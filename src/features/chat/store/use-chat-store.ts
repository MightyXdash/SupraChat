import { create } from "zustand"
import { GENERATION_ERROR_MESSAGE } from "@/features/chat/config/ui"
import {
  cleanIncompleteMarkdown,
  createConversationRecord,
  createMessage,
  titleFromMessage,
} from "@/features/chat/lib/chat-records"
import { streamChatCompletion } from "@/features/chat/services/chat-service"
import { ChatMessage, Conversation } from "@/features/chat/types"

type ChatState = {
  conversations: Conversation[]
  activeConversationId: string
  isGenerating: boolean
  error: string | null
  createConversation: () => string
  sendMessage: (content: string) => Promise<void>
  setActiveConversation: (conversationId: string) => void
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

const initialConversation = createConversationRecord()

export const useChatStore = create<ChatState>((set) => ({
  conversations: [initialConversation],
  activeConversationId: initialConversation.id,
  isGenerating: false,
  error: null,
  createConversation: () => {
    const conversation = createConversationRecord()

    set((state) => ({
      activeConversationId: conversation.id,
      error: null,
      conversations: [conversation, ...state.conversations],
    }))

    return conversation.id
  },
  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId, error: null })
  },
  sendMessage: async (content) => {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return
    }

    const userMessage = createMessage("user", trimmedContent)
    const assistantMessage = createMessage("assistant", "")
    const conversationId = useChatStore.getState().activeConversationId

    set((state) => {
      const activeConversation = state.conversations.find(
        (conversation) => conversation.id === conversationId,
      )
      const nextTitle =
        activeConversation && activeConversation.messages.length === 0
          ? titleFromMessage(trimmedContent)
          : activeConversation?.title

      return {
        error: null,
        isGenerating: true,
        conversations: updateConversationById(state.conversations, conversationId, (conversation) => ({
          ...conversation,
          title: nextTitle ?? conversation.title,
          messages: [...conversation.messages, userMessage, assistantMessage],
          updatedAt: userMessage.createdAt,
        })),
      }
    })

    const appendAssistantChunk = (chunk: string) => {
      set((state) => ({
        conversations: updateAssistantMessage(
          state.conversations,
          conversationId,
          assistantMessage.id,
          (currentContent) => `${currentContent}${chunk}`,
        ),
      }))
    }

    const finalizeAssistantMessage = (formatter: (content: string) => string) => {
      set((state) => ({
        conversations: updateAssistantMessage(
          state.conversations,
          conversationId,
          assistantMessage.id,
          formatter,
        ),
      }))
    }

    try {
      const activeConversation = useChatStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      await streamChatCompletion({
        messages:
          activeConversation?.messages
            .filter((message) => message.id !== assistantMessage.id)
            .map((message: ChatMessage) => ({
              role: message.role,
              content: message.content,
            })) ?? [],
        onChunk: appendAssistantChunk,
      })

      finalizeAssistantMessage(cleanIncompleteMarkdown)
      set({ isGenerating: false })
    } catch {
      finalizeAssistantMessage(cleanIncompleteMarkdown)
      set({
        isGenerating: false,
        error: GENERATION_ERROR_MESSAGE,
      })
    }
  },
}))
