import { FormEvent, ReactNode, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowUp,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  PenLine,
  Settings,
  Sparkle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChatMessage, useAppStore } from "@/store/use-app-store"

const navItems = [
  { label: "Chats", icon: MessageSquare, active: true },
  { label: "Settings", icon: Settings, active: false },
]

const quickPrompts = [
  "Summarize a technical note",
  "Draft a calm product update",
  "Compare local model options",
]

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

const greekSymbols: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Omega: "Ω",
}

function renderText(source: string): ReactNode[] {
  return source ? [source] : []
}

function readLatexGroup(source: string, startIndex: number) {
  if (source[startIndex] !== "{") {
    return null
  }

  let depth = 0
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index]

    if (character === "{") {
      depth += 1
    } else if (character === "}") {
      depth -= 1

      if (depth === 0) {
        return {
          body: source.slice(startIndex + 1, index),
          endIndex: index + 1,
        }
      }
    }
  }

  return null
}

function readLatexArgument(source: string, startIndex: number) {
  if (source[startIndex] === "{") {
    return readLatexGroup(source, startIndex)
  }

  if (startIndex < source.length) {
    return {
      body: source[startIndex],
      endIndex: startIndex + 1,
    }
  }

  return null
}

function renderLatex(source: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0

  while (index < source.length) {
    if (source.startsWith("\\frac", index)) {
      const numerator = readLatexArgument(source, index + 5)
      const denominator = numerator ? readLatexArgument(source, numerator.endIndex) : null

      if (numerator && denominator) {
        nodes.push(
          <span className="latex-fraction" key={`${keyPrefix}-frac-${index}`}>
            <span className="latex-fraction-top">{renderLatex(numerator.body, `${keyPrefix}-n-${index}`)}</span>
            <span className="latex-fraction-bottom">
              {renderLatex(denominator.body, `${keyPrefix}-d-${index}`)}
            </span>
          </span>,
        )
        index = denominator.endIndex
        continue
      }
    }

    if (source.startsWith("\\sqrt", index)) {
      const radicand = readLatexArgument(source, index + 5)

      if (radicand) {
        nodes.push(
          <span className="latex-root" key={`${keyPrefix}-sqrt-${index}`}>
            <span className="latex-root-symbol">√</span>
            <span className="latex-root-body">{renderLatex(radicand.body, `${keyPrefix}-r-${index}`)}</span>
          </span>,
        )
        index = radicand.endIndex
        continue
      }
    }

    if (source[index] === "^" || source[index] === "_") {
      const argument = readLatexArgument(source, index + 1)

      if (argument) {
        const Tag = source[index] === "^" ? "sup" : "sub"
        nodes.push(
          <Tag key={`${keyPrefix}-${source[index]}-${index}`}>
            {renderLatex(argument.body, `${keyPrefix}-script-${index}`)}
          </Tag>,
        )
        index = argument.endIndex
        continue
      }
    }

    if (source[index] === "\\") {
      const command = /^[A-Za-z]+/.exec(source.slice(index + 1))

      if (command) {
        nodes.push(greekSymbols[command[0]] ?? command[0])
        index += command[0].length + 1
        continue
      }
    }

    nodes.push(source[index])
    index += 1
  }

  return nodes
}

function MathExpression({ display = false, source }: { display?: boolean; source: string }) {
  return (
    <span className={cn("latex-expression", display && "latex-expression-display")}>
      {renderLatex(source.trim(), display ? "display-math" : "inline-math")}
    </span>
  )
}

