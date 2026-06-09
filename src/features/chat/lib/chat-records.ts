import {
  DEFAULT_CONVERSATION_TITLE,
} from "@/features/chat/config/ui"
import { ChatMessage, ChatRole, Conversation } from "@/features/chat/types"

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: makeId(role),
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

export function createConversationRecord(): Conversation {
  const conversationId = makeId("conversation")
  const now = new Date().toISOString()

  return {
    id: conversationId,
    title: DEFAULT_CONVERSATION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function titleFromMessage(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).slice(0, 3)
  return words.length > 0 ? words.join(" ") : DEFAULT_CONVERSATION_TITLE
}

export function cleanIncompleteMarkdown(content: string) {
  return content
    .replace(/\n?\s*#{1,6}\s*$/u, "")
    .replace(/\n?\s*[-*_]{1,3}\s*$/u, "")
    .trimEnd()
}
