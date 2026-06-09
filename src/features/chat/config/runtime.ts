export const chatRuntimeConfig = {
  endpoint: "http://127.0.0.1:3001/chat",
  stream: {
    characterFrameMs: 5,
    characterBatchSize: 1,
  },
} as const
