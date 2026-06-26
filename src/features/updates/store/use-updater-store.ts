import { create } from "zustand"
import type { UpdateStatus } from "@/features/updates/types"

const defaultStatus: UpdateStatus = {
  availableVersion: null,
  checkedAt: null,
  currentVersion: "0.0.0",
  downloadProgress: null,
  errorMessage: null,
  isReadyDismissed: false,
  releaseNotes: null,
  state: "idle",
  track: "final",
}

type UpdaterState = {
  isCheckingNow: boolean
  isHydrated: boolean
  isInstalling: boolean
  status: UpdateStatus
  setCheckingNow: (value: boolean) => void
  setHydrated: (value: boolean) => void
  setInstalling: (value: boolean) => void
  setStatus: (status: UpdateStatus) => void
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  isCheckingNow: false,
  isHydrated: false,
  isInstalling: false,
  status: defaultStatus,
  setCheckingNow: (value) => set({ isCheckingNow: value }),
  setHydrated: (value) => set({ isHydrated: value }),
  setInstalling: (value) => set({ isInstalling: value }),
  setStatus: (status) => set({ status }),
}))
