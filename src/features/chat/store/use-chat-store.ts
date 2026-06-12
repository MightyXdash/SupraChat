import { create } from "zustand"
import { GENERATION_ERROR_MESSAGE } from "@/features/chat/config/ui"
import {
  cleanIncompleteMarkdown,
  createConversationRecord,
  createMessage,
  sanitizeGeneratedTitle,
  titleFromGeneratedPayload,
  titleFromMessage,
} from "@/features/chat/lib/chat-records"
import {
  createStoredConversation,
  deleteStoredConversation,
  fetchConversations,
  streamConversationTitle,
  streamChatCompletion,
  updateStoredConversation,
} from "@/features/chat/services/chat-service"
import { ChatMessage, Conversation } from "@/features/chat/types"

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
  sendMessage: (content: string) => Promise<void>
  setActiveConversation: (conversationId: string) => void
}

async function persistConversation(conversation: Conversation) {
  try {
    await updateStoredConversation(conversation)
  } catch {
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

        if (savedConversations.length === 0) {
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
          conversations: sortConversationsByUpdatedAt(savedConversations),
          activeConversationId: savedConversations[0].id,
          isLoading: false,
          error: null,
        })
      } catch {
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
  sendMessage: async (content) => {
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
            messages: [...conversation.messages, userMessage, assistantMessage],
            updatedAt: userMessage.createdAt,
          })),
        ),
      }
    })

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

    const finalizeTitle = (status: "complete" | "failed") => {
      set((state) => ({
        conversations: sortConversationsByUpdatedAt(
          updateConversationById(state.conversations, conversationId, (conversation) => {
            const title = titleFromGeneratedPayload(generatedTitlePayload) || sanitizeGeneratedTitle(conversation.title)

            return {
              ...conversation,
              title: title || titleFromMessage(trimmedContent),
              titleStatus: status,
            }
          }),
        ),
      }))
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
      const completedConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      if (completedConversation) {
        await persistConversation(completedConversation)
      }

      set({ isGenerating: false })
    } catch {
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
        error: GENERATION_ERROR_MESSAGE,
      })
    }
  },
}))
