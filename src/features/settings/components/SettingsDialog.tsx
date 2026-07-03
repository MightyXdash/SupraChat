import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Download, RefreshCcw, Trash2, Upload, X } from "lucide-react"
import { useConfirmationDialog } from "@/app/components/ConfirmationDialog"
import { settingsTabs, type SettingsTabId } from "@/features/settings/config/settings-tabs"
import { SettingsBadge, SettingsPath, SettingsRangeControl, SettingsSegmentedControl, SettingsToggle } from "@/features/settings/components/SettingsControl"
import { SettingsNav } from "@/features/settings/components/SettingsNav"
import { SettingsRow } from "@/features/settings/components/SettingsRow"
import { SettingsSection } from "@/features/settings/components/SettingsSection"
import {
  customHyperparameters,
  getHyperparameterPresetId,
  hyperparameterPresets,
  type HyperparameterPresetId,
} from "@/features/chat/config/hyperparameters"
import { chatRuntimeConfig } from "@/features/chat/config/runtime"
import {
  exportConversationData,
  fetchSettingsModels,
  fetchSettingsStorage,
  importConversationData,
  type SettingsModelsPayload,
  type SettingsStoragePayload,
} from "@/features/settings/services/settings-service"
import { useChatStore } from "@/features/chat/store/use-chat-store"
import { useSettingsStore } from "@/features/settings/store/use-settings-store"
import {
  checkForUpdatesNow,
  installDownloadedUpdate,
  setConfirmExperimentalInstall as persistConfirmExperimentalInstall,
  setUpdateTrack as persistUpdateTrack,
} from "@/features/updates/services/update-service"
import { useUpdaterStore } from "@/features/updates/store/use-updater-store"
import type { UpdateTrack } from "@/features/updates/types"
import { cn } from "@/lib/utils"

type SettingsDialogProps = {
  isOpen: boolean
  onClose: () => void
}

type SettingsDataState = {
  error: string | null
  isLoading: boolean
  models: SettingsModelsPayload | null
  storage: SettingsStoragePayload | null
}

type HyperparameterPresetControlId = HyperparameterPresetId | "custom"

function formatBytes(value: number | null | undefined) {
  if (!value) {
    return "Not available"
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 1024 * 1024 * 1024 ? 1 : 0,
    style: "unit",
    unit: value >= 1024 * 1024 * 1024 ? "gigabyte" : "megabyte",
    unitDisplay: "short",
  }).format(value / (value >= 1024 * 1024 * 1024 ? 1024 * 1024 * 1024 : 1024 * 1024))
}

function formatModelSize(sizeBytes: number | null, approximateSizeMb?: number) {
  if (sizeBytes) {
    return formatBytes(sizeBytes)
  }

  if (approximateSizeMb) {
    return `Approx. ${formatBytes(approximateSizeMb * 1024 * 1024)}`
  }

  return "Size not available"
}

