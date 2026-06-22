const defaultModelCatalogEndpoint =
  "https://suprachat-model-catalog.artigalamithula.workers.dev/api/catalog"

export const modelCatalogEndpoint =
  import.meta.env.VITE_SUPRACHAT_MODEL_CATALOG_URL?.trim() || defaultModelCatalogEndpoint
