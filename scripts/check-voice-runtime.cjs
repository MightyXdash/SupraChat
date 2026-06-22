const { checkVoiceRuntime } = require("../backend/node/suva/voice-runtime.cjs")

const result = checkVoiceRuntime()

console.log("SuVA voice runtime check")
console.log(`Resource root: ${result.resourceRoot}`)

for (const check of result.checks) {
  console.log(`${check.ok ? "OK" : "MISSING"} ${check.label}`)
  if (!check.ok) {
    console.log(`  ${check.detail}`)
  }
}

if (!result.ok) {
  process.exitCode = 1
}
