type RecordingSession = {
  stop: () => Float32Array
  sampleRate: number
}

const TARGET_SAMPLE_RATE = 16_000
const MAX_RECORDING_SECONDS = 18
const SPEECH_START_RMS = 0.018
const SPEECH_END_RMS = 0.012
const MIN_SPEECH_MS = 350
const SILENCE_END_MS = 900

type StartSuvaRecordingOptions = {
  onSpeechStart?: () => void
  onSpeechEnd?: (samples: Float32Array, sampleRate: number) => void
}

function mergeChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0

  chunks.forEach((chunk) => {
    merged.set(chunk, offset)
    offset += chunk.length
  })

  return merged
}

function downsample(samples: Float32Array, sourceSampleRate: number) {
  if (sourceSampleRate === TARGET_SAMPLE_RATE) {
    return samples
  }

  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE
  const targetLength = Math.floor(samples.length / ratio)
  const result = new Float32Array(targetLength)

  for (let index = 0; index < targetLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(Math.floor((index + 1) * ratio), samples.length)
    let total = 0
    let count = 0

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      total += samples[sampleIndex]
      count += 1
    }

    result[index] = count > 0 ? total / count : 0
  }

  return result
}

export async function startSuvaRecording(options: StartSuvaRecordingOptions = {}): Promise<RecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  const audioContext = new AudioContextConstructor()
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  const maxSamples = audioContext.sampleRate * MAX_RECORDING_SECONDS
  const speechStartSamples = (MIN_SPEECH_MS / 1000) * audioContext.sampleRate
  const silenceEndSamples = (SILENCE_END_MS / 1000) * audioContext.sampleRate
  let collectedSamples = 0
  let speechSamples = 0
  let silenceSamples = 0
  let hasSpeech = false
  let stopped = false

  const stop = () => {
    if (stopped) {
      return downsample(mergeChunks(chunks), audioContext.sampleRate)
    }

    stopped = true
    processor.disconnect()
    source.disconnect()
    stream.getTracks().forEach((track) => track.stop())
    void audioContext.close()

    return downsample(mergeChunks(chunks), audioContext.sampleRate)
  }

  const finishFromSpeechEnd = () => {
    const samples = stop()
    options.onSpeechEnd?.(samples, TARGET_SAMPLE_RATE)
  }

  const rms = (samples: Float32Array) => {
    let sum = 0

    for (let index = 0; index < samples.length; index += 1) {
      sum += samples[index] * samples[index]
    }

    return Math.sqrt(sum / Math.max(samples.length, 1))
  }

  processor.onaudioprocess = (event) => {
    if (stopped || collectedSamples >= maxSamples) {
      if (!stopped && hasSpeech) {
        finishFromSpeechEnd()
      }
      return
    }

    const channelData = event.inputBuffer.getChannelData(0)
    const remainingSamples = Math.max(0, maxSamples - collectedSamples)
    const nextChunk =
      channelData.length > remainingSamples
        ? channelData.slice(0, remainingSamples)
        : new Float32Array(channelData)

    chunks.push(nextChunk)
    collectedSamples += nextChunk.length

    const level = rms(nextChunk)

    if (!hasSpeech) {
      if (level >= SPEECH_START_RMS) {
        speechSamples += nextChunk.length
      } else {
        speechSamples = 0
      }

      if (speechSamples >= speechStartSamples) {
        hasSpeech = true
        silenceSamples = 0
        options.onSpeechStart?.()
      }

      return
    }

    if (level <= SPEECH_END_RMS) {
      silenceSamples += nextChunk.length
    } else {
      silenceSamples = 0
    }

    if (silenceSamples >= silenceEndSamples) {
      finishFromSpeechEnd()
    }
  }

  source.connect(processor)
  processor.connect(audioContext.destination)

  return {
    sampleRate: TARGET_SAMPLE_RATE,
    stop,
  }
}