function renderInlineMarkdown(source: string, offset: number): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([^)]+\\\)|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      nodes.push(...renderText(source.slice(cursor, match.index)))
    }

    const token = match[0]
    const tokenOffset = offset + match.index

    if (token.startsWith("`")) {
      nodes.push(
        <code className="markdown-code" key={`code-${tokenOffset}`}>
          {renderText(token.slice(1, -1))}
        </code>,
      )
    } else if (token.startsWith("$$")) {
      nodes.push(<MathExpression display key={`math-${tokenOffset}`} source={token.slice(2, -2)} />)
    } else if (token.startsWith("\\[")) {
      nodes.push(<MathExpression display key={`math-${tokenOffset}`} source={token.slice(2, -2)} />)
    } else if (token.startsWith("$")) {
      nodes.push(<MathExpression key={`math-${tokenOffset}`} source={token.slice(1, -1)} />)
    } else if (token.startsWith("\\(")) {
      nodes.push(<MathExpression key={`math-${tokenOffset}`} source={token.slice(2, -2)} />)
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`strong-${tokenOffset}`}>
          {renderText(token.slice(2, -2))}
        </strong>,
      )
    } else {
      nodes.push(
        <em key={`em-${tokenOffset}`}>
          {renderText(token.slice(1, -1))}
        </em>,
      )
    }

    cursor = match.index + token.length
  }

  if (cursor < source.length) {
    nodes.push(...renderText(source.slice(cursor)))
  }

  return nodes
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split("\n")
  const blocks: ReactNode[] = []
  let lineIndex = 0
  let offset = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const currentOffset = offset

    if (!line.trim()) {
      blocks.push(<div aria-hidden="true" className="markdown-spacer" key={`space-${currentOffset}`} />)
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const HeadingTag = `h${heading[1].length}` as "h1" | "h2" | "h3"
      blocks.push(
        <HeadingTag className="markdown-heading" key={`heading-${currentOffset}`}>
          {renderInlineMarkdown(heading[2], currentOffset + heading[1].length + 1)}
        </HeadingTag>,
      )
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    const displayMath = /^\s*(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])\s*$/.exec(line)
    if (displayMath) {
      blocks.push(
        <div className="latex-display-line" key={`math-${currentOffset}`}>
          <MathExpression display source={displayMath[2]} />
        </div>,
      )
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    if (/^\s*>\s+/.test(line)) {
      const quoteLines: string[] = []
      const quoteOffset = currentOffset

      while (lineIndex < lines.length && /^\s*>\s+/.test(lines[lineIndex])) {
        const quoteLine = lines[lineIndex]
        const marker = quoteLine.match(/^\s*>\s+/)?.[0] ?? ""
        quoteLines.push(quoteLine.slice(marker.length))
        offset += quoteLine.length + 1
        lineIndex += 1
      }

      blocks.push(
        <blockquote className="markdown-quote" key={`quote-${quoteOffset}`}>
          {renderInlineMarkdown(quoteLines.join("\n"), quoteOffset)}
        </blockquote>,
      )
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = []

      while (lineIndex < lines.length && /^\s*[-*]\s+/.test(lines[lineIndex])) {
        const item = lines[lineIndex]
        const marker = item.match(/^\s*[-*]\s+/)?.[0] ?? ""

        items.push(
          <li key={`li-${offset}`}>
            {renderInlineMarkdown(item.slice(marker.length), offset + marker.length)}
          </li>,
        )
        offset += item.length + 1
        lineIndex += 1
      }

      blocks.push(
        <ul className="markdown-list" key={`ul-${currentOffset}`}>
          {items}
        </ul>,
      )
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = []

      while (lineIndex < lines.length && /^\s*\d+\.\s+/.test(lines[lineIndex])) {
        const item = lines[lineIndex]
        const marker = item.match(/^\s*\d+\.\s+/)?.[0] ?? ""

        items.push(
          <li key={`oli-${offset}`}>
            {renderInlineMarkdown(item.slice(marker.length), offset + marker.length)}
          </li>,
        )
        offset += item.length + 1
        lineIndex += 1
      }

      blocks.push(
        <ol className="markdown-list markdown-list-ordered" key={`ol-${currentOffset}`}>
          {items}
        </ol>,
      )
      continue
    }

    const paragraphLines: string[] = []
    const paragraphOffset = currentOffset

    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim() &&
      !/^(#{1,3})\s+/.test(lines[lineIndex]) &&
      !/^\s*[-*]\s+/.test(lines[lineIndex]) &&
      !/^\s*\d+\.\s+/.test(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex])
      offset += lines[lineIndex].length + 1
      lineIndex += 1
    }

    blocks.push(
      <p className="markdown-paragraph" key={`p-${paragraphOffset}`}>
        {renderInlineMarkdown(paragraphLines.join("\n"), paragraphOffset)}
      </p>,
    )
  }

  return <div className="markdown-content">{blocks}</div>
}

