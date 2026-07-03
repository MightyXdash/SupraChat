import { create } from "zustand"
import { defaultHyperparameters, type Hyperparameters } from "@/features/chat/config/hyperparameters"
import { chatRuntimeConfig } from "@/features/chat/config/runtime"
import type { UpdatePreferences, UpdateTrack } from "@/features/updates/types"

export type ThemePreference = "system" | "light" | "dark"
export type InterfaceDensity = "comfortable" | "compact"
export type FrostedSurfacePreference = "standard" | "reduced"
export type MessageFontPreference = "sans" | "serif"
export type DefaultWorkspacePreference = "chat" | "playground"

const SETTINGS_STORAGE_KEY = "suprachat.settings"

const legacyDefaultHyperparameters: Hyperparameters = {
  temperature: 0.75,
  topK: 50,
  topP: 0.8,
  repeatPenalty: 1.1,
  maxTokens: 4096,
}

type PersistedSettings = {
  autoTitleConversations: boolean
  confirmConversationDeletion: boolean
  experimentalUpdatesWarningSeen: boolean
  defaultWorkspace: DefaultWorkspacePreference
  density: InterfaceDensity
  frostedSurfaces: FrostedSurfacePreference
  messageFont: MessageFontPreference
  reduceMotion: boolean
  showAverageTps: boolean
  showContextMeter: boolean
  startWithLastConversation: boolean
  streamingTpsCap: number
  themePreference: ThemePreference
  updateTrack: UpdateTrack
  confirmExperimentalInstall: boolean
  hyperparameters: Hyperparameters
}

type SettingsState = PersistedSettings & {
  hydrateUpdatePreferences: (preferences: UpdatePreferences) => void
  setConfirmExperimentalInstall: (value: boolean) => void
  setAutoTitleConversations: (value: boolean) => void
  setConfirmConversationDeletion: (value: boolean) => void
  setExperimentalUpdatesWarningSeen: (value: boolean) => void
  setDefaultWorkspace: (value: DefaultWorkspacePreference) => void
  setDensity: (value: InterfaceDensity) => void
  setFrostedSurfaces: (value: FrostedSurfacePreference) => void
  setMessageFont: (value: MessageFontPreference) => void
  setReduceMotion: (value: boolean) => void
  setShowAverageTps: (value: boolean) => void
  setShowContextMeter: (value: boolean) => void
  setStartWithLastConversation: (value: boolean) => void
  setStreamingTpsCap: (value: number) => void
  setThemePreference: (value: ThemePreference) => void
  setUpdateTrack: (value: UpdateTrack) => void
  setHyperparameters: (hyperparameters: Hyperparameters) => void
}

const defaultSettings: PersistedSettings = {
  autoTitleConversations: true,
  confirmExperimentalInstall: true,
  confirmConversationDeletion: true,
  experimentalUpdatesWarningSeen: false,
  defaultWorkspace: "chat",
  density: "comfortable",
  frostedSurfaces: "standard",
  messageFont: "sans",
  reduceMotion: false,
  showAverageTps: true,
  showContextMeter: true,
  startWithLastConversation: true,
  streamingTpsCap: chatRuntimeConfig.stream.defaultVisibleTokensPerSecondCap,
  themePreference: "system",
  updateTrack: "final",
  hyperparameters: { ...defaultHyperparameters },
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

function isUpdateTrack(value: unknown): value is UpdateTrack {
  return value === "final" || value === "beta" || value === "alpha" || value === "dalpha"
}

function normalizeStreamingTpsCap(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultSettings.streamingTpsCap
  }

  const roundedValue = Math.round(value / 10) * 10
  return Math.min(
    chatRuntimeConfig.stream.maximumVisibleTokensPerSecondCap,
    Math.max(chatRuntimeConfig.stream.minimumVisibleTokensPerSecondCap, roundedValue),
  )
}

