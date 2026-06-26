"use strict"

const fs = require("node:fs")
const path = require("node:path")

const DEFAULT_PREFERENCES = {
  confirmExperimentalInstall: true,
  updateTrack: "final",
}

const DEFAULT_CACHE = {
  etag: null,
  lastCheckedAt: null,
  releases: [],
}

const DEFAULT_PERSISTED_STATE = {
  cache: DEFAULT_CACHE,
  pendingUpdate: null,
  preferences: DEFAULT_PREFERENCES,
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

class UpdateStore {
  constructor(filePath) {
    this.filePath = filePath
  }

  read() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8")
      const parsed = JSON.parse(raw)

      return {
        cache: {
          ...DEFAULT_CACHE,
          ...(parsed.cache ?? {}),
          releases: Array.isArray(parsed.cache?.releases) ? parsed.cache.releases : [],
        },
        pendingUpdate: parsed.pendingUpdate ?? null,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...(parsed.preferences ?? {}),
        },
      }
    } catch {
      return {
        ...DEFAULT_PERSISTED_STATE,
        cache: { ...DEFAULT_CACHE, releases: [] },
        preferences: { ...DEFAULT_PREFERENCES },
      }
    }
  }

  write(nextState) {
    ensureParentDirectory(this.filePath)
    fs.writeFileSync(this.filePath, JSON.stringify(nextState, null, 2))
  }

  update(updater) {
    const currentState = this.read()
    const nextState = updater(currentState)
    this.write(nextState)
    return nextState
  }
}

module.exports = {
  DEFAULT_PREFERENCES,
  UpdateStore,
}
