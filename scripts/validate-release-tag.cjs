"use strict"

const { parseReleaseTag } = require("../electron/updater/release-parser.cjs")
const { isSlotMonotonic } = require("../electron/updater/release-selector.cjs")
const packageJson = require("../package.json")

const currentVersion = process.argv[2] ?? packageJson.version
const nextTag = process.argv[3] ?? process.env.npm_config_tag ?? process.env.GITHUB_REF_NAME

if (!nextTag) {
  console.error("Usage: node scripts/validate-release-tag.cjs <current-version?> <next-tag>")
  process.exit(1)
}

const parsedCurrent = parseReleaseTag(currentVersion)
const parsedNext = parseReleaseTag(nextTag)

if (!parsedCurrent) {
  console.error(`Current version is invalid: ${currentVersion}`)
  process.exit(1)
}

if (!parsedNext) {
  console.error(`Release tag is invalid: ${nextTag}`)
  process.exit(1)
}

if (!isSlotMonotonic(parsedNext, parsedCurrent)) {
  console.error(
    `Release tag ${nextTag} is invalid because one or more numeric slots moved backwards from ${currentVersion}.`,
  )
  process.exit(1)
}

console.log(`Release tag ${nextTag} is valid against ${currentVersion}.`)
