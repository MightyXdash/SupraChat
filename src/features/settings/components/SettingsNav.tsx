import { settingsTabs, type SettingsTab, type SettingsTabId } from "@/features/settings/config/settings-tabs"
import { cn } from "@/lib/utils"

type SettingsNavProps = {
  activeTab: SettingsTabId
  onChange: (tab: SettingsTabId) => void
}

export function SettingsNav({ activeTab, onChange }: SettingsNavProps) {
  const desktopTabs = settingsTabs.filter((tab) => tab.group === "Desktop")

  return (
    <nav className="settings-nav" aria-label="Settings">
      <div className="settings-nav-primary">
        <div className="settings-nav-group" data-group="desktop">
          <p>Desktop</p>
          {desktopTabs.map((tab) => (
            <button
              key={tab.id}
              className={cn("settings-nav-item", activeTab === tab.id && "settings-nav-item-active")}
              type="button"
              aria-label={tab.label}
              onClick={() => onChange(tab.id)}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
