import { appNavigationItems, sidebarControlIcon as SidebarControlIcon } from "@/app/config/navigation"
import { cn } from "@/lib/utils"
import { Conversation } from "@/features/chat/types"

type AppSidebarProps = {
  activeConversationId: string
  conversations: Conversation[]
  onCreateConversation: () => string
  onSelectConversation: (conversationId: string) => void
}

export function AppSidebar({
  activeConversationId,
  conversations,
  onCreateConversation,
  onSelectConversation,
}: AppSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] max-[780px]:hidden">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">SupraChat</h1>
        <button className="sidebar-icon-button" type="button" aria-label="Collapse sidebar">
          <SidebarControlIcon className="h-4 w-4" />
        </button>
      </div>

      <nav className="space-y-1 px-3">
        {appNavigationItems.map((item) => (
          <button
            key={item.label}
            className={cn("nav-item", item.isActive && "nav-item-active")}
            type="button"
            onClick={item.action === "create-conversation" ? onCreateConversation : undefined}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <section className="sidebar-section">
          <p className="sidebar-section-title">Recents</p>
          <div className="space-y-1">
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
