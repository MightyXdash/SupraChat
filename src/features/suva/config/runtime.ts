import { chatRuntimeConfig } from "@/features/chat/config/runtime"

export const suvaRuntimeConfig = {
  endpoint: `${chatRuntimeConfig.apiBaseUrl}/suva/chat`,
  fallbackEndpoint: chatRuntimeConfig.endpoint,
  sttEndpoint: `${chatRuntimeConfig.apiBaseUrl}/suva/stt`,
  voiceHealthEndpoint: `${chatRuntimeConfig.apiBaseUrl}/suva/voice/health`,
  shortcutLabel: "Ctrl Shift Space",
  stream: {
    characterFrameMs: 3,
  },
} as const