function ChatBubble({ message }: { message: ChatMessage }) {
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
}

export default function App() {
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )
  const createConversation = useAppStore((state) => state.createConversation)
  const setActiveConversation = useAppStore((state) => state.setActiveConversation)
  const sendMessage = useAppStore((state) => state.sendMessage)
  const isGenerating = useAppStore((state) => state.isGenerating)
  const error = useAppStore((state) => state.error)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [activeConversation?.messages.length, isGenerating])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()

    if (!message || isGenerating) {
      return
    }

    setDraft("")
    await sendMessage(message)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <div className="grid h-screen grid-cols-[280px_minmax(0,1fr)_300px] gap-0 max-[1080px]:grid-cols-[240px_minmax(0,1fr)] max-[780px]:grid-cols-1">
        <aside className="flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] max-[780px]:hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent-hover)]">
                <Sparkle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-serif text-2xl leading-none">SupraChat</h1>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Local Workspace
                </p>
              </div>
            </div>
            <Button aria-label="New conversation" size="icon" variant="ghost" onClick={createConversation}>
              <PenLine className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-4 py-4">
            <Button className="w-full justify-start" onClick={createConversation}>
              <PenLine className="h-4 w-4" />
              New Conversation
            </Button>
          </div>

          <nav className="space-y-1 px-3">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={cn("nav-item", item.active && "nav-item-active")}
                type="button"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Recent
            </p>
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={cn(
                    "conversation-link",
                    conversation.id === activeConversationId && "conversation-link-active",
                  )}
                  type="button"
                  onClick={() => setActiveConversation(conversation.id)}
                >
                  <span className="truncate">{conversation.title}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {conversation.messages.length || "Empty"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] p-4">
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-[var(--surface-elevated)] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-light)] text-sm font-semibold text-[var(--text-primary)]">
                S
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">SupraLabs</p>
                <p className="text-xs text-[var(--text-secondary)]">Ollama connected locally</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[var(--surface)]">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeConversation?.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">Local chat workspace</p>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-8 max-[780px]:px-4">
            {activeConversation && activeConversation.messages.length > 0 ? (
              <div className="mx-auto flex max-w-3xl flex-col gap-5">
                <AnimatePresence>
                  {activeConversation.messages.map((message) => (
                    <ChatBubble key={message.id} message={message} />
                  ))}
                </AnimatePresence>
                {isGenerating && (
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-primary)]" />
                    Generating response
                  </div>
                )}
              </div>
            ) : (
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
                    Start a focused conversation.
                  </h2>
                  <p className="mt-3 max-w-xl text-[0.98rem] leading-7 text-[var(--text-secondary)]">
                    SupraChat is using the local Ollama model configured for this workspace.
                  </p>
                  <div className="mt-7 grid gap-2 sm:grid-cols-3">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
                        type="button"
                        onClick={() => setDraft(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-5 py-4">
            {error && (
              <p className="mb-3 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--error)_42%,var(--border))] bg-[color-mix(in_srgb,var(--error)_10%,var(--surface))] px-3 py-2 text-sm text-[var(--error)]">
                {error}
              </p>
            )}
            <form
              className="mx-auto flex max-w-3xl items-end gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-2"
              onSubmit={handleSubmit}
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
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <Button aria-label="Send message" disabled={!draft.trim() || isGenerating} size="icon">
                <ArrowUp className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--sidebar)] p-5 max-[1080px]:hidden">
          <p className="text-sm font-semibold">Session</p>
          <div className="mt-5 space-y-4">
            <div className="status-card">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Provider
              </span>
              <p className="mt-2 text-sm font-semibold">Ollama</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Local generation is active for this workspace.
              </p>
            </div>
            <div className="status-card">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Conversation
              </span>
              <p className="mt-2 text-sm font-semibold">
                {activeConversation?.messages.length ?? 0} messages
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Titles use the first three words of the first user message.
              </p>
            </div>
            <div className="rounded-[var(--radius-control)] bg-[var(--surface-elevated)] p-4">
              <p className="text-sm font-semibold">Reading note</p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                SupraChat can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
