import { chatRuntimeConfig } from "@/features/chat/config/runtime"
import { ChatCompletionMessage, Conversation } from "@/features/chat/types"
import type { Hyperparameters } from "@/features/chat/config/hyperparameters"

type StreamChatCompletionOptions = {
  displayTokensPerSecondCap?: number | null
  hyperparameters?: Hyperparameters
  messages: ChatCompletionMessage[]
  onChunk: (chunk: string) => void
  onRawChunk?: (chunk: string) => void
  signal?: AbortSignal
}

type StreamConversationTitleOptions = {
  userMessage: string
  onChunk: (chunk: string) => void
  temperature?: number
  signal?: AbortSignal
}

export class ChatServiceError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ChatServiceError"
    this.status = status
  }
}

function withLocalApiHeaders(init?: RequestInit): RequestInit | undefined {
  const headers = new Headers(init?.headers)

  for (const [key, value] of Object.entries(chatRuntimeConfig.localApiHeaders)) {
    headers.set(key, value)
  }

  return {
    ...init,
    headers,
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function readErrorDetail(response: Response) {
  let detail = "Unable to generate a response."

  try {
    const data = await response.clone().json()
    detail = data.detail ?? detail
  } catch {
    const responseText = await response.text()
    detail = responseText || detail
  }

  return detail
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  const maxAttempts = 8

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      if (init?.signal?.aborted || error instanceof DOMException && error.name === "AbortError") {
        throw error
      }

      if (attempt === maxAttempts) {
        throw error
      }

      await delay(attempt * 150)
    }
  }

  throw new Error("Unable to reach the local SupraChat backend.")
}

async function readJson<T>(response: Response) {
  if (!response.ok) {
    throw new ChatServiceError(await readErrorDetail(response), response.status)
  }

  return (await response.json()) as T
}

export async function fetchConversations() {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/conversations`,
    withLocalApiHeaders(),
  )
  const data = await readJson<{ conversations: Conversation[] }>(response)
  return data.conversations
}

export async function createStoredConversation(conversation: Conversation) {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/conversations`,
    withLocalApiHeaders({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversation }),
    }),
  )

  await readJson<{ conversation: Conversation }>(response)
  return conversation
}

export async function updateStoredConversation(conversation: Conversation) {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/conversations/${encodeURIComponent(conversation.id)}`,
    withLocalApiHeaders({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversation }),
    }),
  )

  await readJson<{ conversation: Conversation }>(response)
  return conversation
}

export async function deleteStoredConversation(conversationId: string) {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/conversations/${encodeURIComponent(conversationId)}`,
    withLocalApiHeaders({
      method: "DELETE",
    }),
  )

  await readJson<{ ok: true }>(response)
}

