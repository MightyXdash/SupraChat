const path = require("node:path")
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
    const wave = sherpaOnnx.readWave(message.audioPath)
    const stream = recognizer.createStream()
    stream.acceptWaveform({ samples: wave.samples, sampleRate: wave.sampleRate })
    recognizer.decode(stream)
    const result = recognizer.getResult(stream)

    parentPort.postMessage({ id: message.id, ok: true, text: result.text ?? "" })
  } catch (error) {
    parentPort.postMessage({ error: serializeError(error), id: message.id, ok: false })
  }
})
