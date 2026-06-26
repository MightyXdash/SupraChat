"use strict"

const { app, BrowserWindow, ipcMain } = require("electron")
const { EventEmitter } = require("node:events")
const path = require("node:path")
const { autoUpdater } = require("electron-updater")
const { fetchGitHubReleases } = require("./github-releases.cjs")
const { getReleaseConfig } = require("./release-config.cjs")
const { selectReleaseCandidate } = require("./release-selector.cjs")
const { UpdateStore, DEFAULT_PREFERENCES } = require("./update-store.cjs")

const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24
const STARTUP_CHECK_DELAY_MS = 4000

function createDefaultStatus() {
  return {
    availableVersion: null,
    checkedAt: null,
    currentVersion: app.getVersion(),
    downloadProgress: null,
    errorMessage: null,
    isReadyDismissed: false,
    releaseNotes: null,
    state: app.isPackaged ? "idle" : "disabled",
    track: DEFAULT_PREFERENCES.updateTrack,
  }
}

function createUnavailableMessage() {
  return "Updates unavailable right now."
}

function toDownloadBaseUrl(candidate) {
  const releaseConfig = getReleaseConfig()
  return `${releaseConfig.baseUrl}/${releaseConfig.owner}/${releaseConfig.repo}/releases/download/${candidate.rawTag}`
}

class UpdateService extends EventEmitter {
  constructor() {
    super()
    this.backgroundMode = {
      active: false,
      closeRequestedAt: null,
      shouldQuitAfterDownload: false,
    }
    this.closeFlowPromise = null
    this.currentCandidate = null
    this.currentCheckPromise = null
    this.forceQuit = false
    this.hasRegisteredIpc = false
    this.hiddenWindowId = null
    this.status = createDefaultStatus()
    this.store = new UpdateStore(path.join(app.getPath("userData"), "updates", "state.json"))
    this.readyDismissedInSession = false
    this.autoUpdaterConfigured = false
    this.preferences = this.store.read().preferences
    this.status.track = this.preferences.updateTrack
  }

  initialize() {
    const persistedState = this.store.read()
    this.preferences =
      persistedState.preferences.updateTrack === "final"
        ? {
            ...persistedState.preferences,
            confirmExperimentalInstall: true,
          }
        : persistedState.preferences

    if (this.preferences.confirmExperimentalInstall !== persistedState.preferences.confirmExperimentalInstall) {
      this.store.update((state) => ({
        ...state,
        preferences: this.preferences,
      }))
    }

    this.status = {
      ...createDefaultStatus(),
      checkedAt: persistedState.cache.lastCheckedAt,
      track: this.preferences.updateTrack,
    }

    if (!this.hasRegisteredIpc) {
      this.registerIpc()
      this.hasRegisteredIpc = true
    }

    this.configureAutoUpdater()
    this.scheduleStartupCheck()
  }

  configureAutoUpdater() {
    if (this.autoUpdaterConfigured) {
      return
    }

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = console

    autoUpdater.on("checking-for-update", () => {
      this.updateStatus({
        downloadProgress: null,
        errorMessage: null,
        isReadyDismissed: false,
        state: "checking",
      })
    })

    autoUpdater.on("update-available", () => {
      this.updateStatus({
        availableVersion: this.currentCandidate?.parsedVersion.version ?? null,
        errorMessage: null,
        isReadyDismissed: false,
        releaseNotes: this.currentCandidate?.body ?? null,
        state: "update-available",
      })
    })

    autoUpdater.on("update-not-available", () => {
      if (this.status.state === "downloaded") {
        return
      }

      this.updateStatus({
        availableVersion: null,
        checkedAt: new Date().toISOString(),
        downloadProgress: null,
        errorMessage: null,
        releaseNotes: null,
        state: "up-to-date",
      })
    })

    autoUpdater.on("download-progress", (progress) => {
      this.updateStatus({
        downloadProgress: {
          bytesPerSecond: progress.bytesPerSecond,
          percent: progress.percent,
          total: progress.total,
          transferred: progress.transferred,
        },
        errorMessage: null,
        state: "downloading",
      })
    })

    autoUpdater.on("update-downloaded", () => {
      const pendingUpdate = this.currentCandidate
        ? {
            downloadedAt: new Date().toISOString(),
            tag: this.currentCandidate.rawTag,
            track: this.preferences.updateTrack,
            version: this.currentCandidate.parsedVersion.version,
          }
        : null

      this.store.update((state) => ({
        ...state,
        pendingUpdate,
      }))

      this.readyDismissedInSession = false
      this.updateStatus({
        availableVersion: this.currentCandidate?.parsedVersion.version ?? this.status.availableVersion,
        checkedAt: new Date().toISOString(),
        downloadProgress: {
          bytesPerSecond: 0,
          percent: 100,
          total: this.status.downloadProgress?.total ?? 0,
          transferred: this.status.downloadProgress?.total ?? 0,
        },
        errorMessage: null,
        isReadyDismissed: false,
        releaseNotes: this.currentCandidate?.body ?? this.status.releaseNotes,
        state: "downloaded",
      })

      if (this.backgroundMode.shouldQuitAfterDownload) {
        this.forceQuit = true
        app.quit()
      }
    })

    autoUpdater.on("error", () => {
      this.updateStatus({
        checkedAt: new Date().toISOString(),
        downloadProgress: null,
        errorMessage: createUnavailableMessage(),
        state: "error",
      })

      if (this.backgroundMode.active && this.backgroundMode.shouldQuitAfterDownload) {
        this.forceQuit = true
        app.quit()
      }
    })

    this.autoUpdaterConfigured = true
  }

