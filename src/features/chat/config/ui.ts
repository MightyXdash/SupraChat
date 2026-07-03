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
export const STREAM_SCROLL_BOTTOM_SPACE_PX = 380
export const STREAM_SCROLL_JUMP_DURATION_MS = 760
export const STREAM_SCROLL_MAX_SPEED_PX_PER_SECOND = 520
export const STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND = 42
export const STREAM_SCROLL_PREDICTION_MS = 1100
export const STREAM_SCROLL_PROGRAMMATIC_GUARD_MS = 140
export const STREAM_SCROLL_REENGAGE_DISTANCE_PX = 72
export const STREAM_SCROLL_RESTORE_DELAY_MS = 2000
export const STREAM_SCROLL_RESTORE_MAX_DURATION_MS = 1200
export const STREAM_SCROLL_RESTORE_MIN_DURATION_MS = 360
export const STREAM_SCROLL_SPEED_EASE = 0.16
export const STREAM_SCROLL_SETTLE_DISTANCE_PX = 0.6
export const STREAM_SCROLL_TARGET_DEADBAND_PX = 3
