import { appNavigationItems, sidebarControlIcon as SidebarControlIcon } from "@/app/config/navigation"
import { cn } from "@/lib/utils"
import { Conversation } from "@/features/chat/types"

type AppSidebarProps = {
  activeConversationId: string
  collapsed: boolean
  conversations: Conversation[]
  onCreateConversation: () => string
  onSelectConversation: (conversationId: string) => void
  onToggleCollapsed: () => void
}

export function AppSidebar({
  activeConversationId,
  collapsed,
  conversations,
  onCreateConversation,
  onSelectConversation,
  onToggleCollapsed,
}: AppSidebarProps) {
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
            onClick={item.action === "create-conversation" ? onCreateConversation : undefined}
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
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={cn(
                  "conversation-link",
                  conversation.id === activeConversationId && "conversation-link-active",
                )}
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className="truncate">{conversation.title}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
