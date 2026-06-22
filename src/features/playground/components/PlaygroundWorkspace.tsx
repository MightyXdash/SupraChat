import { useEffect, useState } from "react"
import { ExternalLink, RefreshCcw } from "lucide-react"
import {
  fetchPlaygroundCatalog,
  type PlaygroundCatalog,
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

  return (
    <section className="playground-workspace bg-[var(--surface)]">
      <div className="playground-scroll scrollbar-reveal">
        <div className="playground-shell">
          <header className="playground-header">
            <div>
              <p className="playground-kicker">SupraLabs models</p>
              <h2>Playground</h2>
              <p>Browse featured SupraLabs models from the live catalog.</p>
            </div>
            <button
              className="playground-refresh-button"
              type="button"
              onClick={() => void loadModels()}
              disabled={loadState === "loading"}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              <span>{loadState === "loading" ? "Refreshing" : "Refresh"}</span>
            </button>
          </header>

          {categories.length > 0 ? (
            <section className="playground-category-strip" aria-label="Model categories">
              {categories.map((category) => (
                <span key={category.id}>{category.label}</span>
              ))}
            </section>
          ) : null}

          <section className="playground-section" aria-labelledby="featured-models-title">
            <div className="playground-section-heading">
              <h3 id="featured-models-title">Featured models</h3>
              <p>Selected models for the SupraChat playground.</p>
            </div>

            <div className="featured-model-grid">
              {featuredModels.map((model) => {
                const metadata = getFeaturedMetadata(models, model.id)

                return (
                  <article className="featured-model-card" key={model.id}>
                    <div className="model-card-mark" aria-hidden="true">
                      {model.iconUrl ?? metadata?.iconUrl ? (
                        <img src={model.iconUrl ?? metadata?.iconUrl ?? undefined} alt="" />
                      ) : (
                        model.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                      )}
                    </div>
                    <div className="featured-model-content">
                      {model.thumbnailUrl ?? metadata?.thumbnailUrl ? (
                        <img
                          className="featured-model-thumbnail"
                          src={model.thumbnailUrl ?? metadata?.thumbnailUrl ?? undefined}
                          alt=""
                        />
                      ) : null}
                      <div className="featured-model-topline">
                        <span>{model.family ?? metadata?.family ?? "Model"}</span>
                        <span>{metadata?.pipelineTag ?? "Catalog"}</span>
                        {metadata?.status ? <span>{metadata.status}</span> : null}
                      </div>
                      <h4>{model.name ?? metadata?.name}</h4>
                      <p>{model.description ?? metadata?.description}</p>
                      <div className="model-meta-row">
                        <span>{formatNumber(metadata?.downloads ?? 0)} downloads</span>
                        <span>{formatNumber(metadata?.likes ?? 0)} likes</span>
                      </div>
                      <a href={metadata?.url || model.url || "#"} target="_blank" rel="noreferrer">
                        View model
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
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

            <div className="model-catalog-list">
              {loadState === "loading" && models.length === 0 ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div className="model-catalog-row model-catalog-row-loading" key={index}>
                    <span />
                    <div>
                      <i />
                      <i />
                    </div>
                  </div>
                ))
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

              {models.map((model) => (
                <a className="model-catalog-row" href={model.url || "#"} target="_blank" rel="noreferrer" key={model.id}>
                  <span className="model-catalog-icon" aria-hidden="true">
                    {model.iconUrl ? <img src={model.iconUrl} alt="" /> : model.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="model-catalog-main">
                    <strong>{model.name}</strong>
                    <small>{model.description ?? model.id}</small>
                  </span>
                  <span className="model-catalog-tags">
                    {model.category ? <i>{model.category}</i> : null}
                    {model.status ? <i>{model.status}</i> : null}
                    {model.pipelineTag ? <i>{model.pipelineTag}</i> : null}
                    {model.tags.slice(0, 1).map((tag) => (
                      <i key={tag}>{tag}</i>
                    ))}
                  </span>
                  <span className="model-catalog-stat">{formatNumber(model.downloads)} downloads</span>
                  <span className="model-catalog-date">{formatDate(model.lastModified)}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
