import { create } from "zustand"
import { GENERATION_ERROR_MESSAGE } from "@/features/chat/config/ui"
import {
  cleanIncompleteMarkdown,
  createConversationRecord,
  createMessage,
  titleFromGeneratedPayload,
  titleFromMessage,
} from "@/features/chat/lib/chat-records"
import {
  ChatServiceError,
  createStoredConversation,
  deleteStoredConversation,
  fetchConversations,
  streamConversationTitle,
  streamChatCompletion,
  updateStoredConversation,
} from "@/features/chat/services/chat-service"
import { ChatMessage, Conversation } from "@/features/chat/types"

const TITLE_RETRY_MAX_ATTEMPTS = 12
const TITLE_RETRY_TEMPERATURE = 0.35
const TITLE_CONTENT_MAX_WORDS = 2000
const TITLE_COPY_UNIGRAM_THRESHOLD = 0.9

function letterUnigrams(content: string) {
  return Array.from(content.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, ""))
}

function isTitleCopiedFromUserText(title: string, userMessage: string): boolean {
  const titleLetters = letterUnigrams(title)
  const userLetters = letterUnigrams(userMessage)

  if (titleLetters.length === 0 || userLetters.length === 0) {
    return false
  }

  const normalizedTitle = titleLetters.join("")
  const normalizedUser = userLetters.join("")

  if (normalizedUser.includes(normalizedTitle)) {
    return true
  }

  const userLetterCounts = new Map<string, number>()
  userLetters.forEach((letter) => {
    userLetterCounts.set(letter, (userLetterCounts.get(letter) ?? 0) + 1)
  })

  const sharedLetterCount = titleLetters.reduce((count, letter) => {
    const remaining = userLetterCounts.get(letter) ?? 0

    if (remaining <= 0) {
      return count
    }

    userLetterCounts.set(letter, remaining - 1)
    return count + 1
  }, 0)

  return sharedLetterCount / titleLetters.length >= TITLE_COPY_UNIGRAM_THRESHOLD
}

function isTitleTooShort(title: string): boolean {
  return title.trim().split(/\s+/).filter(Boolean).length <= 1
}

function shouldRetryGeneratedTitle(title: string, userMessage: string): boolean {
  return isTitleTooShort(title) || isTitleCopiedFromUserText(title, userMessage)
}

function trimContentToWordLimit(content: string, maxWords: number): string {
  const words = content.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return content.trim()
  }
  return words.slice(0, maxWords).join(" ")
}

function titleContextFromTurns(messages: ChatMessage[], maxTurns: number) {
  const selectedMessages: ChatMessage[] = []
  let userTurns = 0

  for (const message of messages) {
    selectedMessages.push(message)

    if (message.role === "user") {
      userTurns += 1
    }

    if (userTurns >= maxTurns && message.role === "assistant") {
      break
    }
  }

  return selectedMessages
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n")
}

function userTurnCount(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === "user").length
}

function firstUserMessageContent(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content.trim() ?? ""
}

type ChatState = {
  conversations: Conversation[]
  activeConversationId: string
  isLoading: boolean
  isGenerating: boolean
  error: string | null
  initialize: () => Promise<void>
  createConversation: () => Promise<string>
  renameConversation: (conversationId: string, title: string) => Promise<boolean>
  deleteConversation: (conversationId: string) => Promise<boolean>
  sendMessage: (content: string, options?: { beforeGeneration?: () => Promise<void> | void }) => Promise<void>
  setActiveConversation: (conversationId: string) => void
}

async function persistConversation(conversation: Conversation) {
  try {
    await updateStoredConversation(conversation)
  } catch (error) {
    if (!(error instanceof ChatServiceError) || error.status !== 404) {
      throw error
    }

    await createStoredConversation(conversation)
  }
}

function updateConversationById(
  conversations: Conversation[],
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
) {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? updater(conversation) : conversation,
  )
}

