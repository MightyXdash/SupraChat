import { chatRuntimeConfig } from "@/features/chat/config/runtime"

export type SettingsModel = {
  id: string
  role: "chat" | "title" | "tts" | "stt"
  provider: string
  label: string
  repo: string
  filename?: string
  contextWindowTokens?: number
  maxTokens?: number
  approximateSizeMb?: number
  language?: string
  path: string
  installed: boolean
  sizeBytes: number | null
}

export type RuntimeFileCheck = {
  ok: boolean
  label: string
  path: string
  code?: string
  detail?: string
}

export type SettingsRuntimePayload = {
  ok: true
  apiBaseUrl: string
  port: number
  runtime: string
  runtimePreflight: {
    ok: boolean
    platform: string
    arch: string
    platformKey: string
    resourceRoot: string
    checks: RuntimeFileCheck[]
  }
  platform: string
  arch: string
  resourceRoot: string
  chatModel: SettingsModel
  titleModel: SettingsModel
  threadCount: number
  hardwareAccelerationArgs: string[]
  speechRuntime: {
    backend: string
    available?: boolean
  }
}

export type SettingsModelsPayload = {
  ok: true
  resourceRoot: string
  models: SettingsModel[]
}

export type SettingsStoragePayload = {
  ok: true
  dataDir: string
  databasePath: string
  databaseSizeBytes: number | null
  stats: {
    conversationCount: number
    messageCount: number
  }
}

async function readSettingsJson<T>(path: string): Promise<T> {
  const response = await fetch(`${chatRuntimeConfig.apiBaseUrl}${path}`, {
    headers: chatRuntimeConfig.localApiHeaders,
  })

  if (!response.ok) {
    throw new Error("Unable to load settings information.")
  }

  return (await response.json()) as T
}

export function fetchSettingsRuntime() {
  return readSettingsJson<SettingsRuntimePayload>("/settings/runtime")
}

export function fetchSettingsModels() {
  return readSettingsJson<SettingsModelsPayload>("/settings/models")
}

export function fetchSettingsStorage() {
  return readSettingsJson<SettingsStoragePayload>("/settings/storage")
}
