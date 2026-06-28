const fs = require("node:fs")
const {
  checkCurrentRuntime,
  getExpectedRuntimeFiles,
} = require("../backend/node/runtime-preflight.cjs")

function readOption(name) {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))

  if (inline) {
    return inline.slice(prefix.length)
  }

  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }

  return null
}

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

function printTarget() {
  let ok = true
  const platform = readOption("platform") ?? process.platform
  const arch = readOption("arch") ?? process.arch
  const resourceRoot = readOption("resource-root") ?? "resources"

  console.log(`SupraChat runtime check: ${platform}-${arch}`)
  console.log(`Resource root: ${resourceRoot}`)

  for (const expectedPath of getExpectedRuntimeFiles(platform, arch)) {
    const scopedPath = expectedPath.replace(/^resources[\\/]/, "")
    const filePath = `${resourceRoot}/${scopedPath}`
    const exists = fs.existsSync(filePath)
    ok = ok && exists
    console.log(`${exists ? "OK" : "MISSING"} ${filePath}`)
  }

  if (!ok) {
    process.exitCode = 1
  }
}

if (process.argv.includes("--target")) {
  printTarget()
} else if (process.argv.includes("--all")) {
  printAll()
} else {
  printCurrent()
}
