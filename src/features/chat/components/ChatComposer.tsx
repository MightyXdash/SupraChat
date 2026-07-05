import { CSSProperties, FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowUp, Brain, FileText, ImagePlus, Loader2, Pause, Pencil, Play, Plus, Square, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceButton } from "@/features/voice/components/VoiceButton"
import { VoiceDictationSurface } from "@/features/voice/components/VoiceDictationSurface"
import { attachmentSummaryLabel } from "@/features/chat/lib/message-attachments"
import { ChatAttachment, SpeechPlaybackState } from "@/features/chat/types"
import type { ReasoningEffort } from "@/features/cloud-models/lib/reasoning"

export type ContextUsageSummary = {
  estimatedTokens: number
  maxTokens: number
  percentage: number
  state: "healthy" | "warning" | "danger"
}

type ChatComposerProps = {
  activeModelSupportsVision: boolean
  attachments: ChatAttachment[]
  draft: string
  draftRevealKey: number
  shouldRevealDraft: boolean
  error: string | null
  generationTokensPerSecond: number | null
  isEditing: boolean
  isGenerating: boolean
  contextUsage: ContextUsageSummary
  speechPlayback: SpeechPlaybackState
  showAverageTps: boolean
  showContextMeter: boolean
  voiceState: "idle" | "recording" | "processing"
  voiceWaveformData: Uint8Array | null
  hasActiveVoiceHotkey: boolean
  reasoningControl: {
    visible: boolean
    effort: ReasoningEffort
    onChange: (effort: ReasoningEffort) => void
  }
  onCancelEdit: () => void
  onAddDocuments: () => void
  onAddImages: () => void
  onDraftChange: (value: string) => void
  onRemoveAttachment: (attachmentId: string) => void
  onSeekSpeech: (value: number) => void
  onStopSpeech: () => void
  onStopGeneration: () => void
  onSubmit: () => Promise<void> | void
  onToggleSpeech: () => void
  onVoiceVadStart: () => void
  onVoiceFinish: () => void
}

