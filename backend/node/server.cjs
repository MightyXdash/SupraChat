const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const axios = require("axios")
const { createChatDatabase } = require("./chat-database.cjs")
const { resolveRuntimeConfig } = require("./runtime-config.cjs")

const TITLE_SYSTEM_PROMPT = `You are a conversation title generator.

Your task is to generate a concise title based ONLY on the user's first message.

Rules:
- Output valid JSON only.
- No markdown.
- No explanations.
- No thinking.
- No extra fields.
- Capture the main intent, topic, or goal.
- Prefer 2-4 words.
- Maximum 50 characters.
- Use natural human wording.
- Avoid generic titles like "Question", "Help", "Discussion", "Chat", or "Conversation".
- Avoid clickbait.
- Do not repeat unnecessary details.
- Use title Case.
- The title should sound like something a real user would expect to see in their chat history.

Output schema:

{
  "short": "2-3 words",
  "medium": "3-5 words",
  "long": "descriptive title"
}

Examples:

User: "How do I train a 7B model on my RTX 4090?"
{
  "short": "7B Training",
  "medium": "Training A 7B Model",
  "long": "Training A 7B Model On RTX 4090"
}

User: "My Chrome keeps crashing on macOS"
{
  "short": "Chrome Crashes",
  "medium": "Chrome On macOS",
  "long": "Fixing Chrome Crashes On macOS"
}

User: "Can you make me a workout plan for building muscle?"
{
  "short": "Muscle Building",
  "medium": "Muscle Workout Plan",
  "long": "Workout Plan For Building Muscle"
}

User: "What's the best way to learn Python as a beginner?"
{
  "short": "Learn Python",
  "medium": "Python For Beginners",
  "long": "Best Way To Learn Python"
}

User: "My laptop battery drains really fast"
{
  "short": "Battery Drain",
  "medium": "Laptop Battery Issues",
  "long": "Fixing Fast Laptop Battery Drain"
}

User: "Can you explain quantum computing simply?"
{
  "short": "Quantum Computing",
  "medium": "Quantum Computing Basics",
  "long": "Simple Quantum Computing Explanation"
}

User: "I need ideas for a modern portfolio website"
{
  "short": "Portfolio Ideas",
  "medium": "Modern Portfolio Design",
  "long": "Ideas For A Modern Portfolio Website"
}

User: "How do I prepare for a math exam in one week?"
{
  "short": "Math Exam",
  "medium": "Math Exam Prep",
  "long": "Preparing For A Math Exam"
}

User: "Help me write a professional email to my teacher"
{
  "short": "Teacher Email",
  "medium": "Professional Teacher Email",
  "long": "Writing A Professional Teacher Email"
}

User: "Should I buy a MacBook Air or a Windows laptop?"
{
  "short": "Laptop Choice",
  "medium": "MacBook Or Windows",
  "long": "Choosing Between MacBook And Windows"
}

User: "I want to start a YouTube channel about programming"
{
  "short": "Programming Channel",
  "medium": "Starting A Tech Channel",
  "long": "Starting A Programming YouTube Channel"
}

User: "Can you help debug this PyTorch training script?"
{
  "short": "PyTorch Debugging",
  "medium": "Debug Training Script",
  "long": "Debugging A PyTorch Training Script"
}

Generate the JSON now.`

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
  return "You are a helpful, precise, and composed AI assistant.";
}

let serverInstance = null
let databaseInstance = null
let runtimeConfig = null

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

