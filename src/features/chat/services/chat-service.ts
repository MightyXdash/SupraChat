import { chatRuntimeConfig } from "@/features/chat/config/runtime"
import { ChatCompletionMessage, Conversation } from "@/features/chat/types"

type StreamChatCompletionOptions = {
  messages: ChatCompletionMessage[]
  onChunk: (chunk: string) => void
}

type StreamConversationTitleOptions = {
  userMessage: string
  onChunk: (chunk: string) => void
}

async function delay(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function readErrorDetail(response: Response) {
  let detail = "Unable to generate a response."

  try {
    const data = await response.json()
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
    throw new Error(await readErrorDetail(response))
  }

  return (await response.json()) as T
}

export async function fetchConversations() {
  const response = await fetchWithRetry(`${chatRuntimeConfig.apiBaseUrl}/conversations`)
  const data = await readJson<{ conversations: Conversation[] }>(response)
  return data.conversations
}

export async function createStoredConversation(conversation: Conversation) {
  const response = await fetchWithRetry(`${chatRuntimeConfig.apiBaseUrl}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversation }),
  })

  await readJson<{ conversation: Conversation }>(response)
  return conversation
}

export async function updateStoredConversation(conversation: Conversation) {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/conversations/${encodeURIComponent(conversation.id)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversation }),
    },
  )

  await readJson<{ conversation: Conversation }>(response)
  return conversation
}

export async function deleteStoredConversation(conversationId: string) {
  const response = await fetchWithRetry(
    `${chatRuntimeConfig.apiBaseUrl}/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "DELETE",
    },
  )

  await readJson<{ ok: true }>(response)
}

export async function streamChatCompletion({
  messages,
  onChunk,
}: StreamChatCompletionOptions) {
  const response = await fetchWithRetry(chatRuntimeConfig.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok || !response.body) {
    throw new Error(await readErrorDetail(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const pendingCharacters: string[] = []
  let streamFinished = false
  let displayTimer: number | undefined

  const displayComplete = new Promise<void>((resolve) => {
    displayTimer = window.setInterval(() => {
      if (pendingCharacters.length > 0) {
        const batchSize = Math.min(
          chatRuntimeConfig.stream.characterBatchSize,
          pendingCharacters.length,
        )
        onChunk(pendingCharacters.splice(0, batchSize).join(""))
        return
      }

      if (streamFinished) {
        if (displayTimer !== undefined) {
          window.clearInterval(displayTimer)
        }
        resolve()
      }
    }, chatRuntimeConfig.stream.characterFrameMs)
  })

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      pendingCharacters.push(...Array.from(chunk))
    }

    const remaining = decoder.decode()
    if (remaining) {
      pendingCharacters.push(...Array.from(remaining))
    }

    streamFinished = true
    await displayComplete
  } finally {
    if (displayTimer !== undefined) {
      window.clearInterval(displayTimer)
    }
  }
}

export async function streamConversationTitle({
  userMessage,
  onChunk,
}: StreamConversationTitleOptions) {
  const response = await fetchWithRetry(chatRuntimeConfig.titleEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: userMessage }),
  })

  if (!response.ok || !response.body) {
    throw new Error(await readErrorDetail(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
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
