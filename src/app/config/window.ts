export type SupraChatPlatform = "darwin" | "win32" | "linux" | string

type WindowControls = {
  close: () => Promise<void>
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
}

declare global {
  interface Window {
    suprachat?: {
      backendPort?: number
      platform?: SupraChatPlatform
      windowControls?: WindowControls
    }
  }
}

export const appWindowConfig = {
  title: "SupraChat",
  platform: window.suprachat?.platform ?? "browser",
  controls: window.suprachat?.windowControls,
} as const

export const isMacPlatform = appWindowConfig.platform === "darwin"
