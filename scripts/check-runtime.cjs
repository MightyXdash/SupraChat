const fs = require("node:fs")
const {
  checkCurrentRuntime,
  getExpectedRuntimeFiles,
} = require("../backend/node/runtime-preflight.cjs")

const targets = [
  ["darwin", "arm64"],
  ["darwin", "x64"],
  ["win32", "x64"],
  ["win32", "arm64"],
  ["linux", "x64"],
  ["linux", "arm64"],
]

function printCurrent() {
  const result = checkCurrentRuntime()
  console.log(`SupraChat runtime check: ${result.platformKey}`)
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
}

function printAll() {
  let ok = true

  for (const [platform, arch] of targets) {
    console.log(`\n${platform}-${arch}`)
    for (const expectedPath of getExpectedRuntimeFiles(platform, arch)) {
      const exists = fs.existsSync(expectedPath)
      ok = ok && exists
      console.log(`${exists ? "OK" : "MISSING"} ${expectedPath}`)
    }
  }

  if (!ok) {
    process.exitCode = 1
  }
}

if (process.argv.includes("--all")) {
  printAll()
} else {
  printCurrent()
}
