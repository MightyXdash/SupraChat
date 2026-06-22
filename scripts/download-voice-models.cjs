const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { pipeline } = require("node:stream/promises")

const voiceModels = [
  {
    label: "Silero VAD ONNX model",
    url: "https://raw.githubusercontent.com/snakers4/silero-vad/master/src/silero_vad/data/silero_vad.onnx",
    destination: path.join("resources", "voice", "vad", "silero_vad.onnx"),
  },
  {
    label: "sherpa-onnx streaming Zipformer English ASR model",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2",
    archiveDestination: path.join(
      "resources",
      "voice",
      "stt",
      "sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2",
    ),
    extractDirectory: path.join("resources", "voice", "stt"),
    expectedDirectory: path.join(
      "resources",
      "voice",
      "stt",
      "sherpa-onnx-streaming-zipformer-en-2023-06-26",
    ),
  },
  {
    label: "Piper lessac medium English voice model",
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    destination: path.join("resources", "voice", "tts", "en_US-lessac-medium.onnx"),
  },
  {
    label: "Piper lessac medium English voice config",
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
    destination: path.join("resources", "voice", "tts", "en_US-lessac-medium.onnx.json"),
  },
]

async function downloadFile({ label, url, destination }) {
  const resolvedDestination = path.resolve(destination)

  if (fs.existsSync(resolvedDestination)) {
    console.log(`${label} already exists: ${resolvedDestination}`)
    return
  }

  fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true })
  const partialDestination = `${resolvedDestination}.partial`
  fs.rmSync(partialDestination, { force: true })

  console.log(`Downloading ${label}...`)
  const response = await fetch(url)

  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${label}: ${response.status} ${response.statusText}`)
  }

  await pipeline(response.body, fs.createWriteStream(partialDestination))
  fs.renameSync(partialDestination, resolvedDestination)
  console.log(`Saved ${resolvedDestination}`)
}

function extractArchive({ label, archiveDestination, extractDirectory, expectedDirectory }) {
  const resolvedArchive = path.resolve(archiveDestination)
  const resolvedExtractDirectory = path.resolve(extractDirectory)
  const resolvedExpectedDirectory = path.resolve(expectedDirectory)

  if (fs.existsSync(resolvedExpectedDirectory)) {
    console.log(`${label} already extracted: ${resolvedExpectedDirectory}`)
    return
  }

  fs.mkdirSync(resolvedExtractDirectory, { recursive: true })
  console.log(`Extracting ${label}...`)

  const result = spawnSync("tar", ["-xjf", resolvedArchive, "-C", resolvedExtractDirectory], {
    encoding: "utf8",
    stdio: "pipe",
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `Unable to extract ${label}.`,
        result.stderr.trim(),
        result.stdout.trim(),
      ].filter(Boolean).join("\n"),
    )
  }

  if (!fs.existsSync(resolvedExpectedDirectory)) {
    throw new Error(`Extracted ${label}, but expected directory is missing: ${resolvedExpectedDirectory}`)
  }

  console.log(`Extracted ${resolvedExpectedDirectory}`)
}

async function installVoiceModel(model) {
  if (model.destination) {
    await downloadFile(model)
    return
  }

  if (model.archiveDestination) {
    await downloadFile({
      label: `${model.label} archive`,
      url: model.url,
      destination: model.archiveDestination,
    })
    extractArchive(model)
    return
  }

  throw new Error(`Invalid voice model installer entry: ${model.label}`)
}

async function main() {
  for (const model of voiceModels) {
    await installVoiceModel(model)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
