import { create } from "zustand"

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

type AppState = {
  conversations: Conversation[]
  activeConversationId: string
  isGenerating: boolean
  error: string | null
  createConversation: () => string
  sendMessage: (content: string) => Promise<void>
  setActiveConversation: (conversationId: string) => void
}

const CHAT_ENDPOINT = "http://127.0.0.1:3001/chat"
const CHARACTER_STREAM_FRAME_MS = 5
const CHARACTER_STREAM_BATCH_SIZE = 1

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: makeId(role),
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function titleFromMessage(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).slice(0, 3)
  return words.length > 0 ? words.join(" ") : "New Conversation"
}

const initialConversationId = makeId("conversation")
const initialConversation: Conversation = {
  id: initialConversationId,
  title: "New Conversation",
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const useAppStore = create<AppState>((set) => ({
  conversations: [initialConversation],
  activeConversationId: initialConversationId,
  isGenerating: false,
  error: null,
  createConversation: () => {
    const conversationId = makeId("conversation")
    const now = new Date().toISOString()

    set((state) => ({
      activeConversationId: conversationId,
      error: null,
      conversations: [
        {
          id: conversationId,
          title: "New Conversation",
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
        ...state.conversations,
      ],
    }))

    return conversationId
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
    const conversationId = useAppStore.getState().activeConversationId

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
        conversations: state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title: nextTitle ?? conversation.title,
                messages: [...conversation.messages, userMessage, assistantMessage],
                updatedAt: userMessage.createdAt,
              }
            : conversation,
        ),
      }
    })

    try {
      const activeConversation = useAppStore
        .getState()
        .conversations.find((conversation) => conversation.id === conversationId)

      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages:
            activeConversation?.messages
              .filter((message) => message.id !== assistantMessage.id)
              .map((message) => ({
                role: message.role,
                content: message.content,
              })) ?? [],
        }),
      })

      if (!response.ok || !response.body) {
        let detail = "Unable to generate a response."

        try {
          const data = await response.json()
          detail = data.detail ?? detail
        } catch {
          detail = await response.text()
        }

        throw new Error(detail)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const pendingCharacters: string[] = []
      let streamFinished = false
      let displayTimer: number | undefined

      const appendCharacters = (text: string) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === assistantMessage.id
                      ? { ...message, content: `${message.content}${text}` }
                      : message,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : conversation,
          ),
        }))
      }

      const displayComplete = new Promise<void>((resolve) => {
        displayTimer = window.setInterval(() => {
          if (pendingCharacters.length > 0) {
            const batchSize = Math.min(CHARACTER_STREAM_BATCH_SIZE, pendingCharacters.length)
            appendCharacters(pendingCharacters.splice(0, batchSize).join(""))
            return
          }

          if (streamFinished) {
            window.clearInterval(displayTimer)
            resolve()
          }
        }, CHARACTER_STREAM_FRAME_MS)
      })

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          pendingCharacters.push(...Array.from(chunk))
        }

        const remaining = decoder.decode()
        if (remaining) {
          pendingCharacters.push(...Array.from(remaining))
        }

        streamFinished = true
        await displayComplete
      } finally {
        if (!streamFinished && displayTimer) {
          window.clearInterval(displayTimer)
        }
      }

      set({ isGenerating: false })
    } catch (error) {
      set({
        isGenerating: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate a response. Check the provider connection and try again.",
      })
    }
  },
}))
