const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const { createChatDatabase } = require("./chat-database.cjs")
const {
  createLlamaCppProvider,
  pipeOpenAiSseStream,
} = require("./llama-cpp-provider.cjs")
const {
  CHAT_MODEL,
  SPEECH_STT_MODEL,
  SPEECH_TTS_MODEL,
  TITLE_MODEL,
  getHardwareAccelerationArgs,
  getThreadCount,
  resolveModelPath,
  resolveResourceRoot,
  resolveSpeechSttModel,
  resolveSpeechTtsModel,
} = require("./model-registry.cjs")
const { checkCurrentRuntime } = require("./runtime-preflight.cjs")
const { resolveRuntimeConfig } = require("./runtime-config.cjs")
const { getSpeechOnnxRuntimeInfo } = require("./speech-onnx-runtime.cjs")
const { synthesizeSpeechClip } = require("./speech-service.cjs")

function getSystemPrompt() {
  const possiblePaths = [
    path.join(__dirname, "..", "..", "sys_prompt.md"),
    path.join(process.cwd(), "sys_prompt.md"),
  ];
  for (const p of possiblePaths) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) {
      try {
        const content = fs.readFileSync(resolved, "utf8").trim();
        if (content) {
          return content;
        }
      } catch (err) {
        // Ignore
      }
    }
  }
  return "You are Supra";
}

let serverInstance = null
let databaseInstance = null
let runtimeConfig = null
let generationProvider = null

function getAllowedOrigin(req, config) {
  const origin = req.headers.origin
  return config.allowedOrigins.has(origin) ? origin : "http://127.0.0.1:5173"
}

function buildUrl(req) {
  return new URL(req.url, "http://127.0.0.1")
}

function isValidConversation(payload) {
  return (
    payload &&
    typeof payload.id === "string" &&
    typeof payload.title === "string" &&
    typeof payload.createdAt === "string" &&
    typeof payload.updatedAt === "string" &&
    Array.isArray(payload.messages) &&
    payload.messages.every(
      (message) =>
        message &&
        typeof message.id === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        typeof message.createdAt === "string",
    )
  )
}

function sendJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": getAllowedOrigin(req, runtimeConfig),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json",
  })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""

    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error("payload_too_large"))
        req.destroy()
      }
    })

    req.on("end", () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error("invalid_json"))
      }
    })
  })
}

function writeStreamHeaders(req, res, config) {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": getAllowedOrigin(req, config),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "text/plain; charset=utf-8",
  })
}

function sendFile(req, res, statusCode, filePath, mimeType, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": getAllowedOrigin(req, runtimeConfig),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Type": mimeType,
    ...extraHeaders,
  })

  fs.createReadStream(filePath).pipe(res)
}