  registerIpc() {
    ipcMain.handle("updates:get-preferences", () => this.getPreferences())
    ipcMain.handle("updates:get-status", () => this.getStatus())
    ipcMain.handle("updates:set-track", async (_event, track) => {
      this.setTrack(track)
      await this.checkForUpdates({ force: true, reason: "track-change" })
      return this.getPreferences()
    })
    ipcMain.handle("updates:set-confirm-experimental-install", (_event, confirm) => {
      this.setConfirmExperimentalInstall(Boolean(confirm))
      return this.getPreferences()
    })
    ipcMain.handle("updates:check-now", async () => this.checkForUpdates({ force: true, reason: "manual" }))
    ipcMain.handle("updates:install-now", async () => this.installNow())
    ipcMain.handle("updates:dismiss-ready-state", () => {
      this.dismissReadyState()
      return this.getStatus()
    })
  }

  scheduleStartupCheck() {
    if (!app.isPackaged) {
      this.updateStatus({
        checkedAt: null,
        errorMessage: "Updates unavailable in development builds.",
        state: "disabled",
      })
      return
    }

    setTimeout(() => {
      void this.checkForUpdates({ reason: "startup" })
    }, STARTUP_CHECK_DELAY_MS)
  }

  getPreferences() {
    return {
      ...this.preferences,
    }
  }

  getStatus() {
    return {
      ...this.status,
      isReadyDismissed: this.readyDismissedInSession,
      track: this.preferences.updateTrack,
    }
  }

