import { useCallback, useEffect, useMemo, useRef } from "react"
import { useChatStore } from "@/features/chat/store/use-chat-store"

const SCROLL_LOCK_THRESHOLD_PX = 96

export function useAutoScroll() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAutoScrollLockedRef = useRef(true)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const conversations = useChatStore((state) => state.conversations)
  const isGenerating = useChatStore((state) => state.isGenerating)

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  const scrollSignal = useMemo(() => {
    const messages = activeConversation?.messages ?? []
    const lastMessage = messages.at(-1)

    return `${activeConversationId}:${messages.length}:${lastMessage?.id ?? ""}:${lastMessage?.content.length ?? 0}`
  }, [activeConversation?.messages, activeConversationId])

  const lockToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const scrollElement = scrollRef.current

    isAutoScrollLockedRef.current = true

    if (!scrollElement) {
      return
    }

    scrollElement.scrollTo({
      top: scrollElement.scrollHeight,
      behavior,
    })
  }, [])

  useEffect(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    function handleScroll() {
      const distanceFromBottom =
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight

      isAutoScrollLockedRef.current = distanceFromBottom <= SCROLL_LOCK_THRESHOLD_PX
    }

    scrollElement.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => scrollElement.removeEventListener("scroll", handleScroll)
  }, [activeConversationId])

  useEffect(() => {
    if (!isAutoScrollLockedRef.current) {
      return
    }

    lockToBottom("smooth")
  }, [isGenerating, lockToBottom, scrollSignal])

  return { lockToBottom, scrollRef }
}
