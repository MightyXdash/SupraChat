import { RefObject } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDown } from "lucide-react"
import { ChatBubble } from "@/features/chat/components/ChatBubble"
import { ChatComposer } from "@/features/chat/components/ChatComposer"
import { ModelSelector } from "@/features/chat/components/ModelSelector"
import { chatRuntimeConfig } from "@/features/chat/config/runtime"
import { useScrollVisibility } from "@/features/chat/hooks/useScrollVisibility"
import type { RuntimeChatModel } from "@/features/chat/services/chat-service"
import { ChatAttachment, ChatMessage, Conversation, SpeechPlaybackState } from "@/features/chat/types"

type ChatWorkspaceProps = {
  conversation?: Conversation
  draft: string
  draftRevealKey: number
  shouldRevealDraft: boolean
  editingMessageId: string | null
  error: string | null
  generationTokensPerSecond: number | null
  isGenerating: boolean
  isJumpToLatestVisible: boolean
  composerAttachments: ChatAttachment[]
  activeRuntimeModel: RuntimeChatModel | null
  modelSelector: {
    activeModelId: string | null
    isLoading: boolean
    isSelecting: boolean
    models: RuntimeChatModel[]
    onSelectModel: (modelId: string) => void
  }
  scrollRef: RefObject<HTMLDivElement | null>
  speechPlayback: SpeechPlaybackState
  showAverageTps: boolean
  showContextMeter: boolean
  voiceState: "idle" | "recording" | "processing"
  voiceWaveformData: Uint8Array | null
  hasActiveVoiceHotkey: boolean
  onCancelEdit: () => void
  onAddDocuments: () => void
  onAddImages: () => void
  onDraftChange: (value: string) => void
  onEditUserMessage: (message: ChatMessage) => void
  onRemoveAttachment: (attachmentId: string) => void
  onRegenerateAssistantMessage: (messageId: string) => Promise<void> | void
  onSeekSpeech: (value: number) => void
  onSpeakAssistantMessage: (message: ChatMessage) => Promise<void> | void
  onStopSpeech: () => void
  onStopGeneration: () => void
  onSubmit: () => Promise<void> | void
  onJumpToLatest: () => void
  onToggleSpeech: () => void
  onVoiceVadStart: () => void
  onVoiceFinish: () => void
}

