export type UpdateTrack = "final" | "beta" | "alpha" | "dalpha"

export type ParsedReleaseVersion = {
  rawTag: string
  major: number
  minor: number
  patch: number
  channel: UpdateTrack
  iteration: number | null
  isFinal: boolean
  version: string
}

export type UpdateCandidate = {
  assetCount: number
  body: string
  htmlUrl: string | null
  id: number | string
  name: string
  parsedVersion: ParsedReleaseVersion
  prerelease: boolean
  publishedAt: string | null
  rawTag: string
}

export type UpdatePreferences = {
  confirmExperimentalInstall: boolean
  updateTrack: UpdateTrack
}

export type UpdateDownloadProgress = {
  bytesPerSecond: number
  percent: number
  total: number
  transferred: number
}

export type UpdateState =
  | "idle"
  | "checking"
  | "update-available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error"
  | "disabled"

export type UpdateStatus = {
  availableVersion: string | null
  checkedAt: string | null
  currentVersion: string
  downloadProgress: UpdateDownloadProgress | null
  errorMessage: string | null
  isReadyDismissed?: boolean
  releaseNotes: string | null
  state: UpdateState
  track: UpdateTrack
}