  setTrack(track) {
    const normalizedTrack = ["final", "beta", "alpha", "dalpha"].includes(track) ? track : "final"
    this.preferences = this.store.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        confirmExperimentalInstall:
          normalizedTrack === "final" ? true : state.preferences.confirmExperimentalInstall,
        updateTrack: normalizedTrack,
      },
    })).preferences

    this.readyDismissedInSession = false
    this.updateStatus({
      isReadyDismissed: false,
      track: normalizedTrack,
    })
  }

  setConfirmExperimentalInstall(confirmExperimentalInstall) {
    this.preferences = this.store.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        confirmExperimentalInstall:
          state.preferences.updateTrack === "final" ? true : confirmExperimentalInstall,
      },
    })).preferences
  }

  dismissReadyState() {
    this.readyDismissedInSession = true
    this.broadcastStatus()
  }

  updateStatus(partialStatus) {
    this.status = {
      ...this.status,
      ...partialStatus,
      currentVersion: app.getVersion(),
      track: this.preferences.updateTrack,
    }

    this.broadcastStatus()
  }

  broadcastStatus() {
    const payload = this.getStatus()

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("updates:status", payload)
    }
  }

  async checkForUpdates({ force = false, reason = "manual" } = {}) {
    if (!app.isPackaged) {
      this.updateStatus({
        checkedAt: null,
        errorMessage: "Updates unavailable in development builds.",
        state: "disabled",
      })
      return this.getStatus()
    }

    if (this.currentCheckPromise) {
      return this.currentCheckPromise
    }

    const runCheck = async () => {
      const persistedState = this.store.read()
      const lastCheckedAt = persistedState.cache.lastCheckedAt

      if (!force && lastCheckedAt && !persistedState.pendingUpdate) {
        const elapsed = Date.now() - new Date(lastCheckedAt).getTime()

        if (elapsed < CHECK_INTERVAL_MS && reason !== "close") {
          this.updateStatus({
            checkedAt: lastCheckedAt,
          })
          return this.getStatus()
        }
      }

      this.updateStatus({
        checkedAt: lastCheckedAt,
        downloadProgress: null,
        errorMessage: null,
        state: "checking",
      })

      const releaseResult = await fetchGitHubReleases(persistedState.cache)

      if (releaseResult.status === "disabled") {
        this.store.update((state) => ({
          ...state,
          cache: {
            ...state.cache,
            lastCheckedAt: new Date().toISOString(),
          },
        }))

        this.currentCandidate = null
        this.updateStatus({
          checkedAt: new Date().toISOString(),
          downloadProgress: null,
          errorMessage: createUnavailableMessage(),
          releaseNotes: null,
          state: "disabled",
        })
        return this.getStatus()
      }

      if (releaseResult.status === "error") {
        this.updateStatus({
          checkedAt: new Date().toISOString(),
          downloadProgress: null,
          errorMessage: createUnavailableMessage(),
          releaseNotes: null,
          state: "error",
        })
        return this.getStatus()
      }

      this.store.update((state) => ({
        ...state,
        cache: releaseResult.cacheState,
      }))

      const selection = selectReleaseCandidate(
        releaseResult.releases,
        app.getVersion(),
        this.preferences.updateTrack,
      )

      if (!selection.candidate) {
        this.currentCandidate = null
        this.store.update((state) => ({
          ...state,
          pendingUpdate: null,
        }))
        this.updateStatus({
          availableVersion: null,
          checkedAt: releaseResult.cacheState.lastCheckedAt ?? new Date().toISOString(),
          downloadProgress: null,
          errorMessage: null,
          releaseNotes: null,
          state: "up-to-date",
        })
        return this.getStatus()
      }

      this.currentCandidate = selection.candidate
      this.readyDismissedInSession = false
      autoUpdater.setFeedURL({
        channel: "latest",
        provider: "generic",
        url: toDownloadBaseUrl(selection.candidate),
      })

      await autoUpdater.checkForUpdates()
      this.updateStatus({
        availableVersion: selection.candidate.parsedVersion.version,
        checkedAt: releaseResult.cacheState.lastCheckedAt ?? new Date().toISOString(),
        releaseNotes: selection.candidate.body ?? null,
      })

      return this.getStatus()
    }

    this.currentCheckPromise = runCheck().finally(() => {
      this.currentCheckPromise = null
    })

    return this.currentCheckPromise
  }

  async installNow() {
    const persistedState = this.store.read()

    if (!persistedState.pendingUpdate) {
      return false
    }

    this.forceQuit = true
    autoUpdater.quitAndInstall(false, true)
    return true
  }

  async handleWindowCloseRequest(window) {
    if (this.forceQuit) {
      return { shouldClose: true }
    }

    if (this.backgroundMode.active) {
      this.forceQuit = true
      return { shouldClose: true }
    }

    if (!app.isPackaged) {
      return { shouldClose: true }
    }

    if (this.closeFlowPromise) {
      return this.closeFlowPromise
    }

    const runCloseFlow = async () => {
      if (this.status.state === "downloading") {
        this.enterBackgroundMode(window)
        return { shouldClose: false }
      }

      const status = await this.checkForUpdates({ force: true, reason: "close" })

      if (status.state === "downloaded") {
        this.enterBackgroundMode(window)
        this.forceQuit = true
        return { shouldClose: true }
      }

      if (
        status.state === "checking" ||
        status.state === "update-available" ||
        status.state === "downloading"
      ) {
        this.enterBackgroundMode(window)
        return { shouldClose: false }
      }

      return { shouldClose: true }
    }

    this.closeFlowPromise = runCloseFlow().finally(() => {
      this.closeFlowPromise = null
    })

    return this.closeFlowPromise
  }

  enterBackgroundMode(window) {
    this.backgroundMode = {
      active: true,
      closeRequestedAt: new Date().toISOString(),
      shouldQuitAfterDownload: true,
    }
    this.hiddenWindowId = window.id
    window.hide()
  }

  handleWindowShown(window) {
    if (this.hiddenWindowId === window.id) {
      this.backgroundMode.active = false
      this.backgroundMode.shouldQuitAfterDownload = false
      this.hiddenWindowId = null
    }
  }
}

module.exports = {
  UpdateService,
}
