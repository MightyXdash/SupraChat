const path = require("node:path")
const fs = require("node:fs")
const { parentPort } = require("node:worker_threads")
const { resolveSpeechSttModel } = require("./model-registry.cjs")

function getSherpaPlatformPackageName(platform = process.platform, arch = process.arch) {
  if (platform === "darwin") {
    return arch === "arm64" ? "sherpa-onnx-darwin-arm64" : "sherpa-onnx-darwin-x64"
  }

  if (platform === "linux") {
    return arch === "arm64" ? "sherpa-onnx-linux-arm64" : "sherpa-onnx-linux-x64"
  }

  if (platform === "win32") {
    return arch === "ia32" ? "sherpa-onnx-win-ia32" : "sherpa-onnx-win-x64"
  }

  return ""
}

function configureSherpaLibraryPath() {
  const packageName = getSherpaPlatformPackageName()

  if (!packageName) {
    return
  }

  try {
    const packagePath = path.dirname(require.resolve(`${packageName}/package.json`))
    const envKey = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH"
    const currentValue = process.env[envKey] ?? ""

    if (!currentValue.split(path.delimiter).includes(packagePath)) {
      process.env[envKey] = currentValue ? `${packagePath}${path.delimiter}${currentValue}` : packagePath
    }
  } catch {
    // Let the addon report its own load error if the optional platform package is absent.
  }
}

configureSherpaLibraryPath()

const sherpaOnnx = require("sherpa-onnx-node")

let sttRuntime = null

function readPcm16Wave(audioPath) {
  const buffer = fs.readFileSync(audioPath)

  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Audio file is not a WAV file.")
  }

  let offset = 12
  let sampleRate = 16000
  let channels = 1
  let bitsPerSample = 16
  let audioFormat = 1
  let dataStart = -1
  let dataSize = 0

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataStart = offset + 8

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkDataStart)
      channels = buffer.readUInt16LE(chunkDataStart + 2)
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4)
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14)
    } else if (chunkId === "data") {
      dataStart = chunkDataStart
      dataSize = chunkSize
      break
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2)
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || dataStart < 0) {
    throw new Error("Only PCM 16-bit WAV audio is supported for transcription.")
  }

  const frameCount = Math.floor(dataSize / (channels * 2))
  const samples = new Float32Array(frameCount)

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0

    for (let channel = 0; channel < channels; channel += 1) {
      const sampleOffset = dataStart + (frame * channels + channel) * 2
      sum += buffer.readInt16LE(sampleOffset) / 32768
    }

    samples[frame] = sum / channels
  }

  return { samples, sampleRate }
}

function getSttRuntime() {
  if (sttRuntime) {
    return sttRuntime
  }

  const model = resolveSpeechSttModel()
  const recognizer = new sherpaOnnx.OfflineRecognizer({
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      whisper: {
        encoder: model.encoderPath,
        decoder: model.decoderPath,
        language: "en",
        task: "transcribe",
        tailPaddings: 2000,
      },
      tokens: model.tokensPath,
      numThreads: 2,
      provider: "cpu",
      debug: false,
    },
  })

  sttRuntime = { recognizer }
  return sttRuntime
}

function serializeError(error) {
  return {
    code: error?.code,
    message: error?.message ?? "Unable to transcribe speech.",
    stack: error?.stack,
  }
}

parentPort.on("message", (message) => {
  if (message.type !== "transcribe") {
    return
  }

  try {
    const { recognizer } = getSttRuntime()
    const wave = readPcm16Wave(message.audioPath)
    const stream = recognizer.createStream()
    stream.acceptWaveform({ samples: wave.samples, sampleRate: wave.sampleRate })
    recognizer.decode(stream)
    const result = recognizer.getResult(stream)

    parentPort.postMessage({ id: message.id, ok: true, text: result.text ?? "" })
  } catch (error) {
    parentPort.postMessage({ error: serializeError(error), id: message.id, ok: false })
  }
})
