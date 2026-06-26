"use strict"

const { parseReleaseTag } = require("./release-parser.cjs")

const CHANNEL_RANK = {
  dalpha: 0,
  alpha: 1,
  beta: 2,
  final: 3,
}

const TRACK_SCOPE = {
  final: new Set(["final"]),
  beta: new Set(["final", "beta"]),
  alpha: new Set(["final", "beta", "alpha"]),
  dalpha: new Set(["final", "beta", "alpha", "dalpha"]),
}

function compareReleaseVersions(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor
  }

  if (left.patch !== right.patch) {
    return left.patch - right.patch
  }

  if (CHANNEL_RANK[left.channel] !== CHANNEL_RANK[right.channel]) {
    return CHANNEL_RANK[left.channel] - CHANNEL_RANK[right.channel]
  }

  return (left.iteration ?? 0) - (right.iteration ?? 0)
}

function isSlotMonotonic(candidate, current) {
  return (
    candidate.major >= current.major &&
    candidate.minor >= current.minor &&
    candidate.patch >= current.patch
  )
}

function isReleaseEligibleForTrack(parsedRelease, track) {
  return TRACK_SCOPE[track]?.has(parsedRelease.channel) === true
}

function isReleaseFlagConsistent(parsedRelease, release) {
  // The tag is the source of truth for channel selection. GitHub prerelease flags
  // are still recommended, but the client should remain resilient while release
  // automation is being refined.
  return Boolean(parsedRelease && release)
}

function mapReleaseCandidate(release, parsedVersion) {
  return {
    assetCount: Array.isArray(release.assets) ? release.assets.length : 0,
    body: typeof release.body === "string" ? release.body.trim() : "",
    htmlUrl: release.html_url ?? null,
    id: release.id,
    name: release.name ?? parsedVersion.rawTag,
    parsedVersion,
    prerelease: release.prerelease === true,
    publishedAt: release.published_at ?? null,
    rawTag: release.tag_name,
  }
}

function selectReleaseCandidate(releases, currentVersion, track) {
  const parsedCurrentVersion = parseReleaseTag(currentVersion)

  if (!parsedCurrentVersion) {
    return {
      candidate: null,
      currentVersion: null,
      reason: "invalid-current-version",
    }
  }

  const eligibleCandidates = []

  for (const release of releases) {
    if (!release || release.draft === true) {
      continue
    }

    const parsedVersion = parseReleaseTag(release.tag_name)

    if (!parsedVersion) {
      continue
    }

    if (!isReleaseFlagConsistent(parsedVersion, release)) {
      continue
    }

    if (!isReleaseEligibleForTrack(parsedVersion, track)) {
      continue
    }

    if (!isSlotMonotonic(parsedVersion, parsedCurrentVersion)) {
      continue
    }

    if (compareReleaseVersions(parsedVersion, parsedCurrentVersion) <= 0) {
      continue
    }

    eligibleCandidates.push(mapReleaseCandidate(release, parsedVersion))
  }

  eligibleCandidates.sort((left, right) =>
    compareReleaseVersions(left.parsedVersion, right.parsedVersion),
  )

  return {
    candidate: eligibleCandidates.at(-1) ?? null,
    currentVersion: parsedCurrentVersion,
    reason: eligibleCandidates.length > 0 ? "ok" : "no-eligible-release",
  }
}

module.exports = {
  CHANNEL_RANK,
  TRACK_SCOPE,
  compareReleaseVersions,
  isReleaseEligibleForTrack,
  isSlotMonotonic,
  selectReleaseCandidate,
}
