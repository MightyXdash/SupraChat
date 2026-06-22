import {
  DEFAULT_CONVERSATION_TITLE,
  TITLE_MAX_VISIBLE_CHARACTERS,
} from "@/features/chat/config/ui"
import { ChatMessage, ChatRole, Conversation } from "@/features/chat/types"

const GENERATED_TITLE_DISALLOWED_CHARACTERS = /[^A-Za-z0-9\s.,!?;:'"()\-/+*=<>%&$#@]/g
const GENERATED_TITLE_TRAILING_PUNCTUATION = /[.,!?;:]+$/u

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
  const words = content
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .filter((word) => /[A-Za-z]/.test(word))
    .slice(0, 3)

  return words.length > 0 ? words.join(" ") : DEFAULT_CONVERSATION_TITLE
}

export function sanitizeGeneratedTitle(content: string) {
  return content
    .replace(GENERATED_TITLE_DISALLOWED_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .replace(GENERATED_TITLE_TRAILING_PUNCTUATION, "")
    .trim()
}

export function titleFromGeneratedPayload(content: string) {
  const trimmedContent = content.trim()

  if (!trimmedContent) {
    return ""
  }

  try {
    const parsed = JSON.parse(trimmedContent) as {
      short?: unknown
      medium?: unknown
      long?: unknown
    }

    const title =
      typeof parsed.medium === "string"
        ? parsed.medium
        : typeof parsed.short === "string"
          ? parsed.short
          : typeof parsed.long === "string"
            ? parsed.long
            : ""

    return sanitizeGeneratedTitle(title)
  } catch {
    const jsonMatch = trimmedContent.match(/\{[\s\S]*\}/u)

    if (jsonMatch && jsonMatch[0] !== trimmedContent) {
      return titleFromGeneratedPayload(jsonMatch[0])
    }

    return sanitizeGeneratedTitle(trimmedContent)
  }
}

export function truncateConversationTitle(title: string) {
  if (title.length <= TITLE_MAX_VISIBLE_CHARACTERS) {
    return title
  }

  return `${title.slice(0, Math.max(0, TITLE_MAX_VISIBLE_CHARACTERS - 3)).trimEnd()}...`
}

export function cleanIncompleteMarkdown(content: string) {
  return content
    .replace(/\n?\s*#{1,6}\s*$/u, "")
    .replace(/\n?\s*[-*_]{1,3}\s*$/u, "")
    .trimEnd()
}
