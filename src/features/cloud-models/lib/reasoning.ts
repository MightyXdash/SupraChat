export type ReasoningEffort = "instant" | "low" | "medium" | "high"

const REASONING_MODEL_PATTERNS = [
  /qwen[/-]?3\.[5-9]/i,
  /qwen[/-]?[4-9]/i,
  /gemma[/-]?4/i,
  /glm[/-]?5\.2/i,
]

export function isReasoningCapableModel(modelId: string): boolean {
  return REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(modelId))
}