function fileSizeBytes(filePath) {
  try {
    return fs.statSync(filePath).size
  } catch {
    return null
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function serializeModel(model, modelPath) {
  return {
    ...model,
    path: modelPath,
    installed: fileExists(modelPath),
    sizeBytes: fileSizeBytes(modelPath),
  }
}

function getSettingsModelsPayload() {
  const resourceRoot = resolveResourceRoot()
  const ttsModel = resolveSpeechTtsModel(resourceRoot)
  const sttModel = resolveSpeechSttModel(resourceRoot)

  return {
    ok: true,
    resourceRoot,
    models: [
      serializeModel(CHAT_MODEL, resolveModelPath(CHAT_MODEL, resourceRoot)),
      serializeModel(TITLE_MODEL, resolveModelPath(TITLE_MODEL, resourceRoot)),
      serializeModel(SPEECH_TTS_MODEL, ttsModel.modelPath),
      serializeModel(SPEECH_STT_MODEL, sttModel.encoderPath),
    ],
  }
}

function getSettingsRuntimePayload(config, provider) {
  return {
    ok: true,
    apiBaseUrl: `http://127.0.0.1:${config.port}`,
    port: config.port,
    runtime: "llama.cpp",
    runtimePreflight: checkCurrentRuntime(),
    platform: process.platform,
    arch: process.arch,
    resourceRoot: resolveResourceRoot(),
    chatModel: provider.chatModel,
    titleModel: provider.titleModel,
    threadCount: getThreadCount(),
    hardwareAccelerationArgs: getHardwareAccelerationArgs(),
    speechRuntime: getSpeechOnnxRuntimeInfo(),
  }
}

function getSettingsStoragePayload(config, database) {
  return {
    ok: true,
    dataDir: path.dirname(config.databasePath),
    databasePath: config.databasePath,
    databaseSizeBytes: fileSizeBytes(config.databasePath),
    stats: database.getStats(),
  }
}

function createGenerationProvider() {
  const provider = createLlamaCppProvider()

  return {
    ...provider,
    pipeStream: pipeOpenAiSseStream,
  }
}

function providerErrorDetail(error, config, task) {
  if (
    error?.code === "SUPRACHAT_MISSING_RUNTIME_FILE" ||
    error?.code === "SUPRACHAT_RUNTIME_NOT_EXECUTABLE"
  ) {
    return error.message
  }

  return task === "title"
    ? "Unable to generate a conversation title. Check the local model runtime and try again."
    : "Unable to generate a response. Check the local model runtime and try again."
}

function createServer(database, config, provider) {
  return http.createServer(async (req, res) => {
  const url = buildUrl(req)

  if (req.method === "OPTIONS") {
    sendJson(req, res, 204, {})
    return
  }

  if (req.method === "GET" && url.pathname === "/health") {
    database.recordHealthCheck()

    sendJson(req, res, 200, {
      ok: true,
      service: "node-backend",
      runtime: "llama.cpp",
      runtimePreflight: checkCurrentRuntime(),
      model: provider.chatModel.label,
      titleModel: provider.titleModel.label,
    })
    return
  }

  if (req.method === "GET" && url.pathname === "/settings/runtime") {
    sendJson(req, res, 200, getSettingsRuntimePayload(config, provider))
    return
  }

  if (req.method === "GET" && url.pathname === "/settings/models") {
    sendJson(req, res, 200, getSettingsModelsPayload())
    return
  }

  if (req.method === "GET" && url.pathname === "/settings/storage") {
    sendJson(req, res, 200, getSettingsStoragePayload(config, database))
    return
  }

  if (req.method === "GET" && url.pathname === "/conversations") {
    try {
      sendJson(req, res, 200, { ok: true, conversations: database.serializeConversations() })
    } catch {
      sendJson(req, res, 500, {
        ok: false,
        error: "conversation_list_failed",
        detail: "Unable to load saved conversations.",
      })
    }
    return
  }

  if (req.method === "POST" && url.pathname === "/conversations") {
    try {
      const body = await readJsonBody(req)
      const conversation = body.conversation

      if (!isValidConversation(conversation)) {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_conversation",
          detail: "Conversation payload is not valid.",
        })
        return
      }

      if (database.hasConversation(conversation.id)) {
        database.replaceConversation(conversation)
        sendJson(req, res, 200, { ok: true, conversation })
        return
      }

      database.saveConversation(conversation)
      sendJson(req, res, 201, { ok: true, conversation })
    } catch (error) {
      sendJson(req, res, 500, {
        ok: false,
        error: "conversation_create_failed",
        detail: "Unable to store the conversation.",
      })
    }

    return
  }

  if (req.method === "PUT" && url.pathname.startsWith("/conversations/")) {
    try {
      const body = await readJsonBody(req)
      const conversation = body.conversation
      const conversationId = decodeURIComponent(url.pathname.replace("/conversations/", ""))

      if (!isValidConversation(conversation) || conversation.id !== conversationId) {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_conversation",
          detail: "Conversation payload is not valid.",
        })
        return
      }

      if (!database.hasConversation(conversationId)) {
        sendJson(req, res, 404, {
          ok: false,
          error: "conversation_not_found",
          detail: "The selected conversation could not be found.",
        })
        return
      }

      database.replaceConversation(conversation)
      sendJson(req, res, 200, { ok: true, conversation })
    } catch {
      sendJson(req, res, 500, {
        ok: false,
        error: "conversation_update_failed",
        detail: "Unable to update the conversation.",
      })
    }

    return
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/conversations/")) {
    try {
      const conversationId = decodeURIComponent(url.pathname.replace("/conversations/", ""))
      const result = database.deleteConversation(conversationId)

      if (result.changes === 0) {
        sendJson(req, res, 404, {
          ok: false,
          error: "conversation_not_found",
          detail: "The selected conversation could not be found.",
        })
        return
      }

      sendJson(req, res, 200, { ok: true })
    } catch {
      sendJson(req, res, 500, {
        ok: false,
        error: "conversation_delete_failed",
        detail: "Unable to delete the conversation.",
      })
    }
    return
  }

  if (req.method === "POST" && url.pathname === "/chat") {
    try {
      const body = await readJsonBody(req)
      const messages = Array.isArray(body.messages) ? body.messages : []
      const thinking = body.thinking !== false

      if (messages.length === 0) {
        sendJson(req, res, 400, {
          ok: false,
          error: "missing_messages",
          detail: "Send at least one chat message.",
        })
        return
      }

      const systemPrompt = getSystemPrompt()
      const promptContent = thinking
        ? systemPrompt
        : `${systemPrompt}\n\nDo not reason step by step. Do not use thinking tags. Respond directly and concisely.`
      const formattedMessages = [
        { role: "system", content: promptContent },
        ...messages.map((message) => ({
          role: message.role,
          content: String(message.content ?? ""),
        })),
      ]

      const response = await provider.streamChat(formattedMessages, thinking)

      writeStreamHeaders(req, res, config)
      provider.pipeStream(response.data, res, thinking)
    } catch (error) {
      sendJson(req, res, 502, {
        ok: false,
        error: "generation_failed",
        detail: providerErrorDetail(error, config, "chat"),
      })
    }

    return
  }

  if (req.method === "POST" && url.pathname === "/chat/title") {
    try {
      const body = await readJsonBody(req)
      const message = String(body.message ?? "").trim()
      const temperature = typeof body.temperature === "number" ? body.temperature : undefined

      if (!message) {
        sendJson(req, res, 400, {
          ok: false,
          error: "missing_title_message",
          detail: "Send the first user message to generate a title.",
        })
        return
      }

      const response = await provider.streamTitle(message, temperature)

      writeStreamHeaders(req, res, config)
      provider.pipeStream(response.data, res)
    } catch (error) {
      sendJson(req, res, 502, {
        ok: false,
        error: "title_generation_failed",
        detail: providerErrorDetail(error, config, "title"),
      })
    }

    return
  }

  if (req.method === "POST" && url.pathname === "/speech/tts") {
    try {
      const body = await readJsonBody(req)
      const text = String(body.text ?? "")
      const clip = await synthesizeSpeechClip(text, config)

      sendFile(req, res, 200, clip.path, clip.mimeType, {
        "X-SupraChat-Speech-Cache-Hit": clip.cacheHit ? "1" : "0",
        "X-SupraChat-Speech-Cache-Key": clip.cacheKey,
      })
    } catch (error) {
      const isUserError =
        error?.code === "SUPRACHAT_SPEECH_TEXT_REQUIRED" ||
        error?.code === "SUPRACHAT_SPEECH_TEXT_TOO_LONG" ||
        error?.code === "SUPRACHAT_SPEECH_PLATFORM_UNSUPPORTED"

      sendJson(req, res, isUserError ? 400 : 502, {
        ok: false,
        error: "speech_synthesis_failed",
        detail: error?.message ?? "Unable to synthesize speech playback.",
      })
    }

    return
  }

  sendJson(req, res, 404, { ok: false, error: "not_found" })
  })
}

