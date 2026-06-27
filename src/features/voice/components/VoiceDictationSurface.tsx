import { Check, Loader2, X } from "lucide-react"
import { VoiceWaveform } from "@/features/voice/components/VoiceWaveform"

type VoiceDictationSurfaceProps = {
  voiceState: "recording" | "processing"
  waveformData: Uint8Array | null
  onCancel: () => void
}

export function VoiceDictationSurface({
  voiceState,
  waveformData,
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
        className="voice-dictation-action"
        disabled={isProcessing}
        title="Cancel dictation"
        type="button"
        onClick={onCancel}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="voice-dictation-quiet-line" aria-hidden="true" />
      <VoiceWaveform
        barCount={44}
        data={waveformData}
        height={30}
        width={280}
      />
      <span className="voice-dictation-status">
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="voice-dictation-live-dot" />
        )}
        {isProcessing ? "Transcribing" : "Listening"}
      </span>
      <span className="voice-dictation-commit" aria-hidden="true">
        <Check className="h-3.5 w-3.5" />
      </span>
    </div>
  )
}
