"use strict"

const { getReleaseConfig } = require("./release-config.cjs")

function createUserAgent() {
  return "SupraChat-Updater"
}

async function fetchGitHubReleases(cacheState = {}) {
  const releaseConfig = getReleaseConfig()

  if (!releaseConfig.owner || !releaseConfig.repo) {
    return {
      cacheState,
      reason: "missing-repository-config",
      releases: [],
      status: "disabled",
    }
  }

  const endpoint = `${releaseConfig.apiBaseUrl}/repos/${releaseConfig.owner}/${releaseConfig.repo}/releases`
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": createUserAgent(),
  }

  if (cacheState.etag) {
    headers["If-None-Match"] = cacheState.etag
  }

  let response

  try {
    response = await fetch(endpoint, { headers })
  } catch {
    return {
      cacheState,
      reason: "network-error",
      releases: [],
      status: "error",
    }
  }

  if (response.status === 304) {
    return {
      cacheState: {
        ...cacheState,
        lastCheckedAt: new Date().toISOString(),
      },
      reason: "not-modified",
      releases: Array.isArray(cacheState.releases) ? cacheState.releases : [],
      status: "ok",
    }
  }

  if (response.status === 403 || response.status === 404) {
    return {
      cacheState,
      reason: "releases-unavailable",
      releases: [],
      status: "disabled",
    }
  }

  if (!response.ok) {
    return {
      cacheState,
      reason: "request-failed",
      releases: [],
      status: "error",
    }
  }

  const releases = await response.json()

  return {
    cacheState: {
      etag: response.headers.get("etag"),
      lastCheckedAt: new Date().toISOString(),
      releases: Array.isArray(releases) ? releases : [],
    },
    reason: "ok",
    releases: Array.isArray(releases) ? releases : [],
    status: "ok",
  }
}

module.exports = {
  fetchGitHubReleases,
}
