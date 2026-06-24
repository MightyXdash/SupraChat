import { ReactNode } from "react"

type SettingsSectionProps = {
  children: ReactNode
  description?: string
  title: string
}

export function SettingsSection({ children, description, title }: SettingsSectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="settings-section-rows">{children}</div>
    </section>
  )
}
