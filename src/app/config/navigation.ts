import { PanelLeft, Search, Settings, SquarePen, type LucideIcon } from "lucide-react"

export type AppNavigationItem = {
  label: string
  icon: LucideIcon
  isActive?: boolean
  action?: "create-conversation" | "search-conversations"
}

export const appNavigationItems: AppNavigationItem[] = [
  { label: "New chat", icon: SquarePen, action: "create-conversation" },
  { label: "Search chats", icon: Search, action: "search-conversations" },
  { label: "Settings", icon: Settings },
]

export const sidebarControlIcon = PanelLeft
