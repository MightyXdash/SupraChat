export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  tokensPerSecond?: number | null
}

export type Conversation = {
  id: string
  title: string
  titleStatus?: "idle" | "generating" | "complete" | "failed"
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export type ChatCompletionMessage = Pick<ChatMessage, "role" | "content">

export type SpeechPlaybackState = {
  currentTime: number
  duration: number
  isPreparing: boolean
  messageId: string | null
  pendingMessageId: string | null
  status: "idle" | "loading" | "playing" | "paused"
}
