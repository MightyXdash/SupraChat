import { useEffect, useState } from "react"
import { ArrowUpRight, RefreshCcw } from "lucide-react"
import {
  fetchPlaygroundCatalog,
  type FeaturedPlaygroundModel,
  type PlaygroundCatalog,
  type PlaygroundCategory,
  type PlaygroundModel,
} from "@/features/playground/services/model-catalog"

type ModelLoadState = "idle" | "loading" | "ready" | "failed"

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not published"
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function getFeaturedMetadata(models: PlaygroundModel[], modelId: string) {
  const normalizedModelId = modelId.toLowerCase()

  return models.find((model) => model.id.toLowerCase() === normalizedModelId)
}

function getModelInitials(name: string) {
  return name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function getModelIdLabel(modelId: string) {
  return modelId.split("/").at(-1) ?? modelId
}

function getArtworkLabel(model: Pick<PlaygroundModel, "id" | "name" | "category">) {
  const name = model.name
    .replace(/\s+Instruct$/i, "")
    .replace(/\s+Experimental$/i, "")
    .replace(/\s+Preview$/i, "")
    .trim()

  if (name.length <= 24) {
    return name
  }

  const compactModelId = getModelIdLabel(model.id)
    .replace(/^SupraLabs\//i, "")
    .replace(/^Supra-/i, "Supra ")
    .replace(/-exp(?:erimental)?/gi, "")
    .replace(/-instruct/gi, "")
    .replace(/-/g, " ")
    .replace(/\bGGUF\b/i, "GGUF")
    .replace(/\s+/g, " ")
    .trim()

  if (compactModelId.length <= 24) {
    return compactModelId
  }

  return model.category === "utility" ? "Title GGUF" : getModelInitials(model.name)
}

function getModelTone(model: Pick<PlaygroundModel, "category" | "family" | "id">) {
  const value = `${model.category ?? ""} ${model.family ?? ""} ${model.id}`.toLowerCase()

  if (value.includes("reason")) {
    return "reasoning"
  }

  if (value.includes("title") || value.includes("utility")) {
    return "utility"
  }

  if (value.includes("story")) {
    return "story"
  }

  if (value.includes("mini") || value.includes("research") || value.includes("base")) {
    return "research"
  }

  return "chat"
}

function getFeaturedDisplayModel(model: FeaturedPlaygroundModel, metadata?: PlaygroundModel) {
  return {
    ...metadata,
    ...model,
    category: model.category ?? metadata?.category ?? null,
    description: model.description ?? metadata?.description ?? null,
    family: model.family ?? metadata?.family ?? null,
    iconUrl: model.iconUrl ?? metadata?.iconUrl ?? null,
    pipelineTag: model.pipelineTag ?? metadata?.pipelineTag ?? null,
    status: model.status ?? metadata?.status ?? null,
    tags: model.tags?.length ? model.tags : metadata?.tags ?? [],
    thumbnailUrl: model.thumbnailUrl ?? metadata?.thumbnailUrl ?? null,
    downloads: metadata?.downloads ?? model.downloads ?? 0,
    likes: metadata?.likes ?? model.likes ?? 0,
    lastModified: metadata?.lastModified ?? model.lastModified ?? null,
    url: metadata?.url ?? model.url ?? "",
  }
}

function getGroupedModels(models: PlaygroundModel[], categories: PlaygroundCategory[]) {
  const groups = categories
    .map((category) => ({
      ...category,
      models: models.filter((model) => model.category === category.id),
    }))
    .filter((group) => group.models.length > 0)

  const groupedIds = new Set(groups.flatMap((group) => group.models.map((model) => model.id)))
  const uncategorizedModels = models.filter((model) => !groupedIds.has(model.id))

  if (uncategorizedModels.length > 0) {
    groups.push({
      id: "other",
      label: "Other",
      description: "Additional SupraLabs model releases.",
      models: uncategorizedModels,
    })
  }

  return groups
}

function ModelIcon({ model, className = "" }: { model: PlaygroundModel; className?: string }) {
  return (
    <span className={`model-icon ${className}`} data-tone={getModelTone(model)} aria-hidden="true">
      {model.iconUrl ? <img src={model.iconUrl} alt="" /> : getModelInitials(model.name)}
    </span>
  )
}

export function PlaygroundWorkspace() {
  const [catalog, setCatalog] = useState<PlaygroundCatalog | null>(null)
  const [models, setModels] = useState<PlaygroundModel[]>([])
  const [loadState, setLoadState] = useState<ModelLoadState>("idle")
  const [error, setError] = useState<string | null>(null)

  async function loadModels(signal?: AbortSignal) {
    setLoadState("loading")
    setError(null)

    try {
      const nextCatalog = await fetchPlaygroundCatalog(signal)
      setCatalog(nextCatalog)
      setModels(nextCatalog.models)
      setLoadState("ready")
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") {
        return
      }

      setError(nextError instanceof Error ? nextError.message : "Unable to load SupraLabs models.")
      setLoadState("failed")
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    void loadModels(controller.signal)

    return () => controller.abort()
  }, [])

  const featuredModels = catalog?.featuredModels ?? []
  const categories = catalog?.categories ?? []
  const groupedModels = getGroupedModels(models, categories)

  return (
    <section className="playground-workspace bg-[var(--surface)]">
      <div className="playground-scroll scrollbar-reveal">
        <div className="playground-shell">
          <header className="playground-header">
            <div>
              <p className="playground-backlink">Models</p>
              <h2>All models</h2>
              <p>Browse SupraLabs models and compare their capabilities.</p>
            </div>
            <button
              className="playground-refresh-button"
              type="button"
              onClick={() => void loadModels()}
              disabled={loadState === "loading"}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              <span>{loadState === "loading" ? "Refreshing" : "Refresh catalog"}</span>
            </button>
          </header>

          <section className="playground-section" aria-labelledby="featured-models-title">
            <div className="playground-section-heading playground-featured-heading">
              <div>
                <h3 id="featured-models-title">Featured models</h3>
                <p>Start with the current SupraLabs models selected for local experimentation.</p>
              </div>
              <span>{featuredModels.length} featured</span>
            </div>

            <div className="featured-model-grid">
              {featuredModels.map((model) => {
                const metadata = getFeaturedMetadata(models, model.id)
                const displayModel = getFeaturedDisplayModel(model, metadata)
                const hasThumbnail = Boolean(displayModel.thumbnailUrl)

                return (
                  <article className="featured-model-card" key={displayModel.id}>
                    <div className="featured-model-artwork" data-tone={getModelTone(displayModel)}>
                      {hasThumbnail ? <img src={displayModel.thumbnailUrl ?? undefined} alt="" /> : null}
                      <span>{getArtworkLabel(displayModel)}</span>
                    </div>

                    <div className="featured-model-summary">
                      <div className="featured-model-title-row">
                        <ModelIcon model={displayModel} />
                        <div>
                          <h4>{displayModel.name}</h4>
                          <p>{displayModel.description}</p>
                        </div>
                      </div>

                      <dl className="featured-model-specs">
                        <div>
                          <dt>Model ID</dt>
                          <dd>{getModelIdLabel(displayModel.id)}</dd>
                        </div>
                        <div>
                          <dt>Category</dt>
                          <dd>{displayModel.category ?? "Model"}</dd>
                        </div>
                        <div>
                          <dt>Downloads</dt>
                          <dd>{formatNumber(displayModel.downloads)}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDate(displayModel.lastModified)}</dd>
                        </div>
                      </dl>

                      <div className="featured-model-footer">
                        <div className="model-chip-row">
                          {displayModel.family ? <span>{displayModel.family}</span> : null}
                          {displayModel.pipelineTag ? <span>{displayModel.pipelineTag}</span> : null}
                          {displayModel.status ? <span>{displayModel.status}</span> : null}
                        </div>
                        <a href={displayModel.url || "#"} target="_blank" rel="noreferrer">
                          View model
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="playground-section" aria-labelledby="all-models-title">
            <div className="playground-section-heading playground-section-heading-row">
              <div>
                <h3 id="all-models-title">All SupraLabs models</h3>
                <p>
                  Names, categories, artwork, and metadata are served from the SupraLabs catalog.
                </p>
              </div>
              <span>
                {loadState === "ready" ? `${models.length} models · SupraLabs catalog` : "Live catalog"}
              </span>
            </div>

            {loadState === "loading" && models.length === 0 ? (
              <div className="model-group-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="model-list-card model-list-card-loading" key={index}>
                    <span />
                    <div>
                      <i />
                      <i />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {loadState === "failed" ? (
              <div className="playground-state-panel">
                <strong>Unable to load models</strong>
                <p>{error}</p>
              </div>
            ) : null}

            {loadState === "ready" && models.length === 0 ? (
              <div className="playground-state-panel">
                <strong>No models found</strong>
                <p>The SupraLabs model catalog did not return visible models.</p>
              </div>
            ) : null}

            {groupedModels.map((group) => (
              <section className="model-group" key={group.id}>
                <div className="model-group-heading">
                  <h3>{group.label}</h3>
                  {group.description ? <p>{group.description}</p> : null}
                </div>
                <div className="model-group-grid">
                  {group.models.map((model) => (
                    <a className="model-list-card" href={model.url || "#"} target="_blank" rel="noreferrer" key={model.id}>
                      <ModelIcon model={model} className="model-list-icon" />
                      <span className="model-list-copy">
                        <strong>{model.name}</strong>
                        <span>{model.description ?? model.id}</span>
                        <small>
                          {model.pipelineTag ?? "model"} · {formatNumber(model.downloads)} downloads
                        </small>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </section>
        </div>
      </div>
    </section>
  )
}
