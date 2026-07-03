const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const CHAT_MODEL = {
  id: "lfm2.5-1.2b-thinking-q5-k-m",
  role: "chat",
  provider: "llama.cpp",
  label: "LFM 2.5 1.2B Thinking Q5 K M",
  repo: "unsloth/LFM2.5-1.2B-Thinking-GGUF",
  filename: "LFM2.5-1.2B-Thinking-Q5_K_M.gguf",
  contextWindowTokens: 16384,
  maxTokens: 4096,
  temperature: 0.55,
  topK: 35,
  topP: 0.7,
  repeatPenalty: 1.15,
}

const TITLE_MODEL = {
  id: "supra-title-350m-exp-q4-k-m",
  role: "title",
  provider: "llama.cpp",
  label: "Supra Title 350M Experimental Q4 K M",
  repo: "SupraLabs/Supra-Title-350M-exp-GGUF",
  filename: "LiquidAI_LFM2.5-350M-Base_1781204855.Q4_K_M.gguf",
  contextWindowTokens: 4096,
  maxTokens: 12,
  temperature: 0.35,
  topK: 15,
  repeatPenalty: 1.1,
}

const SPEECH_TTS_MODEL = {
  id: "piper-en-us-amy-low-int8",
  role: "tts",
  provider: "sherpa-onnx-node",
  label: "Piper en_US Amy Low int8",
  repo: "k2-fsa/sherpa-onnx",
  modelPath: path.join("voice", "tts", "vits-piper-en_US-amy-low-int8", "en_US-amy-low.onnx"),
  configPath: path.join("voice", "tts", "vits-piper-en_US-amy-low-int8", "en_US-amy-low.onnx.json"),
  tokensPath: path.join("voice", "tts", "vits-piper-en_US-amy-low-int8", "tokens.txt"),
  dataDir: path.join("voice", "tts", "vits-piper-en_US-amy-low-int8", "espeak-ng-data"),
  language: "en-US",
  approximateSizeMb: 36,
}

const SPEECH_STT_MODEL = {
  id: "sherpa-whisper-tiny-en-int8",
  role: "stt",
  provider: "onnxruntime-node",
  label: "Sherpa ONNX Whisper Tiny English int8",
  repo: "csukuangfj/sherpa-onnx-whisper-tiny.en",
  encoderPath: path.join("voice", "stt", "whisper-tiny-en-int8", "tiny.en-encoder.int8.onnx"),
  decoderPath: path.join("voice", "stt", "whisper-tiny-en-int8", "tiny.en-decoder.int8.onnx"),
  tokensPath: path.join("voice", "stt", "whisper-tiny-en-int8", "tiny.en-tokens.txt"),
  language: "en-US",
  approximateSizeMb: 110,
}

const REQUIRED_MODEL_ASSETS = [
  {
    destination: path.join("resources", "models", "chat", CHAT_MODEL.filename),
    filename: CHAT_MODEL.filename,
    label: `${CHAT_MODEL.label} chat model`,
    model: CHAT_MODEL,
    repo: CHAT_MODEL.repo,
    role: "chat",
  },
  {
    destination: path.join("resources", "models", "title", TITLE_MODEL.filename),
    filename: TITLE_MODEL.filename,
    label: `${TITLE_MODEL.label} title model`,
    model: TITLE_MODEL,
    repo: TITLE_MODEL.repo,
    role: "title",
  },
]

const REQUIRED_SPEECH_ASSETS = [
  {
    key: "tts-model",
    label: `${SPEECH_TTS_MODEL.label} ONNX model`,
    pathProperty: "modelPath",
    role: "tts",
  },
  {
    key: "tts-config",
    label: `${SPEECH_TTS_MODEL.label} config`,
    pathProperty: "configPath",
    role: "tts",
  },
  {
    key: "tts-tokens",
    label: `${SPEECH_TTS_MODEL.label} tokens`,
    pathProperty: "tokensPath",
    role: "tts",
  },
  {
    key: "tts-espeak-data",
    label: `${SPEECH_TTS_MODEL.label} eSpeak data`,
    pathProperty: "dataDir",
    role: "tts",
  },
  {
    key: "stt-encoder",
    label: `${SPEECH_STT_MODEL.label} encoder`,
    pathProperty: "encoderPath",
    role: "stt",
  },
  {
    key: "stt-decoder",
    label: `${SPEECH_STT_MODEL.label} decoder`,
    pathProperty: "decoderPath",
    role: "stt",
  },
  {
    key: "stt-tokens",
    label: `${SPEECH_STT_MODEL.label} tokens`,
    pathProperty: "tokensPath",
    role: "stt",
  },
]

function getPlatformKey(platform = process.platform, arch = process.arch) {
  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-x64"
  }

  if (platform === "win32") {
    return arch === "arm64" ? "win32-arm64" : "win32-x64"
  }

  if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux-x64"
  }

  return `${platform}-${arch}`
}

