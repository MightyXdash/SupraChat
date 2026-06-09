import { RefObject } from "react"
import { AnimatePresence } from "framer-motion"
import { ChatBubble } from "@/features/chat/components/ChatBubble"
import { ChatComposer } from "@/features/chat/components/ChatComposer"
import { ChatEmptyState } from "@/features/chat/components/ChatEmptyState"
import { WORKSPACE_LABEL } from "@/features/chat/config/ui"
import { Conversation } from "@/features/chat/types"

type ChatWorkspaceProps = {
  conversation?: Conversation
  draft: string
  error: string | null
  isGenerating: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  onDraftChange: (value: string) => void
  onSubmit: () => Promise<void> | void
}

export function ChatWorkspace({
  conversation,
  draft,
  error,
  isGenerating,
  scrollRef,
  onDraftChange,
  onSubmit,
}: ChatWorkspaceProps) {
  const hasMessages = Boolean(conversation && conversation.messages.length > 0)

  return (
    <section className="relative flex min-h-0 flex-col bg-[var(--surface)]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conversation?.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">{WORKSPACE_LABEL}</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-40 pt-8 max-[780px]:px-4 max-[780px]:pb-36"
      >
        {hasMessages ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            <AnimatePresence>
              {conversation?.messages.map((message) => <ChatBubble key={message.id} message={message} />)}
            </AnimatePresence>
            {isGenerating && (
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-primary)]" />
                Generating response
              </div>
            )}
          </div>
        ) : (
          <ChatEmptyState onPromptSelect={onDraftChange} />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-5">
        <ChatComposer
          draft={draft}
          error={error}
          isGenerating={isGenerating}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
        />
      </div>
    </section>
  )
}
