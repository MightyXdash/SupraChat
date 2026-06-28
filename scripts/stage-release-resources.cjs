const fs = require("node:fs")
const path = require("node:path")
const {
  CHAT_MODEL,
  REQUIRED_SPEECH_ASSETS,
  TITLE_MODEL,
  getLlamaServerName,
  getPlatformKey,
  resolveSpeechSttModel,
  resolveSpeechTtsModel,
} = require("../backend/node/model-registry.cjs")

const PROJECT_ROOT = path.resolve(__dirname, "..")
const SOURCE_ROOT = path.join(PROJECT_ROOT, "resources")
const STAGED_ROOT = path.join(PROJECT_ROOT, "release-resources")

function readOption(name, fallback) {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))

  if (inline) {
    return inline.slice(prefix.length)
  }

  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }

  return fallback
}

function removeDirectory(directory) {
  fs.rmSync(directory, { force: true, recursive: true })
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true })
}

function copyFile(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required release resource: ${source}`)
  }

  ensureDirectory(path.dirname(destination))
  fs.copyFileSync(source, destination)

  const sourceStat = fs.statSync(source)
  fs.chmodSync(destination, sourceStat.mode)
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required release resource directory: ${source}`)
  }

  ensureDirectory(destination)

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath)
      continue
    }

    if (entry.isFile() || entry.isSymbolicLink()) {
      copyFile(sourcePath, destinationPath)
    }
  }
}

function copyRelativeFile(relativePath) {
  copyFile(path.join(SOURCE_ROOT, relativePath), path.join(STAGED_ROOT, relativePath))
}

function copyRelativeDirectory(relativePath) {
  copyDirectory(path.join(SOURCE_ROOT, relativePath), path.join(STAGED_ROOT, relativePath))
}

function stageModel(model) {
  copyRelativeFile(path.join("models", model.role, model.filename))
}

function stageSpeechAssets() {
  const ttsModel = resolveSpeechTtsModel(SOURCE_ROOT)
  const sttModel = resolveSpeechSttModel(SOURCE_ROOT)
  const speechModelsByRole = {
    stt: sttModel,
    tts: ttsModel,
  }

  for (const asset of REQUIRED_SPEECH_ASSETS) {
    const model = speechModelsByRole[asset.role]
    const sourcePath = model[asset.pathProperty]
    const relativePath = path.relative(SOURCE_ROOT, sourcePath)

    if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
      copyRelativeDirectory(relativePath)
    } else {
      copyRelativeFile(relativePath)
    }
  }
}

function stagePlatformRuntime(platform, arch) {
  const platformKey = getPlatformKey(platform, arch)
  const runtimeDirectory = path.join("llama.cpp", platformKey)
  const serverName = getLlamaServerName(platform)
  const sourceDirectory = path.join(SOURCE_ROOT, runtimeDirectory)
  const serverPath = path.join(sourceDirectory, serverName)

  if (!fs.existsSync(serverPath)) {
    throw new Error(`Missing ${platformKey} llama.cpp server at ${serverPath}`)
  }

  ensureDirectory(path.join(STAGED_ROOT, runtimeDirectory))

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue
    }

    const basename = entry.name
    const isRuntimeDependency =
      basename === serverName ||
      /\.(dll|dylib|so|json|txt)$/.test(basename) ||
      /^lib/.test(basename)

    if (isRuntimeDependency) {
      copyRelativeFile(path.join(runtimeDirectory, basename))
    }
  }
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function directorySize(directory) {
  let total = 0

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      total += directorySize(entryPath)
      continue
    }

    if (entry.isFile()) {
      total += fs.statSync(entryPath).size
    }
  }

  return total
}

function main() {
  const platform = readOption("platform", process.platform)
  const arch = readOption("arch", process.arch)
  const platformKey = getPlatformKey(platform, arch)

  removeDirectory(STAGED_ROOT)
  ensureDirectory(STAGED_ROOT)

  copyRelativeFile("README.md")
  stageModel(CHAT_MODEL)
  stageModel(TITLE_MODEL)
  stageSpeechAssets()
  stagePlatformRuntime(platform, arch)

  const size = directorySize(STAGED_ROOT)
  console.log(`Staged ${platformKey} release resources in ${STAGED_ROOT}`)
  console.log(`Release resource payload: ${formatBytes(size)}`)
}

main()
