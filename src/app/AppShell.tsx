import { useEffect, useRef, useState } from "react"
import { useConfirmationDialog } from "@/app/components/ConfirmationDialog"
import { AppSidebar } from "@/app/components/AppSidebar"
import { WindowTitleBar } from "@/app/components/WindowTitleBar"
import {
  applyAppTheme,
  getSystemTheme,
  type AppTheme,
} from "@/app/config/theme"
import { appWindowConfig } from "@/app/config/window"
import { useChatStore } from "@/features/chat/store/use-chat-store"
import { ConversationSearchDialog } from "@/features/chat/components/ConversationSearchDialog"
import { ChatWorkspace } from "@/features/chat/components/ChatWorkspace"
import { useAutoScroll } from "@/features/chat/hooks/useAutoScroll"
import { speechTextFromAssistantMessage } from "@/features/chat/lib/message-content"
import {
  fetchRuntimeChatModels,
  selectRuntimeChatModel,
  synthesizeSpeech,
  type RuntimeChatModel,
} from "@/features/chat/services/chat-service"
import {
  mergeComposerAttachments,
  pickDocumentAttachments,
  pickImageAttachments,
} from "@/features/chat/services/attachment-service"
import { ChatAttachment, ChatMessage, SpeechPlaybackState } from "@/features/chat/types"
import { PlaygroundWorkspace } from "@/features/playground/components/PlaygroundWorkspace"
import { SettingsDialog } from "@/features/settings/components/SettingsDialog"
import { useSettingsStore } from "@/features/settings/store/use-settings-store"
import { UpdateInstallPrompt } from "@/features/updates/components/UpdateInstallPrompt"
import {
  checkForUpdatesNow,
  dismissReadyUpdateState,
  fetchUpdatePreferences,
  fetchUpdateStatus,
  installDownloadedUpdate,
  subscribeToUpdateStatus,
} from "@/features/updates/services/update-service"
import { useUpdaterStore } from "@/features/updates/store/use-updater-store"
import { useVoiceStore } from "@/features/voice/store/use-voice-store"

type AppPanel = "chat" | "playground"

type CachedSpeechClip = {
  url: string
}

let silentSpeechPrimerUrl: string | null = null

function getSilentSpeechPrimerUrl() {
  if (silentSpeechPrimerUrl) {
    return silentSpeechPrimerUrl
  }

  const sampleRate = 16_000
  const sampleCount = 160
  const headerSize = 44
  const dataSize = sampleCount * 2
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeAscii(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, "WAVE")
  writeAscii(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, "data")
  view.setUint32(40, dataSize, true)

  silentSpeechPrimerUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }))
  return silentSpeechPrimerUrl
}