function getLlamaServerName(platform = process.platform) {
  return platform === "win32" ? "llama-server.exe" : "llama-server"
}

function resolveResourceRoot() {
  return (
    process.env.SUPRACHAT_RESOURCE_DIR ??
    path.join(process.cwd(), "resources")
  )
}

function resolveLlamaServerPath(resourceRoot = resolveResourceRoot()) {
  return (
    process.env.SUPRACHAT_LLAMA_SERVER_PATH ??
    path.join(
      resourceRoot,
      "llama.cpp",
      getPlatformKey(),
      getLlamaServerName(),
    )
  )
}

function resolveModelPath(model, resourceRoot = resolveResourceRoot()) {
  const envKey =
    model.role === "chat" ? "SUPRACHAT_CHAT_MODEL_PATH" : "SUPRACHAT_TITLE_MODEL_PATH"
  const explicitPath = process.env[envKey]

  if (explicitPath) {
    return explicitPath
  }

  return path.join(resourceRoot, "models", model.role, model.filename)
}

function resolveSpeechAssetPath(relativePath, resourceRoot = resolveResourceRoot()) {
  return path.join(resourceRoot, relativePath)
}

function resolveSpeechTtsModel(resourceRoot = resolveResourceRoot()) {
  return {
    ...SPEECH_TTS_MODEL,
    modelPath: resolveSpeechAssetPath(SPEECH_TTS_MODEL.modelPath, resourceRoot),
    configPath: resolveSpeechAssetPath(SPEECH_TTS_MODEL.configPath, resourceRoot),
    tokensPath: resolveSpeechAssetPath(SPEECH_TTS_MODEL.tokensPath, resourceRoot),
    dataDir: resolveSpeechAssetPath(SPEECH_TTS_MODEL.dataDir, resourceRoot),
  }
}

function resolveSpeechSttModel(resourceRoot = resolveResourceRoot()) {
  return {
    ...SPEECH_STT_MODEL,
    encoderPath: resolveSpeechAssetPath(SPEECH_STT_MODEL.encoderPath, resourceRoot),
    decoderPath: resolveSpeechAssetPath(SPEECH_STT_MODEL.decoderPath, resourceRoot),
    tokensPath: resolveSpeechAssetPath(SPEECH_STT_MODEL.tokensPath, resourceRoot),
  }
}

function hasBundledVulkanRuntime(resourceRoot = resolveResourceRoot(), platform = process.platform, arch = process.arch) {
  if (platform !== "win32" || arch !== "x64") {
    return false
  }

  return fsExists(path.join(resourceRoot, "llama.cpp", getPlatformKey(platform, arch), "ggml-vulkan.dll"))
}

function fsExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function getAccelerationMode(options = {}) {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const resourceRoot = options.resourceRoot ?? resolveResourceRoot()

  if (process.env.SUPRACHAT_DISABLE_GPU === "1") {
    return "cpu"
  }

  if (process.env.SUPRACHAT_LLAMA_ACCELERATION) {
    return process.env.SUPRACHAT_LLAMA_ACCELERATION
  }

  if (hasBundledVulkanRuntime(resourceRoot, platform, arch)) {
    return "vulkan"
  }

  if (platform === "darwin") {
    return "metal"
  }

  return "auto"
}

function getHardwareAccelerationArgs(options = {}) {
  const configured = process.env.SUPRACHAT_LLAMA_GPU_LAYERS

  if (configured) {
    return ["--n-gpu-layers", configured]
  }

  const mode = options.mode ?? getAccelerationMode(options)

  if (mode === "cpu") {
    return []
  }

  if (mode === "vulkan") {
    const device = process.env.SUPRACHAT_LLAMA_VULKAN_DEVICE ?? "Vulkan0"

    return [
      "--device",
      device,
      "--split-mode",
      "none",
      "--main-gpu",
      "0",
      "--flash-attn",
      "on",
      "--n-gpu-layers",
      "all",
    ]
  }

  // llama.cpp uses this for Metal/CUDA/Vulkan-enabled builds and ignores it
  // harmlessly on CPU-only builds that do not support GPU offload.
  return ["--n-gpu-layers", "999"]
}

function getThreadCount() {
  const configured = Number(process.env.SUPRACHAT_LLAMA_THREADS)

  if (Number.isInteger(configured) && configured > 0) {
    return configured
  }

  return Math.max(2, Math.min(os.cpus().length - 1, 8))
}

module.exports = {
  CHAT_MODEL,
  REQUIRED_MODEL_ASSETS,
  REQUIRED_SPEECH_ASSETS,
  SPEECH_STT_MODEL,
  SPEECH_TTS_MODEL,
  TITLE_MODEL,
  getAccelerationMode,
  getHardwareAccelerationArgs,
  getPlatformKey,
  getThreadCount,
  hasBundledVulkanRuntime,
  getLlamaServerName,
  resolveLlamaServerPath,
  resolveModelPath,
  resolveResourceRoot,
  resolveSpeechSttModel,
  resolveSpeechTtsModel,
}
