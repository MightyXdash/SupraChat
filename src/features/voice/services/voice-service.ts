import { chatRuntimeConfig } from "@/features/chat/config/runtime"

export type VoiceState = "idle" | "recording" | "processing"

export type VoiceMode = "vad" | "ptt"

export type VoiceServiceCallbacks = {
  onStateChange: (state: VoiceState) => void
  onWaveformUpdate: (data: Uint8Array) => void
  onTranscriptionResult: (text: string) => void
  onError: (error: string) => void
}

const SAMPLE_RATE = 16000
const VAD_SILENCE_TIMEOUT_MS = 1500
const VAD_THRESHOLD = 0.025
const WAVEFORM_FFT_SIZE = 256

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * blockAlign
  const bufferSize = 44 + dataSize
  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, bufferSize - 8, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return buffer
}

async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
  const response = await fetch(
    `${chatRuntimeConfig.apiBaseUrl}/speech/stt`,
    {
      method: "POST",
      headers: {
        ...chatRuntimeConfig.localApiHeaders,
        "Content-Type": "audio/wav",
      },
      body: audioBuffer,
    },
  )

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: "Transcription failed" }))
    throw new Error(errorBody.detail ?? "Unable to transcribe audio.")
  }

  const result = await response.json()
  return result.text ?? ""
}

export function createVoiceService(callbacks: VoiceServiceCallbacks) {
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let analyserNode: AnalyserNode | null = null
  let scriptProcessor: ScriptProcessorNode | null = null

  let mode: VoiceMode | null = null
  let state: VoiceState = "idle"
  let audioChunks: Float32Array[] = []
  let totalSamples = 0
  let recordingSampleRate = SAMPLE_RATE

  let vadSilenceStart: number | null = null
  let vadTimer: ReturnType<typeof setInterval> | null = null
  let waveformFrameId: number | null = null

  function setState(next: VoiceState) {
    if (state === next) return
    state = next
    callbacks.onStateChange(next)
  }

  function cleanupMedia() {
    if (waveformFrameId !== null) {
      cancelAnimationFrame(waveformFrameId)
      waveformFrameId = null
    }

    if (vadTimer !== null) {
      clearInterval(vadTimer)
      vadTimer = null
    }

    if (scriptProcessor) {
      scriptProcessor.disconnect()
      scriptProcessor = null
    }

    if (analyserNode) {
      analyserNode.disconnect()
      analyserNode = null
    }

    if (sourceNode) {
      sourceNode.disconnect()
      sourceNode = null
    }

    if (audioContext) {
      void audioContext.close().catch(() => undefined)
      audioContext = null
    }

    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        track.stop()
      }

      mediaStream = null
    }

    audioChunks = []
    totalSamples = 0
  }

  function pushAudioSamples(samples: Float32Array) {
    audioChunks.push(samples)
    totalSamples += samples.length
  }

  function flushAudioBuffer(): Float32Array {
    const result = new Float32Array(totalSamples)
    let offset = 0

    for (const chunk of audioChunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    audioChunks = []
    totalSamples = 0
    return result
  }

  function startWaveformLoop() {
    if (!analyserNode) return

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function tick() {
      if (!analyserNode || state !== "recording") return

      analyserNode.getByteTimeDomainData(dataArray)
      callbacks.onWaveformUpdate(new Uint8Array(dataArray))
      waveformFrameId = requestAnimationFrame(tick)
    }

    waveformFrameId = requestAnimationFrame(tick)
  }

  function startVadDetection() {
    if (!analyserNode) return

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    vadTimer = setInterval(() => {
      if (state !== "recording" || !analyserNode) return

      analyserNode.getByteTimeDomainData(dataArray)
      let sumSquares = 0

      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128
        sumSquares += normalized * normalized
      }

      const rms = Math.sqrt(sumSquares / bufferLength)

      if (rms > VAD_THRESHOLD) {
        vadSilenceStart = null
      } else if (vadSilenceStart === null) {
        vadSilenceStart = Date.now()
      } else if (Date.now() - vadSilenceStart >= VAD_SILENCE_TIMEOUT_MS) {
        stopAndTranscribe()
      }
    }, 150)
  }

  async function startMic(): Promise<AudioContext> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not available in this environment.")
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    audioContext = ctx
    recordingSampleRate = ctx.sampleRate
    sourceNode = ctx.createMediaStreamSource(mediaStream)

    analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = WAVEFORM_FFT_SIZE
    sourceNode.connect(analyserNode)

    scriptProcessor = ctx.createScriptProcessor(4096, 1, 1)
    sourceNode.connect(scriptProcessor)
    scriptProcessor.connect(ctx.destination)

    scriptProcessor.onaudioprocess = (event) => {
      if (state !== "recording") return
      const inputData = event.inputBuffer.getChannelData(0)
      pushAudioSamples(new Float32Array(inputData))
    }

    if (ctx.state === "suspended") {
      await ctx.resume()
    }

    return ctx
  }

  async function stopAndTranscribe() {
    if (state !== "recording") return

    const currentMode = mode
    setState("processing")

    const samples = flushAudioBuffer()
    const sampleRate = recordingSampleRate

    if (currentMode === "vad" && vadTimer) {
      clearInterval(vadTimer)
      vadTimer = null
      vadSilenceStart = null
    }

    cleanupMedia()

    if (samples.length < sampleRate * 0.3) {
      setState("idle")
      callbacks.onError("Recording was too short. Please try again.")
      return
    }

    try {
      const wavBuffer = encodeWav(samples, sampleRate)
      const text = await transcribeAudio(wavBuffer)
      setState("idle")

      if (!text.trim()) {
        callbacks.onError("No speech was detected. Try again with a little more input.")
        return
      }

      callbacks.onTranscriptionResult(text)
    } catch (error) {
      setState("idle")
      callbacks.onError(error instanceof Error ? error.message : "Transcription failed.")
    }
  }

  function cancelRecording() {
    if (state === "idle") return

    cleanupMedia()
    setState("idle")
  }

  async function startVadRecording() {
    if (state !== "idle") return
    mode = "vad"

    try {
      setState("recording")
      await startMic()
      startWaveformLoop()
      startVadDetection()
    } catch (error) {
      cleanupMedia()
      setState("idle")
      callbacks.onError(error instanceof Error ? error.message : "Unable to access microphone.")
    }
  }

  async function startPttRecording() {
    if (state !== "idle") return
    mode = "ptt"

    try {
      setState("recording")
      await startMic()
      startWaveformLoop()
    } catch (error) {
      cleanupMedia()
      setState("idle")
      callbacks.onError(error instanceof Error ? error.message : "Unable to access microphone.")
    }
  }

  function stopPttRecording() {
    if (state !== "recording" || mode !== "ptt") return
    void stopAndTranscribe()
  }

  function finishRecording() {
    if (state !== "recording") return
    void stopAndTranscribe()
  }

  return {
    startVadRecording,
    startPttRecording,
    stopPttRecording,
    finishRecording,
    cancelRecording,
    get state() {
      return state
    },
  }
}

export type VoiceService = ReturnType<typeof createVoiceService>
