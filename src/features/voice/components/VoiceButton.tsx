import { useEffect, useRef, useState } from "react"
import { Loader2, Mic, Square } from "lucide-react"
import { STT_HOTKEY } from "@/features/voice/store/use-voice-store"

type VoiceButtonProps = {
  voiceState: "idle" | "recording" | "processing"
  hasActiveHotkey: boolean
  onVadStart: () => void
  onFinish: () => void
}

const TOOLTIP_DELAY_MS = 1750

export function VoiceButton({
  voiceState,
  hasActiveHotkey,
  onVadStart,
  onFinish,
}: VoiceButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRecording = voiceState === "recording"
  const isProcessing = voiceState === "processing"

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  function handleMouseEnter() {
    if (isRecording || isProcessing) return

    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true)
    }, TOOLTIP_DELAY_MS)
  }

  function handleMouseLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }

    setShowTooltip(false)
  }

  function handleClick() {
    if (isRecording) {
      onFinish()
      return
    }

    onVadStart()
  }

  return (
    <div
      className="voice-button-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        aria-label={isRecording ? "Stop recording" : "Record voice"}
        className="voice-button"
        data-recording={isRecording || undefined}
        data-processing={isProcessing || undefined}
        disabled={isProcessing || hasActiveHotkey}
        type="button"
        onClick={handleClick}
      >
        {isRecording ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {showTooltip && !isRecording && !isProcessing && (
        <div className="voice-tooltip" role="tooltip">
          Hold {STT_HOTKEY} to transcribe voice
        </div>
      )}
    </div>
  )
}
