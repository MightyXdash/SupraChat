import { memo, useState } from "react"
import { motion } from "framer-motion"
import { Check, Copy, Loader2, Pencil, RotateCcw, Volume2 } from "lucide-react"
import { MarkdownMessage } from "@/features/chat/components/MarkdownMessage"
import { ChatMessage } from "@/features/chat/types"
import { cn } from "@/lib/utils"

type ChatBubbleProps = {
  message: ChatMessage
  canEdit?: boolean
  isGenerating?: boolean
  onEdit?: (message: ChatMessage) => void
  onRegenerate?: (messageId: string) => Promise<void> | void
  onSpeak?: (message: ChatMessage) => Promise<void> | void
  speechLoading?: boolean
}

export const ChatBubble = memo(function ChatBubble({ message, canEdit, isGenerating, onEdit, onRegenerate, onSpeak, speechLoading }: ChatBubbleProps) {
  const [hasCopied, setHasCopied] = useState(false)
  const isUser = message.role === "user"
  const showAssistantActions = !isUser && !isGenerating && message.content.trim().length > 0
  const showUserActions = isUser && !isGenerating && message.content.trim().length > 0

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setHasCopied(true)
      window.setTimeout(() => setHasCopied(false), 1400)
    } catch {
      setHasCopied(false)
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn("chat-message-row flex", isUser ? "justify-end" : "w-full")}
      data-message-role={message.role}
    >
      <div className={cn("chat-message-shell", isUser ? "chat-message-shell-user" : "chat-message-shell-assistant")}>
        <div
          className={cn(
            "chat-message-surface rounded-[var(--radius-panel)] border px-4 py-3 text-[0.95rem] leading-7",
            isUser
              ? "max-w-[74ch] border-[var(--border)] bg-[var(--highlight)] text-[var(--text-primary)]"
              : "min-w-0 flex-1 border-transparent bg-[var(--surface)] text-[var(--text-primary)]",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownMessage content={message.content} isGenerating={isGenerating} />
          )}
        </div>
        {showAssistantActions || showUserActions ? (
          <div className="chat-message-actions" aria-label="Message actions">
            {!isUser && onSpeak ? (
              <button
                aria-label="Read response aloud"
                className="chat-message-action"
                title="Read response aloud"
                type="button"
                onClick={() => void onSpeak(message)}
              >
                {speechLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            ) : null}
            <button
              aria-label={hasCopied ? "Copied" : isUser ? "Copy prompt" : "Copy response"}
              className="chat-message-action"
              title={hasCopied ? "Copied" : isUser ? "Copy prompt" : "Copy response"}
              type="button"
              onClick={() => void handleCopy()}
            >
              {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {isUser && canEdit && onEdit ? (
              <button
                aria-label="Edit prompt"
                className="chat-message-action"
                title="Edit prompt"
                type="button"
                onClick={() => onEdit(message)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {!isUser && onRegenerate ? (
              <button
                aria-label="Regenerate response"
                className="chat-message-action"
                title="Regenerate response"
                type="button"
                onClick={() => void onRegenerate(message.id)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.article>
  )
})
