"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { parseReleaseTag } = require("../release-parser.cjs")

test("parseReleaseTag accepts final tags with leading v", () => {
  assert.deepEqual(parseReleaseTag("v1.5.89"), {
    rawTag: "v1.5.89",
    major: 1,
    minor: 5,
    patch: 89,
    channel: "final",
    iteration: null,
    isFinal: true,
    version: "1.5.89",
  })
})

test("parseReleaseTag accepts prerelease tags", () => {
  assert.deepEqual(parseReleaseTag("v3.2.99-beta.2"), {
    rawTag: "v3.2.99-beta.2",
    major: 3,
    minor: 2,
    patch: 99,
    channel: "beta",
    iteration: 2,
    isFinal: false,
    version: "3.2.99-beta.2",
  })

  assert.deepEqual(parseReleaseTag("v2.1.5-dalpha.4"), {
    rawTag: "v2.1.5-dalpha.4",
    major: 2,
    minor: 1,
    patch: 5,
    channel: "dalpha",
    iteration: 4,
    isFinal: false,
    version: "2.1.5-dalpha.4",
  })
})

test("parseReleaseTag rejects unsupported formats", () => {
  assert.equal(parseReleaseTag("v1.2"), null)
  assert.equal(parseReleaseTag("v1.2.3.beta"), null)
  assert.equal(parseReleaseTag("release-1.2.3"), null)
  assert.equal(parseReleaseTag("v1.2.3-gamma.1"), null)
})
