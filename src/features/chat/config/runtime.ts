export const chatRuntimeConfig = {
  endpoint: "http://127.0.0.1:3001/chat",
  model: "gemma4:e2b-mlx",
  contextWindowTokens: 8192,
  stream: {
    characterFrameMs: 5,
    characterBatchSize: 1,
  },
} as const
