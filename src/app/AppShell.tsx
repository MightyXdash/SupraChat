import { useState } from "react"
import { AppSidebar } from "@/app/components/AppSidebar"
import { SessionPanel } from "@/app/components/SessionPanel"
import { useChatStore } from "@/features/chat/store/use-chat-store"
import { ChatWorkspace } from "@/features/chat/components/ChatWorkspace"
import { useAutoScroll } from "@/features/chat/hooks/useAutoScroll"

export function AppShell() {
  const [draft, setDraft] = useState("")
  const scrollRef = useAutoScroll()
  const conversations = useChatStore((state) => state.conversations)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const createConversation = useChatStore((state) => state.createConversation)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const isGenerating = useChatStore((state) => state.isGenerating)
  const error = useChatStore((state) => state.error)

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  async function handleSubmit() {
    const message = draft.trim()

    if (!message || isGenerating) {
      return
    }

    setDraft("")
    await sendMessage(message)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <div className="grid h-screen grid-cols-[280px_minmax(0,1fr)_300px] gap-0 max-[1080px]:grid-cols-[240px_minmax(0,1fr)] max-[780px]:grid-cols-1">
        <AppSidebar
          activeConversationId={activeConversationId}
          conversations={conversations}
          onCreateConversation={createConversation}
          onSelectConversation={setActiveConversation}
        />
        <ChatWorkspace
          conversation={activeConversation}
          draft={draft}
          error={error}
          isGenerating={isGenerating}
          scrollRef={scrollRef}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
        />
        <SessionPanel messageCount={activeConversation?.messages.length ?? 0} />
      </div>
    </main>
  )
}
