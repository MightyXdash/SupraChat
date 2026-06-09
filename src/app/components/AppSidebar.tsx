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
    <aside className="app-sidebar flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] max-[780px]:hidden">
      <div
        className={cn(
          "flex items-center pb-4 pt-5",
          collapsed ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        <div className={cn("sidebar-brand-wrap", collapsed && "sidebar-brand-wrap-collapsed")}>
          <h1 className="text-lg font-semibold tracking-[-0.01em]">SupraChat</h1>
        </div>
        <button
          className="sidebar-icon-button"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          <SidebarControlIcon className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className={cn("space-y-1", collapsed ? "px-2" : "px-2.5")}>
        {appNavigationItems.map((item) => (
          <button
            key={item.label}
            className={cn("nav-item", collapsed && "nav-item-collapsed", item.isActive && "nav-item-active")}
            type="button"
            aria-label={item.label}
            onClick={item.action === "create-conversation" ? onCreateConversation : undefined}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4" />
            <span className={cn("sidebar-label", collapsed && "sidebar-label-collapsed")}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div
        className={cn(
          "sidebar-recents mt-5 min-h-0 flex-1 overflow-y-auto px-2.5 pb-4",
          collapsed && "sidebar-recents-collapsed",
        )}
      >
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
