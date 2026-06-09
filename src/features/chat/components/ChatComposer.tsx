import { FormEvent, KeyboardEvent, useLayoutEffect, useRef } from "react"
import { ArrowUp, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

type ChatComposerProps = {
  draft: string
  error: string | null
  isGenerating: boolean
  onDraftChange: (value: string) => void
  onSubmit: () => Promise<void> | void
}

export function ChatComposer({
  draft,
  error,
  isGenerating,
  onDraftChange,
  onSubmit,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"

    const computed = window.getComputedStyle(textarea)
    const lineHeight = Number.parseFloat(computed.lineHeight) || 24
    const verticalPadding =
      Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom)
    const firstStep = Math.round(lineHeight + verticalPadding)
    const secondStep = Math.round(lineHeight * 2 + verticalPadding)
    const thirdStep = Math.round(lineHeight * 3 + verticalPadding)
    const scrollHeight = textarea.scrollHeight

    const nextHeight = !draft.trim()
      ? firstStep
      : scrollHeight <= firstStep
        ? firstStep
        : scrollHeight <= secondStep
          ? secondStep
          : Math.min(scrollHeight, thirdStep)

    textarea.style.height = `${nextHeight}px`
  }, [draft])

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-3xl">
      {error && (
        <p className="mb-3 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--error)_42%,var(--border))] bg-[color-mix(in_srgb,var(--error)_10%,var(--surface))] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <form className="chat-composer" onSubmit={handleFormSubmit}>
        <div className="chat-composer-main">
          <textarea
            ref={textareaRef}
            aria-label="Message SupraChat"
            className="chat-composer-textarea"
            placeholder="Message SupraChat..."
            rows={1}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="chat-composer-footer">
          <div className="chat-composer-footer-group">
            <Button aria-label="Add attachment" className="chat-composer-round-button" size="icon" type="button" variant="ghost">
              <Plus className="h-5 w-5" />
            </Button>
            <button className="chat-composer-pill" type="button">
              <span>Smart</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <Button
            aria-label="Send message"
            className="chat-composer-voice-button"
            disabled={!draft.trim() || isGenerating}
            size="icon"
            type="submit"
            variant="ghost"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
