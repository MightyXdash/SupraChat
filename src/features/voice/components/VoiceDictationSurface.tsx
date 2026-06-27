import { Loader2, Square, X } from "lucide-react"
import { VoiceWaveform } from "@/features/voice/components/VoiceWaveform"

type VoiceDictationSurfaceProps = {
  voiceState: "recording" | "processing"
  waveformData: Uint8Array | null
  onFinish: () => void
  onCancel: () => void
}

export function VoiceDictationSurface({
  voiceState,
  waveformData,
  onFinish,
  onCancel,
}: VoiceDictationSurfaceProps) {
  const isProcessing = voiceState === "processing"

  return (
    <div
      aria-live="polite"
      className="voice-dictation-surface"
      data-processing={isProcessing || undefined}
      role="status"
    >
      <button
        aria-label="Cancel dictation"
        className="voice-dictation-action voice-dictation-cancel"
        disabled={isProcessing}
        title="Cancel dictation"
        type="button"
        onClick={onCancel}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <span className="voice-dictation-plus" aria-hidden="true" />
      <VoiceWaveform
        barCount={58}
        data={waveformData}
        height={34}
        width={470}
      />
      <span className="voice-dictation-status">
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="voice-dictation-live-dot" />
        )}
        {isProcessing ? "Transcribing" : "Listening"}
      </span>
      <button
        aria-label="Finish dictation"
        className="voice-dictation-action voice-dictation-finish"
        disabled={isProcessing}
        title="Finish dictation"
        type="button"
        onClick={onFinish}
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Square className="h-3.5 w-3.5 fill-current" />
        )}
      </button>
    </div>
  )
}
