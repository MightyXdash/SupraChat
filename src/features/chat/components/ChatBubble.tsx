import { memo } from "react"
import { motion } from "framer-motion"
import { Sparkle } from "lucide-react"
import { MarkdownMessage } from "@/features/chat/components/MarkdownMessage"
import { ChatMessage } from "@/features/chat/types"
import { cn } from "@/lib/utils"

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

export const ChatBubble = memo(function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <motion.article
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn("flex gap-3", isUser && "justify-end")}
    >
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--background)]">
          <Sparkle className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[74ch] rounded-[var(--radius-panel)] border px-4 py-3 text-[0.95rem] leading-7",
          isUser
            ? "border-[var(--border)] bg-[var(--highlight)] text-[var(--text-primary)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
        <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">{formatTime(message.createdAt)}</p>
      </div>
    </motion.article>
  )
})
