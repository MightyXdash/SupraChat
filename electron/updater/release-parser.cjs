"use strict"

const UPDATE_CHANNELS = ["final", "beta", "alpha", "dalpha"]

const RELEASE_TAG_PATTERN =
  /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<channel>beta|alpha|dalpha)\.(?<iteration>\d+))?$/

function normalizeReleaseChannel(channel) {
  if (!channel || channel === "final") {
    return "final"
  }

  if (UPDATE_CHANNELS.includes(channel)) {
    return channel
  }

  return null
}

function parseReleaseTag(rawTag) {
  if (typeof rawTag !== "string" || !rawTag.trim()) {
    return null
  }

  const normalizedTag = rawTag.trim()
  const match = RELEASE_TAG_PATTERN.exec(normalizedTag)

  if (!match || !match.groups) {
    return null
  }

  const major = Number.parseInt(match.groups.major, 10)
  const minor = Number.parseInt(match.groups.minor, 10)
  const patch = Number.parseInt(match.groups.patch, 10)
  const channel = normalizeReleaseChannel(match.groups.channel)
  const iteration = channel === "final" ? null : Number.parseInt(match.groups.iteration, 10)

  if (![major, minor, patch].every(Number.isInteger) || channel == null) {
    return null
  }

  if (channel !== "final" && !Number.isInteger(iteration)) {
    return null
  }

  return {
    rawTag: normalizedTag,
    major,
    minor,
    patch,
    channel,
    iteration,
    isFinal: channel === "final",
    version: `${major}.${minor}.${patch}${channel === "final" ? "" : `-${channel}.${iteration}`}`,
  }
}

module.exports = {
  UPDATE_CHANNELS,
  parseReleaseTag,
}
