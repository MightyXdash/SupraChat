const path = require("node:path")
const fs = require("node:fs")
const { resolveResourceRoot } = require("../model-registry.cjs")

const SHERPA_ONNX_STT_MODEL = "sherpa-onnx-streaming-zipformer-en-2023-06-26"
const PIPER_VOICE = "en_US-lessac-medium"

const VOICE_RUNTIME = {
  vad: {
    provider: "silero",
    engine: "onnx",
    modelPath:
      process.env.SUPRACHAT_SUVA_VAD_MODEL_PATH ??
      path.join(resolveResourceRoot(), "voice", "vad", "silero_vad.onnx"),
    sampleRate: 16_000,
  },
  stt: {
    provider: "sherpa-onnx",
    engine: "onnx",
    modelDirectory:
      process.env.SUPRACHAT_SUVA_STT_MODEL_DIR ??
      path.join(resolveResourceRoot(), "voice", "stt", SHERPA_ONNX_STT_MODEL),
    encoder: "encoder-epoch-99-avg-1-chunk-16-left-128.onnx",
    decoder: "decoder-epoch-99-avg-1-chunk-16-left-128.onnx",
    joiner: "joiner-epoch-99-avg-1-chunk-16-left-128.onnx",
    sampleRate: 16_000,
  },
  tts: {
    provider: "piper-onnx",
    engine: "onnx",
    modelPath:
      process.env.SUPRACHAT_SUVA_TTS_MODEL_PATH ??
      path.join(resolveResourceRoot(), "voice", "tts", `${PIPER_VOICE}.onnx`),
    voiceConfigPath:
      process.env.SUPRACHAT_SUVA_TTS_CONFIG_PATH ??
      path.join(resolveResourceRoot(), "voice", "tts", `${PIPER_VOICE}.onnx.json`),
  },
}

const SHERPA_REQUIRED_FILES = [
  VOICE_RUNTIME.stt.encoder,
  VOICE_RUNTIME.stt.decoder,
  VOICE_RUNTIME.stt.joiner,
  "tokens.txt",
  "bpe.model",
]

let sherpaOnnx = null

function getSherpaOnnx() {
  if (!sherpaOnnx) {
    sherpaOnnx = require("sherpa-onnx")
  }

  return sherpaOnnx
}

function fileCheck(label, filePath) {
  const ok = fs.existsSync(filePath)
  return {
    ok,
    label,
    path: filePath,
    detail: ok ? "" : `${label} is missing at ${filePath}.`,
  }
}

function checkVoiceRuntime() {
  const resourceRoot = resolveResourceRoot()
  const checks = [
    fileCheck("Silero VAD ONNX model", VOICE_RUNTIME.vad.modelPath),
    ...SHERPA_REQUIRED_FILES.map((filename) =>
      fileCheck(
        `sherpa-onnx STT ${filename}`,
        path.join(VOICE_RUNTIME.stt.modelDirectory, filename),
      ),
    ),
    fileCheck("Piper TTS ONNX model", VOICE_RUNTIME.tts.modelPath),
    fileCheck("Piper TTS voice config", VOICE_RUNTIME.tts.voiceConfigPath),
  ]

  return {
    ok: checks.every((check) => check.ok),
    resourceRoot,
    checks,
    providers: VOICE_RUNTIME,
  }
}

function createUnavailableVoiceProvider(kind, runtimeConfig) {
  return {
    kind,
    runtimeConfig,
    async run() {
      const error = new Error(
        `${runtimeConfig.provider} ${runtimeConfig.engine} runtime is not configured.`,
      )
      error.code = "SUPRACHAT_SUVA_VOICE_RUNTIME_NOT_CONFIGURED"
      throw error
    },
  }
}

