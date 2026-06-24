import { create } from "zustand"

export type ThemePreference = "system" | "light" | "dark"
export type InterfaceDensity = "comfortable" | "compact"
export type FrostedSurfacePreference = "standard" | "reduced"
export type MessageFontPreference = "sans" | "serif"
export type DefaultWorkspacePreference = "chat" | "playground"

const SETTINGS_STORAGE_KEY = "suprachat.settings"

type PersistedSettings = {
  defaultWorkspace: DefaultWorkspacePreference
  density: InterfaceDensity
  frostedSurfaces: FrostedSurfacePreference
  messageFont: MessageFontPreference
  reduceMotion: boolean
  showContextMeter: boolean
  startWithLastConversation: boolean
  themePreference: ThemePreference
}

type SettingsState = PersistedSettings & {
  setDefaultWorkspace: (value: DefaultWorkspacePreference) => void
  setDensity: (value: InterfaceDensity) => void
  setFrostedSurfaces: (value: FrostedSurfacePreference) => void
  setMessageFont: (value: MessageFontPreference) => void
  setReduceMotion: (value: boolean) => void
  setShowContextMeter: (value: boolean) => void
  setStartWithLastConversation: (value: boolean) => void
  setThemePreference: (value: ThemePreference) => void
}

const defaultSettings: PersistedSettings = {
  defaultWorkspace: "chat",
  density: "comfortable",
  frostedSurfaces: "standard",
  messageFont: "sans",
  reduceMotion: false,
  showContextMeter: true,
  startWithLastConversation: true,
  themePreference: "system",
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark"
}

function isDensity(value: unknown): value is InterfaceDensity {
  return value === "comfortable" || value === "compact"
}

function isFrostedSurfacePreference(value: unknown): value is FrostedSurfacePreference {
  return value === "standard" || value === "reduced"
}

function isMessageFontPreference(value: unknown): value is MessageFontPreference {
  return value === "sans" || value === "serif"
}

function isDefaultWorkspace(value: unknown): value is DefaultWorkspacePreference {
  return value === "chat" || value === "playground"
}

function readStoredSettings(): PersistedSettings {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}")

    return {
      defaultWorkspace: isDefaultWorkspace(parsed.defaultWorkspace)
        ? parsed.defaultWorkspace
        : defaultSettings.defaultWorkspace,
      density: isDensity(parsed.density) ? parsed.density : defaultSettings.density,
      frostedSurfaces: isFrostedSurfacePreference(parsed.frostedSurfaces)
        ? parsed.frostedSurfaces
        : defaultSettings.frostedSurfaces,
      messageFont: isMessageFontPreference(parsed.messageFont)
        ? parsed.messageFont
        : defaultSettings.messageFont,
      reduceMotion:
        typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : defaultSettings.reduceMotion,
      showContextMeter:
        typeof parsed.showContextMeter === "boolean"
          ? parsed.showContextMeter
          : defaultSettings.showContextMeter,
      startWithLastConversation:
        typeof parsed.startWithLastConversation === "boolean"
          ? parsed.startWithLastConversation
          : defaultSettings.startWithLastConversation,
      themePreference: isThemePreference(parsed.themePreference)
        ? parsed.themePreference
        : defaultSettings.themePreference,
    }
  } catch {
    return defaultSettings
  }
}

function persistSettings(settings: PersistedSettings) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

function updateSetting<T extends keyof PersistedSettings>(
  set: (updater: (state: SettingsState) => Partial<SettingsState>) => void,
  key: T,
  value: PersistedSettings[T],
) {
  set((state) => {
    const nextSettings = { ...state, [key]: value }
    persistSettings({
      defaultWorkspace: nextSettings.defaultWorkspace,
      density: nextSettings.density,
      frostedSurfaces: nextSettings.frostedSurfaces,
      messageFont: nextSettings.messageFont,
      reduceMotion: nextSettings.reduceMotion,
      showContextMeter: nextSettings.showContextMeter,
      startWithLastConversation: nextSettings.startWithLastConversation,
      themePreference: nextSettings.themePreference,
    })
    return { [key]: value } as Partial<SettingsState>
  })
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...readStoredSettings(),
  setDefaultWorkspace: (value) => updateSetting(set, "defaultWorkspace", value),
  setDensity: (value) => updateSetting(set, "density", value),
  setFrostedSurfaces: (value) => updateSetting(set, "frostedSurfaces", value),
  setMessageFont: (value) => updateSetting(set, "messageFont", value),
  setReduceMotion: (value) => updateSetting(set, "reduceMotion", value),
  setShowContextMeter: (value) => updateSetting(set, "showContextMeter", value),
  setStartWithLastConversation: (value) => updateSetting(set, "startWithLastConversation", value),
  setThemePreference: (value) => updateSetting(set, "themePreference", value),
}))
