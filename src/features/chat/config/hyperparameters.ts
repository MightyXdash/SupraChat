export type Hyperparameters = {
  temperature: number
  topK: number
  topP: number
  repeatPenalty: number
  maxTokens: number
}

export type HyperparameterPresetId = "balanced" | "precise" | "anti-repeat" | "creative"

export type HyperparameterPreset = {
  id: HyperparameterPresetId
  label: string
  values: Hyperparameters
}

export const hyperparameterPresets: HyperparameterPreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    values: {
      temperature: 0.55,
      topK: 35,
      topP: 0.7,
      repeatPenalty: 1.15,
      maxTokens: 4096,
    },
  },
  {
    id: "precise",
    label: "Precise",
    values: {
      temperature: 0.35,
      topK: 24,
      topP: 0.65,
      repeatPenalty: 1.2,
      maxTokens: 4096,
    },
  },
  {
    id: "anti-repeat",
    label: "Anti-repeat",
    values: {
      temperature: 0.45,
      topK: 28,
      topP: 0.65,
      repeatPenalty: 1.3,
      maxTokens: 4096,
    },
  },
  {
    id: "creative",
    label: "Creative",
    values: {
      temperature: 0.75,
      topK: 60,
      topP: 0.85,
      repeatPenalty: 1.1,
      maxTokens: 4096,
    },
  },
]

export const defaultHyperparameters = { ...hyperparameterPresets[0].values }

export const customHyperparameters: Hyperparameters = {
  temperature: 1,
  topK: 100,
  topP: 0.5,
  repeatPenalty: 1,
  maxTokens: 8192,
}

export function getHyperparameterPresetId(
  hyperparameters: Hyperparameters,
): HyperparameterPresetId | null {
  const preset = hyperparameterPresets.find(({ values }) =>
    values.temperature === hyperparameters.temperature &&
    values.topK === hyperparameters.topK &&
    values.topP === hyperparameters.topP &&
    values.repeatPenalty === hyperparameters.repeatPenalty &&
    values.maxTokens === hyperparameters.maxTokens,
  )

  return preset?.id ?? null
}
