const fs = require("node:fs")
const path = require("node:path")
const {
  CHAT_MODEL,
  TITLE_MODEL,
  getLlamaServerName,
  getPlatformKey,
  resolveLlamaServerPath,
  resolveModelPath,
  resolveResourceRoot,
} = require("./model-registry.cjs")

function fileStatus(filePath, label, options = {}) {
  const status = {
    ok: true,
    label,
    path: filePath,
  }

  if (!fs.existsSync(filePath)) {
    return {
      ...status,
      ok: false,
      code: "missing",
      detail: `${label} is missing at ${filePath}.`,
    }
  }

  if (options.executable && process.platform !== "win32") {
    try {
      fs.accessSync(filePath, fs.constants.X_OK)
    } catch {
      return {
        ...status,
        ok: false,
        code: "not_executable",
        detail: `${label} is present but is not executable at ${filePath}.`,
      }
    }
  }

  return status
}

function resolveRuntimeLibraryPaths(resourceRoot = resolveResourceRoot()) {
  return [
    path.join(resourceRoot, "llama.cpp", "lib"),
    path.dirname(resolveLlamaServerPath(resourceRoot)),
  ]
}

function buildRuntimeEnvironment(baseEnv = process.env, resourceRoot = resolveResourceRoot()) {
  const libraryPaths = resolveRuntimeLibraryPaths(resourceRoot)
  const env = { ...baseEnv }
  const pathKey = process.platform === "win32" ? "PATH" : "PATH"
  const delimiter = path.delimiter

  env[pathKey] = [...libraryPaths, env[pathKey]].filter(Boolean).join(delimiter)

  if (process.platform === "darwin") {
    env.DYLD_LIBRARY_PATH = [...libraryPaths, env.DYLD_LIBRARY_PATH].filter(Boolean).join(delimiter)
  }

  if (process.platform === "linux") {
    env.LD_LIBRARY_PATH = [...libraryPaths, env.LD_LIBRARY_PATH].filter(Boolean).join(delimiter)
  }

  return env
}

function checkCurrentRuntime() {
  const resourceRoot = resolveResourceRoot()
  const checks = [
    fileStatus(resolveLlamaServerPath(resourceRoot), "llama.cpp server binary", {
      executable: true,
    }),
    fileStatus(resolveModelPath(CHAT_MODEL, resourceRoot), `${CHAT_MODEL.label} GGUF model`),
    fileStatus(resolveModelPath(TITLE_MODEL, resourceRoot), `${TITLE_MODEL.label} GGUF model`),
  ]

  return {
    ok: checks.every((check) => check.ok),
    platform: process.platform,
    arch: process.arch,
    platformKey: getPlatformKey(),
    resourceRoot,
    checks,
  }
}

function getExpectedRuntimeFiles(platform = process.platform, arch = process.arch) {
  const platformKey = getPlatformKey(platform, arch)
  const serverName = getLlamaServerName(platform)

  return [
    path.join("resources", "llama.cpp", platformKey, serverName),
    path.join("resources", "models", "chat", CHAT_MODEL.filename),
    path.join("resources", "models", "title", TITLE_MODEL.filename),
  ]
}

module.exports = {
  buildRuntimeEnvironment,
  checkCurrentRuntime,
  getExpectedRuntimeFiles,
  resolveRuntimeLibraryPaths,
}
