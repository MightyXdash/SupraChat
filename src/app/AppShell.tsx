import { useEffect, useState } from "react"
import { AppSidebar } from "@/app/components/AppSidebar"
import { WindowTitleBar } from "@/app/components/WindowTitleBar"
import {
  applyAppTheme,
  getStoredTheme,
  getSystemTheme,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/app/config/theme"
import { appWindowConfig } from "@/app/config/window"
import { useChatStore } from "@/features/chat/store/use-chat-store"
import { ChatWorkspace } from "@/features/chat/components/ChatWorkspace"
import { useAutoScroll } from "@/features/chat/hooks/useAutoScroll"

export function AppShell() {
  const [draft, setDraft] = useState("")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme() ?? getSystemTheme())
  const { lockToBottom, scrollRef } = useAutoScroll()
  const conversations = useChatStore((state) => state.conversations)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const initialize = useChatStore((state) => state.initialize)
  const createConversation = useChatStore((state) => state.createConversation)
  const renameConversation = useChatStore((state) => state.renameConversation)
  const deleteConversation = useChatStore((state) => state.deleteConversation)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const isLoading = useChatStore((state) => state.isLoading)
  const isGenerating = useChatStore((state) => state.isGenerating)
  const error = useChatStore((state) => state.error)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    applyAppTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"))
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  async function handleSubmit() {
    const message = draft.trim()

    if (!message || isGenerating) {
      return
    }

    setDraft("")
    lockToBottom("auto")
    await sendMessage(message)
  }

  return (
    <main
      className="app-shell min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]"
      data-platform={appWindowConfig.platform}
    >
      <WindowTitleBar />
      <div
        className="app-shell-grid grid gap-0 max-[780px]:grid-cols-1"
        data-sidebar-state={isSidebarCollapsed ? "collapsed" : "expanded"}
      >
        <AppSidebar
          activeConversationId={activeConversationId}
          collapsed={isSidebarCollapsed}
          conversations={conversations}
          isBusy={isGenerating}
          isLoading={isLoading}
          theme={theme}
          onCreateConversation={createConversation}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onSelectConversation={setActiveConversation}
          onToggleTheme={toggleTheme}
          onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
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
      </div>
    </main>
  )
}
