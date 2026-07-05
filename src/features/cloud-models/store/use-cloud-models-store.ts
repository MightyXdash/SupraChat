import { create } from "zustand"
import type { CloudModelInstance, CloudModelProviderId } from "@/features/cloud-models/types/cloud-models"
import type { ReasoningEffort } from "@/features/cloud-models/lib/reasoning"
import { cloudModelsConfig } from "@/features/cloud-models/config/cloud-models"

type ActiveCloudModel = {
  instanceId: string
  modelId: string
}

type CloudModelsState = {
  instances: CloudModelInstance[]
  activeCloudModel: ActiveCloudModel | null
  reasoningEffort: ReasoningEffort
  addInstance: (providerId: CloudModelProviderId, label: string, apiKey: string, modelIds: string[]) => void
  removeInstance: (instanceId: string) => void
  updateInstance: (instanceId: string, updates: Partial<Pick<CloudModelInstance, "label" | "apiKey" | "modelIds">>) => void
  setActiveCloudModel: (model: ActiveCloudModel | null) => void
  setReasoningEffort: (effort: ReasoningEffort) => void
}

function readStoredInstances(): CloudModelInstance[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cloudModelsConfig.storageKey) ?? "[]")

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (instance): instance is CloudModelInstance =>
        instance &&
        typeof instance === "object" &&
        typeof instance.id === "string" &&
        typeof instance.providerId === "string" &&
        typeof instance.label === "string" &&
        typeof instance.apiKey === "string" &&
        Array.isArray(instance.modelIds),
    )
  } catch {
    return []
  }
}

function persistInstances(instances: CloudModelInstance[]) {
  window.localStorage.setItem(cloudModelsConfig.storageKey, JSON.stringify(instances))
}

function generateInstanceId(): string {
  return `cmi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function mergeModelIds(userModelIds: string[]): string[] {
  const merged = [...cloudModelsConfig.autoAddModelIds]
  for (const modelId of userModelIds) {
    const trimmed = modelId.trim()
    if (trimmed && !merged.includes(trimmed)) {
      merged.push(trimmed)
    }
  }
  return merged
}

export const useCloudModelsStore = create<CloudModelsState>((set) => ({
  instances: readStoredInstances(),
  activeCloudModel: null,
  reasoningEffort: "medium",
  addInstance: (providerId, label, apiKey, modelIds) =>
    set((state) => {
      const newInstance: CloudModelInstance = {
        id: generateInstanceId(),
        providerId,
        label,
        apiKey,
        modelIds: mergeModelIds(modelIds),
      }
      const nextInstances = [...state.instances, newInstance]
      persistInstances(nextInstances)
      return { instances: nextInstances }
    }),
  removeInstance: (instanceId) =>
    set((state) => {
      const nextInstances = state.instances.filter((instance) => instance.id !== instanceId)
      persistInstances(nextInstances)
      const wasActiveCloudModel = state.activeCloudModel?.instanceId === instanceId
      return {
        instances: nextInstances,
        activeCloudModel: wasActiveCloudModel ? null : state.activeCloudModel,
      }
    }),
  updateInstance: (instanceId, updates) =>
    set((state) => {
      const nextInstances = state.instances.map((instance) =>
        instance.id === instanceId ? { ...instance, ...updates } : instance,
      )
      persistInstances(nextInstances)
      return { instances: nextInstances }
    }),
  setActiveCloudModel: (model) => set({ activeCloudModel: model }),
  setReasoningEffort: (effort) => set({ reasoningEffort: effort }),
}))
