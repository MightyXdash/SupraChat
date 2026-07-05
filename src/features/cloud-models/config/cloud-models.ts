export const cloudModelsConfig = {
  openRouter: {
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  },
  autoAddModelIds: [
    "qwen/qwen3.7-plus",
    "qwen/qwen3.6-flash",
    "google/gemma-4-31b-it",
    "z-ai/glm-5.2",
  ],
  storageKey: "suprachat.cloud-models",
} as const
