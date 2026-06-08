const { contextBridge } = require("electron")

contextBridge.exposeInMainWorld("suprachat", {
  platform: process.platform,
})
