import { FormEvent, useEffect, useRef, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { appNavigationItems, sidebarControlIcon as SidebarControlIcon } from "@/app/config/navigation"
import { cn } from "@/lib/utils"
import { TITLE_PENDING_LABEL } from "@/features/chat/config/ui"
import { truncateConversationTitle } from "@/features/chat/lib/chat-records"
import { Conversation } from "@/features/chat/types"

type AppSidebarProps = {
  activeConversationId: string
  collapsed: boolean
  conversations: Conversation[]
  isBusy: boolean
  isLoading: boolean
  onCreateConversation: () => Promise<string>
  onDeleteConversation: (conversationId: string) => Promise<boolean>
  onRenameConversation: (conversationId: string, title: string) => Promise<boolean>
  onSelectConversation: (conversationId: string) => void
  onToggleCollapsed: () => void
}

type ConversationMenuState = {
  conversationId: string
  x: number
  y: number
}

export function AppSidebar({
  activeConversationId,
  collapsed,
  conversations,
  isBusy,
  isLoading,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onSelectConversation,
  onToggleCollapsed,
}: AppSidebarProps) {
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuState | null>(null)
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const renameInputRef = useRef<HTMLInputElement | null>(null)
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

    function closeMenu() {
      setConversationMenu(null)
    }

    window.addEventListener("click", closeMenu)
    window.addEventListener("resize", closeMenu)
    window.addEventListener("blur", closeMenu)

    return () => {
      window.removeEventListener("click", closeMenu)
      window.removeEventListener("resize", closeMenu)
      window.removeEventListener("blur", closeMenu)
    }
  }, [conversationMenu])

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
    const confirmed = window.confirm("Delete this conversation? This cannot be undone.")

    if (!confirmed) {
      return
    }

    const deleted = await onDeleteConversation(conversationId)

    if (deleted) {
      setConversationMenu(null)
    }
  }

  function startRenaming(conversation: Conversation) {
    setConversationMenu(null)
    setRenamingConversationId(conversation.id)
    setRenameDraft(conversation.title)
  }

  return (
    <aside
      className="app-sidebar flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] max-[780px]:hidden"
      data-collapsed={collapsed}
    >
      <div className="sidebar-header">
        <div className="sidebar-brand-wrap" aria-hidden={collapsed}>
          <h1 className="text-lg font-semibold tracking-[-0.01em]">SupraChat</h1>
        </div>
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

      <nav className="sidebar-nav space-y-1">
        {appNavigationItems.map((item) => (
          <button
            key={item.label}
            className={cn("nav-item", item.isActive && "nav-item-active")}
            type="button"
            aria-label={item.label}
            onClick={item.action === "create-conversation" ? () => void onCreateConversation() : undefined}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4" />
            <span className="sidebar-label" aria-hidden={collapsed}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-recents mt-5 min-h-0 flex-1 overflow-y-auto px-2.5 pb-4" aria-hidden={collapsed}>
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
                      setConversationMenu({
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
