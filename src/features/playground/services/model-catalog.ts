import { modelCatalogEndpoint } from "@/features/playground/config/models"

export type PlaygroundModel = {
  id: string
  name: string
  category: string | null
  description: string | null
  family: string | null
  iconUrl: string | null
  pipelineTag: string | null
  status: string | null
  tags: string[]
  thumbnailUrl: string | null
  downloads: number
  likes: number
  lastModified: string | null
  url: string
}

export type FeaturedPlaygroundModel = PlaygroundModel & {
  sortOrder?: number
}

export type PlaygroundCategory = {
  id: string
  label: string
  description?: string
}

export type PlaygroundCatalog = {
  categories: PlaygroundCategory[]
  featuredModels: FeaturedPlaygroundModel[]
  models: PlaygroundModel[]
  source: "cloudflare"
}

type CatalogModelResponse = Partial<PlaygroundModel> & {
  id?: string
  sortOrder?: number
}

type CatalogResponse = {
  categories?: PlaygroundCategory[]
  featured?: CatalogModelResponse[]
  models?: CatalogModelResponse[]
}

function getModelName(modelId: string) {
  return modelId.split("/").at(-1) ?? modelId
}

function normalizeModel(model: CatalogModelResponse): PlaygroundModel | null {
  if (!model.id) {
    return null
  }

  return {
    id: model.id,
    name: model.name ?? getModelName(model.id),
    category: model.category ?? null,
    description: model.description ?? null,
    family: model.family ?? null,
    iconUrl: model.iconUrl ?? null,
    pipelineTag: model.pipelineTag ?? null,
    status: model.status ?? null,
    tags: Array.isArray(model.tags) ? model.tags : [],
    thumbnailUrl: model.thumbnailUrl ?? null,
    downloads: model.downloads ?? 0,
    likes: model.likes ?? 0,
    lastModified: model.lastModified ?? null,
    url: model.url ?? "",
  }
}

function normalizeFeaturedModel(model: CatalogModelResponse): FeaturedPlaygroundModel | null {
  const normalizedModel = normalizeModel(model)

  if (!normalizedModel) {
    return null
  }

  return {
    ...normalizedModel,
    sortOrder: model.sortOrder ?? 0,
  }
}

export async function fetchPlaygroundCatalog(signal?: AbortSignal): Promise<PlaygroundCatalog> {
  const response = await fetch(modelCatalogEndpoint, {
    headers: { Accept: "application/json" },
    signal,
  })

  if (!response.ok) {
    throw new Error("Unable to load the SupraLabs model catalog.")
  }

  const catalog = (await response.json()) as CatalogResponse

  return {
    categories: catalog.categories ?? [],
    featuredModels: (catalog.featured ?? [])
      .map(normalizeFeaturedModel)
      .filter((model): model is FeaturedPlaygroundModel => Boolean(model)),
    models: (catalog.models ?? [])
      .map(normalizeModel)
      .filter((model): model is PlaygroundModel => Boolean(model)),
    source: "cloudflare",
  }
}
