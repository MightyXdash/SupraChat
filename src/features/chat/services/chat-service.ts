import { chatRuntimeConfig } from "@/features/chat/config/runtime"
import { ChatCompletionMessage } from "@/features/chat/types"

type StreamChatCompletionOptions = {
  messages: ChatCompletionMessage[]
  onChunk: (chunk: string) => void
}

async function readErrorDetail(response: Response) {
  let detail = "Unable to generate a response."

  try {
    const data = await response.json()
    detail = data.detail ?? detail
  } catch {
    const fallback = await response.text()
    detail = fallback || detail
  }

  return detail
}

export async function streamChatCompletion({
  messages,
  onChunk,
}: StreamChatCompletionOptions) {
  const response = await fetch(chatRuntimeConfig.endpoint, {
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
