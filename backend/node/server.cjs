const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const { createChatDatabase } = require("./chat-database.cjs")
const {
  createLlamaCppProvider,
  pipeOpenAiSseStream,
} = require("./llama-cpp-provider.cjs")
const { checkCurrentRuntime } = require("./runtime-preflight.cjs")
const { resolveRuntimeConfig } = require("./runtime-config.cjs")
const { createVoiceRuntime } = require("./suva/voice-runtime.cjs")

function getSystemPrompt(filename = "sys_prompt.md", fallback = "You are Supra") {
  const possiblePaths = [
    path.join(__dirname, "..", "..", filename),
    path.join(process.cwd(), filename),
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
  return fallback;
}

let serverInstance = null
let databaseInstance = null
let runtimeConfig = null
let generationProvider = null
let voiceRuntime = null

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

function readJsonBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = ""

    req.on("data", (chunk) => {
      body += chunk
      if (body.length > maxBytes) {
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

  if (req.method === "GET" && url.pathname === "/suva/voice/health") {
    sendJson(req, res, 200, {
      ok: true,
      service: "suva-voice",
      runtime: "onnx",
      voice: voiceRuntime.health(),
    })
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

      if (messages.length === 0) {
        sendJson(req, res, 400, {
          ok: false,
          error: "missing_messages",
          detail: "Send at least one chat message.",
        })
        return
      }

      const systemPrompt = getSystemPrompt()
      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((message) => ({
          role: message.role,
          content: String(message.content ?? ""),
        })),
      ]

      const response = await provider.streamChat(formattedMessages)

      writeStreamHeaders(req, res, config)
      provider.pipeStream(response.data, res)
    } catch (error) {
      sendJson(req, res, 502, {
        ok: false,
        error: "generation_failed",
        detail: providerErrorDetail(error, config, "chat"),
      })
    }

    return
  }

  if (req.method === "POST" && url.pathname === "/suva/chat") {
    try {
      const body = await readJsonBody(req)
      const messages = Array.isArray(body.messages) ? body.messages : []

      if (messages.length === 0) {
        sendJson(req, res, 400, {
          ok: false,
          error: "missing_messages",
          detail: "Send at least one SuVA message.",
        })
        return
      }

      const systemPrompt = getSystemPrompt(
        "SuVA_sys_prompt.md",
        "You are SuVA, the concise voice companion for SupraChat.",
      )
      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((message) => ({
          role: message.role,
          content: String(message.content ?? ""),
        })),
      ]

      const response = await provider.streamChat(formattedMessages)

      writeStreamHeaders(req, res, config)
      provider.pipeStream(response.data, res)
    } catch (error) {
      sendJson(req, res, 502, {
        ok: false,
        error: "suva_generation_failed",
        detail: providerErrorDetail(error, config, "chat"),
      })
    }

    return
  }

  if (req.method === "POST" && url.pathname === "/suva/stt") {
    try {
      const body = await readJsonBody(req, 12_000_000)
      const samples = Array.isArray(body.samples) ? body.samples : []
      const sampleRate = Number(body.sampleRate)

      if (samples.length === 0 || !Number.isFinite(sampleRate)) {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_audio",
          detail: "Send recorded audio samples to transcribe.",
        })
        return
      }

      const text = await voiceRuntime.transcribe({
        sampleRate,
        samples,
      })

      sendJson(req, res, 200, { ok: true, text })
    } catch (error) {
      const detail =
        error?.code === "SUPRACHAT_SUVA_VOICE_RUNTIME_NOT_READY"
          ? error.message
          : "Unable to transcribe the recording. Check the local SuVA voice runtime and try again."

      sendJson(req, res, 502, {
        ok: false,
        error: "suva_transcription_failed",
        detail,
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
  voiceRuntime = createVoiceRuntime()
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
      voiceRuntime = null
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

    voiceRuntime = null
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

  voiceRuntime = null
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
