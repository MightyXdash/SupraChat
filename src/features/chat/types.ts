export type ChatRole = "user" | "assistant"

export type DocumentAttachment = {
  id: string
  kind: "document"
  name: string
  filePath: string
  mimeType: string
  textContent: string
  truncated: boolean
  wordCount: number
  createdAt: string
}

export type ImageAttachment = {
  id: string
  kind: "image"
  name: string
  filePath: string
  mimeType: string
  dataUrl: string
  createdAt: string
}

export type ChatAttachment = DocumentAttachment | ImageAttachment

export type ReasoningBlock = {
  title: string
  sub_title: string
  summary: string
  cur_task: string
  startedAt?: number
  completedAt?: number
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  attachments?: ChatAttachment[]
  reasoningDurationMs?: number | null
  tokensPerSecond?: number | null
  reasoningBlocks?: ReasoningBlock[]
}

export type Conversation = {
  id: string
  title: string
  titleStatus?: "idle" | "generating" | "complete" | "failed"
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export type ChatCompletionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export type ChatCompletionMessage = {
  role: ChatRole
  content: string | ChatCompletionContentPart[]
}

export type SpeechPlaybackState = {
  currentTime: number
  duration: number
  isPreparing: boolean
  messageId: string | null
  pendingMessageId: string | null
  status: "idle" | "loading" | "playing" | "paused"
}
