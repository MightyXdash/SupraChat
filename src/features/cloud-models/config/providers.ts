import type { CloudModelProviderId } from "@/features/cloud-models/types/cloud-models"

export type CloudModelProvider = {
  id: CloudModelProviderId
  label: string
  description: string
  apiKeyPlaceholder: string
  modelIdHelpText: string
}

export const cloudModelProviders: CloudModelProvider[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Access hundreds of models through a single API.",
    apiKeyPlaceholder: "sk-or-v1-...",
    modelIdHelpText: "Enter one model ID per line (e.g. anthropic/claude-3.5-sonnet).",
  },
]

export function getProvider(providerId: CloudModelProviderId): CloudModelProvider | undefined {
  return cloudModelProviders.find((provider) => provider.id === providerId)
}
