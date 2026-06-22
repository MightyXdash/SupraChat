# SupraChat Cloudflare Model Catalog

SupraChat uses a Cloudflare-hosted model catalog as the source of truth for the Playground.
The open-source app only reads public catalog JSON. Editing models, categories, featured order,
icons, and thumbnails happens in a private dashboard outside this repository.

## Deployed Resources

- Worker: `suprachat-model-catalog`
- Public catalog: `https://suprachat-model-catalog.artigalamithula.workers.dev/api/catalog`
- Admin dashboard: `https://suprachat-model-catalog.artigalamithula.workers.dev/admin`
- Database: Workers KV namespace `suprachat_model_catalog`
- KV key: `catalog`

The Worker serves:

```txt
GET  /api/catalog
GET  /admin
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/catalog
PUT  /api/admin/catalog
```

## App Contract

The app reads the Cloudflare catalog directly from:

```txt
https://suprachat-model-catalog.artigalamithula.workers.dev/api/catalog
```

The endpoint is public, read-only, CORS-enabled, and cacheable:

```http
GET /api/catalog
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=120, stale-while-revalidate=86400
```

`VITE_SUPRACHAT_MODEL_CATALOG_URL` can override the endpoint for staging or a future custom domain.

## Catalog Shape

```json
{
  "version": 1,
  "updatedAt": "2026-06-22T15:22:13.098Z",
  "categories": [
    {
      "id": "chat",
      "label": "Chat",
      "description": "Instruction and general conversation models",
      "sortOrder": 10,
      "isVisible": true
    }
  ],
  "featured": [
    {
      "id": "SupraLabs/Supra-1.5-50M-Instruct-exp",
      "name": "Supra 1.5 50M Instruct",
      "category": "chat",
      "family": "Instruction",
      "description": "Compact instruction model for first-party SupraLabs chat experiments.",
      "pipelineTag": "text-generation",
      "tags": ["text-generation", "safetensors", "llama"],
      "downloads": 1200,
      "likes": 43,
      "lastModified": "2026-06-13",
      "status": "Featured",
      "iconUrl": "",
      "thumbnailUrl": "",
      "url": "https://huggingface.co/SupraLabs/Supra-1.5-50M-Instruct-exp",
      "isVisible": true,
      "sortOrder": 10
    }
  ],
  "models": []
}
```

## Dashboard Use

The dashboard supports:

- Add and remove models.
- Edit model name, description, category, family, status, pipeline tag, tags, downloads, likes, last modified date, and model URL.
- Mark models visible or hidden.
- Add or remove a model from featured models.
- Set featured sort order.
- Add, remove, hide, and reorder categories.
- Add image URLs for icons and thumbnails.
- Upload small icon and thumbnail files directly in the dashboard.

Current upload implementation:

- Icons are capped at 120 KB.
- Thumbnails are capped at 450 KB.
- Uploaded images are stored as data URLs in the KV catalog because R2 is not enabled on this Cloudflare account.

Production upgrade path:

- Enable Cloudflare R2.
- Store uploaded files in an R2 bucket.
- Replace data URLs with CDN URLs such as `https://assets.supralabs.ai/models/...`.
- Keep only object keys or public CDN URLs in KV.

## Security

- The public app has no write endpoints.
- Admin routes are never called by SupraChat.
- Admin reads and writes require the Worker secret `ADMIN_TOKEN`.
- The token is stored as a Cloudflare Worker secret, not in this repo.
- Admin auth sets an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Admin API responses use `Cache-Control: no-store`.
- The Worker validates and caps catalog payload fields before saving.
- Image fields must be `https://` URLs or `data:image/...` URLs under the configured size caps.

## Account Notes

D1 and Cloudflare Images returned authentication errors with the current account credentials.
R2 returned `Please enable R2 through the Cloudflare Dashboard`.

Because Workers KV was available, the deployed dashboard uses KV as the catalog database. This is suitable for a model catalog document and can be upgraded later to D1/R2 when those account capabilities are enabled.

