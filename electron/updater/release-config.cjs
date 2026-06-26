"use strict"

const packageJson = require("../../package.json")

const DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com"
const DEFAULT_GITHUB_BASE_URL = "https://github.com"

function parseRepositoryUrl(repositoryUrl) {
  if (typeof repositoryUrl !== "string" || !repositoryUrl.trim()) {
    return null
  }

  const normalizedUrl = repositoryUrl
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")

  try {
    const parsedUrl = new URL(normalizedUrl)
    const [owner, repo] = parsedUrl.pathname.replace(/^\/+/, "").split("/")

    if (!owner || !repo) {
      return null
    }

    return { owner, repo }
  } catch {
    return null
  }
}

function readRepositoryMetadata() {
  const envOwner = process.env.SUPRACHAT_UPDATER_OWNER?.trim()
  const envRepo = process.env.SUPRACHAT_UPDATER_REPO?.trim()

  if (envOwner && envRepo) {
    return { owner: envOwner, repo: envRepo }
  }

  const repository = packageJson.repository
  const repositoryUrl =
    typeof repository === "string" ? repository : repository?.url

  return parseRepositoryUrl(repositoryUrl)
}

function getReleaseConfig() {
  const repository = readRepositoryMetadata()

  if (!repository) {
    return {
      apiBaseUrl: DEFAULT_GITHUB_API_BASE_URL,
      baseUrl: DEFAULT_GITHUB_BASE_URL,
      owner: null,
      repo: null,
    }
  }

  return {
    apiBaseUrl: DEFAULT_GITHUB_API_BASE_URL,
    baseUrl: DEFAULT_GITHUB_BASE_URL,
    owner: repository.owner,
    repo: repository.repo,
  }
}

module.exports = {
  DEFAULT_GITHUB_API_BASE_URL,
  DEFAULT_GITHUB_BASE_URL,
  getReleaseConfig,
}