export async function synthesizeSpeech(text: string) {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/speech/tts`,
    withLocalApiHeaders({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }),
  )

  if (!response.ok) {
    throw new Error(await readErrorDetail(response))
  }

  return {
    blob: await response.blob(),
    cacheHit: response.headers.get("X-SupraChat-Speech-Cache-Hit") === "1",
    cacheKey: response.headers.get("X-SupraChat-Speech-Cache-Key") ?? "",
  }
}

export async function streamChatCompletion({
  displayTokensPerSecondCap,
  hyperparameters,
  messages,
  onChunk,
  onRawChunk,
  signal,
}: StreamChatCompletionOptions) {
  const response = await fetchWithRetry(
    chatRuntimeConfig.endpoint,
    withLocalApiHeaders({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        thinking: true,
        ...(hyperparameters
          ? {
            temperature: hyperparameters.temperature,
            top_k: hyperparameters.topK,
            top_p: hyperparameters.topP,
            repeat_penalty: hyperparameters.repeatPenalty,
            max_tokens: hyperparameters.maxTokens,
          }
          : {}),
      }),
      signal,
    }),
  )

  if (!response.ok || !response.body) {
    throw new Error(await readErrorDetail(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const pendingOutput: string[] = []
  let streamFinished = false
  let displayFrame: number | undefined
  let abortDisplay: (() => void) | undefined
  const maxDisplayBatchCharacters =
    displayTokensPerSecondCap === null
      ? chatRuntimeConfig.stream.maxDisplayBatchCharacters
      : Math.max(
        1,
        Math.min(
          chatRuntimeConfig.stream.maxDisplayBatchCharacters,
          Math.ceil(
            (Math.min(
              Math.max(
                displayTokensPerSecondCap ?? chatRuntimeConfig.stream.defaultVisibleTokensPerSecondCap,
                chatRuntimeConfig.stream.minimumVisibleTokensPerSecondCap,
              ),
              chatRuntimeConfig.stream.maximumVisibleTokensPerSecondCap,
            ) *
              chatRuntimeConfig.stream.averageCharactersPerToken) /
              chatRuntimeConfig.stream.assumedDisplayFramesPerSecond,
          ),
        ),
      )

  const displayComplete = new Promise<void>((resolve, reject) => {
    const flushDisplay = () => {
      displayFrame = undefined

      if (signal?.aborted) {
        abortDisplay?.()
        return
      }

      let batch = ""

      while (pendingOutput.length > 0 && batch.length < maxDisplayBatchCharacters) {
        batch += pendingOutput.shift()
      }

      if (batch) {
        onChunk(batch)
      }

      if (pendingOutput.length > 0 || !streamFinished) {
        displayFrame = window.requestAnimationFrame(flushDisplay)
        return
      }

      resolve()
    }

    abortDisplay = () => {
      pendingOutput.length = 0
      if (displayFrame !== undefined) {
        window.cancelAnimationFrame(displayFrame)
      }
      reject(new DOMException("Generation stopped.", "AbortError"))
    }

    if (signal?.aborted) {
      abortDisplay()
      return
    }

    signal?.addEventListener("abort", abortDisplay, { once: true })
    displayFrame = window.requestAnimationFrame(flushDisplay)
  })

  const thinkingMarkers = ["<suprachat-think>", "</suprachat-think>", "<think>", "</think>"]
  const maxMarkerLength = Math.max(...thinkingMarkers.map((marker) => marker.length))
  let markerBuffer = ""

  const findMarkerAtStart = (text: string) => thinkingMarkers.find((marker) => text.startsWith(marker))

  const isMarkerPrefix = (text: string) => thinkingMarkers.some((marker) => marker.startsWith(text))

  const queueText = (text: string) => {
    if (text) {
      pendingOutput.push(text)
    }
  }

  const queueChunk = (chunk: string) => {
    if (!chunk && !markerBuffer) {
      return
    }

    const text = markerBuffer + (chunk ?? "")
    markerBuffer = ""

    let cursor = 0

    while (cursor < text.length) {
      const remaining = text.slice(cursor)
      const marker = findMarkerAtStart(remaining)

      if (marker) {
        pendingOutput.push(marker)
        cursor += marker.length
        continue
      }

      if (remaining.startsWith("<")) {
        const possibleMarker = remaining.slice(0, Math.min(maxMarkerLength, remaining.length))

        if (isMarkerPrefix(possibleMarker)) {
          markerBuffer = remaining
          break
        }
      }

      queueText(text[cursor])
      cursor += 1
    }
  }

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Generation stopped.", "AbortError")
      }

      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      if (chunk) {
        onRawChunk?.(chunk)
      }
      queueChunk(chunk)
    }

    const remaining = decoder.decode()
    if (remaining) {
      onRawChunk?.(remaining)
    }
    queueChunk(remaining)

    if (markerBuffer) {
      queueText(markerBuffer)
      markerBuffer = ""
    }

    streamFinished = true
    await displayComplete
  } finally {
    signal?.removeEventListener("abort", abortDisplay ?? (() => undefined))
    reader.releaseLock()

    if (displayFrame !== undefined) {
      window.cancelAnimationFrame(displayFrame)
    }
  }
}

export async function streamConversationTitle({
  userMessage,
  onChunk,
  temperature,
  signal,
}: StreamConversationTitleOptions) {
  const response = await fetchWithRetry(
    chatRuntimeConfig.titleEndpoint,
    withLocalApiHeaders({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: userMessage, temperature }),
      signal,
    }),
  )

  if (!response.ok || !response.body) {
    throw new Error(await readErrorDetail(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Generation stopped.", "AbortError")
    }

    const { done, value } = await reader.read()

    if (done) {
      break
    }

    const chunk = decoder.decode(value, { stream: true })

    if (chunk) {
      onChunk(chunk)
    }
  }

  const remaining = decoder.decode()

  if (remaining) {
    onChunk(remaining)
  }
}
