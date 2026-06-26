"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const {
  compareReleaseVersions,
  isSlotMonotonic,
  selectReleaseCandidate,
} = require("../release-selector.cjs")
const { parseReleaseTag } = require("../release-parser.cjs")

function release(tagName, prerelease = false) {
  return {
    assets: [],
    body: "",
    draft: false,
    id: tagName,
    prerelease,
    tag_name: tagName,
  }
}

test("compareReleaseVersions ranks channels by stability when numeric parts match", () => {
  const dalpha = parseReleaseTag("v1.2.3-dalpha.1")
  const alpha = parseReleaseTag("v1.2.3-alpha.1")
  const beta = parseReleaseTag("v1.2.3-beta.1")
  const final = parseReleaseTag("v1.2.3")

  assert.ok(compareReleaseVersions(dalpha, alpha) < 0)
  assert.ok(compareReleaseVersions(alpha, beta) < 0)
  assert.ok(compareReleaseVersions(beta, final) < 0)
})

test("compareReleaseVersions compares prerelease iterations within a channel", () => {
  const betaOne = parseReleaseTag("v1.2.3-beta.1")
  const betaTwo = parseReleaseTag("v1.2.3-beta.2")

  assert.ok(compareReleaseVersions(betaOne, betaTwo) < 0)
})

test("isSlotMonotonic rejects any release with a lower numeric slot", () => {
  const current = parseReleaseTag("1.9.9")
  const majorReset = parseReleaseTag("2.0.0")
  const validIncrease = parseReleaseTag("1.10.9")

  assert.equal(isSlotMonotonic(majorReset, current), false)
  assert.equal(isSlotMonotonic(validIncrease, current), true)
})

test("selectReleaseCandidate respects track scope", () => {
  const releases = [
    release("v1.1.0"),
    release("v1.2.0-beta.1", true),
    release("v1.3.0-alpha.1", true),
    release("v1.4.0-dalpha.1", true),
  ]

  assert.equal(
    selectReleaseCandidate(releases, "1.0.0", "final").candidate?.rawTag,
    "v1.1.0",
  )
  assert.equal(
    selectReleaseCandidate(releases, "1.0.0", "beta").candidate?.rawTag,
    "v1.2.0-beta.1",
  )
  assert.equal(
    selectReleaseCandidate(releases, "1.0.0", "alpha").candidate?.rawTag,
    "v1.3.0-alpha.1",
  )
  assert.equal(
    selectReleaseCandidate(releases, "1.0.0", "dalpha").candidate?.rawTag,
    "v1.4.0-dalpha.1",
  )
})
