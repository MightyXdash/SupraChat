const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const crypto = require("node:crypto")
const { Worker } = require("node:worker_threads")

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
let sttWorker = null
let sttWorkerIdleTimer = null
let nextSttRequestId = 1
const sttRequests = new Map()

function getSttTempDirectory() {
  return path.join(os.tmpdir(), "suprachat-stt")
}

function getSttWorker() {
  if (sttWorker) {
    clearSttWorkerIdleShutdown()
    return sttWorker
  }

  sttWorker = new Worker(path.join(__dirname, "speech-stt-worker.cjs"))
  sttWorker.unref()
  sttWorker.on("message", (message) => {
    const request = sttRequests.get(message.id)

    if (!request) {
      return
    }

    sttRequests.delete(message.id)

    if (message.ok) {
      request.resolve(message.text)
      scheduleSttWorkerIdleShutdown()
      return
    }

    const error = new Error(message.error?.message ?? "Unable to transcribe speech.")
    error.code = message.error?.code
    error.stack = message.error?.stack
    request.reject(error)
    scheduleSttWorkerIdleShutdown()
  })
  sttWorker.on("error", (error) => {
    for (const request of sttRequests.values()) {
      request.reject(error)
    }

    sttRequests.clear()
    sttWorker = null
  })
  sttWorker.on("exit", (code) => {
    if (code !== 0) {
      const error = new Error(`STT worker stopped unexpectedly with code ${code}.`)

      for (const request of sttRequests.values()) {
        request.reject(error)
      }

      sttRequests.clear()
    }

    sttWorker = null
  })

  return sttWorker
}

function clearSttWorkerIdleShutdown() {
  if (!sttWorkerIdleTimer) {
    return
  }

  clearTimeout(sttWorkerIdleTimer)
  sttWorkerIdleTimer = null
}

function scheduleSttWorkerIdleShutdown() {
  if (!sttWorker || sttRequests.size > 0 || sttWorkerIdleTimer) {
    return
  }

  sttWorkerIdleTimer = setTimeout(() => {
    const worker = sttWorker
    sttWorker = null
    sttWorkerIdleTimer = null
    void worker?.terminate()
  }, 2_000)
  sttWorkerIdleTimer.unref?.()
}

function transcribeSpeechInWorker(audioPath) {
  const worker = getSttWorker()
  const id = nextSttRequestId
  nextSttRequestId += 1

  return new Promise((resolve, reject) => {
    sttRequests.set(id, { reject, resolve })
    worker.postMessage({ audioPath, id, type: "transcribe" })
  })
}

async function transcribeSpeech(audioBuffer) {
  if (!audioBuffer || audioBuffer.length === 0) {
    const error = new Error("Audio data is required.")
    error.code = "SUPRACHAT_STT_AUDIO_REQUIRED"
    throw error
  }

  if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    const error = new Error("Audio data is too large.")
    error.code = "SUPRACHAT_STT_AUDIO_TOO_LARGE"
    throw error
  }

  const tempDir = getSttTempDirectory()
  fs.mkdirSync(tempDir, { recursive: true })

  const tempName = `${crypto.randomUUID()}.wav`
  const tempPath = path.join(tempDir, tempName)

  try {
    fs.writeFileSync(tempPath, audioBuffer)
    const text = await transcribeSpeechInWorker(tempPath)
    return text
  } finally {
    try {
      fs.rmSync(tempPath, { force: true })
    } catch {
      // Temp file cleanup best-effort
    }
  }
}

module.exports = {
  transcribeSpeech,
}
