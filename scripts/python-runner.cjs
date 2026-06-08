const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")

const candidates = process.platform === "win32"
  ? [path.join(process.cwd(), ".venv", "Scripts", "python.exe")]
  : [path.join(process.cwd(), ".venv", "bin", "python3"), path.join(process.cwd(), ".venv", "bin", "python")]

const python = candidates.find((candidate) => fs.existsSync(candidate))

if (!python) {
  console.error("No project-local Python interpreter found in .venv.")
  process.exit(1)
}

const child = spawn(python, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
