import {
  CHAT_READING_NOTE,
  LOCAL_RUNTIME_DESCRIPTION,
  LOCAL_RUNTIME_NAME,
  TITLE_GENERATION_NOTE,
} from "@/features/chat/config/ui"

type SessionPanelProps = {
  messageCount: number
}

export function SessionPanel({ messageCount }: SessionPanelProps) {
  return (
    <aside className="flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--sidebar)] p-5 max-[1080px]:hidden">
      <p className="text-sm font-semibold">Session</p>
      <div className="mt-5 space-y-4">
        <div className="status-card">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Runtime
          </span>
          <p className="mt-2 text-sm font-semibold">{LOCAL_RUNTIME_NAME}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {LOCAL_RUNTIME_DESCRIPTION}
          </p>
        </div>
        <div className="status-card">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Conversation
          </span>
          <p className="mt-2 text-sm font-semibold">{messageCount} messages</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{TITLE_GENERATION_NOTE}</p>
        </div>
        <div className="rounded-[var(--radius-control)] bg-[var(--surface-elevated)] p-4">
          <p className="text-sm font-semibold">Reading note</p>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{CHAT_READING_NOTE}</p>
        </div>
      </div>
    </aside>
  )
}
