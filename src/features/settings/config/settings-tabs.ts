import {
  Bot,
  Database,
  Palette,
  Settings2,
  type LucideIcon,
} from "lucide-react"

export type SettingsTabId = "general" | "appearance" | "models" | "data"

export type SettingsTab = {
  group: "Desktop" | "Local"
  id: SettingsTabId
  label: string
  description: string
  icon: LucideIcon
}

export const settingsTabs: SettingsTab[] = [
  {
    group: "Desktop",
    id: "general",
    label: "General",
    description: "App behavior and workspace defaults.",
    icon: Settings2,
  },
  {
    group: "Desktop",
    id: "appearance",
    label: "Appearance",
    description: "Theme and display preferences.",
    icon: Palette,
  },
  {
    group: "Local",
    id: "models",
    label: "Models",
    description: "Bundled SupraLabs models and local assets.",
    icon: Bot,
  },
  {
    group: "Local",
    id: "data",
    label: "Data",
    description: "Local storage, conversations, and paths.",
    icon: Database,
  },
]
