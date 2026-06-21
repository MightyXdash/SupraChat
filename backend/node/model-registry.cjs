const os = require("node:os")
const path = require("node:path")

const CHAT_MODEL = {
  id: "lfm2.5-350m-q6",
  role: "chat",
  provider: "llama.cpp",
  label: "LFM2.5 350M Q6",
  repo: "LiquidAI/LFM2.5-350M-GGUF",
  filename: "LFM2.5-350M-Q6_K.gguf",
  contextWindowTokens: 8192,
  maxTokens: 2048,
  temperature: 0.1,
  topK: 50,
  repeatPenalty: 1.05,
}

const TITLE_MODEL = {
  id: "supra-title-50m-q5",
  role: "title",
  provider: "llama.cpp",
  label: "Supra Title 50M Q5",
  repo: "SupraLabs/supra-title-50M-pre-gguf",
  filename: "SupraTitle-50M-Q5_K_M.gguf",
  contextWindowTokens: 1024,
  maxTokens: 24,
  temperature: 0.1,
  topK: 40,
  repeatPenalty: 1.08,
}

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

function getHardwareAccelerationArgs() {
  const configured = process.env.SUPRACHAT_LLAMA_GPU_LAYERS

  if (configured) {
    return ["--n-gpu-layers", configured]
  }

  if (process.env.SUPRACHAT_DISABLE_GPU === "1") {
    return []
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
  TITLE_MODEL,
  getHardwareAccelerationArgs,
  getPlatformKey,
  getThreadCount,
  getLlamaServerName,
  resolveLlamaServerPath,
  resolveModelPath,
  resolveResourceRoot,
}
