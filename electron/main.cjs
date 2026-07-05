const { app, BrowserWindow, Menu, ipcMain, dialog, nativeImage, nativeTheme, shell } = require("electron")
const { randomBytes } = require("node:crypto")
const fs = require("node:fs")
const net = require("node:net")
const path = require("node:path")
const { startServer, stopServer, warmupModels } = require("../backend/node/server.cjs")
const { pickDocumentAttachments, pickImageAttachments } = require("./attachment-service.cjs")
const { createUpdateService } = require("./updater/index.cjs")

let backendPort = null
let backendClientToken = null
let isAppQuitting = false
let mainWindow = null
let splashWindow = null
let latestSplashProgress = {
  detail: "Preparing SupraChat",
  label: "Starting",
  progress: 0.06,
}
const updateService = createUpdateService()
const STARTUP_PREFERENCES_FILENAME = "startup-preferences.json"
const VALID_THEME_PREFERENCES = new Set(["system", "light", "dark"])

function createApplicationMenu() {
  const isMac = process.platform === "darwin"
  const template = [
    ...(isMac
      ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
      : []),
    {
      label: "File",
      submenu: [
        {
          accelerator: "CmdOrCtrl+N",
          label: "New Conversation",
          click: () => getFocusedWindow()?.webContents.send("app:new-conversation"),
        },
        {
          accelerator: "CmdOrCtrl+,",
          label: "Settings",
          click: () => getFocusedWindow()?.webContents.send("app:open-settings"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
            { type: "separator" },
            { role: "front" },
          ]
          : [
            { role: "close" },
          ]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          click: () => getFocusedWindow()?.webContents.send("app:check-updates"),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

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

function isSafeExternalUrl(candidateUrl) {
  try {
    const url = new URL(candidateUrl)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function getStartupPreferencesPath() {
  return path.join(app.getPath("userData"), STARTUP_PREFERENCES_FILENAME)
}

function readStartupThemePreference() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getStartupPreferencesPath(), "utf8"))
    return VALID_THEME_PREFERENCES.has(parsed.themePreference) ? parsed.themePreference : "system"
  } catch {
    return "system"
  }
}

function writeStartupThemePreference(themePreference) {
  if (!VALID_THEME_PREFERENCES.has(themePreference)) {
    return
  }

  try {
    fs.mkdirSync(path.dirname(getStartupPreferencesPath()), { recursive: true })
    fs.writeFileSync(getStartupPreferencesPath(), JSON.stringify({ themePreference }), "utf8")
  } catch (error) {
    console.error("Unable to persist SupraChat startup theme preference.", error)
  }
}

function resolveStartupTheme() {
  const preference = readStartupThemePreference()

  if (preference === "light" || preference === "dark") {
    return preference
  }

  return nativeTheme.shouldUseDarkColors ? "dark" : "light"
}

function resolveAppIconPath() {
  const packagedCandidates = process.platform === "win32"
    ? [
      path.join(process.resourcesPath, "icon.ico"),
      path.join(process.resourcesPath, "icon.png"),
      path.join(process.resourcesPath, "build", "icon.ico"),
      path.join(process.resourcesPath, "build", "icon.png"),
    ]
    : [
      path.join(process.resourcesPath, "icon.png"),
      path.join(process.resourcesPath, "build", "icon.png"),
    ]

  const developmentCandidates = process.platform === "win32"
    ? [
      path.join(__dirname, "..", "build", "icon.ico"),
      path.join(__dirname, "..", "build", "icon.png"),
    ]
    : [
      path.join(__dirname, "..", "build", "icon.png"),
    ]

  const candidates = app.isPackaged ? packagedCandidates : developmentCandidates

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function readAppIconDataUrl() {
  const iconPath = resolveAppIconPath()

  if (!iconPath) {
    return ""
  }

  try {
    const icon = nativeImage.createFromPath(iconPath)

    if (icon.isEmpty()) {
      return ""
    }

    return icon.toDataURL()
  } catch {
    return ""
  }
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

function setSplashProgress({ detail, label, progress }) {
  latestSplashProgress = {
    detail: detail ?? latestSplashProgress.detail,
    label: label ?? latestSplashProgress.label,
    progress: Math.max(latestSplashProgress.progress, Math.max(0, Math.min(1, progress ?? latestSplashProgress.progress))),
  }

  if (!splashWindow || splashWindow.isDestroyed()) {
    return
  }

  const payload = JSON.stringify(latestSplashProgress)
  splashWindow.webContents.executeJavaScript(`
    (() => {
      const state = ${payload};
      const label = document.querySelector("[data-startup-label]");
      const detail = document.querySelector("[data-startup-detail]");
      const fill = document.querySelector("[data-startup-fill]");
      const value = Math.round(state.progress * 100);

      if (label) label.textContent = state.label;
      if (detail) detail.textContent = state.detail;
      if (fill) {
        fill.style.transform = "scaleX(" + state.progress + ")";
        fill.parentElement?.setAttribute("aria-valuenow", String(value));
      }
    })();
  `).catch(() => {})
}

function waitForBackendHealth() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timeoutMs = 20_000

    function check() {
      const request = net.connect({ host: "127.0.0.1", port: backendPort }, () => {
        request.end()
        resolve()
      })

      request.on("error", (error) => {
        request.destroy()

        if (Date.now() - startedAt > timeoutMs) {
          reject(error)
          return
        }

        setTimeout(check, 120)
      })
    }

    check()
  })
}

async function warmupStartupModels() {
  setSplashProgress({
    detail: "Starting local model workers",
    label: "Loading models",
    progress: 0.42,
  })

  try {
    await warmupModels((event) => {
      setSplashProgress({
        detail: "Loading bundled llama.cpp models into memory",
        label: event.label,
        progress: event.progress,
      })
    })
  } catch (error) {
    console.error("Unable to warm SupraChat models during startup.", error)
    setSplashProgress({
      detail: "The local runtime will try again when a model is used",
      label: "Model warmup unavailable",
      progress: 0.82,
    })
  }
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow
  }

  const startupTheme = resolveStartupTheme()
  const appIconDataUrl = readAppIconDataUrl()
  const isDarkSplash = startupTheme === "dark"
  const splashColors = isDarkSplash
    ? {
      backgroundColor: "#212121",
      backgroundStart: "rgba(36, 36, 36, 0.98)",
      backgroundEnd: "rgba(31, 31, 31, 0.98)",
      border: "rgba(236, 236, 236, 0.1)",
      detail: "#858585",
      iconSurface: "rgba(236, 236, 236, 0.06)",
      muted: "#9b9b9b",
      progressEnd: "#d7d7d7",
      progressStart: "#7f7f7f",
      text: "#ececec",
      track: "rgba(236, 236, 236, 0.1)",
    }
    : {
      backgroundColor: "#ffffff",
      backgroundStart: "rgba(255, 255, 255, 0.98)",
      backgroundEnd: "rgba(246, 246, 246, 0.98)",
      border: "rgba(0, 0, 0, 0.1)",
      detail: "#8a8a8a",
      iconSurface: "rgba(0, 0, 0, 0.035)",
      muted: "#5f5f5f",
      progressEnd: "#3f3f3f",
      progressStart: "#9a9a9a",
      text: "#1f1f1f",
      track: "rgba(0, 0, 0, 0.1)",
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
    backgroundColor: splashColors.backgroundColor,
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';" />
    <style>
      :root {
        color-scheme: ${startupTheme};
        font-family: "Segoe UI", Arial, sans-serif;
      }

      body {
        align-items: center;
        background:
          linear-gradient(180deg, ${splashColors.backgroundStart}, ${splashColors.backgroundEnd});
        color: ${splashColors.text};
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

      .app-icon {
        --app-icon-radius: 10px;
        align-items: center;
        background: ${splashColors.iconSurface};
        border: 1px solid ${splashColors.border};
        border-radius: 12px;
        box-shadow:
          0 10px 26px rgba(0, 0, 0, ${isDarkSplash ? "0.24" : "0.08"}),
          inset 0 1px 0 rgba(255, 255, 255, ${isDarkSplash ? "0.06" : "0.45"});
        display: inline-flex;
        height: 2.2rem;
        justify-content: center;
        overflow: hidden;
        padding: 0.18rem;
        width: 2.2rem;
      }

      .app-icon img {
        border-radius: var(--app-icon-radius);
        display: block;
        height: 100%;
        object-fit: contain;
        width: 100%;
      }

      h1 {
        font-size: 0.98rem;
        font-weight: 650;
        letter-spacing: 0;
        line-height: 1;
        margin: 0;
      }

      p {
        color: ${splashColors.muted};
        font-size: 0.76rem;
        line-height: 1.4;
        margin: 0;
      }

      .detail {
        color: ${splashColors.detail};
        font-size: 0.68rem;
        min-height: 0.95rem;
      }

      .bar {
        background: ${splashColors.track};
        border-radius: 999px;
        height: 0.22rem;
        margin-top: 0.18rem;
        overflow: hidden;
        width: 8.5rem;
      }

      .bar span {
        background: linear-gradient(90deg, ${splashColors.progressStart}, ${splashColors.progressEnd});
        border-radius: inherit;
        display: block;
        height: 100%;
        transform: scaleX(0.06);
        transform-origin: left center;
        transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
        width: 100%;
      }
    </style>
  </head>
  <body>
    <main class="shell" aria-label="SupraChat is starting">
      <div class="app-icon" aria-hidden="true">
        ${appIconDataUrl ? `<img src="${appIconDataUrl}" alt="" />` : ""}
      </div>
      <h1>SupraChat</h1>
      <p data-startup-label>Starting local runtime</p>
      <p class="detail" data-startup-detail>Preparing SupraChat</p>
      <div class="bar" role="progressbar" aria-label="Startup progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="6">
        <span data-startup-fill></span>
      </div>
    </main>
  </body>
</html>`)

  splashWindow.loadURL(`data:text/html;charset=utf-8,${splashHtml}`).catch((error) => {
    console.error("Unable to load SupraChat startup screen.", error)
  })

  splashWindow.on("ready-to-show", () => {
    if (!splashWindow?.isDestroyed()) {
      splashWindow.show()
      setSplashProgress(latestSplashProgress)
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

function createWindow(startupPromise = Promise.resolve()) {
  const isMac = process.platform === "darwin"
  let allowWindowClose = false
  let didShowWindow = false
  let didRendererReady = false
  let didStartupWorkFinish = false
  let didWindowReady = false
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
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        `--suprachat-backend-port=${backendPort ?? 3001}`,
        `--suprachat-client-token=${backendClientToken ?? ""}`,
      ],
      preload: path.join(__dirname, "preload.cjs"),
    },
  })

  const rendererUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, "..", "dist", "index.html")}`

  function showWindowWhenReady() {
    if (didShowWindow || window.isDestroyed() || !didRendererReady || !didStartupWorkFinish || !didWindowReady) {
      return
    }

    didShowWindow = true
    setSplashProgress({
      detail: "Opening SupraChat",
      label: "Ready",
      progress: 1,
    })
    window.show()
    closeSplashWindow()
    updateService.handleWindowShown(window)
  }

  startupPromise.finally(() => {
    didStartupWorkFinish = true
    showWindowWhenReady()
  })

  window.loadURL(rendererUrl).catch((error) => {
    console.error("Unable to load SupraChat renderer.", error)
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: "deny" }
  })

  window.webContents.on("will-navigate", (event, url) => {
    if (isSafeExternalUrl(url)) {
      event.preventDefault()
      void shell.openExternal(url)
      return
    }

    event.preventDefault()
  })

  window.on("ready-to-show", () => {
    didWindowReady = true
    showWindowWhenReady()
  })

  function handleRendererReady(event) {
    if (event.sender === window.webContents) {
      didRendererReady = true
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

ipcMain.handle("attachments:pick-documents", async () => {
  const window = getFocusedWindow() ?? mainWindow
  return pickDocumentAttachments(dialog, window)
})

ipcMain.handle("attachments:pick-images", async () => {
  const window = getFocusedWindow() ?? mainWindow
  return pickImageAttachments(dialog, window)
})

ipcMain.on("startup:progress", (event, payload) => {
  if (mainWindow && event.sender !== mainWindow.webContents) {
    return
  }

  setSplashProgress(payload ?? {})
})

ipcMain.on("startup:theme-preference", (event, themePreference) => {
  if (mainWindow && event.sender !== mainWindow.webContents) {
    return
  }

  writeStartupThemePreference(themePreference)
})

function stopBackend() {
  stopServer()
  backendClientToken = null
  backendPort = null
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(createApplicationMenu())
  createSplashWindow()
  setSplashProgress({
    detail: "Starting local services",
    label: "Starting runtime",
    progress: 0.12,
  })

  try {
    await startBackend()
    setSplashProgress({
      detail: "Waiting for backend health",
      label: "Starting runtime",
      progress: 0.24,
    })
    await waitForBackendHealth()
    setSplashProgress({
      detail: "Local backend is ready",
      label: "Runtime ready",
      progress: 0.34,
    })
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
  const startupPromise = warmupStartupModels()
  createWindow(startupPromise)

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.show()
        mainWindow.focus()
        updateService.handleWindowShown(mainWindow)
      }
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
