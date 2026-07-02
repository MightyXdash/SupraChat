const fs = require("node:fs")
const http = require("node:http")
const { spawn } = require("node:child_process")
const axios = require("axios")
const {
  CHAT_MODEL,
  TITLE_MODEL,
  getAccelerationMode,
  getHardwareAccelerationArgs,
  getThreadCount,
  resolveLlamaServerPath,
  resolveModelPath,
} = require("./model-registry.cjs")
const { buildRuntimeEnvironment } = require("./runtime-preflight.cjs")

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = http.createServer()

      server.unref()
      server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          tryPort(port + 1)
          return
        }

        reject(error)
      })

      server.listen(port, "127.0.0.1", () => {
        const { port: availablePort } = server.address()
        server.close(() => resolve(availablePort))
      })
    }

    tryPort(startPort)
  })
}

function assertReadableFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    const error = new Error(`${label} is missing at ${filePath}.`)
    error.code = "SUPRACHAT_MISSING_RUNTIME_FILE"
    throw error
  }

  if (label.includes("server binary") && process.platform !== "win32") {
    try {
      fs.accessSync(filePath, fs.constants.X_OK)
    } catch {
      const error = new Error(`${label} is present but is not executable at ${filePath}.`)
      error.code = "SUPRACHAT_RUNTIME_NOT_EXECUTABLE"
      throw error
    }
  }
}

function normalizeLlamaError(error) {
  if (error?.code === "SUPRACHAT_MISSING_RUNTIME_FILE") {
    return error
  }

  const detail =
    error?.response?.data?.error?.message ??
    error?.response?.data?.message ??
    error?.message ??
    "The local llama.cpp runtime is not reachable."
  const normalized = new Error(detail)
  normalized.code = error?.code ?? "SUPRACHAT_LLAMA_RUNTIME_FAILED"
  return normalized
}

class LlamaCppWorker {
  constructor({ model, portStart }) {
    this.model = model
    this.portStart = portStart
    this.process = null
    this.port = null
    this.readyPromise = null
    this.accelerationMode = null
  }

  async ensureReady() {
    if (this.readyPromise) {
      return this.readyPromise
    }

    this.readyPromise = this.start()

    try {
      await this.readyPromise
    } catch (error) {
      this.readyPromise = null
      throw error
    }

    return this.readyPromise
  }

  async start() {
    const llamaServerPath = resolveLlamaServerPath()
    const modelPath = resolveModelPath(this.model)

    assertReadableFile(llamaServerPath, "llama.cpp server binary")
    assertReadableFile(modelPath, `${this.model.label} GGUF model`)

    const preferredMode = getAccelerationMode()
    const modes = preferredMode === "vulkan" ? ["vulkan", "cpu"] : [preferredMode]
    let lastError = null

    for (const mode of modes) {
      try {
        await this.startWithAccelerationMode(mode, llamaServerPath, modelPath)
        this.accelerationMode = mode
        return
      } catch (error) {
        lastError = error
        this.stop()

        if (mode === "vulkan") {
          console.warn(
            `[llama.cpp:${this.model.role}] Vulkan startup failed; retrying with CPU inference.`,
          )
        }
      }
    }

    throw lastError ?? new Error(`Unable to start llama.cpp ${this.model.role} worker.`)
  }

  async startWithAccelerationMode(mode, llamaServerPath, modelPath) {
    this.port = await findAvailablePort(this.portStart)

    const args = [
      "--host",
      "127.0.0.1",
      "--port",
      String(this.port),
      "--model",
      modelPath,
      "--ctx-size",
      String(this.model.contextWindowTokens),
      "--threads",
      String(getThreadCount()),
      "--parallel",
      "1",
      ...getHardwareAccelerationArgs({ mode }),
    ]

    this.process = spawn(llamaServerPath, args, {
      env: buildRuntimeEnvironment(process.env),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })

    console.log(`[llama.cpp:${this.model.role}] starting with ${mode} acceleration`)

    this.process.stdout.on("data", (chunk) => {
      process.stdout.write(`[llama.cpp:${this.model.role}] ${chunk}`)
    })

    this.process.stderr.on("data", (chunk) => {
      process.stderr.write(`[llama.cpp:${this.model.role}] ${chunk}`)
    })

    this.process.on("exit", () => {
      this.process = null
      this.port = null
      this.readyPromise = null
    })

    await this.waitForHealth(mode)
  }

