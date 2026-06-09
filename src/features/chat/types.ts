export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

export type Conversation = {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export type ChatCompletionMessage = Pick<ChatMessage, "role" | "content">
