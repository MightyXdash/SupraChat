import type { UpdatePreferences, UpdateStatus, UpdateTrack } from "@/features/updates/types"

type UpdaterBridge = NonNullable<typeof window.suprachat>["updater"]

function getUpdaterBridge(): UpdaterBridge | null {
  return window.suprachat?.updater ?? null
}

export async function fetchUpdatePreferences(): Promise<UpdatePreferences> {
  const updater = getUpdaterBridge()

  if (!updater) {
    return {
      confirmExperimentalInstall: true,
      updateTrack: "final",
    }
  }

  return updater.getPreferences()
}

export async function fetchUpdateStatus(): Promise<UpdateStatus> {
  const updater = getUpdaterBridge()

  if (!updater) {
    return {
      availableVersion: null,
      checkedAt: null,
      currentVersion: "0.0.0",
      downloadProgress: null,
      errorMessage: "Updates unavailable.",
      releaseNotes: null,
      state: "disabled",
      track: "final",
    }
  }

  return updater.getStatus()
}

export async function setUpdateTrack(track: UpdateTrack) {
  const updater = getUpdaterBridge()

  if (!updater) {
    return {
      confirmExperimentalInstall: true,
      updateTrack: track,
    }
  }

  return updater.setTrack(track)
}

export async function setConfirmExperimentalInstall(confirmExperimentalInstall: boolean) {
  const updater = getUpdaterBridge()

  if (!updater) {
    return {
      confirmExperimentalInstall,
      updateTrack: "final" as UpdateTrack,
    }
  }

  return updater.setConfirmExperimentalInstall(confirmExperimentalInstall)
}

export async function checkForUpdatesNow() {
  const updater = getUpdaterBridge()

  if (!updater) {
    return fetchUpdateStatus()
  }

  return updater.checkNow()
}

export async function installDownloadedUpdate() {
  const updater = getUpdaterBridge()

  if (!updater) {
    return false
  }

  return updater.installNow()
}

export async function dismissReadyUpdateState() {
  const updater = getUpdaterBridge()

  if (!updater) {
    return fetchUpdateStatus()
  }

  return updater.dismissReadyState()
}

export function subscribeToUpdateStatus(listener: (status: UpdateStatus) => void) {
  const updater = getUpdaterBridge()

  if (!updater) {
    return () => undefined
  }

  return updater.onStatus(listener)
}