export function ChatWorkspace({
  conversation,
  draft,
  draftRevealKey,
  shouldRevealDraft,
  editingMessageId,
  error,
  generationTokensPerSecond,
  isGenerating,
  isJumpToLatestVisible,
  composerAttachments,
  activeRuntimeModel,
  modelSelector,
  scrollRef,
  speechPlayback,
  showAverageTps,
  showContextMeter,
  voiceState,
  voiceWaveformData,
  hasActiveVoiceHotkey,
  onCancelEdit,
  onAddDocuments,
  onAddImages,
  onDraftChange,
  onEditUserMessage,
  onRemoveAttachment,
  onRegenerateAssistantMessage,
  onSeekSpeech,
  onSpeakAssistantMessage,
  onStopSpeech,
  onStopGeneration,
  onSubmit,
  onJumpToLatest,
  onToggleSpeech,
  onVoiceVadStart,
  onVoiceFinish,
}: ChatWorkspaceProps) {
  const isChatScrolling = useScrollVisibility(scrollRef)
  const hasMessages = Boolean(conversation && conversation.messages.length > 0)
  const messageCount = conversation?.messages.length ?? 0
  const userTokens =
    conversation?.messages.reduce(
      (total, message) =>
        total +
        (message.role === "user"
          ? Math.ceil(
            (
              message.content +
              (message.attachments?.reduce((attachmentTotal, attachment) => {
                if (attachment.kind === "document") {
                  return attachmentTotal + attachment.textContent.length
                }

                return attachmentTotal + attachment.name.length
              }, 0) ?? 0)
            ).length / 4,
          )
          : 0),
      0,
    ) ?? 0
  const assistantTokens =
    conversation?.messages.reduce(
      (total, message) => total + (message.role === "assistant" ? Math.ceil(message.content.length / 4) : 0),
      0,
    ) ?? 0
  const systemTokens = 220
  const estimatedTokens = userTokens + assistantTokens + (messageCount > 0 ? systemTokens : 0)
  const contextUsage = Math.min(
    100,
    Math.round((estimatedTokens / chatRuntimeConfig.contextWindowTokens) * 100),
  )
  const tokenState = contextUsage >= 85 ? "danger" : contextUsage >= 60 ? "warning" : "healthy"
  const latestUserMessageId = conversation?.messages.reduce<string | null>(
    (latestMessageId, message) => message.role === "user" ? message.id : latestMessageId,
    null,
  )
  const latestAssistantTokensPerSecond = conversation?.messages.reduce<number | null>(
    (latestValue, message) =>
      message.role === "assistant" && typeof message.tokensPerSecond === "number"
        ? message.tokensPerSecond
        : latestValue,
    null,
  ) ?? null
  const displayedTokensPerSecond = generationTokensPerSecond ?? latestAssistantTokensPerSecond
  const conversationAnimationKey = conversation?.id ?? "initial-conversation"

  return (
    <section className="relative flex min-h-0 flex-col bg-[var(--surface)]">
      <div className="chat-workspace-header">
        <ModelSelector
          activeModelId={modelSelector.activeModelId}
          disabled={isGenerating}
          isLoading={modelSelector.isLoading}
          isSelecting={modelSelector.isSelecting}
          models={modelSelector.models}
          onSelectModel={modelSelector.onSelectModel}
        />
      </div>

      <div
        ref={scrollRef}
        className="chat-workspace-scroll scrollbar-reveal min-h-0 flex-1 overflow-y-auto px-6 pb-40 max-[780px]:px-4 max-[780px]:pb-36"
        data-empty={!hasMessages}
        data-scrolling={isChatScrolling}
      >
        {hasMessages && (
          <motion.div
            key={`messages-${conversationAnimationKey}`}
            className="mx-auto flex max-w-3xl flex-col gap-5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence>
              {conversation?.messages.map((message, index) => (
                <ChatBubble
                  key={message.id}
                  canEdit={message.id === latestUserMessageId}
                  message={message}
                  isGenerating={isGenerating && index === conversation.messages.length - 1}
                  onEdit={onEditUserMessage}
                  onRegenerate={onRegenerateAssistantMessage}
                  onSpeak={onSpeakAssistantMessage}
                  speechLoading={speechPlayback.pendingMessageId === message.id}
                />
              ))}
            </AnimatePresence>
            
          </motion.div>
        )}
      </div>

      <div className="chat-workspace-bottom-glass" data-hidden={!hasMessages} aria-hidden="true">
        <span className="chat-workspace-bottom-glass-layer" />
      </div>

      <AnimatePresence>
        {hasMessages && isJumpToLatestVisible ? (
          <motion.button
            aria-label="Jump to latest"
            className="chat-jump-to-latest"
            title="Jump to latest"
            type="button"
            initial={{ opacity: 0, scale: 0.88, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={onJumpToLatest}
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      <div
        className="chat-composer-dock pointer-events-none absolute inset-x-0 px-5"
        data-position="bottom"
      >
        <ChatComposer
          activeModelSupportsVision={Boolean(activeRuntimeModel?.capabilities?.vision)}
          attachments={composerAttachments}
          draft={draft}
          draftRevealKey={draftRevealKey}
          shouldRevealDraft={shouldRevealDraft}
          error={error}
          isGenerating={isGenerating}
          generationTokensPerSecond={displayedTokensPerSecond}
          contextUsage={{
            estimatedTokens,
            maxTokens: chatRuntimeConfig.contextWindowTokens,
            percentage: contextUsage,
            state: tokenState,
          }}
          isEditing={Boolean(editingMessageId)}
          speechPlayback={speechPlayback}
          showAverageTps={showAverageTps}
          showContextMeter={showContextMeter}
          voiceState={voiceState}
          voiceWaveformData={voiceWaveformData}
          hasActiveVoiceHotkey={hasActiveVoiceHotkey}
          onCancelEdit={onCancelEdit}
          onAddDocuments={onAddDocuments}
          onAddImages={onAddImages}
          onDraftChange={onDraftChange}
          onRemoveAttachment={onRemoveAttachment}
          onSeekSpeech={onSeekSpeech}
          onStopSpeech={onStopSpeech}
          onStopGeneration={onStopGeneration}
          onSubmit={onSubmit}
          onToggleSpeech={onToggleSpeech}
          onVoiceVadStart={onVoiceVadStart}
          onVoiceFinish={onVoiceFinish}
        />
      </div>
    </section>
  )
}