function startServer(options = {}) {
  if (serverInstance) {
    return serverInstance
  }

  runtimeConfig = resolveRuntimeConfig(options)
  databaseInstance = createChatDatabase(runtimeConfig.databasePath)
  generationProvider = createGenerationProvider()
  serverInstance = createServer(databaseInstance, runtimeConfig, generationProvider)
  serverInstance.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Node backend already available on http://127.0.0.1:${runtimeConfig.port}`)
      if (generationProvider) {
        generationProvider.stop()
        generationProvider = null
      }
      if (databaseInstance) {
        databaseInstance.close()
        databaseInstance = null
      }
      serverInstance = null
      runtimeConfig = null
      return
    }

    throw error
  })
  serverInstance.on("close", () => {
    if (generationProvider) {
      generationProvider.stop()
      generationProvider = null
    }

    if (databaseInstance) {
      databaseInstance.close()
      databaseInstance = null
    }

    serverInstance = null
    runtimeConfig = null
  })

  serverInstance.listen(runtimeConfig.port, "127.0.0.1", () => {
    const address = serverInstance.address()
    const boundPort =
      address && typeof address === "object" ? address.port : runtimeConfig.port

    console.log(`Node backend listening on http://127.0.0.1:${boundPort}`)
    console.log(`SupraChat database: ${runtimeConfig.databasePath}`)
    console.log("SupraChat runtime: llama.cpp")
    console.log(`SupraChat speech runtime: ${getSpeechOnnxRuntimeInfo().backend}`)
    console.log(`SupraChat chat model: ${generationProvider.chatModel.label}`)
    console.log(`SupraChat title model: ${generationProvider.titleModel.label}`)
  })

  return serverInstance
}

function stopServer() {
  if (serverInstance) {
    serverInstance.close()
    return
  }

  if (generationProvider) {
    generationProvider.stop()
    generationProvider = null
  }

  if (databaseInstance) {
    databaseInstance.close()
    databaseInstance = null
  }
}

if (require.main === module) {
  startServer()

  process.on("SIGINT", () => {
    stopServer()
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    stopServer()
    process.exit(0)
  })
}

module.exports = {
  startServer,
  stopServer,
}