function normalizeHyperparameters(value: unknown): Hyperparameters {
  if (!value || typeof value !== "object") {
    return { ...defaultHyperparameters }
  }

  const raw = value as Record<string, unknown>
  const normalized = {
    temperature:
      typeof raw.temperature === "number" && Number.isFinite(raw.temperature)
        ? Math.min(2, Math.max(0, raw.temperature))
        : defaultHyperparameters.temperature,
    topK:
      typeof raw.topK === "number" && Number.isFinite(raw.topK)
        ? Math.round(Math.min(200, Math.max(1, raw.topK)))
        : defaultHyperparameters.topK,
    topP:
      typeof raw.topP === "number" && Number.isFinite(raw.topP)
        ? Math.min(1, Math.max(0, raw.topP))
        : defaultHyperparameters.topP,
    repeatPenalty:
      typeof raw.repeatPenalty === "number" && Number.isFinite(raw.repeatPenalty)
        ? Math.min(2, Math.max(0, raw.repeatPenalty))
        : defaultHyperparameters.repeatPenalty,
    maxTokens:
      typeof raw.maxTokens === "number" && Number.isFinite(raw.maxTokens)
        ? Math.round(Math.min(16384, Math.max(16, raw.maxTokens)))
        : defaultHyperparameters.maxTokens,
  }

  if (
    normalized.temperature === legacyDefaultHyperparameters.temperature &&
    normalized.topK === legacyDefaultHyperparameters.topK &&
    normalized.topP === legacyDefaultHyperparameters.topP &&
    normalized.repeatPenalty === legacyDefaultHyperparameters.repeatPenalty &&
    normalized.maxTokens === legacyDefaultHyperparameters.maxTokens
  ) {
    return { ...defaultHyperparameters }
  }

  return normalized
}

