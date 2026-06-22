declare global {
  interface Window {
    suprachat?: {
      backendPort?: number
      platform?: string
      windowControls?: {
        close: () => Promise<void>
        minimize: () => Promise<void>
        toggleMaximize: () => Promise<void>
      }
    }
  }
}

const backendPort = window.suprachat?.backendPort ?? 3001
const apiBaseUrl = `http://127.0.0.1:${backendPort}`

export const chatRuntimeConfig = {
  apiBaseUrl,
  endpoint: `${apiBaseUrl}/chat`,
  titleEndpoint: `${apiBaseUrl}/chat/title`,
  model: "lfm2.5-350m-q6",
  titleModel: "supra-title-350m-exp-q4-k-m",
  contextWindowTokens: 8192,
  stream: {
    characterFrameMs: 3,
  },
} as const
