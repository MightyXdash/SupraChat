import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Download, Search, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RuntimeChatModel } from "@/features/chat/services/chat-service"

type ModelSelectorProps = {
  activeModelId: string | null
  disabled?: boolean
  isLoading: boolean
  isSelecting: boolean
  models: RuntimeChatModel[]
  onSelectModel: (modelId: string) => void
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

function getPrimaryModelLabel(model: RuntimeChatModel) {
  return model.repo
}

export function ModelSelector({
  activeModelId,
  disabled,
  isLoading,
  isSelecting,
  models,
  onSelectModel,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeModel = models.find((model) => model.id === activeModelId)
  const hasModels = models.length > 0
  const filteredModels = useMemo(() => getFilteredModels(models, query), [models, query])

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

  return (
    <div
      ref={rootRef}
      className={cn(
        "model-selector",
        !hasModels && "model-selector-empty",
      )}
      title={hasModels ? activeModel?.path : "No GGUF models were found in the Hugging Face cache."}
    >
      <button
        className="model-selector-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled || isSelecting || isLoading}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="model-selector-trigger-name">
          {isLoading ? "Loading models" : getModelShortName(activeModel)}
        </span>
        <ChevronDown className="model-selector-chevron h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="model-selector-popover" role="dialog" aria-label="Select cached model">
          <div className="model-selector-tabs" aria-label="Model sources">
            <button className="active" type="button">Local</button>
            <button type="button" disabled>Cloud</button>
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

          <div className="model-selector-group-heading">
            <span>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Downloaded
            </span>
            <small>{models.length} models</small>
          </div>

          <div className="model-selector-list" role="listbox" aria-label="Downloaded Hugging Face models">
            {filteredModels.map((model) => {
              const isSelected = model.id === activeModel?.id

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
        </div>
      ) : null}
    </div>
  )
}
