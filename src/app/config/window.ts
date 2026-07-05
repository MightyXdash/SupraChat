import type { UpdatePreferences, UpdateStatus, UpdateTrack } from "@/features/updates/types"
export type SupraChatPlatform = "darwin" | "win32" | "linux" | string

type WindowControls = {
  close: () => Promise<void>
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
}

type AttachmentPickerDocument = {
  id: string
  kind: "document"
  name: string
  filePath: string
  mimeType: string
  textContent: string
  truncated: boolean
  wordCount: number
  createdAt: string
}

type AttachmentPickerImage = {
  id: string
  kind: "image"
  name: string
  filePath: string
  mimeType: string
  dataUrl: string
  createdAt: string
}

type AttachmentPickerBridge = {
  pickDocuments: () => Promise<AttachmentPickerDocument[]>
  pickImages: () => Promise<AttachmentPickerImage[]>
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

type AppEventsBridge = {
  onCheckUpdates: (listener: () => void) => () => void
  onNewConversation: (listener: () => void) => () => void
  onOpenSettings: (listener: () => void) => () => void
}

type StartupBridge = {
  reportProgress: (payload: {
    detail?: string
    label?: string
    progress?: number
  }) => void
  setThemePreference: (themePreference: "system" | "light" | "dark") => void
}

declare global {
  interface Window {
    suprachat?: {
      appEvents?: AppEventsBridge
      attachments?: AttachmentPickerBridge
      backendPort?: number
      clientToken?: string
      platform?: SupraChatPlatform
      rendererReady?: () => void
      startup?: StartupBridge
      updater?: UpdaterBridge
      windowControls?: WindowControls
    }
  }
}

export const appWindowConfig = {
  title: "SupraChat",
  appEvents: window.suprachat?.appEvents,
  platform: window.suprachat?.platform ?? "browser",
  controls: window.suprachat?.windowControls,
} as const

export const isMacPlatform = appWindowConfig.platform === "darwin"
