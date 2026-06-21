import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"
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
  const [composerSize, setComposerSize] = useState<"small" | "small-medium" | "medium-long" | "long">("small")

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    function syncDraftFromTextarea() {
      onDraftChange(textarea?.value ?? "")
    }

    textarea.addEventListener("input", syncDraftFromTextarea)
    textarea.addEventListener("keyup", syncDraftFromTextarea)

    return () => {
      textarea.removeEventListener("input", syncDraftFromTextarea)
      textarea.removeEventListener("keyup", syncDraftFromTextarea)
    }
  }, [onDraftChange])

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"

    const computed = window.getComputedStyle(textarea)
    const fontSize = Number.parseFloat(computed.fontSize) || 16
    const rawLineHeight = Number.parseFloat(computed.lineHeight)
    const lineHeight = Number.isFinite(rawLineHeight)
      ? rawLineHeight <= 4
        ? rawLineHeight * fontSize
        : rawLineHeight
      : fontSize * 1.55
    const verticalPadding =
      Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom)
    const firstStep = Math.round(lineHeight + verticalPadding)
    const secondStep = Math.round(lineHeight * 2 + verticalPadding)
    const thirdStep = Math.round(lineHeight * 3 + verticalPadding)
    const fourthStep = Math.round(lineHeight * 4 + verticalPadding)
    const scrollHeight = textarea.scrollHeight
    const isEmptyDraft = draft.length === 0
    const hasExpandedContent = !isEmptyDraft && (draft.includes("\n") || scrollHeight > firstStep)

    const nextSize = isEmptyDraft || !hasExpandedContent
      ? "small"
      : scrollHeight <= secondStep
        ? "small-medium"
        : scrollHeight <= thirdStep
          ? "medium-long"
          : "long"
    const nextHeight =
      nextSize === "small"
        ? firstStep
      : nextSize === "small-medium"
          ? secondStep
          : nextSize === "medium-long"
            ? thirdStep
            : Math.min(scrollHeight, fourthStep)

    textarea.style.height = `${nextHeight}px`
    setComposerSize(nextSize)
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
      <form className="chat-composer" data-size={composerSize} onSubmit={handleFormSubmit}>
        <div className="chat-composer-main">
          <textarea
            ref={textareaRef}
            aria-label="Message SupraChat"
            className="chat-composer-textarea"
            placeholder="Message Supra..."
            rows={1}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onInput={(event) => onDraftChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={(event) => onDraftChange(event.currentTarget.value)}
          />
        </div>

        <div className="chat-composer-footer">
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
