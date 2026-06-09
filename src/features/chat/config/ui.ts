export const DEFAULT_CONVERSATION_TITLE = "New Conversation"

export const QUICK_PROMPTS = [
  "Summarize a technical note",
  "Draft a calm product update",
  "Compare local model options",
] as const

export const EMPTY_STATE_TITLE = "Start a focused conversation."
export const EMPTY_STATE_DESCRIPTION =
  "SupraChat is using the local Ollama model configured for this workspace."
export const WORKSPACE_LABEL = "Local chat workspace"
export const LOCAL_PROVIDER_NAME = "Ollama"
export const LOCAL_PROVIDER_DESCRIPTION = "Local generation is active for this workspace."
export const TITLE_GENERATION_NOTE = "Titles use the first three words of the first user message."
export const CHAT_READING_NOTE = "SupraChat can make mistakes. Verify important information."
export const GENERATION_ERROR_MESSAGE =
  "Generation stopped before the response completed. Check the provider connection and try again."