export function ChatComposer({
  activeModelSupportsVision,
  attachments,
  draft,
  draftRevealKey,
  shouldRevealDraft,
  error,
  generationTokensPerSecond,
  isEditing,
  isGenerating,
  contextUsage,
  speechPlayback,
  showAverageTps,
  showContextMeter,
  voiceState,
  voiceWaveformData,
  hasActiveVoiceHotkey,
  reasoningControl,
  onCancelEdit,
  onAddDocuments,
  onAddImages,
  onDraftChange,
  onRemoveAttachment,
  onSeekSpeech,
  onStopSpeech,
  onStopGeneration,
  onSubmit,
  onToggleSpeech,
  onVoiceVadStart,
  onVoiceFinish,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const [composerSize, setComposerSize] = useState<"small" | "small-medium" | "medium-long" | "long">("small")
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false)
  const activeVoiceState = voiceState === "idle" ? null : voiceState
  const isVoiceActive = activeVoiceState !== null

  useEffect(() => {
    if (!isAttachmentMenuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!attachmentMenuRef.current?.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isAttachmentMenuOpen])

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"

    const computed = window.getComputedStyle(textarea)
    const fontSize = Number.parseFloat(computed.fontSize) || 16
    const rawLineHeight = Number.parseFloat(computed.lineHeight)
    const lineHeight = Number.isFinite(rawLineHeight)
      ? rawLineHeight <= 4
        ? rawLineHeight * fontSize
        : rawLineHeight
      : fontSize * 1.55
    const verticalPadding =
      Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom)
    const firstStep = Math.round(lineHeight + verticalPadding)
    const secondStep = Math.round(lineHeight * 2 + verticalPadding)
    const thirdStep = Math.round(lineHeight * 3 + verticalPadding)
    const maxStep = Math.round(lineHeight * 12 + verticalPadding)
    const scrollHeight = textarea.scrollHeight
    const isEmptyDraft = draft.length === 0
    const hasAttachments = attachments.length > 0
    const hasExpandedContent = !isEmptyDraft && (draft.includes("\n") || scrollHeight > firstStep)

    const nextSize = (!hasAttachments && (isEmptyDraft || !hasExpandedContent))
      ? "small"
      : scrollHeight <= secondStep
        ? "small-medium"
        : scrollHeight <= thirdStep
          ? "medium-long"
          : "long"
    const nextHeight =
      nextSize === "small"
        ? firstStep
      : nextSize === "small-medium"
          ? secondStep
          : nextSize === "medium-long"
            ? thirdStep
            : Math.min(scrollHeight, maxStep)

    textarea.style.height = `${nextHeight}px`
    setComposerSize(nextSize)
  }, [attachments.length, draft])

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isVoiceActive) {
      return
    }

    if (isGenerating) {
      onStopGeneration()
      return
    }

    void onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isVoiceActive) {
      event.preventDefault()
      return
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const contextTooltip = `${contextUsage.estimatedTokens.toLocaleString()} of ${contextUsage.maxTokens.toLocaleString()} tokens`
  const isSpeechVisible = speechPlayback.status !== "idle" || speechPlayback.isPreparing
  const speechDuration = speechPlayback.duration > 0 ? speechPlayback.duration : 0
  const speechProgress = speechDuration > 0 ? Math.min(speechPlayback.currentTime, speechDuration) : 0

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-3xl">
      {error && (
        <p className="mb-3 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--error)_42%,var(--border))] bg-[color-mix(in_srgb,var(--error)_10%,var(--surface))] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <form
        className="chat-composer"
        data-dictating={isVoiceActive || undefined}
        data-size={composerSize}
        onSubmit={handleFormSubmit}
      >
        <div className="chat-composer-speech-player" data-visible={isSpeechVisible}>
          <div className="chat-composer-speech-status">
            <span>{speechPlayback.isPreparing ? "Preparing audio" : "Reading response"}</span>
          </div>
          <div className="chat-composer-speech-controls">
            <button
              aria-label={speechPlayback.status === "playing" ? "Pause audio" : "Play audio"}
              className="chat-composer-speech-button"
              type="button"
              onClick={onToggleSpeech}
            >
              {speechPlayback.isPreparing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : speechPlayback.status === "playing" ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
            <input
              aria-label="Speech playback position"
              className="chat-composer-speech-timeline"
              disabled={speechDuration <= 0}
              max={speechDuration || 1}
              min={0}
              step={0.05}
              style={{ "--speech-progress": `${speechDuration > 0 ? (speechProgress / speechDuration) * 100 : 0}%` } as CSSProperties}
              type="range"
              value={speechProgress}
              onChange={(event) => onSeekSpeech(Number(event.currentTarget.value))}
            />
            <button
              aria-label="Stop audio"
              className="chat-composer-speech-button"
              title="Stop audio"
              type="button"
              onClick={onStopSpeech}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {isEditing ? (
          <div className="chat-composer-edit-header">
            <span>
              <Pencil className="h-3 w-3" />
              Edit
            </span>
            <button aria-label="Cancel edit" title="Cancel edit" type="button" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="chat-composer-attachments">
            {attachments.map((attachment) => (
              attachment.kind === "image" ? (
                <div className="chat-composer-image-chip" key={attachment.id}>
                  <img alt={attachment.name} className="chat-composer-image-chip-preview" src={attachment.dataUrl} />
                  <div className="chat-composer-image-chip-copy">
                    <span title={attachment.name}>{attachment.name}</span>
                    <small>{attachmentSummaryLabel(attachment)}</small>
                  </div>
                  <button
                    aria-label={`Remove ${attachment.name}`}
                    className="chat-composer-attachment-remove"
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="chat-composer-attachment-chip" key={attachment.id}>
                  <span className="chat-composer-attachment-icon">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <span className="chat-composer-attachment-copy">
                    <strong title={attachment.name}>{attachment.name}</strong>
                    <small>{attachmentSummaryLabel(attachment)}</small>
                  </span>
                  <button
                    aria-label={`Remove ${attachment.name}`}
                    className="chat-composer-attachment-remove"
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            ))}
          </div>
        ) : null}
        <div className="chat-composer-main">
          <div
            className="chat-composer-text-reveal-shell"
            data-revealing={shouldRevealDraft || undefined}
            key={`draft-reveal-${draftRevealKey}`}
          >
            <textarea
              ref={textareaRef}
              aria-label="Message SupraChat"
              aria-readonly={isVoiceActive}
              className="chat-composer-textarea"
              placeholder="Send a message..."
              readOnly={isVoiceActive}
              rows={1}
              value={draft}
              onChange={(event) => {
                if (!isVoiceActive) {
                  onDraftChange(event.target.value)
                }
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          {activeVoiceState ? (
            <VoiceDictationSurface
              voiceState={activeVoiceState}
              waveformData={voiceWaveformData}
            />
          ) : null}
        </div>

        <div className="chat-composer-footer">
          <div className="chat-composer-footer-start">
            {!isVoiceActive ? (
              <div className="chat-composer-attachment-menu-shell" ref={attachmentMenuRef}>
                <button
                  aria-expanded={isAttachmentMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Add attachment"
                  className="chat-composer-round-button"
                  type="button"
                  onClick={() => setIsAttachmentMenuOpen((current) => !current)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {isAttachmentMenuOpen ? (
                  <div className="chat-composer-attachment-menu" role="menu" aria-label="Add attachment">
                    <button
                      className="chat-composer-attachment-menu-item"
                      type="button"
                      onClick={() => {
                        setIsAttachmentMenuOpen(false)
                        void onAddDocuments()
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Add document</span>
                    </button>
                    <button
                      className="chat-composer-attachment-menu-item"
                      data-disabled={!activeModelSupportsVision || undefined}
                      disabled={!activeModelSupportsVision}
                      type="button"
                      onClick={() => {
                        setIsAttachmentMenuOpen(false)
                        void onAddImages()
                      }}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>Add images</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {reasoningControl.visible ? (
              <div className="chat-composer-reasoning-control" data-active={reasoningControl.effort !== "instant" || undefined}>
                {reasoningControl.effort === "instant" ? (
                  <Zap className="h-3.5 w-3.5 chat-composer-reasoning-icon" aria-hidden="true" />
                ) : (
                  <Brain className="h-3.5 w-3.5 chat-composer-reasoning-icon" aria-hidden="true" />
                )}
                <div className="chat-composer-reasoning-segments">
                  <button
                    className={reasoningControl.effort === "instant" ? "active" : ""}
                    type="button"
                    onClick={() => reasoningControl.onChange("instant")}
                  >
                    Instant
                  </button>
                  <button
                    className={reasoningControl.effort === "low" ? "active" : ""}
                    type="button"
                    onClick={() => reasoningControl.onChange("low")}
                  >
                    Low
                  </button>
                  <button
                    className={reasoningControl.effort === "medium" ? "active" : ""}
                    type="button"
                    onClick={() => reasoningControl.onChange("medium")}
                  >
                    Medium
                  </button>
                  <button
                    className={reasoningControl.effort === "high" ? "active" : ""}
                    type="button"
                    onClick={() => reasoningControl.onChange("high")}
                  >
                    High
                  </button>
                </div>
              </div>
            ) : null}
            {showContextMeter ? (
              <div
                aria-label={`Context length: ${contextTooltip}`}
                className="chat-context-meter"
                data-state={contextUsage.state}
                role="status"
                title={contextTooltip}
              >
                <span
                  aria-hidden="true"
                  className="chat-context-meter-ring"
                  style={{ "--usage": `${contextUsage.percentage}%` } as CSSProperties}
                />
                <span>{contextUsage.percentage}%</span>
              </div>
            ) : null}
            {showAverageTps && generationTokensPerSecond !== null ? (
              <span className="chat-throughput-label">
                {generationTokensPerSecond.toFixed(1)} t/s
              </span>
            ) : null}
          </div>
          <div className="chat-composer-footer-end">
            <VoiceButton
              voiceState={voiceState}
              hasActiveHotkey={hasActiveVoiceHotkey}
              onVadStart={onVoiceVadStart}
              onFinish={onVoiceFinish}
            />
            {!isVoiceActive ? (
              <Button
                aria-label={isGenerating ? "Stop response" : "Send message"}
                className="chat-composer-voice-button"
                disabled={(!draft.trim() && attachments.length === 0) && !isGenerating}
                size="icon"
                type="submit"
                variant="ghost"
              >
                {isGenerating ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  )
}
