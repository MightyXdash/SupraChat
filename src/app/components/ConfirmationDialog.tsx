import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

export type ConfirmationTone = "danger" | "warning"

export type ConfirmationOptions = {
  body: string
  cancelLabel?: string
  confirmLabel: string
  title: string
  tone?: ConfirmationTone
}

type ConfirmationRequest = ConfirmationOptions & {
  id: number
}

type ConfirmationDialogProps = {
  request: ConfirmationRequest | null
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmationDialog({ onCancel, onConfirm, request }: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {request ? (
        <div className="confirmation-layer" role="presentation">
          <motion.button
            aria-label="Cancel"
            className="confirmation-backdrop"
            type="button"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          />
          <motion.section
            aria-label={request.title}
            aria-modal="true"
            className="confirmation-dialog"
            data-tone={request.tone ?? "warning"}
            role="alertdialog"
            initial={{ opacity: 0, scale: 0.985, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="confirmation-dialog-copy">
              <h2>{request.title}</h2>
              <p>{request.body}</p>
            </div>
            <div className="confirmation-dialog-actions">
              <button className="settings-secondary-button" type="button" onClick={onCancel}>
                {request.cancelLabel ?? "Cancel"}
              </button>
              <button
                className="confirmation-primary-button"
                data-tone={request.tone ?? "warning"}
                type="button"
                onClick={onConfirm}
              >
                {request.confirmLabel}
              </button>
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

export function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null)
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const requestIdRef = useRef(0)

  function close(confirmed: boolean) {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setRequest(null)
  }

  function confirm(options: ConfirmationOptions) {
    requestIdRef.current += 1

    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setRequest({
        ...options,
        id: requestIdRef.current,
      })
    })
  }

  return {
    confirm,
    confirmationDialog: (
      <ConfirmationDialog
        request={request}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    ),
  }
}