function normalizeTranscriptText(text) {
  const trimmedText = String(text ?? "").trim().replace(/\s+/g, " ")

  if (!trimmedText) {
    return ""
  }

  const letterCharacters = trimmedText.match(/[A-Za-z]/g) ?? []
  const uppercaseCharacters = trimmedText.match(/[A-Z]/g) ?? []
  const isMostlyUppercase =
    letterCharacters.length > 4 &&
    uppercaseCharacters.length / letterCharacters.length > 0.82

  if (!isMostlyUppercase) {
    return trimmedText
  }

  const normalized = trimmedText
    .toLowerCase()
    .replace(/\bi\b/g, "I")
    .replace(/\bai\b/g, "AI")
    .replace(/\bapi\b/g, "API")
    .replace(/\bcpu\b/g, "CPU")
    .replace(/\bgpu\b/g, "GPU")
    .replace(/\bjson\b/g, "JSON")
    .replace(/\bllm\b/g, "LLM")
    .replace(/\bonnx\b/g, "ONNX")
    .replace(/\bstt\b/g, "STT")
    .replace(/\btts\b/g, "TTS")
    .replace(/\bui\b/g, "UI")
    .replace(/\burl\b/g, "URL")
    .replace(/\bvad\b/g, "VAD")
    .replace(/\bsuva\b/g, "SuVA")

  return normalized.replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix, letter) =>
    `${prefix}${letter.toUpperCase()}`,
  )
}

function createSherpaSttProvider(runtimeConfig) {
  let recognizer = null

  function assertReady() {
    const result = checkVoiceRuntime()

    if (result.ok) {
      return
    }

    const missing = result.checks
      .filter((check) => !check.ok)
      .map((check) => check.label)
      .join(", ")

    const error = new Error(`SuVA voice runtime files are missing: ${missing}.`)
    error.code = "SUPRACHAT_SUVA_VOICE_RUNTIME_NOT_READY"
    throw error
  }

  function getRecognizer() {
    assertReady()

    if (recognizer) {
      return recognizer
    }

    const sherpa = getSherpaOnnx()
    const modelDirectory = runtimeConfig.modelDirectory

    recognizer = sherpa.createOnlineRecognizer({
      featConfig: {
        sampleRate: runtimeConfig.sampleRate,
        featureDim: 80,
      },
      modelConfig: {
        transducer: {
          encoder: path.join(modelDirectory, runtimeConfig.encoder),
          decoder: path.join(modelDirectory, runtimeConfig.decoder),
          joiner: path.join(modelDirectory, runtimeConfig.joiner),
        },
        paraformer: {
          encoder: "",
          decoder: "",
        },
        zipformer2Ctc: {
          model: "",
        },
        nemoCtc: {
          model: "",
        },
        toneCtc: {
          model: "",
        },
        tokens: path.join(modelDirectory, "tokens.txt"),
        numThreads: 2,
        provider: "cpu",
        debug: 0,
        modelType: "",
        modelingUnit: "bpe",
        bpeVocab: path.join(modelDirectory, "bpe.model"),
      },
      decodingMethod: "greedy_search",
      maxActivePaths: 4,
      enableEndpoint: 0,
      rule1MinTrailingSilence: 2.4,
      rule2MinTrailingSilence: 1.2,
      rule3MinUtteranceLength: 20,
      hotwordsFile: "",
      hotwordsScore: 1.5,
      ctcFstDecoderConfig: {
        graph: "",
        maxActive: 3000,
      },
      ruleFsts: "",
      ruleFars: "",
    })

    return recognizer
  }

  return {
    kind: "stt",
    runtimeConfig,
    async transcribe({ samples, sampleRate }) {
      const typedSamples = Float32Array.from(samples, (sample) => {
        const value = Number(sample)
        if (!Number.isFinite(value)) {
          return 0
        }

        return Math.max(-1, Math.min(1, value))
      })

      const recognizerInstance = getRecognizer()
      const stream = recognizerInstance.createStream()

      try {
        stream.acceptWaveform(sampleRate, typedSamples)
        stream.inputFinished()

        while (recognizerInstance.isReady(stream)) {
          recognizerInstance.decode(stream)
        }

        const result = recognizerInstance.getResult(stream)
        return normalizeTranscriptText(result.text)
      } finally {
        stream.free()
      }
    },
  }
}

function createVoiceRuntime() {
  const stt = createSherpaSttProvider(VOICE_RUNTIME.stt)

  return {
    vad: createUnavailableVoiceProvider("vad", VOICE_RUNTIME.vad),
    stt,
    tts: createUnavailableVoiceProvider("tts", VOICE_RUNTIME.tts),
    async transcribe(audio) {
      return stt.transcribe(audio)
    },
    health() {
      return checkVoiceRuntime()
    },
  }
}

module.exports = {
  VOICE_RUNTIME,
  checkVoiceRuntime,
  normalizeTranscriptText,
  createVoiceRuntime,
}
