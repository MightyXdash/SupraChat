export type CloudModelProviderId = "openrouter"

export type CloudModelInstance = {
  id: string
  providerId: CloudModelProviderId
  label: string
  apiKey: string
  modelIds: string[]
}
