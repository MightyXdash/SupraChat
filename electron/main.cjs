const { app, BrowserWindow, Menu, ipcMain } = require("electron")
const net = require("node:net")
const path = require("node:path")
const { startServer, stopServer } = require("../backend/node/server.cjs")

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
  if (backendPort) {
    return backendPort
  }

  backendPort = await findAvailablePort(3001)
  const resourceDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "resources")
    : path.join(__dirname, "..", "resources")

  Object.assign(process.env, {
    SUPRACHAT_DATA_DIR: app.getPath("userData"),
    SUPRACHAT_NODE_PORT: String(backendPort),
    SUPRACHAT_RESOURCE_DIR: resourceDirectory,
  })

  startServer({ dataDir: app.getPath("userData"), port: backendPort })

  return backendPort
}

function createWindow() {
  const isMac = process.platform === "darwin"
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 740,
    title: "SupraChat",
    backgroundColor: "#F7F3EE",
    autoHideMenuBar: true,
    frame: isMac,
    fullSizeContentView: isMac,
    titleBarStyle: "hidden",
    trafficLightPosition: isMac ? { x: 13, y: 10 } : undefined,
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

function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow()
}

ipcMain.handle("window:minimize", () => {
  getFocusedWindow()?.minimize()
})

ipcMain.handle("window:toggle-maximize", () => {
  const window = getFocusedWindow()

  if (!window) {
    return
  }

  if (window.isMaximized()) {
    window.unmaximize()
    return
  }

  window.maximize()
})

ipcMain.handle("window:close", () => {
  getFocusedWindow()?.close()
})

function stopBackend() {
  stopServer()
  backendPort = null
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
