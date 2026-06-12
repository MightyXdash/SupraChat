declare global {
  interface Window {
    suprachat?: {
      backendPort?: number
      platform?: string
    }
  }
}

const backendPort = window.suprachat?.backendPort ?? 3001
const apiBaseUrl = `http://127.0.0.1:${backendPort}`

export const chatRuntimeConfig = {
  apiBaseUrl,
  endpoint: `${apiBaseUrl}/chat`,
  titleEndpoint: `${apiBaseUrl}/chat/title`,
  model: "qwen3.5:4b-mlx",
  titleModel: "gemma4:e2b-mlx",
  contextWindowTokens: 16384,
  stream: {
    characterFrameMs: 5,
    characterBatchSize: 1,
  },
} as const
