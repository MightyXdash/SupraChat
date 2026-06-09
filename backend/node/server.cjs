const http = require("node:http")
const Database = require("better-sqlite3")
const axios = require("axios")

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
const CHAT_MODEL = process.env.SUPRACHAT_OLLAMA_MODEL ?? "qwen3.5:4b"
const PORT = Number(process.env.SUPRACHAT_NODE_PORT ?? 3001)
const ALLOWED_ORIGINS = new Set(["http://127.0.0.1:5173", "http://localhost:5173", "null"])
let serverInstance = null

function getAllowedOrigin(req) {
  const origin = req.headers.origin
  return ALLOWED_ORIGINS.has(origin) ? origin : "http://127.0.0.1:5173"
}

const db = new Database("suprachat.db")
db.exec(`
  CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": getAllowedOrigin(res.req),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

function createServer() {
  return http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return
  }

  if (req.method === "GET" && req.url === "/health") {
    db.prepare("INSERT INTO health_checks (source) VALUES (?)").run("node-backend")

    let python = { ok: false }
    try {
      const response = await axios.get("http://127.0.0.1:8000/health", { timeout: 1200 })
      python = response.data
    } catch {
      python = { ok: false, service: "python-backend", detail: "unreachable" }
    }

    sendJson(res, 200, { ok: true, service: "node-backend", python, model: CHAT_MODEL })
    return
  }

  if (req.method === "POST" && req.url === "/chat") {
    try {
      const body = await readJsonBody(req)
      const messages = Array.isArray(body.messages) ? body.messages : []

      if (messages.length === 0) {
        sendJson(res, 400, {
          ok: false,
          error: "missing_messages",
          detail: "Send at least one chat message.",
        })
        return
      }

      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model: CHAT_MODEL,
          messages: messages.map((message) => ({
            role: message.role,
            content: String(message.content ?? ""),
          })),
          stream: true,
          think: false,
        },
        { responseType: "stream", timeout: 600_000 },
      )

      res.writeHead(200, {
        "Access-Control-Allow-Origin": getAllowedOrigin(req),
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Content-Type": "text/plain; charset=utf-8",
      })

      let buffer = ""
      let providerCompleted = false
      response.data.on("data", (chunk) => {
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

      response.data.on("end", () => {
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

      response.data.on("error", () => {
        res.destroy(new Error("Provider stream failed before completion."))
      })
    } catch (error) {
      const detail =
        error?.code === "ECONNREFUSED"
          ? "Ollama is not reachable at 127.0.0.1:11434."
          : "Unable to generate a response. Check the provider connection and try again."

      sendJson(res, 502, {
        ok: false,
        error: "ollama_generation_failed",
        detail,
      })
    }

    return
  }

  sendJson(res, 404, { ok: false, error: "not_found" })
  })
}

function startServer(port = PORT) {
  if (serverInstance) {
    return serverInstance
  }

  serverInstance = createServer()
  serverInstance.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Node backend already available on http://127.0.0.1:${port}`)
      serverInstance = null
      return
    }

    throw error
  })

  serverInstance.listen(port, () => {
    console.log(`Node backend listening on http://127.0.0.1:${port}`)
    console.log(`SupraChat Ollama model: ${CHAT_MODEL}`)
  })

  return serverInstance
}

if (require.main === module) {
  startServer()
}

module.exports = {
  startServer,
}