export function AppShell() {
  const [draft, setDraft] = useState("")
  const [draftRevealKey, setDraftRevealKey] = useState(0)
  const [shouldRevealDraft, setShouldRevealDraft] = useState(false)
  const [composerAttachments, setComposerAttachments] = useState<ChatAttachment[]>([])
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<AppPanel>(() => useSettingsStore.getState().defaultWorkspace)

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [runtimeModels, setRuntimeModels] = useState<RuntimeChatModel[]>([])
  const [activeRuntimeModelId, setActiveRuntimeModelId] = useState<string | null>(null)
  const [isLoadingRuntimeModels, setIsLoadingRuntimeModels] = useState(true)
  const [isSelectingRuntimeModel, setIsSelectingRuntimeModel] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [speechPlayback, setSpeechPlayback] = useState<SpeechPlaybackState>({
    currentTime: 0,
    duration: 0,
    isPreparing: false,
    messageId: null,
    pendingMessageId: null,
    status: "idle",
  })
  const [theme, setTheme] = useState<AppTheme>(() => getSystemTheme())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechCacheRef = useRef<Map<string, CachedSpeechClip>>(new Map())
  const speechRequestRef = useRef(0)
  const { confirm, confirmationDialog } = useConfirmationDialog()
  const hasAppliedInitialThemeRef = useRef(false)
  const themeRef = useRef<AppTheme>(theme)
  const conversations = useChatStore((state) => state.conversations)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const initialize = useChatStore((state) => state.initialize)
  const createConversation = useChatStore((state) => state.createConversation)
  const renameConversation = useChatStore((state) => state.renameConversation)
  const regenerateConversationTitle = useChatStore((state) => state.regenerateConversationTitle)
  const regenerateAssistantMessage = useChatStore((state) => state.regenerateAssistantMessage)
  const editUserMessage = useChatStore((state) => state.editUserMessage)
  const deleteConversation = useChatStore((state) => state.deleteConversation)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const stopGeneration = useChatStore((state) => state.stopGeneration)
  const isLoading = useChatStore((state) => state.isLoading)
  const isGenerating = useChatStore((state) => state.isGenerating)
  const generationTokensPerSecond = useChatStore((state) => state.generationTokensPerSecond)
  const error = useChatStore((state) => state.error)
  const confirmExperimentalInstall = useSettingsStore((state) => state.confirmExperimentalInstall)
  const hydrateUpdatePreferences = useSettingsStore((state) => state.hydrateUpdatePreferences)
  const themePreference = useSettingsStore((state) => state.themePreference)
  const setThemePreference = useSettingsStore((state) => state.setThemePreference)
  const updateTrack = useSettingsStore((state) => state.updateTrack)
  const density = useSettingsStore((state) => state.density)
  const frostedSurfaces = useSettingsStore((state) => state.frostedSurfaces)
  const messageFont = useSettingsStore((state) => state.messageFont)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const showAverageTps = useSettingsStore((state) => state.showAverageTps)
  const showContextMeter = useSettingsStore((state) => state.showContextMeter)
  const isInstallingUpdate = useUpdaterStore((state) => state.isInstalling)
  const setHydratedUpdater = useUpdaterStore((state) => state.setHydrated)
  const setInstallingUpdate = useUpdaterStore((state) => state.setInstalling)
  const setUpdaterStatus = useUpdaterStore((state) => state.setStatus)
  const updaterStatus = useUpdaterStore((state) => state.status)
  const voiceState = useVoiceStore((state) => state.voiceState)
  const voiceWaveformData = useVoiceStore((state) => state.waveformData)
  const isVoiceHotkeyActive = useVoiceStore((state) => state.isHotkeyActive)
  const initializeVoice = useVoiceStore((state) => state.initialize)
  const startPttRecording = useVoiceStore((state) => state.startPttRecording)
  const stopPttRecording = useVoiceStore((state) => state.stopPttRecording)
  const finishVoiceRecording = useVoiceStore((state) => state.finishRecording)
  const startVadRecording = useVoiceStore((state) => state.startVadRecording)
  const setHotkeyActive = useVoiceStore((state) => state.setHotkeyActive)
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )
  const latestStreamMessage = activeConversation?.messages[activeConversation.messages.length - 1]
  const streamScrollKey = latestStreamMessage
    ? `${activeConversationId}:${latestStreamMessage.id}:${latestStreamMessage.content.length}`
    : activeConversationId
  const {
    clearSubmitScrollSpace,
    isJumpToLatestVisible,
    scrollLatestUserTurnIntoView,
    scrollRef,
    scrollToLatestTurn,
  } = useAutoScroll({
    isGenerating,
    reduceMotion,
    streamScrollKey,
  })

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    let isMounted = true

    void fetchRuntimeChatModels()
      .then((payload) => {
        if (!isMounted) {
          return
        }

        setRuntimeModels(payload.models)
        setActiveRuntimeModelId(payload.activeModelId)
      })
      .catch((error) => {
        console.error("Unable to load runtime chat models.", error)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRuntimeModels(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void Promise.all([fetchUpdatePreferences(), fetchUpdateStatus()])
      .then(([preferences, status]) => {
        if (!isMounted) {
          return
        }

        hydrateUpdatePreferences(preferences)
        setUpdaterStatus(status)
        setHydratedUpdater(true)
      })
      .catch(() => {
        if (isMounted) {
          setHydratedUpdater(true)
        }
      })

    const unsubscribe = subscribeToUpdateStatus((status) => {
      setUpdaterStatus(status)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [hydrateUpdatePreferences, setHydratedUpdater, setUpdaterStatus])

  useEffect(() => {
    initializeVoice({
      onTranscriptionResult: (text) => {
        const normalizedText = text.trim()

        if (!normalizedText) {
          return
        }

        setVoiceError(null)
        setDraft((current) => {
          if (!current.trim()) {
            return normalizedText
          }

          return `${current}${/\s$/.test(current) ? "" : " "}${normalizedText}`
        })
        setShouldRevealDraft(true)
        setDraftRevealKey((current) => current + 1)
      },
      onError: (error) => {
        setVoiceError(error)
        console.error("Voice transcription error:", error)
      },
    })
  }, [initializeVoice])

  useEffect(() => {
    const appEvents = appWindowConfig.appEvents

    if (!appEvents) {
      return
    }

    const unsubscribeNewConversation = appEvents.onNewConversation(() => {
      void handleCreateConversation()
    })
    const unsubscribeOpenSettings = appEvents.onOpenSettings(() => {
      setIsSettingsOpen(true)
    })
    const unsubscribeCheckUpdates = appEvents.onCheckUpdates(() => {
      void checkForUpdatesNow().then(setUpdaterStatus)
    })

    return () => {
      unsubscribeNewConversation()
      unsubscribeOpenSettings()
      unsubscribeCheckUpdates()
    }
  }, [createConversation, setActiveConversation, setUpdaterStatus])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.code !== "KeyM") {
        return
      }

      if (voiceState === "processing") {
        return
      }

      if (voiceState === "recording") {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setVoiceError(null)
      setHotkeyActive(true)
      startPttRecording()
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.code !== "KeyM") {
        return
      }

      setHotkeyActive(false)
      setVoiceError(null)
      stopPttRecording()
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    window.addEventListener("keyup", handleKeyUp, { capture: true })

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
      window.removeEventListener("keyup", handleKeyUp, { capture: true })
    }
  }, [voiceState, startPttRecording, stopPttRecording, setHotkeyActive])

  useEffect(() => {
    window.suprachat?.startup?.setThemePreference(themePreference)

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)")

    function commitTheme(nextTheme: AppTheme) {
      themeRef.current = nextTheme
      setTheme(nextTheme)
      applyAppTheme(nextTheme)
    }

    function resolveTheme() {
      const nextTheme = themePreference === "system" ? getSystemTheme() : themePreference

      if (!hasAppliedInitialThemeRef.current) {
        hasAppliedInitialThemeRef.current = true
        themeRef.current = nextTheme
        setTheme(nextTheme)
        applyAppTheme(nextTheme)
        return
      }

      if (nextTheme === themeRef.current) {
        return
      }

      commitTheme(nextTheme)
    }

    resolveTheme()

    const shouldListenToSystemTheme = themePreference === "system" && mediaQuery

    if (shouldListenToSystemTheme) {
      mediaQuery.addEventListener("change", resolveTheme)
    }

    return () => {
      if (shouldListenToSystemTheme) {
        mediaQuery.removeEventListener("change", resolveTheme)
      }
    }
  }, [themePreference])

  useEffect(() => {
    const audio = new Audio()
    audio.autoplay = true
    audio.preload = "auto"
    audioRef.current = audio

    function handleTimeUpdate() {
      setSpeechPlayback((current) => ({
        ...current,
        currentTime: audio.currentTime || 0,
      }))
    }

    function handleLoadedMetadata() {
      setSpeechPlayback((current) => ({
        ...current,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }))
    }

    function handleEnded() {
      setSpeechPlayback((current) => ({
        ...current,
        currentTime: 0,
        duration: 0,
        isPreparing: false,
        messageId: null,
        pendingMessageId: null,
        status: "idle",
      }))
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("ended", handleEnded)
      audioRef.current = null
    }
  }, [])

  function toggleTheme() {
    setThemePreference(theme === "light" ? "dark" : "light")
  }

  async function handleSubmit() {
    const message = draft.trim()

    if ((!message && composerAttachments.length === 0) || isGenerating) {
      return
    }

    setDraft("")
    setShouldRevealDraft(false)
    setComposerAttachments([])
    try {
      if (editingMessageId) {
        const messageId = editingMessageId
        setEditingMessageId(null)
        await editUserMessage(messageId, message, composerAttachments)
      } else {
        await sendMessage(message, composerAttachments, { beforeGeneration: scrollLatestUserTurnIntoView })
      }
    } finally {
      clearSubmitScrollSpace()
    }
  }

  function handleEditUserMessage(message: ChatMessage) {
    if (isGenerating) {
      return
    }

    setActivePanel("chat")
    setEditingMessageId(message.id)
    setDraft(message.content)
    setComposerAttachments(message.attachments ?? [])
    setShouldRevealDraft(false)
  }

  function handleCancelEdit() {
    setEditingMessageId(null)
    setDraft("")
    setComposerAttachments([])
    setShouldRevealDraft(false)
  }

  function handleDraftChange(value: string) {
    setShouldRevealDraft(false)
    setDraft(value)
  }

  async function handleAddDocuments() {
    if (isGenerating) {
      return
    }

    try {
      const attachments = await pickDocumentAttachments()

      if (attachments.length === 0) {
        return
      }

      setComposerAttachments((current) => mergeComposerAttachments(current, attachments))
    } catch (error) {
      console.error("Unable to add documents.", error)
    }
  }

  async function handleAddImages() {
    if (isGenerating) {
      return
    }

    try {
      const attachments = await pickImageAttachments()

      if (attachments.length === 0) {
        return
      }

      setComposerAttachments((current) => mergeComposerAttachments(current, attachments))
    } catch (error) {
      console.error("Unable to add images.", error)
    }
  }

  function handleRemoveComposerAttachment(attachmentId: string) {
    setComposerAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }

  function handleVoiceVadStart() {
    setVoiceError(null)
    startVadRecording()
  }

  function handleVoiceFinish() {
    setVoiceError(null)
    finishVoiceRecording()
  }

  async function playSpeechClip(message: ChatMessage) {
    const text = speechTextFromAssistantMessage(message.content)

    if (!text) {
      return
    }

    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused || !audio.src) {
      const primerUrl = getSilentSpeechPrimerUrl()
      audio.muted = true
      audio.src = primerUrl
      audio.currentTime = 0
      audio.load()
      void audio.play().catch(() => undefined).finally(() => {
        if (audio.src === primerUrl) {
          audio.pause()
          audio.currentTime = 0
          audio.muted = false
        }
      })
    } else {
      audio.muted = false
    }

    const requestId = speechRequestRef.current + 1
    speechRequestRef.current = requestId
    const cacheKey = `${message.id}:${text}`
    const cachedClip = speechCacheRef.current.get(cacheKey)

    setSpeechPlayback((current) => ({
      ...current,
      isPreparing: true,
      messageId: current.status === "idle" ? message.id : current.messageId,
      pendingMessageId: message.id,
      status: current.status === "idle" ? "loading" : current.status,
    }))

    try {
      const resolvedClip = cachedClip ?? await synthesizeSpeech(text).then((result) => {
        const cached = { url: URL.createObjectURL(result.blob) }
        speechCacheRef.current.set(cacheKey, cached)
        return cached
      })

      if (speechRequestRef.current !== requestId) {
        return
      }

      audio.pause()
      audio.muted = false
      audio.autoplay = true
      audio.preload = "auto"
      audio.src = resolvedClip!.url
      audio.currentTime = 0
      audio.load()

      let nextStatus: SpeechPlaybackState["status"] = "playing"

      try {
        await audio.play()
      } catch (error) {
        console.error("Unable to start speech playback automatically.", error)
        nextStatus = "paused"
      }

      setSpeechPlayback((current) => ({
        ...current,
        currentTime: 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : current.duration,
        isPreparing: false,
        messageId: message.id,
        pendingMessageId: null,
        status: nextStatus,
      }))
    } catch (error) {
      if (speechRequestRef.current !== requestId) {
        return
      }

      console.error("Unable to prepare speech playback.", error)
      setSpeechPlayback((current) => ({
        ...current,
        isPreparing: false,
        pendingMessageId: null,
        status: current.messageId ? current.status : "idle",
      }))
    }
  }

  function toggleSpeechPlayback() {
    const audio = audioRef.current

    if (!audio || speechPlayback.status === "idle" || speechPlayback.isPreparing) {
      return
    }

    if (audio.paused) {
      void audio.play()
      setSpeechPlayback((current) => ({ ...current, status: "playing" }))
      return
    }

    audio.pause()
    setSpeechPlayback((current) => ({ ...current, status: "paused" }))
  }

  function stopSpeechPlayback() {
    const audio = audioRef.current
    speechRequestRef.current += 1

    if (audio) {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
    }

    setSpeechPlayback({
      currentTime: 0,
      duration: 0,
      isPreparing: false,
      messageId: null,
      pendingMessageId: null,
      status: "idle",
    })
  }

  function seekSpeechPlayback(value: number) {
    const audio = audioRef.current

    if (!audio || !Number.isFinite(value)) {
      return
    }

    audio.currentTime = value
    setSpeechPlayback((current) => ({ ...current, currentTime: value }))
  }

  async function handleCreateConversation() {
    setActivePanel("chat")
    setEditingMessageId(null)
    setDraft("")
    setComposerAttachments([])
    setShouldRevealDraft(false)
    return createConversation()
  }

  function handleSelectConversation(conversationId: string) {
    setActivePanel("chat")
    setEditingMessageId(null)
    setDraft("")
    setComposerAttachments([])
    setShouldRevealDraft(false)
    setActiveConversation(conversationId)
  }

  async function handleSelectRuntimeModel(modelId: string) {
    if (!modelId || modelId === activeRuntimeModelId || isGenerating) {
      return
    }

    setIsSelectingRuntimeModel(true)

    try {
      const payload = await selectRuntimeChatModel(modelId)
      setActiveRuntimeModelId(payload.activeModelId)
      setRuntimeModels((models) => {
        if (models.some((model) => model.id === payload.model.id)) {
          return models
        }

        return [...models, payload.model]
      })
    } catch (error) {
      console.error("Unable to select runtime chat model.", error)
    } finally {
      setIsSelectingRuntimeModel(false)
    }
  }

  async function handleInstallDownloadedUpdate() {
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

    setInstallingUpdate(true)

    try {
      await installDownloadedUpdate()
    } finally {
      setInstallingUpdate(false)
    }
  }

  async function handleDismissReadyUpdate() {
    const status = await dismissReadyUpdateState()
    setUpdaterStatus(status)
  }

  const activeRuntimeModel = runtimeModels.find((model) => model.id === activeRuntimeModelId) ?? null

  return (
    <main
      className="app-shell min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]"
      data-platform={appWindowConfig.platform}
      data-density={density}
      data-frosted-surfaces={frostedSurfaces}
      data-message-font={messageFont}
      data-reduce-motion={reduceMotion}
      data-sidebar-state={isSidebarCollapsed ? "collapsed" : "expanded"}
    >
      <WindowTitleBar />
      <div
        className="app-shell-grid grid gap-0 max-[780px]:grid-cols-1"
        data-sidebar-state={isSidebarCollapsed ? "collapsed" : "expanded"}
      >
        <AppSidebar
          activePanel={activePanel}
          activeConversationId={activeConversationId}
          collapsed={isSidebarCollapsed}
          conversations={conversations}
          isBusy={isGenerating}
          isLoading={isLoading}
          theme={theme}
          onCreateConversation={handleCreateConversation}
          onDeleteConversation={deleteConversation}
          onRegenerateConversationTitle={regenerateConversationTitle}
          onRenameConversation={renameConversation}
          onSelectConversation={handleSelectConversation}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenPlayground={() => setActivePanel("playground")}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleTheme={toggleTheme}
          onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
        />
        {activePanel === "playground" ? (
          <PlaygroundWorkspace />
        ) : (
          <ChatWorkspace
            conversation={activeConversation}
            draft={draft}
            draftRevealKey={draftRevealKey}
            shouldRevealDraft={shouldRevealDraft}
            editingMessageId={editingMessageId}
            error={voiceError ?? error}
            isGenerating={isGenerating}
            isJumpToLatestVisible={isJumpToLatestVisible}
            generationTokensPerSecond={generationTokensPerSecond}
            composerAttachments={composerAttachments}
            modelSelector={{
              activeModelId: activeRuntimeModelId,
              isLoading: isLoadingRuntimeModels,
              isSelecting: isSelectingRuntimeModel,
              models: runtimeModels,
              onSelectModel: (modelId) => void handleSelectRuntimeModel(modelId),
            }}
            activeRuntimeModel={activeRuntimeModel}
            scrollRef={scrollRef}
            speechPlayback={speechPlayback}
            showAverageTps={showAverageTps}
            showContextMeter={showContextMeter}
            voiceState={voiceState}
            voiceWaveformData={voiceWaveformData}
            hasActiveVoiceHotkey={isVoiceHotkeyActive}
            onCancelEdit={handleCancelEdit}
            onAddDocuments={() => void handleAddDocuments()}
            onAddImages={() => void handleAddImages()}
            onDraftChange={handleDraftChange}
            onEditUserMessage={handleEditUserMessage}
            onRemoveAttachment={handleRemoveComposerAttachment}
            onRegenerateAssistantMessage={regenerateAssistantMessage}
            onSeekSpeech={seekSpeechPlayback}
            onSpeakAssistantMessage={playSpeechClip}
            onStopSpeech={stopSpeechPlayback}
            onStopGeneration={stopGeneration}
            onSubmit={handleSubmit}
            onJumpToLatest={scrollToLatestTurn}
            onToggleSpeech={toggleSpeechPlayback}
            onVoiceVadStart={handleVoiceVadStart}
            onVoiceFinish={handleVoiceFinish}
          />
        )}
      </div>
      <ConversationSearchDialog
        conversations={conversations}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
      />
      <UpdateInstallPrompt
        isInstalling={isInstallingUpdate}
        status={updaterStatus}
        onDismiss={() => void handleDismissReadyUpdate()}
        onInstall={() => void handleInstallDownloadedUpdate()}
      />
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {confirmationDialog}
    </main>
  )
}