  async waitForHealth(mode) {
    const startedAt = Date.now()
    const timeoutMs = mode === "vulkan" ? 35_000 : 90_000

    while (Date.now() - startedAt < timeoutMs) {
      if (!this.process) {
        throw new Error(`llama.cpp ${this.model.role} worker exited before it became ready.`)
      }

      try {
        await axios.get(`${this.baseUrl}/health`, { timeout: 800 })
        return
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 350))
      }
    }

    throw new Error(`Timed out while starting llama.cpp ${this.model.role} worker.`)
  }

  get baseUrl() {
    if (!this.port) {
      throw new Error(`llama.cpp ${this.model.role} worker is not ready.`)
    }

    return `http://127.0.0.1:${this.port}`
  }

  async streamChat(messages, temperatureOverride, thinking) {
    return this.streamChatWithParams(messages, { temperature: temperatureOverride }, thinking)
  }

  async streamChatWithParams(messages, params = {}, thinking) {
    await this.ensureReady()

    const body = {
      model: this.model.filename,
      messages,
      stream: true,
      temperature: typeof params.temperature === "number" ? params.temperature : this.model.temperature,
      top_k: typeof params.topK === "number" ? params.topK : this.model.topK,
      top_p: typeof params.topP === "number" ? params.topP : this.model.topP,
      repeat_penalty: typeof params.repeatPenalty === "number" ? params.repeatPenalty : this.model.repeatPenalty,
      max_tokens: typeof params.maxTokens === "number" ? params.maxTokens : this.model.maxTokens,
    }

    if (thinking !== undefined) {
      body.thinking = thinking
    }

    return axios.post(
      `${this.baseUrl}/v1/chat/completions`,
      body,
      { responseType: "stream", timeout: 600_000 },
    )
  }

  stop() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }

    this.port = null
    this.readyPromise = null
    this.accelerationMode = null
  }
}

function pipeOpenAiSseStream(providerStream, res, thinking = true) {
  let buffer = ""
  let completed = false
  let inReasoning = false

  function handleLine(line) {
    const trimmedLine = line.trim()

    if (!trimmedLine || !trimmedLine.startsWith("data:")) {
      return
    }

    const payloadText = trimmedLine.replace(/^data:\s*/, "")

    if (payloadText === "[DONE]") {
      if (inReasoning) {
        res.write("</suprachat-think>")
        inReasoning = false
      }
      completed = true
      return
    }

    try {
      const payload = JSON.parse(payloadText)
      const content =
        payload?.choices?.[0]?.delta?.content ??
        payload?.choices?.[0]?.text ??
        ""
      const reasoning =
        payload?.choices?.[0]?.delta?.reasoning_content ?? ""

      if (reasoning && thinking) {
        if (!inReasoning) {
          res.write("<suprachat-think>")
          inReasoning = true
        }
        res.write(reasoning)
      }

      if (content) {
        if (inReasoning) {
          res.write("</suprachat-think>")
          inReasoning = false
        }
        res.write(content)
      }
    } catch {
      // Ignore malformed provider metadata without interrupting the stream.
    }
  }

  providerStream.on("data", (chunk) => {
    buffer += chunk.toString("utf8")
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    lines.forEach(handleLine)
  })

  providerStream.on("end", () => {
    if (inReasoning) {
      res.write("</suprachat-think>")
      inReasoning = false
    }

    if (buffer) {
      handleLine(buffer)
    }

    if (!completed) {
      res.destroy(new Error("llama.cpp stream ended before completion."))
      return
    }

    res.end()
  })

  providerStream.on("error", () => {
    res.destroy(new Error("llama.cpp stream failed before completion."))
  })
}

function createLlamaCppProvider() {
  const chatWorker = new LlamaCppWorker({ model: CHAT_MODEL, portStart: 31200 })
  const titleWorker = new LlamaCppWorker({ model: TITLE_MODEL, portStart: 31300 })

  return {
    chatModel: CHAT_MODEL,
    titleModel: TITLE_MODEL,
    async warmup(onProgress) {
      onProgress?.({
        id: "title-model",
        label: `Loading ${TITLE_MODEL.label}`,
        progress: 0.48,
      })
      await titleWorker.ensureReady()
      onProgress?.({
        id: "title-model",
        label: `${TITLE_MODEL.label} ready`,
        progress: 0.62,
      })

      onProgress?.({
        id: "chat-model",
        label: `Loading ${CHAT_MODEL.label}`,
        progress: 0.68,
      })
      await chatWorker.ensureReady()
      onProgress?.({
        id: "chat-model",
        label: `${CHAT_MODEL.label} ready`,
        progress: 0.82,
      })
    },
    async streamChat(messages, thinking) {
      try {
        return await chatWorker.streamChat(messages, undefined, thinking)
      } catch (error) {
        throw normalizeLlamaError(error)
      }
    },
    async streamChatWithParams(messages, params, thinking) {
      try {
        return await chatWorker.streamChatWithParams(messages, params, thinking)
      } catch (error) {
        throw normalizeLlamaError(error)
      }
    },
    async streamTitle(message, temperature) {
      try {
        const temp = typeof temperature === "number" ? temperature : TITLE_MODEL.temperature
        return await titleWorker.streamChat([
          {
            role: "user",
            content: message,
          },
        ], temp)
      } catch (error) {
        throw normalizeLlamaError(error)
      }
    },
    stop() {
      chatWorker.stop()
      titleWorker.stop()
    },
  }
}

module.exports = {
  createLlamaCppProvider,
  pipeOpenAiSseStream,
}
