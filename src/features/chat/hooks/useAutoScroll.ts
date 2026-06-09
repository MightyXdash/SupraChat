import { useEffect, useRef } from "react"
import { useChatStore } from "@/features/chat/store/use-chat-store"

export function useAutoScroll() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const conversations = useChatStore((state) => state.conversations)
  const isGenerating = useChatStore((state) => state.isGenerating)

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [activeConversation?.messages.length, isGenerating])

  return scrollRef
}
