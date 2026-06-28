const requiredVariables = [
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
]

const missingVariables = requiredVariables.filter((name) => !process.env[name])

if (missingVariables.length > 0) {
  console.error("Release signing is not fully configured.")
  console.error(`Missing environment variables: ${missingVariables.join(", ")}`)
  process.exit(1)
}

console.log("Release signing environment is configured.")
