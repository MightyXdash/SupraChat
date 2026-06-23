const path = require("node:path")
const { parentPort } = require("node:worker_threads")
const { resolveSpeechTtsModel } = require("./model-registry.cjs")

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

let ttsRuntime = null

function getTtsRuntime() {
  if (ttsRuntime) {
    return ttsRuntime
  }

  const model = resolveSpeechTtsModel()
  const tts = new sherpaOnnx.OfflineTts({
    model: {
      vits: {
        model: model.modelPath,
        tokens: model.tokensPath,
        dataDir: model.dataDir,
      },
      debug: false,
      numThreads: 1,
      provider: "cpu",
    },
    maxNumSentences: 1,
  })

  const generationConfig = new sherpaOnnx.GenerationConfig({
    sid: 0,
    speed: 1.0,
    silenceScale: 0.2,
  })

  ttsRuntime = { generationConfig, tts }
  return ttsRuntime
}

function serializeError(error) {
  return {
    code: error?.code,
    message: error?.message ?? "Unable to synthesize speech playback.",
    stack: error?.stack,
  }
}

parentPort.on("message", (message) => {
  if (message.type !== "synthesize") {
    return
  }

  try {
    const { generationConfig, tts } = getTtsRuntime()
    const audio = tts.generate({
      text: message.text,
      enableExternalBuffer: false,
      generationConfig,
    })

    sherpaOnnx.writeWave(message.clipPath, {
      samples: audio.samples,
      sampleRate: audio.sampleRate,
    })

    parentPort.postMessage({ id: message.id, ok: true })
  } catch (error) {
    parentPort.postMessage({ error: serializeError(error), id: message.id, ok: false })
  }
})
