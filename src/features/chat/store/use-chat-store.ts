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
const TITLE_REGENERATION_TEMPERATURE = 0.75
const TITLE_DEFERRED_FIRST_MESSAGE_MAX_CHARACTERS = 40
const TITLE_COPY_UNIGRAM_THRESHOLD = 0.9
const TITLE_MIN_ENGLISH_LETTER_RATIO = 0.6
const TITLE_RECOVERY_EXPANSION_WORDS = 200

function letterUnigrams(content: string) {
  return Array.from(content.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, ""))
}

function englishLetters(content: string) {
  return content.match(/[A-Za-z]/g) ?? []
}

function isTitleCopiedFromUserText(title: string, userMessage: string): boolean {
  const titleLetters = letterUnigrams(title)
  const userLetters = letterUnigrams(userMessage)

  if (titleLetters.length === 0 || userLetters.length === 0) {
    return false
  }

  const normalizedTitle = titleLetters.join("")
  const normalizedUser = userLetters.join("")

  if (normalizedUser.startsWith(normalizedTitle)) {
    return true
  }

  const userPrefixLetters = userLetters.slice(0, titleLetters.length)
  const userLetterCounts = new Map<string, number>()
  userPrefixLetters.forEach((letter) => {
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

function isTitleEnglish(title: string): boolean {
  const letters = title.match(/\p{L}/gu) ?? []

  if (letters.length === 0) {
    return false
  }

  return englishLetters(title).length / letters.length >= TITLE_MIN_ENGLISH_LETTER_RATIO
}

function isTitleTooShort(title: string): boolean {
  return title.trim().split(/\s+/).filter(Boolean).length <= 1
}

function shouldRetryGeneratedTitle(title: string, userMessage: string): boolean {
  return !isTitleEnglish(title) || isTitleTooShort(title) || isTitleCopiedFromUserText(title, userMessage)
}

function safeTitleFromGeneratedPayload(payload: string, userMessage: string): string {
  const title = titleFromGeneratedPayload(payload)

  return title && !shouldRetryGeneratedTitle(title, userMessage) ? title : ""
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

function titleContextFromRecentMessages(messages: ChatMessage[], maxWords: number) {
  const selectedMessages: string[] = []
  let remainingWords = maxWords

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    const words = message.content.trim().split(/\s+/).filter(Boolean)

    if (words.length === 0) {
      continue
    }

    const selectedWords = words.slice(Math.max(0, words.length - remainingWords))
    selectedMessages.unshift(`${message.role}: ${selectedWords.join(" ")}`)
    remainingWords -= selectedWords.length

    if (remainingWords <= 0) {
      break
    }
  }

  return selectedMessages.join("\n\n")
}

function userTurnCount(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === "user").length
}

function firstUserMessageContent(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content.trim() ?? ""
}

function firstAssistantMessageContent(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "assistant")?.content.trim() ?? ""
}

function shouldDeferInitialTitleGeneration(content: string) {
  return content.trim().length < TITLE_DEFERRED_FIRST_MESSAGE_MAX_CHARACTERS
}

function isOneTurnConversation(conversation: Conversation) {
  return userTurnCount(conversation.messages) === 1
}

function shouldRepairOneTurnTitle(conversation: Conversation) {
  const firstUserMessage = firstUserMessageContent(conversation.messages)

  if (!firstUserMessage || !isOneTurnConversation(conversation)) {
    return false
  }

  return shouldDeferInitialTitleGeneration(firstUserMessage) || shouldRetryGeneratedTitle(conversation.title, firstUserMessage)
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
  regenerateConversationTitle: (conversationId: string) => Promise<boolean>
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
const regeneratingTitleConversationIds = new Set<string>()

async function generateTitleExpansion(conversation: Conversation) {
  const firstUserMessage = firstUserMessageContent(conversation.messages)
  const firstAssistantMessage = firstAssistantMessageContent(conversation.messages)
  let expansion = ""

  await streamChatCompletion({
    messages: [
      {
        role: "user",
        content: [
          `Write about ${TITLE_RECOVERY_EXPANSION_WORDS} words of neutral context that explains what this short chat is likely about.`,
          "Use concrete phrasing that would help a title model infer the topic.",
          "Do not mention that you are writing context. Do not create a title.",
          "",
          `User message: ${firstUserMessage}`,
          firstAssistantMessage ? `Assistant response: ${firstAssistantMessage}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    onChunk: (chunk) => {
      expansion = `${expansion}${chunk}`
    },
  })

  return trimContentToWordLimit(expansion, TITLE_RECOVERY_EXPANSION_WORDS)
}

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
  regenerateConversationTitle: async (conversationId) => {
    if (regeneratingTitleConversationIds.has(conversationId)) {
      return false
    }

    const existingConversation = useChatStore
      .getState()
      .conversations.find((conversation) => conversation.id === conversationId)

    if (!existingConversation || existingConversation.messages.length === 0) {
      return false
    }

    regeneratingTitleConversationIds.add(conversationId)

    const firstUserMessage = firstUserMessageContent(existingConversation.messages)
    const firstAssistantMessage = firstAssistantMessageContent(existingConversation.messages)
    const titleContext = shouldRepairOneTurnTitle(existingConversation)
      ? trimContentToWordLimit(
        [
          firstUserMessage,
          firstAssistantMessage,
          await generateTitleExpansion(existingConversation),
        ].filter(Boolean).join("\n\n"),
        TITLE_CONTENT_MAX_WORDS,
      )
      : titleContextFromRecentMessages(
        existingConversation.messages,
        TITLE_CONTENT_MAX_WORDS,
      )

    if (!titleContext) {
      regeneratingTitleConversationIds.delete(conversationId)
      return false
    }

    set((state) => ({
      error: null,
      conversations: sortConversationsByUpdatedAt(
        updateConversationById(state.conversations, conversationId, (conversation) => ({
          ...conversation,
          titleStatus: "generating",
        })),
      ),
    }))

    let generatedTitlePayload = ""

    try {
      await streamConversationTitle({
        userMessage: titleContext,
        temperature: TITLE_REGENERATION_TEMPERATURE,
        onChunk: (chunk) => {
          generatedTitlePayload = `${generatedTitlePayload}${chunk}`
        },
      })

      const generatedTitle = safeTitleFromGeneratedPayload(
        generatedTitlePayload,
        firstUserMessage || titleContext,
      )

      if (!generatedTitle) {
        throw new Error("Unable to create a usable title.")
      }

      const currentConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      if (!currentConversation) {
        return false
      }

      const updatedConversation = {
        ...currentConversation,
        title: generatedTitle,
        titleStatus: "complete" as const,
        updatedAt: new Date().toISOString(),
      }

      await updateStoredConversation(updatedConversation)

      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, () => updatedConversation),
        ),
      }))

      return true
    } catch {
      set((state) => ({
        error: "Unable to regenerate the conversation title. Check the local title model and try again.",
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, (conversation) => ({
            ...conversation,
            titleStatus: "failed",
          })),
        ),
      }))

      return false
    } finally {
      regeneratingTitleConversationIds.delete(conversationId)
    }
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
    const shouldDeferTitleGeneration = shouldDeferInitialTitleGeneration(trimmedContent)

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
      const title = safeTitleFromGeneratedPayload(generatedTitlePayload, trimmedContent)

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

    const finalizeTitle = async (
      status: "complete" | "failed",
      titleReferenceText = trimmedContent,
    ) => {
      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, (conversation) => {
            const title =
              safeTitleFromGeneratedPayload(generatedTitlePayload, titleReferenceText) ||
              titleFromMessage(trimmedContent)

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
        ? shouldDeferTitleGeneration
          ? Promise.resolve()
          : streamConversationTitle({
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
        const firstTurnContext = titleContextFromTurns(conversationAfterResponse.messages, 1)

        if (shouldGenerateTitle && shouldDeferTitleGeneration) {
          generatedTitlePayload = ""

          try {
            await streamConversationTitle({
              userMessage: trimContentToWordLimit(firstTurnContext || trimmedContent, TITLE_CONTENT_MAX_WORDS),
              onChunk: (chunk) => {
                generatedTitlePayload = `${generatedTitlePayload}${chunk}`
              },
            })
            await finalizeTitle("complete", titleReferenceText)
          } catch {
            await finalizeTitle("failed", titleReferenceText)
          }
        }

        const currentTitle = shouldGenerateTitle
          ? safeTitleFromGeneratedPayload(generatedTitlePayload, titleReferenceText) || conversationAfterResponse.title
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

                const retryTitle = safeTitleFromGeneratedPayload(retryPayload, titleReferenceText)

                if (retryTitle && retryTitle !== lastTitle) {
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
