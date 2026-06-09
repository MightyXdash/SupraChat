import { motion } from "framer-motion"
import { Sparkle } from "lucide-react"
import {
  EMPTY_STATE_DESCRIPTION,
  EMPTY_STATE_TITLE,
  QUICK_PROMPTS,
} from "@/features/chat/config/ui"

type ChatEmptyStateProps = {
  onPromptSelect: (prompt: string) => void
}

export function ChatEmptyState({ onPromptSelect }: ChatEmptyStateProps) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-light)] text-[var(--accent-hover)]">
          <Sparkle className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-4xl leading-tight text-[var(--text-primary)]">
          {EMPTY_STATE_TITLE}
        </h2>
        <p className="mt-3 max-w-xl text-[0.98rem] leading-7 text-[var(--text-secondary)]">
          {EMPTY_STATE_DESCRIPTION}
        </p>
        <div className="mt-7 grid gap-2 sm:grid-cols-3">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
              type="button"
              onClick={() => onPromptSelect(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
