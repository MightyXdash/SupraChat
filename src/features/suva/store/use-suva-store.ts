import { create } from "zustand"
import { streamSuvaCompletion, type SuvaCompletionMessage } from "@/features/suva/services/suva-service"
import { speakSuvaResponse } from "@/features/suva/services/suva-tts"

type SuvaStatus = "idle" | "listening" | "transcribing" | "generating" | "speaking" | "error"

export type SuvaMessage = SuvaCompletionMessage & {
  id: string
  createdAt: string
}

type SuvaState = {
  isOpen: boolean
  status: SuvaStatus
  transcript: string
  messages: SuvaMessage[]
  error: string | null
  open: () => void
  close: () => void
  toggle: () => void
  setTranscript: (transcript: string) => void
  clearSession: () => void
  setStatus: (status: SuvaStatus) => void
  setError: (error: string | null) => void
  sendTranscript: (transcript?: string) => Promise<void>
}

function createSuvaMessage(role: SuvaMessage["role"], content: string): SuvaMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function updateMessageById(
  messages: SuvaMessage[],
  messageId: string,
  updater: (message: SuvaMessage) => SuvaMessage,
) {
  return messages.map((message) => (message.id === messageId ? updater(message) : message))
}

export const useSuvaStore = create<SuvaState>((set, get) => ({
  isOpen: false,
  status: "idle",
  transcript: "",
  messages: [],
  error: null,
  open: () => set({ isOpen: true, error: null }),
  close: () => set({ isOpen: false, status: "idle", error: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, error: null })),
  setTranscript: (transcript) => set({ transcript, error: null }),
  clearSession: () => set({ messages: [], transcript: "", status: "idle", error: null }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? "error" : get().status }),
  sendTranscript: async (transcriptOverride) => {
    const transcript = (transcriptOverride ?? get().transcript).trim()

    if (!transcript || get().status === "generating" || get().status === "transcribing") {
      return
    }

    const userMessage = createSuvaMessage("user", transcript)
    const assistantMessage = createSuvaMessage("assistant", "")
    const nextMessages = [...get().messages, userMessage, assistantMessage]

    set({
      isOpen: true,
      status: "generating",
      transcript: "",
      messages: nextMessages,
      error: null,
    })

    try {
      let assistantContent = ""

      await streamSuvaCompletion({
        messages: nextMessages
          .filter((message) => message.id !== assistantMessage.id)
          .map(({ role, content }) => ({ role, content })),
        onChunk: (chunk) => {
          assistantContent = `${assistantContent}${chunk}`
          set((state) => ({
            messages: updateMessageById(state.messages, assistantMessage.id, (message) => ({
              ...message,
              content: `${message.content}${chunk}`,
            })),
          }))
        },
      })

      set({ status: "speaking" })
      await speakSuvaResponse(assistantContent)
      set({ status: "idle" })
    } catch (error) {
      set({
        status: "error",
        messages: get().messages.filter((message) => message.id !== assistantMessage.id),
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate a SuVA response. Check the local runtime and try again.",
      })
    }
  },
}))