function updateAssistantMessage(
  conversations: Conversation[],
  conversationId: string,
  assistantMessageId: string,
  updater: (content: string) => string,
) {
  return updateConversationById(conversations, conversationId, (conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.id === assistantMessageId
        ? { ...message, content: updater(message.content) }
        : message,
    ),
    updatedAt: new Date().toISOString(),
  }))
}

function sortConversationsByUpdatedAt(conversations: Conversation[]) {
  return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

const initialConversation = createConversationRecord()
let initializationPromise: Promise<void> | null = null

export const useChatStore = create<ChatState>((set) => ({
  conversations: [initialConversation],
  activeConversationId: initialConversation.id,
  isLoading: true,
  isGenerating: false,
  error: null,
  initialize: async () => {
    if (initializationPromise) {
      await initializationPromise
      return
    }

    initializationPromise = (async () => {
      try {
        const conversations = await fetchConversations()

        const savedConversations = conversations.filter(
          (conversation) => conversation.messages.length > 0,
        )

        const recoveredConversations = savedConversations.map((conversation) => {
          if (conversation.title.trim().length === 0 && conversation.messages.length > 0) {
            const firstUserMessage = conversation.messages.find((m) => m.role === "user")
            return {
              ...conversation,
              title: firstUserMessage ? titleFromMessage(firstUserMessage.content) : conversation.title,
              titleStatus: "failed" as const,
            }
          }
          return conversation
        })

        if (recoveredConversations.length === 0) {
          const conversation = createConversationRecord()
          set({
            conversations: [conversation],
            activeConversationId: conversation.id,
            isLoading: false,
            error: null,
          })
          return
        }

        set({
          conversations: sortConversationsByUpdatedAt(recoveredConversations),
          activeConversationId: recoveredConversations[0].id,
          isLoading: false,
          error: null,
        })

        const needsRecovery = savedConversations.some(
          (c) => c.title.trim().length === 0 && c.messages.length > 0,
        )

        if (needsRecovery) {
          await Promise.allSettled(
            recoveredConversations
              .filter((c) => c.titleStatus === "failed")
              .map((c) => persistConversation(c)),
          )
        }
      } catch {
        initializationPromise = null
        set({
          isLoading: false,
          error: "Unable to load saved conversations. Check the local database connection and try again.",
        })
      }
    })()

    await initializationPromise
  },
  createConversation: async () => {
    const conversation = createConversationRecord()

    set((state) => {
      const conversations = state.conversations.filter(
        (existingConversation) => existingConversation.messages.length > 0,
      )

      return {
        activeConversationId: conversation.id,
        error: null,
        conversations: [conversation, ...sortConversationsByUpdatedAt(conversations)],
      }
    })

    return conversation.id
  },
  renameConversation: async (conversationId, title) => {
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      return false
    }

    const existingConversation = useChatStore
      .getState()
      .conversations.find((conversation) => conversation.id === conversationId)

    if (!existingConversation) {
      return false
    }

    const nextConversation = {
      ...existingConversation,
      title: trimmedTitle,
      updatedAt: new Date().toISOString(),
    }

    try {
      await updateStoredConversation(nextConversation)
    } catch {
      set({
        error: "Unable to rename the conversation. Check the local database connection and try again.",
      })
      return false
    }

    set((state) => ({
      conversations: sortConversationsByUpdatedAt(
        updateConversationById(state.conversations, conversationId, () => nextConversation),
      ),
    }))

    return true
  },
  deleteConversation: async (conversationId) => {
    const state = useChatStore.getState()

    if (state.isGenerating && state.activeConversationId === conversationId) {
      return false
    }

    const conversationToDelete = state.conversations.find(
      (conversation) => conversation.id === conversationId,
    )
    const nextConversations = state.conversations.filter(
      (conversation) => conversation.id !== conversationId,
    )

    if (conversationToDelete && conversationToDelete.messages.length === 0) {
      const replacementConversation = nextConversations[0] ?? createConversationRecord()
      set({
        conversations:
          nextConversations.length > 0
            ? sortConversationsByUpdatedAt(nextConversations)
            : [replacementConversation],
        activeConversationId:
          state.activeConversationId === conversationId
            ? replacementConversation.id
            : state.activeConversationId,
        error: null,
      })
      return true
    }

    if (nextConversations.length === 0) {
      const replacementConversation = createConversationRecord()
      try {
        await deleteStoredConversation(conversationId)
      } catch {
        set({
          error: "Unable to delete the conversation. Check the local database connection and try again.",
        })
        return false
      }

      set({
        conversations: [replacementConversation],
        activeConversationId: replacementConversation.id,
        error: null,
      })
      return true
    }

    try {
      await deleteStoredConversation(conversationId)
    } catch {
      set({
        error: "Unable to delete the conversation. Check the local database connection and try again.",
      })
      return false
    }

    set({
      conversations: sortConversationsByUpdatedAt(nextConversations),
      activeConversationId:
        state.activeConversationId === conversationId
          ? nextConversations[0].id
          : state.activeConversationId,
      error: null,
    })

    return true
  },
  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId, error: null })
  },
  sendMessage: async (content, options) => {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return
    }

    const stateBeforeSend = useChatStore.getState()

    if (stateBeforeSend.isLoading) {
      await stateBeforeSend.initialize()
    }

    const userMessage = createMessage("user", trimmedContent)
    const assistantMessage = createMessage("assistant", "")
    const conversationId = useChatStore.getState().activeConversationId
    let shouldGenerateTitle = false
    let generatedTitlePayload = ""

    set((state) => {
      const activeConversation = state.conversations.find(
        (conversation) => conversation.id === conversationId,
      )
      shouldGenerateTitle = Boolean(activeConversation && activeConversation.messages.length === 0)

      return {
        error: null,
        isGenerating: true,
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, (conversation) => ({
            ...conversation,
            title: shouldGenerateTitle ? "" : conversation.title,
            titleStatus: shouldGenerateTitle ? "generating" : conversation.titleStatus,
            messages: [...conversation.messages, userMessage],
            updatedAt: userMessage.createdAt,
          })),
        ),
      }
    })

    try {
      await options?.beforeGeneration?.()
    } catch {
      // Scroll preparation should not prevent local generation from starting.
    }

    set((state) => ({
      conversations: sortConversationsByUpdatedAt(
        updateConversationById(state.conversations, conversationId, (conversation) => ({
          ...conversation,
          messages: [...conversation.messages, assistantMessage],
        })),
      ),
    }))

    try {
      const conversationAfterPrompt = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      if (conversationAfterPrompt) {
        await persistConversation(conversationAfterPrompt)
      } else {
        set({
          isGenerating: false,
          error: "Unable to find the active conversation. Create a new conversation and try again.",
        })
        return
      }
    } catch {
      set({
        isGenerating: false,
        error: "Unable to save the conversation before generation started.",
      })
      return
    }

    const appendAssistantChunk = (chunk: string) => {
      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateAssistantMessage(
            state.conversations,
            conversationId,
            assistantMessage.id,
            (currentContent) => `${currentContent}${chunk}`,
          ),
        ),
      }))
    }

    const appendTitleChunk = (chunk: string) => {
      generatedTitlePayload = `${generatedTitlePayload}${chunk}`
      const title = titleFromGeneratedPayload(generatedTitlePayload)

      if (!title || generatedTitlePayload.trim().startsWith("{")) {
        return
      }

      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, (conversation) => ({
            ...conversation,
            title,
            titleStatus: "generating",
            updatedAt: conversation.updatedAt,
          })),
        ),
      }))
    }

    const finalizeTitle = async (status: "complete" | "failed") => {
      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, (conversation) => {
            const title = titleFromGeneratedPayload(generatedTitlePayload) || titleFromMessage(trimmedContent)

            return {
              ...conversation,
              title,
              titleStatus: status,
            }
          }),
        ),
      }))

      const updatedConversation = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId)

      if (updatedConversation) {
        try {
          await persistConversation(updatedConversation)
        } catch {
          // Title persistence failure is non-critical; the chat response is already saved.
        }
      }
    }

    const finalizeAssistantMessage = (formatter: (content: string) => string) => {
      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateAssistantMessage(
            state.conversations,
            conversationId,
            assistantMessage.id,
            formatter,
          ),
        ),
      }))
    }

    try {
      const activeConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      const responseStream = streamChatCompletion({
        messages:
          activeConversation?.messages
            .filter((message) => message.id !== assistantMessage.id)
            .map((message: ChatMessage) => ({
              role: message.role,
              content: message.content,
            })) ?? [],
        onChunk: appendAssistantChunk,
      })
      const titleStream = shouldGenerateTitle
        ? streamConversationTitle({
            userMessage: trimmedContent,
            onChunk: appendTitleChunk,
          })
            .then(() => finalizeTitle("complete"))
            .catch(() => finalizeTitle("failed"))
        : Promise.resolve()

      await Promise.all([responseStream, titleStream])

      finalizeAssistantMessage(cleanIncompleteMarkdown)

      const conversationAfterResponse = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId)

      if (conversationAfterResponse) {
        const titleReferenceText = firstUserMessageContent(conversationAfterResponse.messages) || trimmedContent
        const currentTitle = shouldGenerateTitle
          ? titleFromGeneratedPayload(generatedTitlePayload) || conversationAfterResponse.title
          : conversationAfterResponse.title

        if (shouldRetryGeneratedTitle(currentTitle, titleReferenceText)) {
          let lastTitle = currentTitle

          const tryTitleRetries = async (content: string) => {
            const trimmedRetryContent = trimContentToWordLimit(content, TITLE_CONTENT_MAX_WORDS)

            for (let attempt = 0; attempt < TITLE_RETRY_MAX_ATTEMPTS; attempt += 1) {
              let retryPayload = ""

              try {
                await streamConversationTitle({
                  userMessage: trimmedRetryContent,
                  temperature: TITLE_RETRY_TEMPERATURE,
                  onChunk: (chunk) => {
                    retryPayload = `${retryPayload}${chunk}`
                  },
                })

                const retryTitle = titleFromGeneratedPayload(retryPayload)

                if (retryTitle && !shouldRetryGeneratedTitle(retryTitle, titleReferenceText) && retryTitle !== lastTitle) {
                  set((state) => ({
                    conversations: sortConversationsByUpdatedAt(
                      updateConversationById(state.conversations, conversationId, (conversation) => ({
                        ...conversation,
                        title: retryTitle,
                        titleStatus: "complete",
                      })),
                    ),
                  }))

                  const retriedConversation = useChatStore
                    .getState()
                    .conversations.find((c) => c.id === conversationId)

                  if (retriedConversation) {
                    await persistConversation(retriedConversation)
                  }

                  return retryTitle
                }

                lastTitle = retryTitle || lastTitle
              } catch {
                // Retry title generation is best-effort; continue to next attempt.
              }
            }

            return lastTitle
          }

          const firstTurnContext = titleContextFromTurns(conversationAfterResponse.messages, 1)
          const firstRetryTitle = shouldGenerateTitle
            ? await tryTitleRetries(firstTurnContext || trimmedContent)
            : currentTitle

          if (shouldRetryGeneratedTitle(firstRetryTitle, titleReferenceText) && userTurnCount(conversationAfterResponse.messages) > 1) {
            const threeTurnContext = titleContextFromTurns(conversationAfterResponse.messages, 3)

            if (threeTurnContext && threeTurnContext !== firstTurnContext) {
              await tryTitleRetries(threeTurnContext)
            }
          }
        }
      }

      const completedConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      if (completedConversation) {
        await persistConversation(completedConversation)
      }

      set({ isGenerating: false })
    } catch (error) {
      finalizeAssistantMessage(cleanIncompleteMarkdown)
      const interruptedConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      if (interruptedConversation) {
        try {
          await persistConversation(interruptedConversation)
        } catch {
          // Preserve the generation error as the primary user-facing failure.
        }
      }

      set({
        isGenerating: false,
        error: error instanceof Error ? error.message : GENERATION_ERROR_MESSAGE,
      })
    }
  },
}))
