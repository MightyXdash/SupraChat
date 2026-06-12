const os = require("node:os")
const path = require("node:path")

const DEFAULT_APP_DATA_DIRECTORY = "SupraChat"
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
const DEFAULT_CHAT_MODEL = "qwen3.5:4b-mlx"
const DEFAULT_TITLE_MODEL = "gemma4:e2b-mlx"
const DEFAULT_NODE_PORT = 3001

function resolvePlatformDataDir(appDirectoryName = DEFAULT_APP_DATA_DIRECTORY) {
  if (process.env.SUPRACHAT_DATA_DIR) {
    return process.env.SUPRACHAT_DATA_DIR
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? os.homedir(), appDirectoryName)
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appDirectoryName)
  }

  return path.join(
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
    appDirectoryName,
  )
}

function parsePort(value, fallback = DEFAULT_NODE_PORT) {
  const port = Number(value)
  return Number.isInteger(port) && port >= 0 ? port : fallback
}

function resolveRuntimeConfig(options = {}) {
  const dataDir = options.dataDir ?? resolvePlatformDataDir()
  const databasePath =
    options.databasePath ?? process.env.SUPRACHAT_DB_PATH ?? path.join(dataDir, "suprachat.db")

  return {
    allowedOrigins: new Set([
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "null",
    ]),
    chatModel: options.chatModel ?? process.env.SUPRACHAT_OLLAMA_MODEL ?? DEFAULT_CHAT_MODEL,
    titleModel:
      options.titleModel ?? process.env.SUPRACHAT_TITLE_MODEL ?? DEFAULT_TITLE_MODEL,
    databasePath,
    ollamaBaseUrl:
      options.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
    port: parsePort(options.port ?? process.env.SUPRACHAT_NODE_PORT),
  }
}

module.exports = {
  resolveRuntimeConfig,
}
