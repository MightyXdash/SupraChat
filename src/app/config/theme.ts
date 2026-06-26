export type AppTheme = "light" | "dark"

const THEME_SWITCH_ATTRIBUTE = "data-theme-switching"

export function getSystemTheme(): AppTheme {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark"
  }

  return "light"
}

export function applyAppTheme(theme: AppTheme) {
  const root = document.documentElement

  root.setAttribute(THEME_SWITCH_ATTRIBUTE, "true")
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.removeAttribute(THEME_SWITCH_ATTRIBUTE)
    })
  })
}
