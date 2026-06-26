import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { RefreshCcw, X } from "lucide-react"
import { settingsTabs, type SettingsTabId } from "@/features/settings/config/settings-tabs"
import { SettingsBadge, SettingsPath, SettingsSegmentedControl, SettingsToggle } from "@/features/settings/components/SettingsControl"
import { SettingsNav } from "@/features/settings/components/SettingsNav"
import { SettingsRow } from "@/features/settings/components/SettingsRow"
import { SettingsSection } from "@/features/settings/components/SettingsSection"
import {
  fetchSettingsModels,
  fetchSettingsStorage,
  type SettingsModelsPayload,
  type SettingsStoragePayload,
} from "@/features/settings/services/settings-service"
import { useChatStore } from "@/features/chat/store/use-chat-store"
import { useSettingsStore } from "@/features/settings/store/use-settings-store"
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
  const [dataState, setDataState] = useState<SettingsDataState>({
    error: null,
    isLoading: false,
    models: null,
    storage: null,
  })
  const [isDeletingAllChats, setIsDeletingAllChats] = useState(false)
  const activeTabDefinition = useMemo(
    () => settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0],
    [activeTab],
  )
  const localTabs = useMemo(() => settingsTabs.filter((tab) => tab.group === "Local"), [])
  const autoTitleConversations = useSettingsStore((state) => state.autoTitleConversations)
  const confirmConversationDeletion = useSettingsStore((state) => state.confirmConversationDeletion)
  const deleteAllConversations = useChatStore((state) => state.deleteAllConversations)
  const showAverageTps = useSettingsStore((state) => state.showAverageTps)
  const showContextMeter = useSettingsStore((state) => state.showContextMeter)
  const startWithLastConversation = useSettingsStore((state) => state.startWithLastConversation)
  const themePreference = useSettingsStore((state) => state.themePreference)
  const setAutoTitleConversations = useSettingsStore((state) => state.setAutoTitleConversations)
  const setConfirmConversationDeletion = useSettingsStore((state) => state.setConfirmConversationDeletion)
  const setShowAverageTps = useSettingsStore((state) => state.setShowAverageTps)
  const setShowContextMeter = useSettingsStore((state) => state.setShowContextMeter)
  const setStartWithLastConversation = useSettingsStore((state) => state.setStartWithLastConversation)
  const setThemePreference = useSettingsStore((state) => state.setThemePreference)

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

    const shouldDelete = window.confirm(
      "Delete all saved chats from this device? This action cannot be undone.",
    )

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
    <AnimatePresence>
      {isOpen ? (
        <div className="settings-layer" role="presentation">
          <motion.button
            className="settings-backdrop"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            initial={{
              opacity: 0,
              "--settings-backdrop-blur": "0px",
              "--settings-backdrop-saturate": "1",
            } as CSSProperties}
            animate={{
              opacity: 1,
              "--settings-backdrop-blur": "8px",
              "--settings-backdrop-saturate": "0.96",
            } as CSSProperties}
            exit={{
              opacity: 0,
              "--settings-backdrop-blur": "0px",
              "--settings-backdrop-saturate": "1",
            } as CSSProperties}
            transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={{ opacity: 0, scale: 1.11, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.11, y: 0 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          >
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
                    </SettingsSection>

                    <SettingsSection title="Delete">
                      <div className="settings-danger-section-heading">Delete</div>
                      <div className="settings-section-rows settings-danger-rows">
                        <div className="settings-row settings-danger-row">
                          <div className="settings-row-copy">
                            <span>Delete all chats</span>
                            <p>Remove all saved conversations and messages from this device.</p>
                          </div>
                          <div className="settings-row-control">
                            <button
                              className="settings-danger-button"
                              type="button"
                              onClick={() => void handleDeleteAllChats()}
                              disabled={isDeletingAllChats}
                            >
                              {isDeletingAllChats ? "Deleting" : "Delete all chats"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </SettingsSection>
                  </>
                ) : null}
              </div>
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
