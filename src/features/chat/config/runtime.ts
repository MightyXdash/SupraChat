const backendPort = window.suprachat?.backendPort ?? 3001
const clientToken = window.suprachat?.clientToken ?? ""
const apiBaseUrl = `http://127.0.0.1:${backendPort}`
const localApiHeaders = clientToken
  ? {
      "X-SupraChat-Client-Token": clientToken,
    }
  : {}

export const chatRuntimeConfig = {
  apiBaseUrl,
  endpoint: `${apiBaseUrl}/chat`,
  titleEndpoint: `${apiBaseUrl}/chat/title`,
  localApiHeaders,
  model: "lfm2.5-1.2b-thinking-q5-k-m",
  titleModel: "supra-title-350m-exp-q4-k-m",
  contextWindowTokens: 16384,
  stream: {
    maxDisplayBatchCharacters: 4096,
  },
} as const
