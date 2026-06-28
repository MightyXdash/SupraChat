const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { pipeline } = require("node:stream/promises")

const RELEASE_TAG = process.env.SUPRACHAT_LLAMA_RELEASE_TAG || "b9827"
const REPO = "ggml-org/llama.cpp"

const targets = [
  {
    asset: `llama-${RELEASE_TAG}-bin-macos-arm64.tar.gz`,
    executable: "llama-server",
    platformKey: "darwin-arm64",
  },
  {
    asset: `llama-${RELEASE_TAG}-bin-macos-x64.tar.gz`,
    executable: "llama-server",
    platformKey: "darwin-x64",
  },
  {
    asset: `llama-${RELEASE_TAG}-bin-ubuntu-x64.tar.gz`,
    executable: "llama-server",
    platformKey: "linux-x64",
  },
  {
    asset: `llama-${RELEASE_TAG}-bin-ubuntu-arm64.tar.gz`,
    executable: "llama-server",
    platformKey: "linux-arm64",
  },
  {
    asset: `llama-${RELEASE_TAG}-bin-win-cpu-x64.zip`,
    executable: "llama-server.exe",
    platformKey: "win32-x64",
  },
  {
    asset: `llama-${RELEASE_TAG}-bin-win-cpu-arm64.zip`,
    executable: "llama-server.exe",
    platformKey: "win32-arm64",
  },
]

function assetUrl(asset) {
  return `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${asset}`
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`)
  }
}

function walkFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    const stat = fs.lstatSync(entryPath)

    if (stat.isDirectory()) {
      files.push(...walkFiles(entryPath))
      continue
    }

    if (stat.isFile() || stat.isSymbolicLink()) {
      files.push(entryPath)
    }
  }

  return files
}

function installExtractedFiles(extractDir, targetDir, executable) {
  fs.mkdirSync(targetDir, { recursive: true })

  const files = walkFiles(extractDir)
  const executablePath = files.find((file) => path.basename(file) === executable)

  if (!executablePath) {
    throw new Error(`Unable to find ${executable} in extracted runtime archive.`)
  }

  for (const file of files) {
    const basename = path.basename(file)
    const isRuntimeFile =
      basename === executable ||
      /\.(dll|dylib|so|json|txt)$/.test(basename) ||
      /^lib/.test(basename) ||
      /^ggml/.test(basename)

    if (!isRuntimeFile) {
      continue
    }

    const destination = path.join(targetDir, basename)
    fs.copyFileSync(file, destination)

    if (basename === executable && process.platform !== "win32") {
      fs.chmodSync(destination, 0o755)
    }
  }
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "SupraChat-runtime-fetch",
    },
  })

  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${url}: ${response.status} ${response.statusText}`)
  }

  await pipeline(response.body, fs.createWriteStream(destination))
}

async function installTarget(target) {
  const url = assetUrl(target.asset)
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `suprachat-${target.platformKey}-`))
  const archivePath = path.join(workDir, target.asset)
  const extractDir = path.join(workDir, "extract")
  const targetDir = path.resolve("resources", "llama.cpp", target.platformKey)

  fs.mkdirSync(extractDir, { recursive: true })
  console.log(`Downloading ${target.asset}`)
  await downloadFile(url, archivePath)

  if (target.asset.endsWith(".zip")) {
    run("unzip", ["-q", archivePath, "-d", extractDir])
  } else {
    run("tar", ["-xzf", archivePath, "-C", extractDir])
  }

  installExtractedFiles(extractDir, targetDir, target.executable)
  console.log(`Installed ${target.platformKey} runtime to ${targetDir}`)
}

async function main() {
  for (const target of targets) {
    await installTarget(target)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