function readStoredSettings(): PersistedSettings {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}")

    return {
      autoTitleConversations:
        typeof parsed.autoTitleConversations === "boolean"
          ? parsed.autoTitleConversations
          : defaultSettings.autoTitleConversations,
      confirmExperimentalInstall:
        typeof parsed.confirmExperimentalInstall === "boolean"
          ? parsed.confirmExperimentalInstall
          : defaultSettings.confirmExperimentalInstall,
      confirmConversationDeletion:
        typeof parsed.confirmConversationDeletion === "boolean"
          ? parsed.confirmConversationDeletion
          : defaultSettings.confirmConversationDeletion,
      experimentalUpdatesWarningSeen:
        typeof parsed.experimentalUpdatesWarningSeen === "boolean"
          ? parsed.experimentalUpdatesWarningSeen
          : defaultSettings.experimentalUpdatesWarningSeen,
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
      showAverageTps:
        typeof parsed.showAverageTps === "boolean" ? parsed.showAverageTps : defaultSettings.showAverageTps,
      showContextMeter:
        typeof parsed.showContextMeter === "boolean"
          ? parsed.showContextMeter
          : defaultSettings.showContextMeter,
      startWithLastConversation:
        typeof parsed.startWithLastConversation === "boolean"
          ? parsed.startWithLastConversation
          : defaultSettings.startWithLastConversation,
      streamingTpsCap: normalizeStreamingTpsCap(parsed.streamingTpsCap),
      themePreference: isThemePreference(parsed.themePreference)
        ? parsed.themePreference
        : defaultSettings.themePreference,
      updateTrack: isUpdateTrack(parsed.updateTrack) ? parsed.updateTrack : defaultSettings.updateTrack,
      hyperparameters: normalizeHyperparameters(parsed.hyperparameters),
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
      autoTitleConversations: nextSettings.autoTitleConversations,
      confirmExperimentalInstall: nextSettings.confirmExperimentalInstall,
      confirmConversationDeletion: nextSettings.confirmConversationDeletion,
      experimentalUpdatesWarningSeen: nextSettings.experimentalUpdatesWarningSeen,
      defaultWorkspace: nextSettings.defaultWorkspace,
      density: nextSettings.density,
      frostedSurfaces: nextSettings.frostedSurfaces,
      messageFont: nextSettings.messageFont,
      reduceMotion: nextSettings.reduceMotion,
      showAverageTps: nextSettings.showAverageTps,
      showContextMeter: nextSettings.showContextMeter,
      startWithLastConversation: nextSettings.startWithLastConversation,
      streamingTpsCap: nextSettings.streamingTpsCap,
      themePreference: nextSettings.themePreference,
      updateTrack: nextSettings.updateTrack,
      hyperparameters: nextSettings.hyperparameters,
    })
    return { [key]: value } as Partial<SettingsState>
  })
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...readStoredSettings(),
  hydrateUpdatePreferences: (preferences) =>
    set((state) => {
      const normalizedPreferences =
        preferences.updateTrack === "final"
          ? { ...preferences, confirmExperimentalInstall: true }
          : preferences

      const nextSettings = {
        ...state,
        confirmExperimentalInstall: normalizedPreferences.confirmExperimentalInstall,
        updateTrack: normalizedPreferences.updateTrack,
      }

      persistSettings({
        autoTitleConversations: nextSettings.autoTitleConversations,
        confirmExperimentalInstall: nextSettings.confirmExperimentalInstall,
        confirmConversationDeletion: nextSettings.confirmConversationDeletion,
        experimentalUpdatesWarningSeen: nextSettings.experimentalUpdatesWarningSeen,
        defaultWorkspace: nextSettings.defaultWorkspace,
        density: nextSettings.density,
        frostedSurfaces: nextSettings.frostedSurfaces,
        messageFont: nextSettings.messageFont,
        reduceMotion: nextSettings.reduceMotion,
        showAverageTps: nextSettings.showAverageTps,
        showContextMeter: nextSettings.showContextMeter,
        startWithLastConversation: nextSettings.startWithLastConversation,
        streamingTpsCap: nextSettings.streamingTpsCap,
        themePreference: nextSettings.themePreference,
        updateTrack: nextSettings.updateTrack,
        hyperparameters: nextSettings.hyperparameters,
      })

      return {
        confirmExperimentalInstall: normalizedPreferences.confirmExperimentalInstall,
        updateTrack: normalizedPreferences.updateTrack,
      }
    }),
  setAutoTitleConversations: (value) => updateSetting(set, "autoTitleConversations", value),
  setConfirmExperimentalInstall: (value) => updateSetting(set, "confirmExperimentalInstall", value),
  setConfirmConversationDeletion: (value) => updateSetting(set, "confirmConversationDeletion", value),
  setExperimentalUpdatesWarningSeen: (value) => updateSetting(set, "experimentalUpdatesWarningSeen", value),
  setDefaultWorkspace: (value) => updateSetting(set, "defaultWorkspace", value),
  setDensity: (value) => updateSetting(set, "density", value),
  setFrostedSurfaces: (value) => updateSetting(set, "frostedSurfaces", value),
  setMessageFont: (value) => updateSetting(set, "messageFont", value),
  setReduceMotion: (value) => updateSetting(set, "reduceMotion", value),
  setShowAverageTps: (value) => updateSetting(set, "showAverageTps", value),
  setShowContextMeter: (value) => updateSetting(set, "showContextMeter", value),
  setStartWithLastConversation: (value) => updateSetting(set, "startWithLastConversation", value),
  setStreamingTpsCap: (value) => updateSetting(set, "streamingTpsCap", normalizeStreamingTpsCap(value)),
  setThemePreference: (value) => updateSetting(set, "themePreference", value),
  setUpdateTrack: (value) => updateSetting(set, "updateTrack", value),
  setHyperparameters: (hyperparameters) =>
    set((state) => {
      const normalizedHyperparameters = normalizeHyperparameters(hyperparameters)
      const nextSettings = { ...state, hyperparameters: normalizedHyperparameters }
      persistSettings({
        autoTitleConversations: nextSettings.autoTitleConversations,
        confirmExperimentalInstall: nextSettings.confirmExperimentalInstall,
        confirmConversationDeletion: nextSettings.confirmConversationDeletion,
        experimentalUpdatesWarningSeen: nextSettings.experimentalUpdatesWarningSeen,
        defaultWorkspace: nextSettings.defaultWorkspace,
        density: nextSettings.density,
        frostedSurfaces: nextSettings.frostedSurfaces,
        messageFont: nextSettings.messageFont,
        reduceMotion: nextSettings.reduceMotion,
        showAverageTps: nextSettings.showAverageTps,
        showContextMeter: nextSettings.showContextMeter,
        startWithLastConversation: nextSettings.startWithLastConversation,
        streamingTpsCap: nextSettings.streamingTpsCap,
        themePreference: nextSettings.themePreference,
        updateTrack: nextSettings.updateTrack,
        hyperparameters: nextSettings.hyperparameters,
      })
      return { hyperparameters: normalizedHyperparameters }
    }),
}))
