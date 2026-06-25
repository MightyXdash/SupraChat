import { FormEvent, useEffect, useRef, useState } from "react"
import { Moon, Pencil, RefreshCcw, Sun, Trash2 } from "lucide-react"
import { appNavigationItems, sidebarControlIcon as SidebarControlIcon } from "@/app/config/navigation"
import { type AppTheme } from "@/app/config/theme"
import { cn } from "@/lib/utils"
import { TITLE_PENDING_LABEL } from "@/features/chat/config/ui"
import { useScrollVisibility } from "@/features/chat/hooks/useScrollVisibility"
import { truncateConversationTitle } from "@/features/chat/lib/chat-records"
import { Conversation } from "@/features/chat/types"
import { useSettingsStore } from "@/features/settings/store/use-settings-store"

type AppSidebarProps = {
  activePanel: "chat" | "playground"
  activeConversationId: string
  collapsed: boolean
  conversations: Conversation[]
  isBusy: boolean
  isLoading: boolean
  theme: AppTheme
  onCreateConversation: () => Promise<string>
  onDeleteConversation: (conversationId: string) => Promise<boolean>
  onRegenerateConversationTitle: (conversationId: string) => Promise<boolean>
  onRenameConversation: (conversationId: string, title: string) => Promise<boolean>
  onSelectConversation: (conversationId: string) => void
  onOpenSearch: () => void
  onOpenPlayground: () => void
  onOpenSettings: () => void
  onToggleTheme: () => void
  onToggleCollapsed: () => void
}

type ConversationMenuState = {
  conversationId: string
  isClosing?: boolean
  x: number
  y: number
}

