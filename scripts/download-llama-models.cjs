const fs = require("node:fs")
const path = require("node:path")
const { pipeline } = require("node:stream/promises")

const models = [
  {
    label: "LFM2.5 350M Q6 chat model",
    repo: "LiquidAI/LFM2.5-350M-GGUF",
    filename: "LFM2.5-350M-Q6_K.gguf",
    destination: path.join("resources", "models", "chat", "LFM2.5-350M-Q6_K.gguf"),
  },
  {
    label: "Supra Title 350M Q4 title model",
    repo: "SupraLabs/Supra-Title-350M-exp-GGUF",
    filename: "LiquidAI_LFM2.5-350M-Base_1781204855.Q4_K_M.gguf",
    destination: path.join(
      "resources",
      "models",
      "title",
      "LiquidAI_LFM2.5-350M-Base_1781204855.Q4_K_M.gguf",
    ),
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
