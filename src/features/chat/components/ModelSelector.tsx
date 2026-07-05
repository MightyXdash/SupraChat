import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Cloud, Download, Search, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RuntimeChatModel } from "@/features/chat/services/chat-service"
import { useCloudModelsStore } from "@/features/cloud-models/store/use-cloud-models-store"

type CloudModelSelection = {
  instanceId: string
  modelId: string
}

type ModelSelectorProps = {
  activeModelId: string | null
  activeCloudModel: CloudModelSelection | null
  disabled?: boolean
  isLoading: boolean
  isSelecting: boolean
  models: RuntimeChatModel[]
  onSelectModel: (modelId: string) => void
  onSelectCloudModel: (selection: CloudModelSelection) => void
}

function formatModelSize(sizeBytes: number | null) {
  if (!sizeBytes) {
    return "Cached"
  }

  const sizeGb = sizeBytes / 1024 / 1024 / 1024

  if (sizeGb >= 1) {
    return `${sizeGb.toFixed(sizeGb >= 10 ? 0 : 1)} GB`
  }

  return `${Math.round(sizeBytes / 1024 / 1024)} MB`
}

function getModelShortName(model: RuntimeChatModel | undefined) {
  if (!model) {
    return "Select model"
  }

  return model.label.replace(/\s+gguf$/i, "")
}

function getFilteredModels(models: RuntimeChatModel[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return models
  }

  return models.filter((model) =>
    [model.label, model.repo, model.filename]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery)),
  )
}

function getFilteredCloudModelIds(modelIds: string[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return modelIds
  }

  return modelIds.filter((modelId) => modelId.toLowerCase().includes(normalizedQuery))
}

function getPrimaryModelLabel(model: RuntimeChatModel) {
  return model.repo
}

export function ModelSelector({
  activeModelId,
  activeCloudModel,
  disabled,
  isLoading,
  isSelecting,
  models,
  onSelectModel,
  onSelectCloudModel,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeSource, setActiveSource] = useState<"local" | "cloud">("local")
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeModel = models.find((model) => model.id === activeModelId)
  const hasModels = models.length > 0
  const filteredModels = useMemo(() => getFilteredModels(models, query), [models, query])
  const cloudInstances = useCloudModelsStore((state) => state.instances)
  const hasCloudInstances = cloudInstances.length > 0
  const activeCloudInstance = activeCloudModel
    ? cloudInstances.find((instance) => instance.id === activeCloudModel.instanceId)
    : null

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  function handleSelectModel(modelId: string) {
    onSelectModel(modelId)
    setIsOpen(false)
    setQuery("")
  }

  function handleSelectCloudModel(instanceId: string, modelId: string) {
    onSelectCloudModel({ instanceId, modelId })
    setIsOpen(false)
    setQuery("")
  }

  const triggerLabel = activeCloudModel
    ? activeCloudModel.modelId
    : isLoading
      ? "Loading models"
      : getModelShortName(activeModel)

  return (
    <div
      ref={rootRef}
      className={cn(
        "model-selector",
        !hasModels && !hasCloudInstances && "model-selector-empty",
      )}
    >
      <button
        className="model-selector-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled || isSelecting || isLoading}
        onClick={() => setIsOpen((value) => !value)}
      >
        {activeCloudModel ? (
          <Cloud className="h-3.5 w-3.5 model-selector-cloud-icon" aria-hidden="true" />
        ) : null}
        <span className="model-selector-trigger-name">{triggerLabel}</span>
        <ChevronDown className="model-selector-chevron h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="model-selector-popover" role="dialog" aria-label="Select cached model">
          <div className="model-selector-tabs" aria-label="Model sources">
            <button
              className={activeSource === "local" ? "active" : ""}
              type="button"
              onClick={() => setActiveSource("local")}
            >
              Local
            </button>
            <button
              className={activeSource === "cloud" ? "active" : ""}
              type="button"
              disabled={!hasCloudInstances}
              onClick={() => setActiveSource("cloud")}
            >
              Cloud
            </button>
          </div>

          <label className="model-selector-search">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input
              autoFocus
              placeholder="Search models"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {activeSource === "local" ? (
            <>
              <div className="model-selector-group-heading">
                <span>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Downloaded
                </span>
                <small>{models.length} models</small>
              </div>

              <div className="model-selector-list" role="listbox" aria-label="Downloaded Hugging Face models">
                {filteredModels.map((model) => {
                  const isSelected = !activeCloudModel && model.id === activeModel?.id

                  return (
                    <button
                      key={model.id}
                      className="model-selector-option"
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectModel(model.id)}
                    >
                      <span className="model-selector-option-copy">
                        <strong>{getPrimaryModelLabel(model)}</strong>
                      </span>
                      <span className="model-selector-option-meta">
                        GGUF / {formatModelSize(model.sizeBytes)}
                      </span>
                      {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </button>
                  )
                })}

                {!isLoading && filteredModels.length === 0 ? (
                  <div className="model-selector-empty-state">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    <span>{hasModels ? "No matching models" : "No cached GGUF chat models found"}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="model-selector-cloud-list">
              {cloudInstances.map((instance) => {
                const filteredModelIds = getFilteredCloudModelIds(instance.modelIds, query)

                return (
                  <div key={instance.id} className="model-selector-cloud-instance">
                    <div className="model-selector-cloud-instance-header">
                      <strong>{instance.label}</strong>
                      <small>{filteredModelIds.length} model{filteredModelIds.length === 1 ? "" : "s"}</small>
                    </div>
                    <div className="model-selector-cloud-models">
                      {filteredModelIds.map((modelId) => {
                        const isSelected = activeCloudModel?.instanceId === instance.id && activeCloudModel?.modelId === modelId

                        return (
                          <button
                            key={modelId}
                            className="model-selector-option"
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectCloudModel(instance.id, modelId)}
                          >
                            <span className="model-selector-option-copy">
                              <strong>{modelId}</strong>
                            </span>
                            <span className="model-selector-option-meta">Cloud</span>
                            {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                          </button>
                        )
                      })}

                      {filteredModelIds.length === 0 ? (
                        <div className="model-selector-empty-state">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          <span>No matching models</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