export function AppSidebar({
  activePanel,
  activeConversationId,
  collapsed,
  conversations,
  isBusy,
  isLoading,
  theme,
  onCreateConversation,
  onDeleteConversation,
  onRegenerateConversationTitle,
  onRenameConversation,
  onSelectConversation,
  onOpenSearch,
  onOpenPlayground,
  onOpenSettings,
  onToggleTheme,
  onToggleCollapsed,
}: AppSidebarProps) {
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuState | null>(null)
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const closeMenuTimerRef = useRef<number | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const recentsScrollRef = useRef<HTMLDivElement | null>(null)
  const isRecentsScrolling = useScrollVisibility(recentsScrollRef)
  const confirmConversationDeletion = useSettingsStore((state) => state.confirmConversationDeletion)
  const displayedConversations = isLoading
    ? []
    : conversations.filter((conversation) => conversation.messages.length > 0)

  useEffect(() => {
    if (!renamingConversationId) {
      return
    }

    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renamingConversationId])

  useEffect(() => {
    if (!conversationMenu) {
      return
    }

    window.addEventListener("click", closeConversationMenu)
    window.addEventListener("resize", closeConversationMenu)
    window.addEventListener("blur", closeConversationMenu)

    return () => {
      window.removeEventListener("click", closeConversationMenu)
      window.removeEventListener("resize", closeConversationMenu)
      window.removeEventListener("blur", closeConversationMenu)
    }
  }, [conversationMenu])

  useEffect(() => {
    return () => {
      if (closeMenuTimerRef.current !== null) {
        window.clearTimeout(closeMenuTimerRef.current)
      }
    }
  }, [])

  function openConversationMenu(menu: ConversationMenuState) {
    if (closeMenuTimerRef.current !== null) {
      window.clearTimeout(closeMenuTimerRef.current)
      closeMenuTimerRef.current = null
    }

    setConversationMenu(menu)
  }

  function closeConversationMenu() {
    setConversationMenu((currentMenu) => {
      if (!currentMenu || currentMenu.isClosing) {
        return currentMenu
      }

      return { ...currentMenu, isClosing: true }
    })

    if (closeMenuTimerRef.current !== null) {
      window.clearTimeout(closeMenuTimerRef.current)
    }

    closeMenuTimerRef.current = window.setTimeout(() => {
      setConversationMenu(null)
      closeMenuTimerRef.current = null
    }, 150)
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!renamingConversationId) {
      return
    }

    const renamed = await onRenameConversation(renamingConversationId, renameDraft)

    if (renamed) {
      setRenamingConversationId(null)
      setRenameDraft("")
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    const confirmed = !confirmConversationDeletion || window.confirm("Delete this conversation? This cannot be undone.")

    if (!confirmed) {
      return
    }

    const deleted = await onDeleteConversation(conversationId)

    if (deleted) {
      closeConversationMenu()
    }
  }

  function startRenaming(conversation: Conversation) {
    closeConversationMenu()
    setRenamingConversationId(conversation.id)
    setRenameDraft(conversation.title)
  }

  async function handleRegenerateConversationTitle(conversationId: string) {
    closeConversationMenu()
    await onRegenerateConversationTitle(conversationId)
  }

  return (
    <aside
      className="app-sidebar flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] max-[780px]:hidden"
      data-collapsed={collapsed}
    >
      <div className="sidebar-header">
        <div className="sidebar-brand-wrap" aria-hidden={collapsed}>
          <h1 className="text-[0.96rem] font-semibold">SupraChat</h1>
        </div>
        <div className="sidebar-header-actions">
          {!collapsed ? (
            <button
              className="sidebar-icon-button"
              type="button"
              aria-label={theme === "light" ? "Use dark theme" : "Use light theme"}
              onClick={onToggleTheme}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          ) : null}
          <button
            className="sidebar-icon-button"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
          >
            <SidebarControlIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav space-y-1">
        {appNavigationItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "nav-item",
              item.isActive && "nav-item-active",
              item.action === "open-playground" && activePanel === "playground" && "nav-item-active",
            )}
            type="button"
            aria-label={item.label}
            onClick={
              item.action === "create-conversation"
                ? () => void onCreateConversation()
                : item.action === "search-conversations"
                  ? onOpenSearch
                  : item.action === "open-playground"
                    ? onOpenPlayground
                    : item.action === "open-settings"
                      ? onOpenSettings
                      : undefined
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4" />
            <span className="sidebar-label" aria-hidden={collapsed}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div
        className="sidebar-recents scrollbar-reveal mt-5 min-h-0 flex-1 overflow-y-auto px-2.5 pb-4"
        aria-hidden={collapsed}
        data-scrolling={isRecentsScrolling}
        ref={recentsScrollRef}
      >
        <section className="sidebar-section">
          <p className="sidebar-section-title">Recents</p>
          <div className="space-y-0.5">
            {isLoading ? (
              <div className="sidebar-empty-state">Loading conversations</div>
            ) : null}
            {displayedConversations.map((conversation) => {
              const isTitleGenerating =
                conversation.titleStatus === "generating" && conversation.title.trim().length === 0
              const displayTitle = truncateConversationTitle(conversation.title)

              return (
              <div className="conversation-row" key={conversation.id}>
                {renamingConversationId === conversation.id ? (
                  <form className="conversation-rename-form" onSubmit={(event) => void handleRenameSubmit(event)}>
                    <input
                      ref={renameInputRef}
                      className="conversation-rename-input"
                      value={renameDraft}
                      onBlur={() => {
                        setRenamingConversationId(null)
                        setRenameDraft("")
                      }}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setRenamingConversationId(null)
                          setRenameDraft("")
                        }
                      }}
                    />
                  </form>
                ) : (
                  <button
                    className={cn(
                      "conversation-link",
                      conversation.id === activeConversationId && "conversation-link-active",
                    )}
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      openConversationMenu({
                        conversationId: conversation.id,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }}
                  >
                    {isTitleGenerating ? (
                      <span className="conversation-title-loading" aria-label={TITLE_PENDING_LABEL}>
                        <span />
                        <span />
                      </span>
                    ) : (
                      <span className="truncate">{displayTitle}</span>
                    )}
                  </button>
                )}
              </div>
              )
            })}
            {!isLoading && displayedConversations.length === 0 ? (
              <div className="sidebar-empty-state">No saved conversations</div>
            ) : null}
          </div>
        </section>
      </div>

      {conversationMenu ? (
        <div
          className="conversation-context-menu"
          data-state={conversationMenu.isClosing ? "closed" : "open"}
          style={{ left: conversationMenu.x, top: conversationMenu.y }}
        >
          <button
            className="conversation-context-action"
            type="button"
            onClick={() => {
              const conversation = conversations.find(
                (item) => item.id === conversationMenu.conversationId,
              )

              if (conversation) {
                startRenaming(conversation)
              }
            }}
          >
            <Pencil className="h-3 w-3" />
            <span>Rename</span>
          </button>
          <button
            className="conversation-context-action"
            type="button"
            disabled={conversationMenu.isClosing}
            onClick={() => void handleRegenerateConversationTitle(conversationMenu.conversationId)}
          >
            <RefreshCcw className="h-3 w-3" />
            <span>Rename</span>
          </button>
          <button
            className="conversation-context-action conversation-context-action-danger"
            type="button"
            disabled={isBusy && conversationMenu.conversationId === activeConversationId}
            onClick={() => void handleDeleteConversation(conversationMenu.conversationId)}
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </button>
        </div>
      ) : null}
    </aside>
  )
}
