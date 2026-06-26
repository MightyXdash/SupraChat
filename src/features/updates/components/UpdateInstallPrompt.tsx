import { RefreshCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UpdateStatus } from "@/features/updates/types"

type UpdateInstallPromptProps = {
  isInstalling: boolean
  status: UpdateStatus
  onDismiss: () => void
  onInstall: () => void
}

export function UpdateInstallPrompt({
  isInstalling,
  onDismiss,
  onInstall,
  status,
}: UpdateInstallPromptProps) {
  if (status.state !== "downloaded" || status.isReadyDismissed) {
    return null
  }

  return (
    <aside className="update-install-prompt" role="status" aria-live="polite">
      <button
        className="update-install-prompt-close"
        type="button"
        aria-label="Dismiss update notice"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="update-install-prompt-copy">
        <span>Update ready</span>
        <p>
          {status.availableVersion
            ? `SupraChat ${status.availableVersion} is ready to install. Restart the app to apply it.`
            : "A SupraChat update is ready to install. Restart the app to apply it."}
        </p>
      </div>
      <div className="update-install-prompt-actions">
        <Button variant="outline" size="sm" type="button" onClick={onDismiss}>
          Later
        </Button>
        <Button size="sm" type="button" onClick={onInstall} disabled={isInstalling}>
          {isInstalling ? (
            <>
              <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
              Restarting
            </>
          ) : (
            "Restart to Install"
          )}
        </Button>
      </div>
    </aside>
  )
}
