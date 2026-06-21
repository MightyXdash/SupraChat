# SupraChat Local Runtime Resources

SupraChat uses a packaged `llama.cpp` runtime by default.

Expected layout:

```text
resources/
  llama.cpp/
    darwin-arm64/llama-server
    darwin-x64/llama-server
    win32-x64/llama-server.exe
    win32-arm64/llama-server.exe
    linux-x64/llama-server
    linux-arm64/llama-server
    lib/*.dylib
    lib/*.so
    lib/*.dll
  models/
    chat/LFM2.5-350M-Q6_K.gguf
    title/LiquidAI_LFM2.5-350M-Base_1781204855.Q4_K_M.gguf
```

Download the default GGUF model files:

```bash
npm run models:download
```

`llama-server` binaries still need to be supplied per platform from the
`llama.cpp` build/release that matches the target acceleration backend.
Run `npm run runtime:check` to verify the current machine and
`npm run runtime:check:all` before packaging cross-platform releases.

Chat model:

- Repository: `LiquidAI/LFM2.5-350M-GGUF`
- Default file: `LFM2.5-350M-Q6_K.gguf`

Title model:

- Repository: `SupraLabs/Supra-Title-350M-exp-GGUF`
- Default file: `LiquidAI_LFM2.5-350M-Base_1781204855.Q4_K_M.gguf`

Development overrides:

- `SUPRACHAT_RESOURCE_DIR`
- `SUPRACHAT_LLAMA_SERVER_PATH`
- `SUPRACHAT_CHAT_MODEL_PATH`
- `SUPRACHAT_TITLE_MODEL_PATH`
- `SUPRACHAT_LLAMA_GPU_LAYERS`
- `SUPRACHAT_DISABLE_GPU=1`
