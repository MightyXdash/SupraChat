import { Minus, Square, X } from "lucide-react"
import { appWindowConfig, isMacPlatform } from "@/app/config/window"

export function WindowTitleBar() {
  const controls = appWindowConfig.controls

  if (isMacPlatform) {
    return null
  }

  return (
    <header className="window-titlebar" data-platform={appWindowConfig.platform}>
      {controls ? (
        <div className="window-titlebar-controls">
          <button
            className="window-titlebar-control window-titlebar-control-minimize"
            type="button"
            aria-label="Minimize window"
            onClick={() => void controls.minimize()}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            className="window-titlebar-control window-titlebar-control-maximize"
            type="button"
            aria-label="Maximize window"
            onClick={() => void controls.toggleMaximize()}
          >
            <Square className="h-3 w-3" />
          </button>
          <button
            className="window-titlebar-control window-titlebar-control-close"
            type="button"
            aria-label="Close window"
            onClick={() => void controls.close()}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </header>
  )
}
