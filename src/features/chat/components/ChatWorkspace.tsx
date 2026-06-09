import { CSSProperties, RefObject, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChatBubble } from "@/features/chat/components/ChatBubble"
import { ChatComposer } from "@/features/chat/components/ChatComposer"
import { ChatEmptyState } from "@/features/chat/components/ChatEmptyState"
import { chatRuntimeConfig } from "@/features/chat/config/runtime"
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
  const [isUsageOpen, setIsUsageOpen] = useState(false)
  const usageButtonRef = useRef<HTMLDivElement | null>(null)
  const usagePopoverRef = useRef<HTMLDivElement | null>(null)
  const hasMessages = Boolean(conversation && conversation.messages.length > 0)
  const messageCount = conversation?.messages.length ?? 0
  const userTokens =
    conversation?.messages.reduce(
      (total, message) => total + (message.role === "user" ? Math.ceil(message.content.length / 4) : 0),
      0,
    ) ?? 0
  const assistantTokens =
    conversation?.messages.reduce(
      (total, message) => total + (message.role === "assistant" ? Math.ceil(message.content.length / 4) : 0),
      0,
    ) ?? 0
  const systemTokens = 220
  const estimatedTokens = userTokens + assistantTokens + (messageCount > 0 ? systemTokens : 0)
  const contextUsage = Math.min(
    100,
    Math.round((estimatedTokens / chatRuntimeConfig.contextWindowTokens) * 100),
  )
  const tokenState = contextUsage >= 85 ? "danger" : contextUsage >= 60 ? "warning" : "healthy"
  const chartTotal = Math.max(estimatedTokens, 1)
  const systemAngle = ((messageCount > 0 ? systemTokens : 0) / chartTotal) * 360
  const userAngle = (userTokens / chartTotal) * 360
  const assistantAngle = Math.max(0, 360 - systemAngle - userAngle)
  const tokenBreakdown = [
    { label: "System", value: messageCount > 0 ? systemTokens : 0, className: "system" },
    { label: "User prompts", value: userTokens, className: "user" },
    { label: "Assistant output", value: assistantTokens, className: "assistant" },
  ]

  useEffect(() => {
    if (!isUsageOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (!usageButtonRef.current?.contains(target) && !usagePopoverRef.current?.contains(target)) {
        setIsUsageOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)

    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [isUsageOpen])

  return (
    <section className="relative flex min-h-0 flex-col bg-[var(--surface)]">
      <header className="chat-workspace-header px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conversation?.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">{WORKSPACE_LABEL}</p>
        </div>
        <div className="chat-workspace-report" aria-label="Session report">
          <div className="chat-workspace-stat">
            <span>{messageCount}</span>
            <small>messages</small>
          </div>
          <div className="chat-token-usage-wrap" ref={usageButtonRef}>
            <button
              aria-expanded={isUsageOpen}
              className="chat-token-usage-button"
              data-state={tokenState}
              type="button"
              onClick={() => setIsUsageOpen((value) => !value)}
            >
              <span className="chat-token-usage-dot" aria-hidden="true" />
              <span>{estimatedTokens.toLocaleString()}</span>
              <small>{contextUsage}% ctx</small>
              <span className="chat-token-usage-meter" aria-hidden="true">
                <span style={{ width: `${contextUsage}%` }} />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isUsageOpen ? (
          <div className="chat-token-popover-layer" ref={usagePopoverRef}>
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="chat-token-popover"
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              initial={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="chat-token-popover-header">
                <div>
                  <p>Context usage</p>
                  <span>
                    {estimatedTokens.toLocaleString()} of{" "}
                    {chatRuntimeConfig.contextWindowTokens.toLocaleString()} tokens
                  </span>
                </div>
                <strong>{contextUsage}%</strong>
              </div>
              <div className="chat-token-visual">
                <div
                  className="chat-token-ring"
                  style={
                    {
                      "--system-angle": `${systemAngle}deg`,
                      "--user-angle": `${systemAngle + userAngle}deg`,
                      "--assistant-angle": `${systemAngle + userAngle + assistantAngle}deg`,
                    } as CSSProperties
                  }
                >
                  <strong>{contextUsage}%</strong>
                  <span>used</span>
                </div>
                <div className="chat-token-breakdown">
                  {tokenBreakdown.map((item) => (
                    <div className="chat-token-row" data-kind={item.className} key={item.label}>
                      <span>
                        <i aria-hidden="true" />
                        {item.label}
                      </span>
                      <strong>{item.value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chat-token-row chat-token-row-total">
                <span>Total estimate</span>
                <strong>{estimatedTokens.toLocaleString()}</strong>
              </div>
              <p className="chat-token-note">Estimated from conversation text. Provider token accounting can replace this later.</p>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-40 pt-24 max-[780px]:px-4 max-[780px]:pb-36"
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
