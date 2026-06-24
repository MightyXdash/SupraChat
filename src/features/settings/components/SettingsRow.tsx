import { ReactNode } from "react"

type SettingsRowProps = {
  children: ReactNode
  description?: string
  label: string
}

export function SettingsRow({ children, description, label }: SettingsRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <span>{label}</span>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}