function statusTone(ok?: boolean) {
  return ok ? "success" : "warning"
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general")
  const [pendingExperimentalTrack, setPendingExperimentalTrack] = useState<UpdateTrack | null>(null)
  const [dataState, setDataState] = useState<SettingsDataState>({
    error: null,
    isLoading: false,
    models: null,
    storage: null,
  })
  const [isDeletingAllChats, setIsDeletingAllChats] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isExportingChats, setIsExportingChats] = useState(false)
  const [isImportingChats, setIsImportingChats] = useState(false)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const { confirm, confirmationDialog } = useConfirmationDialog()
  const activeTabDefinition = useMemo(
    () => settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0],
    [activeTab],
  )
  const localTabs = useMemo(() => settingsTabs.filter((tab) => tab.group === "Local"), [])
  const autoTitleConversations = useSettingsStore((state) => state.autoTitleConversations)
  const confirmExperimentalInstall = useSettingsStore((state) => state.confirmExperimentalInstall)
  const confirmConversationDeletion = useSettingsStore((state) => state.confirmConversationDeletion)
  const deleteAllConversations = useChatStore((state) => state.deleteAllConversations)
  const reloadConversations = useChatStore((state) => state.reloadConversations)
  const hyperparameters = useSettingsStore((state) => state.hyperparameters)
  const showAverageTps = useSettingsStore((state) => state.showAverageTps)
  const showContextMeter = useSettingsStore((state) => state.showContextMeter)
  const startWithLastConversation = useSettingsStore((state) => state.startWithLastConversation)
  const streamingTpsCap = useSettingsStore((state) => state.streamingTpsCap)
  const themePreference = useSettingsStore((state) => state.themePreference)
  const updateTrack = useSettingsStore((state) => state.updateTrack)
  const setAutoTitleConversations = useSettingsStore((state) => state.setAutoTitleConversations)
  const setConfirmExperimentalInstall = useSettingsStore((state) => state.setConfirmExperimentalInstall)
  const setConfirmConversationDeletion = useSettingsStore((state) => state.setConfirmConversationDeletion)
  const setHyperparameters = useSettingsStore((state) => state.setHyperparameters)
  const setShowAverageTps = useSettingsStore((state) => state.setShowAverageTps)
  const setShowContextMeter = useSettingsStore((state) => state.setShowContextMeter)
  const setStartWithLastConversation = useSettingsStore((state) => state.setStartWithLastConversation)
  const setStreamingTpsCap = useSettingsStore((state) => state.setStreamingTpsCap)
  const setThemePreference = useSettingsStore((state) => state.setThemePreference)
  const setUpdateTrack = useSettingsStore((state) => state.setUpdateTrack)
  const setUpdaterStatus = useUpdaterStore((state) => state.setStatus)
  const updaterStatus = useUpdaterStore((state) => state.status)
  const experimentalConfirmationLocked = updateTrack === "final"
  const activeHyperparameterPresetId = getHyperparameterPresetId(hyperparameters)
  const hyperparameterPresetControlValue: HyperparameterPresetControlId =
    activeHyperparameterPresetId ?? "custom"

  function handleHyperparameterPresetChange(presetId: HyperparameterPresetControlId) {
    if (presetId === "custom") {
      setHyperparameters({ ...customHyperparameters })
      return
    }

    const preset = hyperparameterPresets.find((candidate) => candidate.id === presetId)

    if (preset) {
      setHyperparameters({ ...preset.values })
    }
  }

  async function applyUpdateTrack(nextTrack: UpdateTrack) {
    setUpdateTrack(nextTrack)

    if (nextTrack === "final") {
      setConfirmExperimentalInstall(true)
    }

    const nextPreferences = await persistUpdateTrack(nextTrack)
    setUpdateTrack(nextPreferences.updateTrack)
    setConfirmExperimentalInstall(nextPreferences.confirmExperimentalInstall)
  }

  async function handleUpdateTrackChange(nextTrack: UpdateTrack) {
    if (nextTrack !== "final" && nextTrack !== updateTrack) {
      setPendingExperimentalTrack(nextTrack)
      return
    }

    await applyUpdateTrack(nextTrack)
  }

  async function handleExperimentalInstallPreferenceChange(checked: boolean) {
    if (experimentalConfirmationLocked) {
      return
    }

    setConfirmExperimentalInstall(checked)
    const nextPreferences = await persistConfirmExperimentalInstall(checked)
    setConfirmExperimentalInstall(nextPreferences.confirmExperimentalInstall)
  }

  async function handleCheckForUpdates() {
    if (isCheckingUpdates) {
      return
    }

    setIsCheckingUpdates(true)

    try {
      const nextStatus = await checkForUpdatesNow()
      setUpdaterStatus(nextStatus)
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  async function applyExperimentalTrackSelection(nextTrack: UpdateTrack) {
    setPendingExperimentalTrack(null)
    await applyUpdateTrack(nextTrack)
  }

  async function handleInstallUpdate() {
    if (isInstallingUpdate || updaterStatus.state !== "downloaded") {
      return
    }

    if (updateTrack !== "final" && confirmExperimentalInstall) {
      const shouldInstallExperimentalUpdate = await confirm({
        body: "Experimental updates can change more often and may be less stable.",
        confirmLabel: "Install",
        title: "Install experimental build?",
        tone: "warning",
      })

      if (!shouldInstallExperimentalUpdate) {
        return
      }
    }

    setIsInstallingUpdate(true)

    try {
      await installDownloadedUpdate()
    } finally {
      setIsInstallingUpdate(false)
    }
  }

  async function loadSettingsData() {
    setDataState((current) => ({ ...current, error: null, isLoading: true }))

    try {
      const [models, storage] = await Promise.all([
        fetchSettingsModels(),
        fetchSettingsStorage(),
      ])

      setDataState({
        error: null,
        isLoading: false,
        models,
        storage,
      })
    } catch (error) {
      setDataState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to load settings information.",
        isLoading: false,
      }))
    }
  }

  async function handleDeleteAllChats() {
    if (isDeletingAllChats) {
      return
    }

    const shouldDelete = await confirm({
      body: "This removes all saved conversations and messages from this device.",
      confirmLabel: "Delete all",
      title: "Delete all saved chats?",
      tone: "danger",
    })

    if (!shouldDelete) {
      return
    }

    setIsDeletingAllChats(true)

    try {
      const deleted = await deleteAllConversations()

      if (deleted) {
        await loadSettingsData()
      }
    } finally {
      setIsDeletingAllChats(false)
    }
  }

  async function handleExportChats() {
    if (isExportingChats) {
      return
    }

    setIsExportingChats(true)

    try {
      const payload = await exportConversationData()
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const date = new Date().toISOString().slice(0, 10)

      anchor.href = url
      anchor.download = `suprachat-conversations-${date}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setDataState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to export conversations.",
      }))
    } finally {
      setIsExportingChats(false)
    }
  }

  async function handleImportChats(file: File | null) {
    if (!file || isImportingChats) {
      return
    }

    const shouldImport = await confirm({
      body: "Matching conversation IDs will be replaced. Other saved conversations will remain on this device.",
      confirmLabel: "Import",
      title: "Import conversations?",
      tone: "warning",
    })

    if (!shouldImport) {
      return
    }

    setIsImportingChats(true)

    try {
      const parsed = JSON.parse(await file.text())
      await importConversationData(parsed)
      await reloadConversations()
      await loadSettingsData()
    } catch (error) {
      setDataState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to import conversations.",
      }))
    } finally {
      setIsImportingChats(false)

      if (importInputRef.current) {
        importInputRef.current.value = ""
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadSettingsData()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
    <AnimatePresence>
      {isOpen ? (
        <div className="settings-layer" role="presentation">
          <motion.button
            className="settings-backdrop"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={{ opacity: 0, scale: 1.11 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.11 }}
            transition={{ duration: 0.64, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence>
              {pendingExperimentalTrack ? (
                <motion.div
                  className="settings-inline-warning-shell"
                  role="presentation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <motion.div
                    className="settings-inline-warning-card"
                    role="alertdialog"
                    aria-modal="true"
                    aria-label="Experimental updates warning"
                    initial={{ opacity: 0, scale: 1.16 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.14 }}
                    transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="settings-inline-warning-copy">
                      <h3>Experimental builds may be unstable.</h3>
                      <p>We recommend the Final installation option for most users.</p>
                    </div>
                    <div className="settings-inline-warning-actions">
                      <button
                        className="settings-secondary-button"
                        type="button"
                        onClick={() => setPendingExperimentalTrack(null)}
                      >
                        Keep Final
                      </button>
                      <button
                        className="settings-secondary-button"
                        type="button"
                        onClick={() => void applyExperimentalTrackSelection(pendingExperimentalTrack)}
                      >
                        I know what I am doing
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <aside className="settings-sidebar">
              <div className="settings-sidebar-header">
                <button className="settings-icon-button" type="button" aria-label="Close settings" onClick={onClose}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SettingsNav activeTab={activeTab} onChange={setActiveTab} />
              <div className="settings-sidebar-local-nav" aria-label="Local settings">
                {localTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={cn("settings-nav-item", activeTab === tab.id && "settings-nav-item-active")}
                    type="button"
                    aria-label={tab.label}
                    title={tab.label}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <tab.icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </aside>

            <div className="settings-content">
              <header className="settings-content-header">
                <div>
                  <h2>{activeTabDefinition.label}</h2>
                </div>
                <button
                  className="settings-icon-button settings-refresh-icon-button"
                  type="button"
                  aria-label="Refresh settings"
                  onClick={() => void loadSettingsData()}
                  disabled={dataState.isLoading}
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>

              {dataState.error ? (
                <div className="settings-status-panel" role="status">
                  {dataState.error}
                </div>
              ) : null}

              <div className="settings-content-scroll scrollbar-reveal">
                {activeTab === "general" ? (
                  <>
                    <SettingsSection title="Workspace" description="Choose how SupraChat behaves during normal use.">
                      <SettingsRow label="Start with last conversation" description="Restore the last active conversation when possible.">
                        <SettingsToggle
                          aria-label="Start with last conversation"
                          checked={startWithLastConversation}
                          onChange={setStartWithLastConversation}
                        />
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection title="Conversation Controls">
                      <SettingsRow label="Auto-title conversations" description="Conversation titles are generated locally with the bundled title model.">
                        <SettingsToggle
                          aria-label="Auto-title conversations"
                          checked={autoTitleConversations}
                          title="Generate a name for the chat thread automatically using AI"
                          onChange={setAutoTitleConversations}
                        />
                      </SettingsRow>
                      <SettingsRow label="Delete confirmation" description="Conversation deletion currently uses a native confirmation prompt.">
                        <SettingsToggle
                          aria-label="Delete confirmation"
                          checked={confirmConversationDeletion}
                          onChange={setConfirmConversationDeletion}
                        />
                      </SettingsRow>
                    </SettingsSection>
                  </>
                ) : null}

                {activeTab === "appearance" ? (
                  <>
                    <SettingsSection title="Theme" description="Theme preference is stored locally and follows the system by default.">
                      <SettingsRow label="Theme">
                        <SettingsSegmentedControl
                          aria-label="Theme"
                          value={themePreference}
                          options={[
                            { label: "System", value: "system" },
                            { label: "Light", value: "light" },
                            { label: "Dark", value: "dark" },
                          ]}
                          onChange={setThemePreference}
                        />
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection title="Display">
                      <SettingsRow label="Show context meter">
                        <SettingsToggle
                          aria-label="Show context meter"
                          checked={showContextMeter}
                          onChange={setShowContextMeter}
                        />
                      </SettingsRow>
                      <SettingsRow label="Show average TPS" description="Display the average token throughput for the latest response.">
                        <SettingsToggle
                          aria-label="Show average TPS"
                          checked={showAverageTps}
                          onChange={setShowAverageTps}
                        />
                      </SettingsRow>
                      <SettingsRow label="Streaming TPS cap" description="Limits the visible response reveal. The composer still reports actual runtime TPS.">
                        <SettingsRangeControl
                          aria-label="Streaming TPS cap"
                          max={chatRuntimeConfig.stream.maximumVisibleTokensPerSecondCap}
                          min={chatRuntimeConfig.stream.minimumVisibleTokensPerSecondCap}
                          step={10}
                          unit="t/s"
                          value={streamingTpsCap}
                          onChange={setStreamingTpsCap}
                        />
                      </SettingsRow>
                    </SettingsSection>
                  </>
                ) : null}

                {activeTab === "updates" ? (
                  <>
                    <SettingsSection
                      title="Release Channel"
                      description="Final releases remain selected by default. Experimental tracks require explicit opt-in."
                    >
                      <SettingsRow label="Update track">
                        <SettingsSegmentedControl
                          aria-label="Update track"
                          value={updateTrack}
                          options={[
                            { label: "Final", value: "final" },
                            { label: "Beta", value: "beta" },
                            { label: "Alpha", value: "alpha" },
                            { label: "Developer Alpha", value: "dalpha" },
                          ]}
                          onChange={(value) => void handleUpdateTrackChange(value)}
                        />
                      </SettingsRow>
                      <SettingsRow
                        label="Ask me before installing experimental updates"
                        description="Experimental builds remain optional and require an extra confirmation before install."
                      >
                        <SettingsToggle
                          aria-label="Ask before installing experimental updates"
                          checked={confirmExperimentalInstall}
                          disabled={experimentalConfirmationLocked}
                          onChange={(checked) => void handleExperimentalInstallPreferenceChange(checked)}
                        />
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection title="Status" description="SupraChat checks GitHub Releases and downloads eligible updates in the background.">
                      <SettingsRow label="Current version">
                        <SettingsBadge>{updaterStatus.currentVersion}</SettingsBadge>
                      </SettingsRow>
                      <SettingsRow label="Updater status">
                        <SettingsBadge tone={updaterStatus.state === "error" ? "error" : "neutral"}>
                          {updaterStatus.state.replace(/-/g, " ")}
                        </SettingsBadge>
                      </SettingsRow>
                      <SettingsRow label="Available version">
                        <SettingsBadge>{updaterStatus.availableVersion ?? "None"}</SettingsBadge>
                      </SettingsRow>
                      <SettingsRow label="Last checked">
                        <SettingsBadge>{updaterStatus.checkedAt ? new Date(updaterStatus.checkedAt).toLocaleString() : "Not yet"}</SettingsBadge>
                      </SettingsRow>
                      {updaterStatus.downloadProgress ? (
                        <SettingsRow label="Download progress">
                          <SettingsBadge>{`${Math.round(updaterStatus.downloadProgress.percent)}%`}</SettingsBadge>
                        </SettingsRow>
                      ) : null}
                    </SettingsSection>

                    {updaterStatus.errorMessage && updaterStatus.state === "error" ? (
                      <div className="settings-status-panel" role="status">
                        {updaterStatus.errorMessage}
                      </div>
                    ) : null}

                    <SettingsSection title="Actions">
                      <div className="settings-action-card">
                        <div className="settings-action-row">
                          <button
                            className="settings-secondary-button"
                            type="button"
                            disabled={isCheckingUpdates}
                            onClick={() => void handleCheckForUpdates()}
                          >
                            {isCheckingUpdates ? "Checking" : "Check for Updates"}
                          </button>
                          <button
                            className="settings-primary-button"
                            type="button"
                            disabled={updaterStatus.state !== "downloaded" || isInstallingUpdate}
                            onClick={() => void handleInstallUpdate()}
                          >
                            {isInstallingUpdate ? "Restarting" : "Restart to Install"}
                          </button>
                        </div>
                        <p className="settings-action-note">
                          {updateTrack === "final"
                            ? "Final releases are recommended for most users."
                            : "This track may include less stable builds and requires explicit confirmation before install."}
                        </p>
                      </div>
                    </SettingsSection>
                  </>
                ) : null}

                {activeTab === "models" ? (
                  <SettingsSection title="Bundled Models" description={`Resource root: ${dataState.models?.resourceRoot ?? "Loading"}`}>
                    {(dataState.models?.models ?? []).map((model) => (
                      <SettingsRow
                        key={model.id}
                        label={model.label}
                        description={`${model.role.toUpperCase()} · ${model.provider} · ${formatModelSize(model.sizeBytes, model.approximateSizeMb)}`}
                      >
                        <SettingsBadge tone={model.installed ? "success" : "warning"}>
                          {model.installed ? "Installed" : "Missing"}
                        </SettingsBadge>
                      </SettingsRow>
                    ))}
                    {!dataState.models?.models.length ? (
                      <div className="settings-status-panel">Model information is loading.</div>
                    ) : null}
                  </SettingsSection>
                ) : null}

                {activeTab === "hyperparameters" ? (
                  <SettingsSection
                    title="Hyperparameters"
                    description="Control how the active model generates responses. These values are sent with every chat request."
                  >
                    <SettingsRow
                      label="Preset"
                    >
                      <div className="settings-inline-control-group">
                        <SettingsSegmentedControl<HyperparameterPresetControlId>
                          aria-label="Hyperparameter preset"
                          value={hyperparameterPresetControlValue}
                          options={[
                            ...hyperparameterPresets.map((preset) => ({
                              label: preset.label,
                              value: preset.id,
                            })),
                            { label: "Custom", value: "custom" },
                          ]}
                          onChange={handleHyperparameterPresetChange}
                        />
                      </div>
                    </SettingsRow>
                    <SettingsRow
                      label="Temperature"
                      description="Controls randomness. Lower values produce more deterministic responses."
                    >
                      <SettingsRangeControl
                        aria-label="Temperature"
                        max={2}
                        min={0}
                        step={0.05}
                        value={hyperparameters.temperature}
                        onChange={(value) => setHyperparameters({ ...hyperparameters, temperature: value })}
                      />
                    </SettingsRow>
                    <SettingsRow
                      label="Top K"
                      description="Limits the vocabulary to the K most likely next tokens."
                    >
                      <SettingsRangeControl
                        aria-label="Top K"
                        max={200}
                        min={1}
                        step={1}
                        value={hyperparameters.topK}
                        onChange={(value) => setHyperparameters({ ...hyperparameters, topK: value })}
                      />
                    </SettingsRow>
                    <SettingsRow
                      label="Top P"
                      description="Nucleus sampling threshold. Tokens with cumulative probability above P are considered."
                    >
                      <SettingsRangeControl
                        aria-label="Top P"
                        max={1}
                        min={0}
                        step={0.05}
                        value={hyperparameters.topP}
                        onChange={(value) => setHyperparameters({ ...hyperparameters, topP: value })}
                      />
                    </SettingsRow>
                    <SettingsRow
                      label="Repeat Penalty"
                      description="Penalizes repeating token sequences. Higher values reduce repetition."
                    >
                      <SettingsRangeControl
                        aria-label="Repeat Penalty"
                        max={2}
                        min={0}
                        step={0.05}
                        value={hyperparameters.repeatPenalty}
                        onChange={(value) => setHyperparameters({ ...hyperparameters, repeatPenalty: value })}
                      />
                    </SettingsRow>
                    <SettingsRow
                      label="Max Tokens"
                      description="Maximum number of tokens the model can generate in a single response."
                    >
                      <SettingsRangeControl
                        aria-label="Max Tokens"
                        max={16384}
                        min={16}
                        step={64}
                        value={hyperparameters.maxTokens}
                        onChange={(value) => setHyperparameters({ ...hyperparameters, maxTokens: value })}
                      />
                    </SettingsRow>
                  </SettingsSection>
                ) : null}

                {activeTab === "data" ? (
                  <>
                    <SettingsSection title="Local Storage" description="Conversation data is stored on this device.">
                      <SettingsRow label="Data folder">
                        <SettingsPath value={dataState.storage?.dataDir ?? "Loading"} />
                      </SettingsRow>
                      <SettingsRow label="Database">
                        <SettingsPath value={dataState.storage?.databasePath ?? "Loading"} />
                      </SettingsRow>
                      <SettingsRow label="Database size">
                        <SettingsBadge>{formatBytes(dataState.storage?.databaseSizeBytes)}</SettingsBadge>
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection title="Conversation Data">
                      <SettingsRow label="Conversations">
                        <SettingsBadge>{String(dataState.storage?.stats.conversationCount ?? 0)}</SettingsBadge>
                      </SettingsRow>
                      <SettingsRow label="Messages">
                        <SettingsBadge>{String(dataState.storage?.stats.messageCount ?? 0)}</SettingsBadge>
                      </SettingsRow>
                      <SettingsRow label="Export conversations" description="Save a copy of all conversations as a JSON file.">
                        <button
                          className="settings-secondary-button"
                          type="button"
                          onClick={() => void handleExportChats()}
                          disabled={isExportingChats}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          {isExportingChats ? "Exporting" : "Export"}
                        </button>
                      </SettingsRow>
                      <SettingsRow label="Import conversations" description="Merge conversations from a SupraChat JSON export.">
                        <button
                          className="settings-primary-button"
                          type="button"
                          onClick={() => importInputRef.current?.click()}
                          disabled={isImportingChats}
                        >
                          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                          {isImportingChats ? "Importing" : "Import"}
                        </button>
                        <input
                          ref={importInputRef}
                          accept="application/json,.json"
                          className="sr-only"
                          type="file"
                          onChange={(event) => void handleImportChats(event.currentTarget.files?.[0] ?? null)}
                        />
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection title="Danger">
                      <SettingsRow label="Delete all chats" description="Remove all saved conversations and messages from this device.">
                        <button
                          className="settings-danger-button"
                          type="button"
                          onClick={() => void handleDeleteAllChats()}
                          disabled={isDeletingAllChats}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {isDeletingAllChats ? "Deleting" : "Delete all chats"}
                        </button>
                      </SettingsRow>
                    </SettingsSection>
                  </>
                ) : null}
              </div>
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
    {confirmationDialog}
    </>
  )
}
