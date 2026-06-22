import { suvaRuntimeConfig } from "@/features/suva/config/runtime"

export type SuvaCompletionMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type StreamSuvaCompletionOptions = {
  messages: SuvaCompletionMessage[]
  onChunk: (chunk: string) => void
}

async function readErrorDetail(response: Response) {
  let detail = "Unable to generate a SuVA response."

  try {
    const data = await response.clone().json()
    detail = data.detail ?? data.error ?? detail
  } catch {
    const responseText = await response.text()
    detail = responseText || detail
  }

  return detail
}

function fallbackMessages(messages: SuvaCompletionMessage[]) {
  return [
    {
      role: "system" as const,
      content:
        "You are SuVA, the concise voice companion for SupraChat. Keep replies short, calm, and useful.",
    },
    ...messages,
  ]
}

async function streamFromEndpoint(
  endpoint: string,
  messages: SuvaCompletionMessage[],
  onChunk: (chunk: string) => void,
) {
  const response = await fetch(endpoint, {
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

export async function streamSuvaCompletion({
  messages,
  onChunk,
}: StreamSuvaCompletionOptions) {
  try {
    await streamFromEndpoint(suvaRuntimeConfig.endpoint, messages, onChunk)
  } catch (error) {
    await streamFromEndpoint(
      suvaRuntimeConfig.fallbackEndpoint,
      fallbackMessages(messages),
      onChunk,
    )
  }
}

export async function transcribeSuvaAudio(samples: Float32Array, sampleRate: number) {
  const response = await fetch(suvaRuntimeConfig.sttEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sampleRate,
      samples: Array.from(samples, (sample) => Number(sample.toFixed(6))),
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorDetail(response))
  }

  const data = (await response.json()) as { text?: unknown }
  return typeof data.text === "string" ? data.text.trim() : ""
}
