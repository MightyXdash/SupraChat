const { app, BrowserWindow, Menu } = require("electron")
const { spawn } = require("node:child_process")
const net = require("node:net")
const path = require("node:path")

let backendProcess = null
let backendPort = null

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer()

      server.unref()
      server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          tryPort(port + 1)
          return
        }

        reject(error)
      })

      server.listen(port, "127.0.0.1", () => {
        const { port: availablePort } = server.address()
        server.close(() => resolve(availablePort))
      })
    }

    tryPort(startPort)
  })
}

async function startBackend() {
  if (backendProcess && backendPort) {
    return backendPort
  }

  backendPort = await findAvailablePort(3001)
  backendProcess = spawn(process.env.SUPRACHAT_NODE_RUNTIME ?? "node", [
    path.join(__dirname, "..", "backend", "node", "server.cjs"),
  ], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      SUPRACHAT_DATA_DIR: app.getPath("userData"),
      SUPRACHAT_NODE_PORT: String(backendPort),
    },
    stdio: "inherit",
    windowsHide: true,
  })

  backendProcess.on("exit", () => {
    backendProcess = null
    backendPort = null
  })

  return backendPort
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 740,
    title: "SupraChat",
    backgroundColor: "#F7F3EE",
    autoHideMenuBar: true,
    webPreferences: {
      additionalArguments: [`--suprachat-backend-port=${backendPort ?? 3001}`],
      preload: path.join(__dirname, "preload.cjs"),
    },
  })

  const rendererUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, "..", "dist", "index.html")}`

  window.loadURL(rendererUrl).catch((error) => {
    console.error("Unable to load SupraChat renderer.", error)
  })

  window.on("ready-to-show", () => {
    window.show()
  })
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  try {
    await startBackend()
  } catch (error) {
    console.error("Unable to start SupraChat backend.", error)
  }
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("before-quit", () => {
  stopBackend()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopBackend()
    app.quit()
  }
})
