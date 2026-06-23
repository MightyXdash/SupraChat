const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const { Worker } = require("node:worker_threads")

const MAX_SPEECH_TEXT_LENGTH = 24_000
let speechWorker = null
let speechWorkerIdleTimer = null
let nextSpeechRequestId = 1
const speechRequests = new Map()

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true })
}

function getSpeechCacheDirectory(config) {
  const dataDir = path.dirname(config.databasePath)
  return path.join(dataDir, "speech-cache")
}

function getSpeechCacheKey(text) {
  return crypto.createHash("sha256").update(text).digest("hex")
}

function resolveSpeechClipPath(config, cacheKey) {
  return path.join(getSpeechCacheDirectory(config), `${cacheKey}.wav`)
}

function getSpeechWorker() {
  if (speechWorker) {
    clearSpeechWorkerIdleShutdown()
    return speechWorker
  }

  speechWorker = new Worker(path.join(__dirname, "speech-worker.cjs"))
  speechWorker.unref()
  speechWorker.on("message", (message) => {
    const request = speechRequests.get(message.id)

    if (!request) {
      return
    }

    speechRequests.delete(message.id)

    if (message.ok) {
      request.resolve()
      scheduleSpeechWorkerIdleShutdown()
      return
    }

    const error = new Error(message.error?.message ?? "Unable to synthesize speech playback.")
    error.code = message.error?.code
    error.stack = message.error?.stack
    request.reject(error)
    scheduleSpeechWorkerIdleShutdown()
  })
  speechWorker.on("error", (error) => {
    for (const request of speechRequests.values()) {
      request.reject(error)
    }

    speechRequests.clear()
    speechWorker = null
  })
  speechWorker.on("exit", (code) => {
    if (code !== 0) {
      const error = new Error(`Speech worker stopped unexpectedly with code ${code}.`)

      for (const request of speechRequests.values()) {
        request.reject(error)
      }

      speechRequests.clear()
    }

    speechWorker = null
  })

  return speechWorker
}

function clearSpeechWorkerIdleShutdown() {
  if (!speechWorkerIdleTimer) {
    return
  }

  clearTimeout(speechWorkerIdleTimer)
  speechWorkerIdleTimer = null
}

function scheduleSpeechWorkerIdleShutdown() {
  if (!speechWorker || speechRequests.size > 0 || speechWorkerIdleTimer) {
    return
  }

  speechWorkerIdleTimer = setTimeout(() => {
    const worker = speechWorker
    speechWorker = null
    speechWorkerIdleTimer = null
    void worker?.terminate()
  }, 2_000)
  speechWorkerIdleTimer.unref?.()
}

function synthesizeSpeechClipInWorker(text, clipPath) {
  const worker = getSpeechWorker()
  const id = nextSpeechRequestId
  nextSpeechRequestId += 1

  return new Promise((resolve, reject) => {
    speechRequests.set(id, { reject, resolve })
    worker.postMessage({ clipPath, id, text, type: "synthesize" })
  })
}

async function synthesizeSpeechClip(text, config) {
  const normalizedText = String(text ?? "").trim()

  if (!normalizedText) {
    const error = new Error("Text is required.")
    error.code = "SUPRACHAT_SPEECH_TEXT_REQUIRED"
    throw error
  }

  if (normalizedText.length > MAX_SPEECH_TEXT_LENGTH) {
    const error = new Error("Text is too long for speech playback.")
    error.code = "SUPRACHAT_SPEECH_TEXT_TOO_LONG"
    throw error
  }

  const cacheKey = getSpeechCacheKey(normalizedText)
  const cacheDirectory = getSpeechCacheDirectory(config)
  const clipPath = resolveSpeechClipPath(config, cacheKey)

  ensureDirectory(cacheDirectory)

  if (fs.existsSync(clipPath)) {
    return {
      cacheHit: true,
      cacheKey,
      mimeType: "audio/wav",
      path: clipPath,
    }
  }

  try {
    await synthesizeSpeechClipInWorker(normalizedText, clipPath)

    return {
      cacheHit: false,
      cacheKey,
      mimeType: "audio/wav",
      path: clipPath,
    }
  } catch (error) {
    if (fs.existsSync(clipPath)) {
      fs.rmSync(clipPath, { force: true })
    }

    throw error
  }
}

module.exports = {
  synthesizeSpeechClip,
}
