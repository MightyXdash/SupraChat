const { contextBridge, ipcRenderer } = require("electron")

function getBackendPort() {
  const backendArgument = process.argv.find((argument) =>
    argument.startsWith("--suprachat-backend-port="),
  )

  const backendPort = backendArgument?.split("=")[1]
  const parsedPort = Number(backendPort)

  return Number.isFinite(parsedPort) ? parsedPort : 3001
}

contextBridge.exposeInMainWorld("suprachat", {
  backendPort: getBackendPort(),
  platform: process.platform,
  windowControls: {
    close: () => ipcRenderer.invoke("window:close"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  },
})
