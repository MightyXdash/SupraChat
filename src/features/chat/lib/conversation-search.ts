import { Conversation } from "@/features/chat/types"

export type ConversationSearchResult = {
  conversation: Conversation
  matchedText: string
  score: number
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function getSearchWords(query: string) {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean)
}

function firstMatchingSnippet(conversation: Conversation, words: string[]) {
  const title = conversation.title.trim()
  const matchingMessage = conversation.messages.find((message) => {
    const normalizedContent = normalizeSearchText(message.content)
    return words.some((word) => normalizedContent.includes(word))
  })

  if (!matchingMessage) {
    return title
  }

  const compactContent = matchingMessage.content.replace(/\s+/g, " ").trim()
  return compactContent.length > 96 ? `${compactContent.slice(0, 93).trimEnd()}...` : compactContent
}

export function searchConversations(conversations: Conversation[], query: string) {
  const words = getSearchWords(query)
  const searchableConversations = conversations.filter((conversation) => conversation.messages.length > 0)

  if (words.length === 0) {
    return searchableConversations
      .map<ConversationSearchResult>((conversation) => ({
        conversation,
        matchedText: conversation.title,
        score: 0,
      }))
      .sort((left, right) => right.conversation.updatedAt.localeCompare(left.conversation.updatedAt))
  }

  return searchableConversations
    .map<ConversationSearchResult | null>((conversation) => {
      const normalizedBody = normalizeSearchText(
        conversation.messages.map((message) => message.content).join(" "),
      )
      const matchedWords = words.filter((word) => normalizedBody.includes(word))

      if (matchedWords.length === 0) {
        return null
      }

      return {
        conversation,
        matchedText: firstMatchingSnippet(conversation, words),
        score: matchedWords.length,
      }
    })
    .filter((result): result is ConversationSearchResult => Boolean(result))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.conversation.updatedAt.localeCompare(left.conversation.updatedAt)
    })
}
