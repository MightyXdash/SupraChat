# SupraChat Playground Model Catalog

SupraChat reads Playground model metadata from a hosted JSON catalog endpoint.

## App contract

- The Playground expects a public, read-only JSON endpoint.
- The endpoint must return categories, featured models, and models.
- The app can use `VITE_SUPRACHAT_MODEL_CATALOG_URL` to override the default endpoint when needed.

## Public catalog shape

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

## Notes

- The repository intentionally documents only the client-side catalog contract.
- Hosted catalog infrastructure, admin flows, and deployment details are kept outside the open-source repository.
