import { ReactNode, useEffect, useRef, useState } from "react"
import { Copy, Download, Ellipsis } from "lucide-react"
import { cn } from "@/lib/utils"

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

const latexSymbols: Record<string, string> = {
  ...greekSymbols,
  ast: "*",
  cdot: "·",
  degree: "°",
  times: "×",
  div: "÷",
  pm: "±",
  leq: "≤",
  geq: "≥",
  neq: "≠",
  approx: "≈",
  rightarrow: "→",
  to: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
}

function renderText(source: string, offset = 0, animatedFrom = Number.POSITIVE_INFINITY): ReactNode[] {
  if (!source) {
    return []
  }

  return Array.from(source).map((character, index) =>
    offset + index >= animatedFrom ? (
      <span
        className="markdown-stream-character"
        key={`stream-char-${offset + index}`}
      >
        {character}
      </span>
    ) : (
      character
    ),
  )
}

function normalizeMarkdownSource(source: string) {
  return source
    .replace(/^(\s*#{1,6})(?=\S)/gm, "$1 ")
    .replace(/^(\s*#{1,6}\s+)#{1,6}\s+/gm, "$1")
    .replace(/\\\$/g, "$")
}

function parseHeading(line: string) {
  const heading = /^(#{1,6})\s+(.+)$/.exec(line.trimStart())

  if (!heading) {
    return null
  }

  heading[2] = heading[2].replace(/^#{1,6}\s+/, "")
  return heading
}

function isHeadingLine(line: string) {
  return parseHeading(line) !== null
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

    if (source.startsWith("\\text", index) || source.startsWith("\\mathrm", index)) {
      const commandLength = source.startsWith("\\mathrm", index) ? 7 : 5
      const textArgument = readLatexArgument(source, index + commandLength)

      if (textArgument) {
        nodes.push(
          <span className="latex-text" key={`${keyPrefix}-text-${index}`}>
            {renderText(textArgument.body)}
          </span>,
        )
        index = textArgument.endIndex
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
        nodes.push(latexSymbols[command[0]] ?? `\\${command[0]}`)
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

function renderPlainChemistry(source: string, offset: number, animatedFrom: number): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\b(?:[A-Z][a-z]?\d*){2,}\b/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      nodes.push(...renderText(source.slice(cursor, match.index), offset + cursor, animatedFrom))
    }

    const formula = match[0]
    const formulaNodes: ReactNode[] = []

    for (let index = 0; index < formula.length; index += 1) {
      const character = formula[index]

      if (/\d/.test(character)) {
        let digits = character

        while (index + 1 < formula.length && /\d/.test(formula[index + 1])) {
          digits += formula[index + 1]
          index += 1
        }

        formulaNodes.push(<sub key={`chem-sub-${offset + match.index}-${index}`}>{digits}</sub>)
      } else {
        formulaNodes.push(character)
      }
    }

    nodes.push(
      <span className="latex-expression" key={`chem-${offset + match.index}`}>
        {formulaNodes}
      </span>,
    )
    cursor = match.index + formula.length
  }

  if (cursor < source.length) {
    nodes.push(...renderText(source.slice(cursor), offset + cursor, animatedFrom))
  }

  return nodes
}

function renderInlineMarkdown(
  source: string,
  offset: number,
  animatedFrom = Number.POSITIVE_INFINITY,
): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(<br\s*\/?>|`[^`]+`|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([^)]+\\\)|\*\*[^*]+\*\*|\*[^*]+\*)/gi
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      nodes.push(...renderPlainChemistry(source.slice(cursor, match.index), offset + cursor, animatedFrom))
    }

    const token = match[0]
    const tokenOffset = offset + match.index

    if (/^<br\s*\/?>$/i.test(token)) {
      nodes.push(<br key={`br-${tokenOffset}`} />)
    } else if (token.startsWith("`")) {
      nodes.push(
        <code className="markdown-code" key={`code-${tokenOffset}`}>
          {renderText(token.slice(1, -1), tokenOffset + 1, animatedFrom)}
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
          {renderInlineMarkdown(token.slice(2, -2), tokenOffset + 2, animatedFrom)}
        </strong>,
      )
    } else {
      nodes.push(
        <em key={`em-${tokenOffset}`}>
          {renderInlineMarkdown(token.slice(1, -1), tokenOffset + 1, animatedFrom)}
        </em>,
      )
    }

    cursor = match.index + token.length
  }

  if (cursor < source.length) {
    nodes.push(...renderPlainChemistry(source.slice(cursor), offset + cursor, animatedFrom))
  }

  return nodes
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function normalizeTableCells(cells: string[], columnCount: number) {
  if (cells.length === columnCount) {
    return cells
  }

  if (cells.length < columnCount) {
    return [...cells, ...Array.from({ length: columnCount - cells.length }, () => "")]
  }

  return [...cells.slice(0, columnCount - 1), cells.slice(columnCount - 1).join(" | ")]
}

function isTableRow(line: string) {
  const cells = splitTableRow(line)

  return line.includes("|") && cells.length > 1 && cells.some((cell) => cell.length > 0)
}

function isDelimitedTableRow(line: string) {
  const trimmedLine = line.trim()

  return trimmedLine.startsWith("|") && trimmedLine.endsWith("|") && isTableRow(line)
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line)

  return cells.length > 1 && cells.every((cell) => /^:?-{2,}:?$/.test(cell))
}

function isTableStart(lines: string[], index: number) {
  const line = lines[index]
  const nextLine = lines[index + 1]

  if (!line || !nextLine || !isTableRow(line)) {
    return false
  }

  if (isTableSeparator(nextLine)) {
    const headerCellCount = splitTableRow(line).length
    const separatorCellCount = splitTableRow(nextLine).length

    return separatorCellCount >= Math.min(headerCellCount, 2)
  }

  return isDelimitedTableRow(line) && isDelimitedTableRow(nextLine)
}

function isOrderedListItem(line: string) {
  return /^\s*\d+\.\s+/.test(line)
}

function isUnorderedListItem(line: string) {
  return /^\s*[-*]\s+/.test(line)
}

export function MarkdownMessage({ content }: { content: string }) {
  const [openTableMenu, setOpenTableMenu] = useState<string | null>(null)
  const [closingTableMenu, setClosingTableMenu] = useState<string | null>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const previousContentLengthRef = useRef(content.length)
  const normalizedContent = normalizeMarkdownSource(content)
  const animatedFrom =
    content.length > previousContentLengthRef.current
      ? previousContentLengthRef.current
      : Number.POSITIVE_INFINITY
  const lines = normalizedContent.split("\n")
  const blocks: ReactNode[] = []
  let lineIndex = 0
  let offset = 0

  useEffect(() => {
    setOpenTableMenu(null)
    setClosingTableMenu(null)
  }, [content])

  useEffect(() => {
    previousContentLengthRef.current = content.length
  }, [content])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  function closeMenu(menuKey: string) {
    setClosingTableMenu(menuKey)
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpenTableMenu((current) => (current === menuKey ? null : current))
      setClosingTableMenu((current) => (current === menuKey ? null : current))
      closeTimeoutRef.current = null
    }, 200)
  }

  useEffect(() => {
    if (!openTableMenu) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu(openTableMenu)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)

    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [openTableMenu])

  async function copyTableMarkdown(markdown: string) {
    try {
      await navigator.clipboard.writeText(markdown)
      if (openTableMenu) {
        closeMenu(openTableMenu)
      }
    } catch {
      // Silently ignore clipboard failures for now.
    }
  }

  function downloadTableMarkdown(markdown: string, key: string) {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = `table-${key}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    if (openTableMenu) {
      closeMenu(openTableMenu)
    }
  }

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const currentOffset = offset

    if (!line.trim()) {
      blocks.push(<div aria-hidden="true" className="markdown-spacer" key={`space-${currentOffset}`} />)
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    if (/^\s*#{1,6}\s*$/.test(line)) {
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<hr className="markdown-rule" key={`rule-${currentOffset}`} />)
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    const codeFence = /^\s*```([\w-]+)?\s*$/.exec(line)
    if (codeFence) {
      const language = codeFence[1]?.trim()
      const codeOffset = currentOffset
      const codeLines: string[] = []

      lineIndex += 1
      offset += line.length + 1

      while (lineIndex < lines.length && !/^\s*```\s*$/.test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex])
        offset += lines[lineIndex].length + 1
        lineIndex += 1
      }

      if (lineIndex < lines.length) {
        offset += lines[lineIndex].length + 1
        lineIndex += 1
      }

      blocks.push(
        <div className="markdown-code-block" key={`codeblock-${codeOffset}`}>
          {language ? <div className="markdown-code-block-label">{language}</div> : null}
          <pre className="markdown-code-block-pre">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      )
      continue
    }

    const heading = parseHeading(line)
    if (heading) {
      const HeadingTag = `h${Math.min(heading[1].length, 3)}` as "h1" | "h2" | "h3"
      blocks.push(
        <HeadingTag className="markdown-heading" key={`heading-${currentOffset}`}>
          {renderInlineMarkdown(heading[2], currentOffset + heading[1].length + 1, animatedFrom)}
        </HeadingTag>,
      )
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    if (isTableStart(lines, lineIndex)) {
      const header = splitTableRow(line)
      const columnCount = header.length
      const tableOffset = currentOffset
      const rows: { cells: string[]; offset: number }[] = []
      const tableLines = [line]

      offset += line.length + 1

      const separatorLine = lines[lineIndex + 1]
      if (separatorLine && isTableSeparator(separatorLine)) {
        tableLines.push(separatorLine)
        lineIndex += 2
        offset += separatorLine.length + 1
      } else {
        lineIndex += 1
      }

      while (lineIndex < lines.length && isTableRow(lines[lineIndex])) {
        tableLines.push(lines[lineIndex])
        rows.push({ cells: normalizeTableCells(splitTableRow(lines[lineIndex]), columnCount), offset })
        offset += lines[lineIndex].length + 1
        lineIndex += 1
      }

      const tableMarkdown = tableLines.join("\n")
      const tableMenuKey = `table-${tableOffset}`

      blocks.push(
        <div className="markdown-table-block" key={`table-${tableOffset}`}>
          <div className="markdown-table-wrap">
            <table className="markdown-table">
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={`th-${tableOffset}-${cellIndex}`}>
                      {renderInlineMarkdown(cell, tableOffset + cellIndex, animatedFrom)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`tr-${row.offset}`}>
                    {header.map((_, cellIndex) => (
                      <td key={`td-${row.offset}-${cellIndex}`}>
                        {renderInlineMarkdown(row.cells[cellIndex] ?? "", row.offset + cellIndex, animatedFrom)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="markdown-table-actions">
            <button
              aria-expanded={openTableMenu === tableMenuKey}
              aria-haspopup="menu"
              className="markdown-table-menu-trigger"
              type="button"
              onClick={() => {
                if (openTableMenu === tableMenuKey) {
                  closeMenu(tableMenuKey)
                  return
                }

                if (closeTimeoutRef.current) {
                  window.clearTimeout(closeTimeoutRef.current)
                  closeTimeoutRef.current = null
                }

                setClosingTableMenu(null)
                setOpenTableMenu(tableMenuKey)
              }}
            >
              <Ellipsis className="h-4 w-4" />
            </button>
            {openTableMenu === tableMenuKey || closingTableMenu === tableMenuKey ? (
              <div
                className={cn(
                  "markdown-table-menu",
                  closingTableMenu === tableMenuKey && "markdown-table-menu-closing",
                )}
                role="menu"
              >
                <button
                  className="markdown-table-menu-item"
                  role="menuitem"
                  type="button"
                  onClick={() => downloadTableMarkdown(tableMarkdown, `${tableOffset}`)}
                >
                  <Download className="h-4 w-4" />
                  <span>Download as markdown</span>
                </button>
                <button
                  className="markdown-table-menu-item"
                  role="menuitem"
                  type="button"
                  onClick={() => void copyTableMarkdown(tableMarkdown)}
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy to clipboard</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>,
      )
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
          {renderInlineMarkdown(quoteLines.join("\n"), quoteOffset, animatedFrom)}
        </blockquote>,
      )
      continue
    }

    if (isUnorderedListItem(line)) {
      const items: ReactNode[] = []

      while (lineIndex < lines.length && isUnorderedListItem(lines[lineIndex])) {
        const item = lines[lineIndex]
        const marker = item.match(/^\s*[-*]\s+/)?.[0] ?? ""

        items.push(
          <li key={`li-${offset}`}>
            {renderInlineMarkdown(item.slice(marker.length), offset + marker.length, animatedFrom)}
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

    if (isOrderedListItem(line)) {
      const items: ReactNode[] = []
      const start = Number.parseInt(line.match(/^\s*(\d+)\./)?.[1] ?? "1", 10)

      while (lineIndex < lines.length && isOrderedListItem(lines[lineIndex])) {
        const item = lines[lineIndex]
        const marker = item.match(/^\s*\d+\.\s+/)?.[0] ?? ""
        const itemOffset = offset
        const itemBlocks: ReactNode[] = [
          <div key={`oli-title-${itemOffset}`}>{renderInlineMarkdown(item.slice(marker.length), offset + marker.length, animatedFrom)}</div>,
        ]

        offset += item.length + 1
        lineIndex += 1

        while (lineIndex < lines.length) {
          const nextLine = lines[lineIndex]

          if (!nextLine.trim()) {
            const followingLine = lines[lineIndex + 1]

            offset += nextLine.length + 1
            lineIndex += 1

            if (
              !followingLine ||
              isOrderedListItem(followingLine) ||
              isHeadingLine(followingLine) ||
              /^\s*---+\s*$/.test(followingLine) ||
              /^\s*```/.test(followingLine) ||
              isTableStart(lines, lineIndex) ||
              isUnorderedListItem(followingLine) ||
              /^\s*>\s+/.test(followingLine)
            ) {
              break
            }

            itemBlocks.push(
              <div aria-hidden="true" className="markdown-spacer" key={`oli-space-${offset}`} />,
            )
            continue
          }

          if (
            isOrderedListItem(nextLine) ||
            isHeadingLine(nextLine) ||
            /^\s*---+\s*$/.test(nextLine) ||
            /^\s*```/.test(nextLine) ||
            isTableStart(lines, lineIndex) ||
            isUnorderedListItem(nextLine) ||
            /^\s*>\s+/.test(nextLine)
          ) {
            break
          }

          const paragraphLines: string[] = []
          const paragraphOffset = offset

          while (
            lineIndex < lines.length &&
            lines[lineIndex].trim() &&
            !isOrderedListItem(lines[lineIndex]) &&
            !isHeadingLine(lines[lineIndex]) &&
            !/^\s*---+\s*$/.test(lines[lineIndex]) &&
            !/^\s*```/.test(lines[lineIndex]) &&
            !isTableStart(lines, lineIndex) &&
            !isUnorderedListItem(lines[lineIndex]) &&
            !/^\s*>\s+/.test(lines[lineIndex])
          ) {
            paragraphLines.push(lines[lineIndex])
            offset += lines[lineIndex].length + 1
            lineIndex += 1
          }

          itemBlocks.push(
            <p className="markdown-paragraph" key={`oli-paragraph-${paragraphOffset}`}>
              {renderInlineMarkdown(paragraphLines.join("\n"), paragraphOffset, animatedFrom)}
            </p>,
          )
        }

        items.push(<li key={`oli-${itemOffset}`}>{itemBlocks}</li>)
      }

      blocks.push(
        <ol className="markdown-list markdown-list-ordered" key={`ol-${currentOffset}`} start={start}>
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
      !isHeadingLine(lines[lineIndex]) &&
      !/^\s*---+\s*$/.test(lines[lineIndex]) &&
      !/^\s*```/.test(lines[lineIndex]) &&
      !isTableStart(lines, lineIndex) &&
      !isUnorderedListItem(lines[lineIndex]) &&
      !isOrderedListItem(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex])
      offset += lines[lineIndex].length + 1
      lineIndex += 1
    }

    blocks.push(
      <p className="markdown-paragraph" key={`p-${paragraphOffset}`}>
        {renderInlineMarkdown(paragraphLines.join("\n"), paragraphOffset, animatedFrom)}
      </p>,
    )
  }

  return (
    <div className="markdown-content" ref={rootRef}>
      {blocks}
    </div>
  )
}
