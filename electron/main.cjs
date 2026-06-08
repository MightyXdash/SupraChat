const { app, BrowserWindow, Menu } = require("electron")
const { spawn } = require("node:child_process")
const path = require("node:path")

let backendProcess = null

function startBackend() {
  if (backendProcess) {
    return
  }

  backendProcess = spawn("node", [path.join(__dirname, "..", "backend", "node", "server.cjs")], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    windowsHide: true,
  })

  backendProcess.on("exit", () => {
    backendProcess = null
  })
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
      preload: path.join(__dirname, "preload.cjs"),
    },
  })

  const rendererUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, "..", "dist", "index.html")}`

  window.loadURL(rendererUrl)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  startBackend()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }

  if (process.platform !== "darwin") {
    app.quit()
  }
})
