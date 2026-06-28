const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron")
const { randomBytes } = require("node:crypto")
const net = require("node:net")
const path = require("node:path")
const { startServer, stopServer } = require("../backend/node/server.cjs")
const { createUpdateService } = require("./updater/index.cjs")

let backendPort = null
let backendClientToken = null
let isAppQuitting = false
let mainWindow = null
let splashWindow = null
const updateService = createUpdateService()

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
  backendClientToken = randomBytes(32).toString("hex")
  const resourceDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "resources")
    : path.join(__dirname, "..", "resources")

  Object.assign(process.env, {
    SUPRACHAT_CLIENT_TOKEN: backendClientToken,
    SUPRACHAT_DATA_DIR: app.getPath("userData"),
    SUPRACHAT_NODE_PORT: String(backendPort),
    SUPRACHAT_RESOURCE_DIR: resourceDirectory,
  })

  startServer({
    clientToken: backendClientToken,
    dataDir: app.getPath("userData"),
    port: backendPort,
  })

  return backendPort
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow
  }

  splashWindow = new BrowserWindow({
    width: 360,
    height: 220,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    transparent: false,
    backgroundColor: "#212121",
    title: "SupraChat",
    webPreferences: {
      sandbox: true,
    },
  })

  const splashHtml = encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", Arial, sans-serif;
      }

      body {
        align-items: center;
        background:
          linear-gradient(180deg, rgba(39, 39, 39, 0.98), rgba(31, 31, 31, 0.98));
        color: #ececec;
        display: flex;
        height: 100vh;
        justify-content: center;
        margin: 0;
        overflow: hidden;
        user-select: none;
      }

      .shell {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        justify-content: center;
        text-align: center;
      }

      .mark {
        background: linear-gradient(135deg, #342f28, #b7a287);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        box-shadow: 0 0 0 5px rgba(183, 162, 135, 0.08);
        height: 0.76rem;
        width: 0.76rem;
      }

      h1 {
        font-size: 0.98rem;
        font-weight: 650;
        letter-spacing: 0;
        line-height: 1;
        margin: 0;
      }

      p {
        color: #9b9b9b;
        font-size: 0.76rem;
        line-height: 1.4;
        margin: 0;
      }

      .bar {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        height: 0.18rem;
        margin-top: 0.18rem;
        overflow: hidden;
        width: 8.5rem;
      }

      .bar::before {
        animation: load 1.25s ease-in-out infinite;
        background: linear-gradient(90deg, transparent, #b7a287, transparent);
        content: "";
        display: block;
        height: 100%;
        transform: translateX(-100%);
        width: 70%;
      }

      @keyframes load {
        to {
          transform: translateX(170%);
        }
      }
    </style>
  </head>
  <body>
    <main class="shell" aria-label="SupraChat is starting">
      <div class="mark" aria-hidden="true"></div>
      <h1>SupraChat</h1>
      <p>Starting local runtime</p>
      <div class="bar" aria-hidden="true"></div>
    </main>
  </body>
</html>`)

  splashWindow.loadURL(`data:text/html;charset=utf-8,${splashHtml}`).catch((error) => {
    console.error("Unable to load SupraChat startup screen.", error)
  })

  splashWindow.on("ready-to-show", () => {
    if (!splashWindow?.isDestroyed()) {
      splashWindow.show()
    }
  })

  splashWindow.on("closed", () => {
    splashWindow = null
  })

  return splashWindow
}

function closeSplashWindow() {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return
  }

  splashWindow.destroy()
  splashWindow = null
}

function createWindow() {
  const isMac = process.platform === "darwin"
  let allowWindowClose = false
  let didShowWindow = false
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 740,
    title: "SupraChat",
    backgroundColor: "#F7F3EE",
    autoHideMenuBar: true,
    frame: false,
    show: false,
    fullSizeContentView: isMac,
    titleBarStyle: "hidden",
    trafficLightPosition: isMac ? { x: 13, y: 10 } : undefined,
    webPreferences: {
      additionalArguments: [
        `--suprachat-backend-port=${backendPort ?? 3001}`,
        `--suprachat-client-token=${backendClientToken ?? ""}`,
      ],
      preload: path.join(__dirname, "preload.cjs"),
    },
  })

  const rendererUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, "..", "dist", "index.html")}`

  function showWindowWhenReady() {
    if (didShowWindow || window.isDestroyed()) {
      return
    }

    didShowWindow = true
    window.show()
    closeSplashWindow()
    updateService.handleWindowShown(window)
  }

  window.loadURL(rendererUrl).catch((error) => {
    console.error("Unable to load SupraChat renderer.", error)
  })

  window.on("ready-to-show", () => {
    setTimeout(showWindowWhenReady, 1800)
  })

  function handleRendererReady(event) {
    if (event.sender === window.webContents) {
      showWindowWhenReady()
      ipcMain.removeListener("renderer:ready", handleRendererReady)
    }
  }

  ipcMain.on("renderer:ready", handleRendererReady)

  window.on("close", (event) => {
    if (isAppQuitting || allowWindowClose) {
      return
    }

    event.preventDefault()

    void updateService.handleWindowCloseRequest(window).then(({ shouldClose }) => {
      if (!shouldClose) {
        return
      }

      allowWindowClose = true
      window.close()
      setImmediate(() => {
        allowWindowClose = false
      })
    })
  })

  window.on("closed", () => {
    ipcMain.removeListener("renderer:ready", handleRendererReady)
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  mainWindow = window
  return window
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
  backendClientToken = null
  backendPort = null
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  createSplashWindow()

  try {
    await startBackend()
  } catch (error) {
    console.error("Unable to start SupraChat backend.", error)
    closeSplashWindow()
    dialog.showErrorBox(
      "Unable to start SupraChat",
      "The local SupraChat backend could not start. Run npm run rebuild:electron, then restart the app.",
    )
    app.quit()
    return
  }
  updateService.initialize()
  createWindow()

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      updateService.handleWindowShown(mainWindow)
      return
    }

    if (BrowserWindow.getAllWindows().filter((window) => window !== splashWindow).length === 0) {
      createWindow()
    }
  })
})

app.on("before-quit", () => {
  isAppQuitting = true
  stopBackend()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopBackend()
    app.quit()
  }
})
