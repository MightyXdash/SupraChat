import { CSSProperties, FormEvent, KeyboardEvent, useLayoutEffect, useRef, useState } from "react"
import { ArrowUp, Loader2, Pause, Pencil, Play, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceButton } from "@/features/voice/components/VoiceButton"
import { VoiceDictationSurface } from "@/features/voice/components/VoiceDictationSurface"
import { SpeechPlaybackState } from "@/features/chat/types"

export type ContextUsageSummary = {
  estimatedTokens: number
  maxTokens: number
  percentage: number
  state: "healthy" | "warning" | "danger"
}

type ChatComposerProps = {
  draft: string
  draftRevealKey: number
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
  onCancelEdit: () => void
  onDraftChange: (value: string) => void
  onSeekSpeech: (value: number) => void
  onStopSpeech: () => void
  onStopGeneration: () => void
  onSubmit: () => Promise<void> | void
  onToggleSpeech: () => void
  onVoiceVadStart: () => void
  onVoiceCancel: () => void
}

export function ChatComposer({
  draft,
  draftRevealKey,
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
  onCancelEdit,
  onDraftChange,
  onSeekSpeech,
  onStopSpeech,
  onStopGeneration,
  onSubmit,
  onToggleSpeech,
  onVoiceVadStart,
  onVoiceCancel,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [composerSize, setComposerSize] = useState<"small" | "small-medium" | "medium-long" | "long">("small")
  const activeVoiceState = voiceState === "idle" ? null : voiceState
  const isVoiceActive = activeVoiceState !== null

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
    const hasExpandedContent = !isEmptyDraft && (draft.includes("\n") || scrollHeight > firstStep)

    const nextSize = isEmptyDraft || !hasExpandedContent
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
  }, [draft])

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
        <div className="chat-composer-main">
          <div
            className="chat-composer-text-reveal-shell"
            data-revealing={draftRevealKey > 0 || undefined}
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
              onCancel={onVoiceCancel}
            />
          ) : null}
        </div>

        <div className="chat-composer-footer">
          <div className="chat-composer-footer-start">
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
              onCancel={onVoiceCancel}
            />
            <Button
              aria-label={isGenerating ? "Stop response" : "Send message"}
              className="chat-composer-voice-button"
              disabled={isVoiceActive || (!draft.trim() && !isGenerating)}
              size="icon"
              type="submit"
              variant="ghost"
            >
              {isGenerating ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
