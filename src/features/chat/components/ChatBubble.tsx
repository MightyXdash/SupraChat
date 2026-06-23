import { memo } from "react"
import { motion } from "framer-motion"
import { MarkdownMessage } from "@/features/chat/components/MarkdownMessage"
import { ChatMessage } from "@/features/chat/types"
import { cn } from "@/lib/utils"

export const ChatBubble = memo(function ChatBubble({ message, isGenerating }: { message: ChatMessage; isGenerating?: boolean }) {
  const isUser = message.role === "user"

  return (
    <motion.article
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn("flex", isUser ? "justify-end" : "w-full")}
      data-message-role={message.role}
    >
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
    </motion.article>
  )
})
