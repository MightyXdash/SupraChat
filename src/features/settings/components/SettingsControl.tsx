import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

type SegmentedOption<T extends string> = {
  label: string
  value: T
}

type SettingsSegmentedControlProps<T extends string> = {
  "aria-label": string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

type SettingsToggleProps = {
  "aria-label"?: string
  checked: boolean
  title?: string
  onChange: (checked: boolean) => void
}

type SettingsBadgeProps = {
  children: string
  tone?: "neutral" | "success" | "warning" | "error"
}

export function SettingsSegmentedControl<T extends string>({
  "aria-label": ariaLabel,
  options,
  value,
  onChange,
}: SettingsSegmentedControlProps<T>) {
  return (
    <div className="settings-segmented-control" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          className="settings-segmented-option"
          type="button"
          role="radio"
          aria-checked={option.value === value}
          data-active={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsToggle({ "aria-label": ariaLabel, checked, onChange, title }: SettingsToggleProps) {
  return (
    <button
      className="settings-toggle"
      type="button"
      role="checkbox"
      aria-label={ariaLabel}
      aria-checked={checked}
      data-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span>
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  )
}

export function SettingsBadge({ children, tone = "neutral" }: SettingsBadgeProps) {
  return (
    <span className={cn("settings-badge", `settings-badge-${tone}`)}>
      {children}
    </span>
  )
}

export function SettingsPath({ value }: { value: string }) {
  return <code className="settings-path">{value}</code>
}
