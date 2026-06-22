export const DEFAULT_CONVERSATION_TITLE = "New Conversation"
export const TITLE_PENDING_LABEL = "Naming conversation"
export const TITLE_MAX_VISIBLE_CHARACTERS = 34
export const SEARCH_TITLE_MAX_VISIBLE_CHARACTERS = 70

export const QUICK_PROMPTS = [
  "Summarize a technical note",
  "Draft a calm product update",
  "Compare local model options",
] as const

export const EMPTY_STATE_TITLE = "Start a focused conversation."
export const EMPTY_STATE_DESCRIPTION =
  "SupraChat is using the packaged local llama.cpp runtime configured for this workspace."
export const WORKSPACE_LABEL = "Local chat workspace"
export const LOCAL_RUNTIME_NAME = "llama.cpp"
export const LOCAL_RUNTIME_DESCRIPTION = "Local generation is active for this workspace."
export const TITLE_GENERATION_NOTE = "Titles are generated locally after the first message."
export const CHAT_READING_NOTE = "SupraChat can make mistakes. Verify important information."
export const GENERATION_ERROR_MESSAGE =
  "Generation stopped before the response completed. Check the local model runtime and try again."
export const SUBMIT_SCROLL_TOP_OFFSET_PX = 24
export const SUBMIT_SCROLL_SETTLE_MS = 420
export const SUBMIT_SCROLL_MIN_BOTTOM_SPACE_PX = 160
