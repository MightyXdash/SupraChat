import { Fragment, type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MessageCircle, Search, SquarePen, X } from "lucide-react"
import { searchConversations, getSearchWords } from "@/features/chat/lib/conversation-search"
import { truncateConversationTitle } from "@/features/chat/lib/chat-records"
import { Conversation } from "@/features/chat/types"

type ConversationSearchDialogProps = {
  conversations: Conversation[]
  isOpen: boolean
  onClose: () => void
  onCreateConversation: () => Promise<string>
  onSelectConversation: (conversationId: string) => void
}

function relativeGroupLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return "Today"
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday"
  }

  return "Earlier"
}

function highlightedParts(text: string, words: string[]) {
  if (words.length === 0) {
    return [text]
  }

  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi")
  return text.split(pattern).filter(Boolean)
}

function SearchHighlight({ parts, words }: { parts: string[]; words: string[] }) {
  return parts.map((part, index) => {
    const isMatch = words.includes(part.toLowerCase())

    return isMatch ? (
      <mark className="conversation-search-match" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  })
}

export function ConversationSearchDialog({
  conversations,
  isOpen,
  onClose,
  onCreateConversation,
  onSelectConversation,
}: ConversationSearchDialogProps) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const words = useMemo(() => getSearchWords(query), [query])
  const results = useMemo(() => searchConversations(conversations, query), [conversations, query])

  useEffect(() => {
    if (!isOpen) {
      setQuery("")
      return
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  async function handleCreateConversation() {
    const conversationId = await onCreateConversation()
    onSelectConversation(conversationId)
    onClose()
  }

  function handleSelectConversation(conversationId: string) {
    onSelectConversation(conversationId)
    onClose()
  }

  let previousGroup = ""

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="conversation-search-layer"
          role="presentation"
        >
          <motion.button
            className="conversation-search-backdrop"
            type="button"
            aria-label="Close search"
            onClick={onClose}
            initial={{
              opacity: 0,
              "--search-backdrop-blur": "0px",
              "--search-backdrop-saturate": "1",
            } as CSSProperties}
            animate={{
              opacity: 1,
              "--search-backdrop-blur": "10px",
              "--search-backdrop-saturate": "0.94",
            } as CSSProperties}
            exit={{
              opacity: 0,
              "--search-backdrop-blur": "0px",
              "--search-backdrop-saturate": "1",
            } as CSSProperties}
            transition={{ duration: 0.36, ease: "easeOut" }}
          />
          <motion.section
            className="conversation-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search conversations"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
          >
            <div className="conversation-search-field">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                placeholder="Search chats..."
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="conversation-search-close" type="button" aria-label="Close search" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="conversation-search-results scrollbar-reveal">
              <button className="conversation-search-action" type="button" onClick={() => void handleCreateConversation()}>
                <SquarePen className="h-4 w-4" />
                <span>New Conversation</span>
              </button>

              {results.map((result) => {
                const group = relativeGroupLabel(result.conversation.updatedAt)
                const shouldRenderGroup = group !== previousGroup
                previousGroup = group
                const title = truncateConversationTitle(result.conversation.title)
                const parts = highlightedParts(title, words)
                const snippetParts = highlightedParts(result.matchedText, words)

                return (
                  <Fragment key={result.conversation.id}>
                    {shouldRenderGroup ? <p className="conversation-search-group">{group}</p> : null}
                    <button
                      className="conversation-search-result"
                      type="button"
                      onClick={() => handleSelectConversation(result.conversation.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="conversation-search-result-copy">
                        <span className="conversation-search-result-title">
                          <SearchHighlight parts={parts} words={words} />
                        </span>
                        {query.trim() && result.matchedText !== result.conversation.title ? (
                          <span className="conversation-search-result-snippet">
                            <SearchHighlight parts={snippetParts} words={words} />
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </Fragment>
                )
              })}

              {results.length === 0 ? (
                <div className="conversation-search-empty">
                  <p>No matching conversations</p>
                  <span>Try a different word or start a new conversation.</span>
                </div>
              ) : null}
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
