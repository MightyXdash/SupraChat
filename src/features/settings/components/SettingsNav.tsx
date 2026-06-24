import { settingsTabs, type SettingsTab, type SettingsTabId } from "@/features/settings/config/settings-tabs"
import { cn } from "@/lib/utils"

type SettingsNavProps = {
  activeTab: SettingsTabId
  onChange: (tab: SettingsTabId) => void
}

export function SettingsNav({ activeTab, onChange }: SettingsNavProps) {
  const groupedTabs = settingsTabs.reduce<Record<SettingsTab["group"], SettingsTab[]>>(
    (groups, tab) => {
      groups[tab.group].push(tab)
      return groups
    },
    {
      Desktop: [],
      Local: [],
    },
  )

  return (
    <nav className="settings-nav" aria-label="Settings">
      {Object.entries(groupedTabs).map(([group, tabs]) => (
        <div className="settings-nav-group" key={group}>
          <p>{group}</p>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn("settings-nav-item", activeTab === tab.id && "settings-nav-item-active")}
              type="button"
              onClick={() => onChange(tab.id)}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}