function pipeOllamaChatStream(providerStream, res) {
  let buffer = ""
  let providerCompleted = false

  providerStream.on("data", (chunk) => {
    buffer += chunk.toString("utf8")
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.trim()) {
        continue
      }

      try {
        const payload = JSON.parse(line)
        const content = payload?.message?.content

        if (payload?.done === true) {
          providerCompleted = true
        }

        if (content) {
          res.write(content)
        }
      } catch {
        // Ignore malformed provider chunks without ending a valid stream.
      }
    }
  })

  providerStream.on("end", () => {
    if (buffer.trim()) {
      try {
        const payload = JSON.parse(buffer)
        const content = payload?.message?.content

        if (payload?.done === true) {
          providerCompleted = true
        }

        if (content) {
          res.write(content)
        }
      } catch {
        // The stream is complete; incomplete provider metadata can be ignored.
      }
    }

    if (!providerCompleted) {
      res.destroy(new Error("Provider stream ended before completion."))
      return
    }

    res.end()
  })

  providerStream.on("error", () => {
    res.destroy(new Error("Provider stream failed before completion."))
  })
}

function createServer(database, config) {
  return http.createServer(async (req, res) => {
  const url = buildUrl(req)

  if (req.method === "OPTIONS") {
    sendJson(req, res, 204, {})
    return
  }

  if (req.method === "GET" && url.pathname === "/health") {
    database.recordHealthCheck()

    let python = { ok: false }
    try {
      const response = await axios.get("http://127.0.0.1:8000/health", { timeout: 1200 })
      python = response.data
    } catch {
      python = { ok: false, service: "python-backend", detail: "unreachable" }
    }

    sendJson(req, res, 200, {
      ok: true,
      service: "node-backend",
      python,
      model: config.chatModel,
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

      database.saveConversation(conversation)
      sendJson(req, res, 201, { ok: true, conversation })
    } catch (error) {
      const detail =
        error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
          ? "A conversation with this id already exists."
          : "Unable to store the conversation."
      const statusCode = error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ? 409 : 500

      sendJson(req, res, statusCode, { ok: false, error: "conversation_create_failed", detail })
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

      const response = await axios.post(
        `${config.ollamaBaseUrl}/api/chat`,
        {
          model: config.chatModel,
          messages: formattedMessages,
          stream: true,
          think: false,
        },
        { responseType: "stream", timeout: 600_000 },
      )

      writeStreamHeaders(req, res, config)
      pipeOllamaChatStream(response.data, res)
    } catch (error) {
      const detail =
        error?.code === "ECONNREFUSED"
          ? `Ollama is not reachable at ${config.ollamaBaseUrl}.`
          : "Unable to generate a response. Check the provider connection and try again."

      sendJson(req, res, 502, {
        ok: false,
        error: "ollama_generation_failed",
        detail,
      })
    }

    return
  }

  if (req.method === "POST" && url.pathname === "/chat/title") {
    try {
      const body = await readJsonBody(req)
      const message = String(body.message ?? "").trim()

      if (!message) {
        sendJson(req, res, 400, {
          ok: false,
          error: "missing_title_message",
          detail: "Send the first user message to generate a title.",
        })
        return
      }

      const response = await axios.post(
        `${config.ollamaBaseUrl}/api/chat`,
        {
          model: config.titleModel,
          messages: [
            { role: "system", content: TITLE_SYSTEM_PROMPT },
            { role: "user", content: message },
          ],
          stream: true,
          think: false,
          keep_alive: 0,
          options: {
            temperature: 0.2,
            num_predict: 96,
          },
        },
        { responseType: "stream", timeout: 120_000 },
      )

      writeStreamHeaders(req, res, config)
      pipeOllamaChatStream(response.data, res)
    } catch (error) {
      const detail =
        error?.code === "ECONNREFUSED"
          ? `Ollama is not reachable at ${config.ollamaBaseUrl}.`
          : "Unable to generate a conversation title. Check the provider connection and try again."

      sendJson(req, res, 502, {
        ok: false,
        error: "ollama_title_generation_failed",
        detail,
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
  serverInstance = createServer(databaseInstance, runtimeConfig)
  serverInstance.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Node backend already available on http://127.0.0.1:${runtimeConfig.port}`)
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
    console.log(`SupraChat Ollama model: ${runtimeConfig.chatModel}`)
    console.log(`SupraChat title model: ${runtimeConfig.titleModel}`)
  })

  return serverInstance
}

if (require.main === module) {
  startServer()
}

module.exports = {
  startServer,
}
