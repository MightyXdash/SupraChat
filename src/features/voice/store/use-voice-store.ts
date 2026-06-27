import { create } from "zustand"
import { createVoiceService, type VoiceService, type VoiceState, type VoiceServiceCallbacks } from "@/features/voice/services/voice-service"

export const STT_HOTKEY = "Ctrl+Shift+M"

type VoiceStore = {
  voiceState: VoiceState
  waveformData: Uint8Array | null
  voiceService: VoiceService | null
  isHotkeyActive: boolean
  initialize: (callbacks: {
    onTranscriptionResult: (text: string) => void
    onError: (error: string) => void
  }) => void
  startVadRecording: () => void
  startPttRecording: () => void
  stopPttRecording: () => void
  finishRecording: () => void
  cancelRecording: () => void
  setHotkeyActive: (active: boolean) => void
}

let activeCallbacks: Pick<VoiceServiceCallbacks, "onTranscriptionResult" | "onError"> | null = null

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  voiceState: "idle",
  waveformData: null,
  voiceService: null,
  isHotkeyActive: false,

  initialize: (callbacks) => {
    activeCallbacks = callbacks

    if (get().voiceService) return

    const serviceCallbacks: VoiceServiceCallbacks = {
      onStateChange: (nextState) => {
        set({ voiceState: nextState })
      },
      onWaveformUpdate: (data) => {
        set({ waveformData: data })
      },
      onTranscriptionResult: (text) => {
        set({ waveformData: null })
        activeCallbacks?.onTranscriptionResult(text)
      },
      onError: (error) => {
        set({ waveformData: null })
        activeCallbacks?.onError(error)
      },
    }

    const voiceService = createVoiceService(serviceCallbacks)
    set({ voiceService })
  },

  startVadRecording: () => {
    const { voiceService } = get()
    voiceService?.startVadRecording()
  },

  startPttRecording: () => {
    const { voiceService } = get()
    voiceService?.startPttRecording()
  },

  stopPttRecording: () => {
    const { voiceService } = get()
    voiceService?.stopPttRecording()
  },

  finishRecording: () => {
    const { voiceService } = get()
    voiceService?.finishRecording()
  },

  cancelRecording: () => {
    const { voiceService } = get()
    voiceService?.cancelRecording()
  },

  setHotkeyActive: (active) => {
    set({ isHotkeyActive: active })
  },
}))
