import type { UpdatePreferences, UpdateStatus, UpdateTrack } from "@/features/updates/types"
export type SupraChatPlatform = "darwin" | "win32" | "linux" | string

type WindowControls = {
  close: () => Promise<void>
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
}

type UpdaterBridge = {
  checkNow: () => Promise<UpdateStatus>
  dismissReadyState: () => Promise<UpdateStatus>
  getPreferences: () => Promise<UpdatePreferences>
  getStatus: () => Promise<UpdateStatus>
  installNow: () => Promise<boolean>
  onStatus: (listener: (status: UpdateStatus) => void) => () => void
  setConfirmExperimentalInstall: (confirmExperimentalInstall: boolean) => Promise<UpdatePreferences>
  setTrack: (track: UpdateTrack) => Promise<UpdatePreferences>
}

declare global {
  interface Window {
    suprachat?: {
      backendPort?: number
      clientToken?: string
      platform?: SupraChatPlatform
      updater?: UpdaterBridge
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
