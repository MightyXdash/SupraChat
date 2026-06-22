import { useEffect, useRef } from "react"
import { Mic, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { startSuvaRecording } from "@/features/suva/services/suva-audio-recorder"
import { transcribeSuvaAudio } from "@/features/suva/services/suva-service"
import { stopSuvaSpeech } from "@/features/suva/services/suva-tts"
import { useSuvaStore } from "@/features/suva/store/use-suva-store"

type RecordingSession = Awaited<ReturnType<typeof startSuvaRecording>>

function statusText(status: ReturnType<typeof useSuvaStore.getState>["status"]) {
  if (status === "transcribing") return "Transcribing"
  if (status === "generating") return "Thinking"
  if (status === "speaking") return "Speaking"
  if (status === "error") return "Paused"
  return "Listening"
}

export function SuvaOverlay() {
  const recordingRef = useRef<RecordingSession | null>(null)
  const isOpenRef = useRef(false)
  const isOpen = useSuvaStore((state) => state.isOpen)
  const status = useSuvaStore((state) => state.status)
  const messages = useSuvaStore((state) => state.messages)
  const error = useSuvaStore((state) => state.error)
  const toggle = useSuvaStore((state) => state.toggle)
  const open = useSuvaStore((state) => state.open)
  const close = useSuvaStore((state) => state.close)
  const setStatus = useSuvaStore((state) => state.setStatus)
  const setError = useSuvaStore((state) => state.setError)
  const setTranscript = useSuvaStore((state) => state.setTranscript)
  const sendTranscript = useSuvaStore((state) => state.sendTranscript)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = event.shiftKey && event.code === "Space" && (event.ctrlKey || event.metaKey)

      if (!isShortcut) {
        return
      }

      event.preventDefault()
      toggle()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggle])

  useEffect(() => {
    isOpenRef.current = isOpen

    if (!isOpen) {
      recordingRef.current?.stop()
      recordingRef.current = null
      stopSuvaSpeech()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || status !== "idle" || recordingRef.current) {
      return
    }

    async function listen() {
      try {
        const recording = await startSuvaRecording({
          onSpeechStart: () => {
            if (isOpenRef.current) {
              setError(null)
            }
          },
          onSpeechEnd: (samples, sampleRate) => {
            recordingRef.current = null

            if (!isOpenRef.current) {
              return
            }

            void (async () => {
              setStatus("transcribing")

              try {
                const text = await transcribeSuvaAudio(samples, sampleRate)

                if (!text) {
                  setStatus("idle")
                  return
                }

                setTranscript(text)
                setStatus("idle")
                await sendTranscript(text)
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Unable to understand the recording.",
                )
              }
            })()
          },
        })

        if (!isOpenRef.current) {
          recording.stop()
          return
        }

        recordingRef.current = recording
        setStatus("listening")
        setError(null)
      } catch {
        if (isOpenRef.current) {
          setError("Microphone unavailable.")
        }
      }
    }

    void listen()
  }, [isOpen, sendTranscript, setError, setStatus, setTranscript, status])

  function handleClose() {
    recordingRef.current?.stop()
    recordingRef.current = null
    stopSuvaSpeech()
    close()
  }

  return (
    <>
      {!isOpen ? (
        <button
          aria-label="Open SuVA"
          className="fixed right-5 top-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-panel)] text-[var(--text-primary)] shadow-[0_18px_48px_var(--shadow-soft)] backdrop-blur-xl transition hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
          type="button"
          onClick={open}
        >
          <Mic className="h-4 w-4" />
        </button>
      ) : null}

      {isOpen ? (
        <section
          aria-label="SuVA"
          className="fixed right-5 top-5 z-50 flex w-[min(20rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--glass-border)] bg-[linear-gradient(180deg,var(--glass-top),var(--glass-bottom))] text-[var(--text-primary)] shadow-[0_24px_70px_var(--shadow-strong)] backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">{statusText(status)}</div>
            <Button aria-label="Close" size="icon" type="button" variant="ghost" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[18rem] min-h-16 overflow-y-auto px-3 py-3">
            {messages.length === 0 && !error ? (
              <div className="text-sm text-[var(--text-secondary)]">Speak now.</div>
            ) : null}

            {messages.length > 0 ? (
              <div className="space-y-2">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                    <div
                      className={[
                        "inline-block max-w-[92%] rounded-[var(--radius-control)] px-3 py-2 text-sm leading-6",
                        message.role === "user"
                          ? "bg-[var(--accent-light)] text-[var(--text-primary)]"
                          : "bg-[var(--glass-panel)] text-[var(--text-secondary)]",
                      ].join(" ")}
                    >
                      {message.content || "..."}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="text-sm text-[var(--error)]">{error}</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
