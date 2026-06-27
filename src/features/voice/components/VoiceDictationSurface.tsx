import { Loader2 } from "lucide-react"
import { VoiceWaveform } from "@/features/voice/components/VoiceWaveform"

type VoiceDictationSurfaceProps = {
  voiceState: "recording" | "processing"
  waveformData: Uint8Array | null
}

export function VoiceDictationSurface({
  voiceState,
  waveformData,
}: VoiceDictationSurfaceProps) {
  const isProcessing = voiceState === "processing"

  return (
    <div
      aria-live="polite"
      className="voice-dictation-surface"
      data-processing={isProcessing || undefined}
      role="status"
    >
      <VoiceWaveform
        barCount={104}
        data={waveformData}
        height={50}
        width={560}
      />
      <span className="voice-dictation-status">
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="voice-dictation-live-dot" />
        )}
        {isProcessing ? "Transcribing" : "Listening"}
      </span>
    </div>
  )
}
