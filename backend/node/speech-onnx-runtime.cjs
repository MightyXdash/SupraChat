const onnx = require("onnxruntime-node")
const {
  resolveSpeechSttModel,
  resolveSpeechTtsModel,
} = require("./model-registry.cjs")

const DEFAULT_EXECUTION_PROVIDERS = ["cpu"]

function createSpeechOnnxSession(modelPath, options = {}) {
  return onnx.InferenceSession.create(modelPath, {
    executionProviders: options.executionProviders ?? DEFAULT_EXECUTION_PROVIDERS,
    graphOptimizationLevel: options.graphOptimizationLevel ?? "all",
  })
}

function createTensor(type, data, dims) {
  return new onnx.Tensor(type, data, dims)
}

function getSpeechOnnxRuntimeInfo() {
  return {
    backend: "onnxruntime-node",
    executionProviders: DEFAULT_EXECUTION_PROVIDERS,
    sttModel: resolveSpeechSttModel(),
    ttsModel: resolveSpeechTtsModel(),
  }
}

module.exports = {
  createSpeechOnnxSession,
  createTensor,
  getSpeechOnnxRuntimeInfo,
}
