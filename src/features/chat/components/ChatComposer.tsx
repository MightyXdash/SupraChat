import { FormEvent, KeyboardEvent } from "react"
import { ArrowUp, Paperclip } from "lucide-react"
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
    <div className="shrink-0 border-t border-[var(--border)] px-5 py-4">
      {error && (
        <p className="mb-3 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--error)_42%,var(--border))] bg-[color-mix(in_srgb,var(--error)_10%,var(--surface))] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <form
        className="mx-auto flex max-w-3xl items-end gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-2"
        onSubmit={handleFormSubmit}
      >
        <Button aria-label="Attach file" size="icon" type="button" variant="ghost">
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          aria-label="Message SupraChat"
          className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Message SupraChat..."
          rows={1}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button aria-label="Send message" disabled={!draft.trim() || isGenerating} size="icon">
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
