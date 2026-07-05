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

const GGUF_EXTENSION = ".gguf"
const HF_CACHE_MODEL_PREFIX = "models--"

function getHuggingFaceCacheRoots() {
  const roots = []
  const configuredHubCacheAlias = process.env.HF_HUB_CACHE
  const configuredHubCache = process.env.HUGGINGFACE_HUB_CACHE
  const configuredHome = process.env.HF_HOME

  if (configuredHubCacheAlias) {
    roots.push(configuredHubCacheAlias)
  }

  if (configuredHubCache) {
    roots.push(configuredHubCache)
  }

  if (configuredHome) {
    roots.push(path.join(configuredHome, "hub"))
  }

  roots.push(path.join(os.homedir(), ".cache", "huggingface", "hub"))

  return Array.from(new Set(roots.map((root) => path.resolve(root))))
}

function getRepoCacheDirectory(repo, cacheRoot) {
  return path.join(cacheRoot, `${HF_CACHE_MODEL_PREFIX}${repo.replace("/", "--")}`)
}

function readDirectoryEntries(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

function repoCacheHasBlobContent(repoDirectory) {
  const blobsDirectory = path.join(repoDirectory, "blobs")

  for (const entry of readDirectoryEntries(blobsDirectory)) {
    if (isCachedFileEntry(entry)) {
      return true
    }
  }

  return false
}

function isCachedFileEntry(entry) {
  return entry.isFile() || entry.isSymbolicLink()
}

function isChatGgufCandidate(repo, filename) {
  const value = `${repo}/${filename}`.toLowerCase()

  return (
    filename.toLowerCase().endsWith(GGUF_EXTENSION) &&
    !value.includes("mmproj") &&
    !value.includes("title") &&
    !value.includes("bge-")
  )
}

function findCachedRepoFiles(repo, predicate) {
  const matches = []

  for (const cacheRoot of getHuggingFaceCacheRoots()) {
    const snapshotsRoot = path.join(getRepoCacheDirectory(repo, cacheRoot), "snapshots")

    for (const snapshot of readDirectoryEntries(snapshotsRoot)) {
      if (!snapshot.isDirectory()) {
        continue
      }

      const snapshotRoot = path.join(snapshotsRoot, snapshot.name)
      const stack = [snapshotRoot]

      while (stack.length > 0) {
        const currentDirectory = stack.pop()

        for (const entry of readDirectoryEntries(currentDirectory)) {
          const entryPath = path.join(currentDirectory, entry.name)

          if (entry.isDirectory()) {
            stack.push(entryPath)
            continue
          }

          if (isCachedFileEntry(entry) && predicate(entry.name, entryPath)) {
            matches.push(entryPath)
          }
        }
      }
    }
  }

  return matches
}

function findCachedModelPath(model) {
  if (!model.repo || !model.filename) {
    return null
  }

  return findCachedRepoFiles(
    model.repo,
    (filename) => filename.toLowerCase() === model.filename.toLowerCase(),
  )[0] ?? null
}

function labelFromCachedGguf(repo, filename) {
  const baseName = filename.replace(/\.gguf$/i, "").replace(/[._-]+/g, " ").trim()
  const repoName = repo.split("/").at(-1)?.replace(/[._-]+/g, " ") ?? repo

  return baseName || repoName
}

function createChatModelFromCachedGguf(repo, filePath) {
  const filename = path.basename(filePath)
  const id = `${repo}/${filename}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const mmprojPath =
    findCachedRepoFiles(repo, (candidateFilename) => candidateFilename.toLowerCase().includes("mmproj"))[0] ?? null

  return {
    ...CHAT_MODEL,
    id,
    label: labelFromCachedGguf(repo, filename),
    repo,
    filename,
    path: filePath,
    mmprojPath,
    capabilities: {
      vision: Boolean(mmprojPath),
    },
    source: "huggingface-cache",
  }
}

function discoverCachedChatModels() {
  const modelsByPath = new Map()

  for (const cacheRoot of getHuggingFaceCacheRoots()) {
    for (const repoEntry of readDirectoryEntries(cacheRoot)) {
      if (!repoEntry.isDirectory() || !repoEntry.name.startsWith(HF_CACHE_MODEL_PREFIX)) {
        continue
      }

      const repoDirectory = path.join(cacheRoot, repoEntry.name)

      if (!repoCacheHasBlobContent(repoDirectory)) {
        continue
      }

      const repo = repoEntry.name
        .slice(HF_CACHE_MODEL_PREFIX.length)
        .replace(/--/g, "/")
      const snapshotsRoot = path.join(repoDirectory, "snapshots")

      for (const snapshot of readDirectoryEntries(snapshotsRoot)) {
        if (!snapshot.isDirectory()) {
          continue
        }

        const snapshotRoot = path.join(snapshotsRoot, snapshot.name)
        const stack = [snapshotRoot]

        while (stack.length > 0) {
          const currentDirectory = stack.pop()

          for (const entry of readDirectoryEntries(currentDirectory)) {
            const entryPath = path.join(currentDirectory, entry.name)

            if (entry.isDirectory()) {
              stack.push(entryPath)
              continue
            }

            if (isCachedFileEntry(entry) && isChatGgufCandidate(repo, entry.name)) {
              modelsByPath.set(entryPath, createChatModelFromCachedGguf(repo, entryPath))
            }
          }
        }
      }
    }
  }

  return Array.from(modelsByPath.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function resolveDefaultChatModel() {
  const cachedModelPath = findCachedModelPath(CHAT_MODEL)

  if (cachedModelPath) {
    return {
      ...CHAT_MODEL,
      path: cachedModelPath,
      mmprojPath: null,
      capabilities: {
        vision: false,
      },
      source: "huggingface-cache",
    }
  }

  return {
    ...CHAT_MODEL,
    mmprojPath: null,
    capabilities: {
      vision: false,
    },
  }
}

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

  if (model.path) {
    return model.path
  }

  const cachedPath = findCachedModelPath(model)

  if (cachedPath) {
    return cachedPath
  }

  if (model.role === "chat") {
    return path.join(
      getRepoCacheDirectory(model.repo, getHuggingFaceCacheRoots()[0]),
      "snapshots",
      "missing",
      model.filename,
    )
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
  discoverCachedChatModels,
  findCachedModelPath,
  getHuggingFaceCacheRoots,
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
  resolveDefaultChatModel,
  resolveModelPath,
  resolveResourceRoot,
  resolveSpeechSttModel,
  resolveSpeechTtsModel,
}
