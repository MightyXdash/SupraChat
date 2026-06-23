const fs = require("node:fs")
const path = require("node:path")
const { pipeline } = require("node:stream/promises")

const models = [
  {
    label: "LFM 2.5 1.2B Thinking Q5 K M chat model",
    repo: "unsloth/LFM2.5-1.2B-Thinking-GGUF",
    filename: "LFM2.5-1.2B-Thinking-Q5_K_M.gguf",
    destination: path.join("resources", "models", "chat", "LFM2.5-1.2B-Thinking-Q5_K_M.gguf"),
  },
]

function getModelUrl(model) {
  return `https://huggingface.co/${model.repo}/resolve/main/${model.filename}`
}

async function downloadModel(model) {
  const destination = path.resolve(model.destination)

  if (fs.existsSync(destination)) {
    console.log(`${model.label} already exists: ${destination}`)
    return
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const response = await fetch(getModelUrl(model))

  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${model.label}: ${response.status} ${response.statusText}`)
  }

  console.log(`Downloading ${model.label}...`)
  await pipeline(response.body, fs.createWriteStream(destination))
  console.log(`Saved ${destination}`)
}

async function main() {
  for (const model of models) {
    await downloadModel(model)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
