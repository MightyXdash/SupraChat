const { contextBridge, ipcRenderer } = require("electron")

function getBackendPort() {
  const backendArgument = process.argv.find((argument) =>
    argument.startsWith("--suprachat-backend-port="),
  )

  const backendPort = backendArgument?.split("=")[1]
  const parsedPort = Number(backendPort)

  return Number.isFinite(parsedPort) ? parsedPort : 3001
}

function getClientToken() {
  const tokenArgument = process.argv.find((argument) =>
    argument.startsWith("--suprachat-client-token="),
  )

  return tokenArgument?.split("=")[1] ?? ""
}

contextBridge.exposeInMainWorld("suprachat", {
  backendPort: getBackendPort(),
  clientToken: getClientToken(),
  platform: process.platform,
  updater: {
    checkNow: () => ipcRenderer.invoke("updates:check-now"),
    dismissReadyState: () => ipcRenderer.invoke("updates:dismiss-ready-state"),
    getPreferences: () => ipcRenderer.invoke("updates:get-preferences"),
    getStatus: () => ipcRenderer.invoke("updates:get-status"),
    installNow: () => ipcRenderer.invoke("updates:install-now"),
    onStatus: (listener) => {
      const handleStatus = (_event, payload) => listener(payload)

      ipcRenderer.on("updates:status", handleStatus)

      return () => {
        ipcRenderer.removeListener("updates:status", handleStatus)
      }
    },
    setConfirmExperimentalInstall: (confirmExperimentalInstall) =>
      ipcRenderer.invoke("updates:set-confirm-experimental-install", confirmExperimentalInstall),
    setTrack: (track) => ipcRenderer.invoke("updates:set-track", track),
  },
  windowControls: {
    close: () => ipcRenderer.invoke("window:close"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  },
})
