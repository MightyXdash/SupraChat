import { ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronRight, Copy, Download, Ellipsis, Lightbulb, Zap } from "lucide-react"
import { chatRuntimeConfig } from "@/features/chat/config/runtime"
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

type StreamAnimationRange = {
  end: number
  expiresAt: number
  start: number
}

const FAST_REASONING_THRESHOLD_MS = 3850
const MOMENT_REASONING_THRESHOLD_MS = 10000

function renderText(
  source: string,
  offset = 0,
  animatedFrom = Number.POSITIVE_INFINITY,
  visibleUntil = Number.POSITIVE_INFINITY,
): ReactNode[] {
  if (!source) {
    return []
  }

  return Array.from(source).flatMap((character, index) => {
    const characterOffset = offset + index

    if (characterOffset >= visibleUntil) {
      return []
    }

    return characterOffset >= animatedFrom ? (
      <span
        className="markdown-stream-character"
        key={`stream-char-${characterOffset}`}
      >
        {character}
      </span>
    ) : (
      character
    )
  })
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

function renderPlainChemistry(
  source: string,
  offset: number,
  animatedFrom: number,
  visibleUntil: number,
): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\b(?:[A-Z][a-z]?\d*){2,}\b/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      nodes.push(...renderText(source.slice(cursor, match.index), offset + cursor, animatedFrom, visibleUntil))
    }

    const formula = match[0]
    const formulaOffset = offset + match.index
    const visibleFormula = formula.slice(0, Math.max(0, visibleUntil - formulaOffset))
    const formulaNodes: ReactNode[] = []

    for (let index = 0; index < visibleFormula.length; index += 1) {
      const character = visibleFormula[index]

      if (/\d/.test(character)) {
        let digits = character

        while (index + 1 < visibleFormula.length && /\d/.test(visibleFormula[index + 1])) {
          digits += visibleFormula[index + 1]
          index += 1
        }

        formulaNodes.push(<sub key={`chem-sub-${formulaOffset}-${index}`}>{digits}</sub>)
      } else {
        formulaNodes.push(character)
      }
    }

    if (formulaNodes.length > 0) {
      nodes.push(
        <span className="latex-expression" key={`chem-${formulaOffset}`}>
          {formulaNodes}
        </span>,
      )
    }
    cursor = match.index + formula.length
  }

  if (cursor < source.length) {
    nodes.push(...renderText(source.slice(cursor), offset + cursor, animatedFrom, visibleUntil))
  }

  return nodes
}

type InlineMarkdownToken =
  | {
      body: string
      end: number
      start: number
      type:
        | "code"
        | "displayMath"
        | "inlineMath"
        | "strong"
        | "emphasis"
        | "plainStrongCandidate"
        | "plainEmphasisCandidate"
    }
  | { end: number; start: number; type: "break" }

function findClosingMarker(source: string, marker: string, startIndex: number) {
  let cursor = startIndex

  while (cursor < source.length) {
    const nextIndex = source.indexOf(marker, cursor)

    if (nextIndex === -1) {
      return -1
    }

    if (nextIndex === 0 || source[nextIndex - 1] !== "\\") {
      return nextIndex
    }

    cursor = nextIndex + marker.length
  }

  return -1
}

function canOpenEmphasis(source: string, start: number, markerLength: number) {
  const nextCharacter = source[start + markerLength]

  return !!nextCharacter && !/\s/.test(nextCharacter)
}

function readInlineMarkdownToken(source: string, start: number): InlineMarkdownToken | null {
  const remaining = source.slice(start)
  const breakMatch = /^<br\s*\/?>/i.exec(remaining)

  if (breakMatch) {
    return { end: start + breakMatch[0].length, start, type: "break" }
  }

  if (source[start] === "`") {
    const end = findClosingMarker(source, "`", start + 1)

    return end === -1
      ? null
      : { body: source.slice(start + 1, end), end: end + 1, start, type: "code" }
  }

  if (source.startsWith("$$", start)) {
    const end = findClosingMarker(source, "$$", start + 2)

    return end === -1
      ? null
      : { body: source.slice(start + 2, end), end: end + 2, start, type: "displayMath" }
  }

  if (source.startsWith("\\[", start)) {
    const end = findClosingMarker(source, "\\]", start + 2)

    return end === -1
      ? null
      : { body: source.slice(start + 2, end), end: end + 2, start, type: "displayMath" }
  }

  if (source[start] === "$") {
    const end = findClosingMarker(source, "$", start + 1)

    return end === -1 || source.slice(start + 1, end).includes("\n")
      ? null
      : { body: source.slice(start + 1, end), end: end + 1, start, type: "inlineMath" }
  }

  if (source.startsWith("\\(", start)) {
    const end = findClosingMarker(source, "\\)", start + 2)

    return end === -1
      ? null
      : { body: source.slice(start + 2, end), end: end + 2, start, type: "inlineMath" }
  }

  if (source.startsWith("**", start) && canOpenEmphasis(source, start, 2)) {
    const end = findClosingMarker(source, "**", start + 2)

    return end === -1
      ? {
          body: source.slice(start + 2),
          end: source.length,
          start,
          type: "plainStrongCandidate",
        }
      : { body: source.slice(start + 2, end), end: end + 2, start, type: "strong" }
  }

  if (source[start] === "*" && !source.startsWith("**", start) && canOpenEmphasis(source, start, 1)) {
    const end = findClosingMarker(source, "*", start + 1)

    return end === -1
      ? {
          body: source.slice(start + 1),
          end: source.length,
          start,
          type: "plainEmphasisCandidate",
        }
      : { body: source.slice(start + 1, end), end: end + 1, start, type: "emphasis" }
  }

  return null
}

function findNextInlineMarkdownToken(source: string, startIndex: number): InlineMarkdownToken | null {
  for (let index = startIndex; index < source.length; index += 1) {
    const token = readInlineMarkdownToken(source, index)

    if (token) {
      return token
    }
  }

  return null
}

function renderInlineMarkdown(
  source: string,
  offset: number,
  animatedFrom = Number.POSITIVE_INFINITY,
  visibleUntil = Number.POSITIVE_INFINITY,
): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0

  while (cursor < source.length) {
    const token = findNextInlineMarkdownToken(source, cursor)

    if (!token) {
      break
    }

    if (token.start > cursor) {
      nodes.push(...renderPlainChemistry(source.slice(cursor, token.start), offset + cursor, animatedFrom, visibleUntil))
    }

    if (offset + token.start >= visibleUntil) {
      break
    }

    const tokenOffset = offset + token.start

    if (token.type === "break") {
      nodes.push(<br key={`br-${tokenOffset}`} />)
    } else if (token.type === "code") {
      nodes.push(
        <code className="markdown-code" key={`code-${tokenOffset}`}>
          {renderText(token.body, tokenOffset + 1, animatedFrom, visibleUntil)}
        </code>,
      )
    } else if (token.type === "displayMath") {
      if (token.end + offset <= visibleUntil) {
        nodes.push(<MathExpression display key={`math-${tokenOffset}`} source={token.body} />)
      }
    } else if (token.type === "inlineMath") {
      if (token.end + offset <= visibleUntil) {
        nodes.push(<MathExpression key={`math-${tokenOffset}`} source={token.body} />)
      }
    } else if (token.type === "strong") {
      const innerAnimatedFrom = animatedFrom === Number.POSITIVE_INFINITY ? animatedFrom : Math.min(animatedFrom, tokenOffset + 2)
      nodes.push(
        <strong key={`strong-${tokenOffset}`}>
          {renderInlineMarkdown(token.body, tokenOffset + 2, innerAnimatedFrom, visibleUntil)}
        </strong>,
      )
    } else if (token.type === "emphasis") {
      const innerAnimatedFrom = animatedFrom === Number.POSITIVE_INFINITY ? animatedFrom : Math.min(animatedFrom, tokenOffset + 1)
      nodes.push(
        <em key={`em-${tokenOffset}`}>
          {renderInlineMarkdown(token.body, tokenOffset + 1, innerAnimatedFrom, visibleUntil)}
        </em>,
      )
    } else {
      const markerLength = token.type === "plainStrongCandidate" ? 2 : 1
      const innerAnimatedFrom = animatedFrom === Number.POSITIVE_INFINITY
        ? animatedFrom
        : Math.min(animatedFrom, tokenOffset + markerLength)

      nodes.push(
        ...renderInlineMarkdown(
          token.body,
          tokenOffset + markerLength,
          innerAnimatedFrom,
          visibleUntil,
        ),
      )
    }

    cursor = token.end
  }

  if (cursor < source.length) {
    nodes.push(...renderPlainChemistry(source.slice(cursor), offset + cursor, animatedFrom, visibleUntil))
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

function splitOnThinking(content: string): { reasoning: string; answer: string } {
  let reasoning = ""
  let answer = ""
  let isInsideReasoning = false
  let hasReasoningMarker = false
  let lastIndex = 0
  const markerRegex = /<suprachat-think>|<\/suprachat-think>|<think>|<\/think>/g
  let markerMatch: RegExpExecArray | null

  while ((markerMatch = markerRegex.exec(content)) !== null) {
    const textBeforeMarker = content.slice(lastIndex, markerMatch.index)
    const marker = markerMatch[0]

    if (isInsideReasoning) {
      reasoning += textBeforeMarker
    } else {
      answer += textBeforeMarker
    }

    hasReasoningMarker = true
    isInsideReasoning = marker === "<suprachat-think>" || marker === "<think>"
    lastIndex = markerMatch.index + marker.length
  }

  if (!hasReasoningMarker) {
    return { reasoning: "", answer: content }
  }

  const remainingText = content.slice(lastIndex)
  if (isInsideReasoning) {
    reasoning += remainingText
  } else {
    answer += remainingText
  }

  return { reasoning: reasoning.trim(), answer: answer.trim() }
}

function buildMarkdownBlocks(
  content: string,
  animatedFrom: number,
  visibleUntil = content.length,
): ReactNode[] {
  const normalized = normalizeMarkdownSource(content)
  const lines = normalized.split("\n")
  const blocks: ReactNode[] = []
  let lineIndex = 0
  let offset = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const currentOffset = offset

    if (currentOffset >= visibleUntil) {
      break
    }

    if (!line.trim()) {
      blocks.push(<div aria-hidden="true" className="markdown-spacer" key={`s-${currentOffset}`} />)
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
      blocks.push(<hr className="markdown-rule" key={`r-${currentOffset}`} />)
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    const codeFence = /^\s*```([\w-]+)?\s*$/.exec(line)
    if (codeFence) {
      const language = codeFence[1]?.trim()
      const codeOffset = currentOffset
      const codeBodyOffset = offset + line.length + 1
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
        <div className="markdown-code-block" key={`cb-${codeOffset}`}>
          {language ? <div className="markdown-code-block-label">{language}</div> : null}
          <pre className="markdown-code-block-pre">
            <code>{renderText(codeLines.join("\n"), codeBodyOffset, animatedFrom, visibleUntil)}</code>
          </pre>
        </div>,
      )
      continue
    }

    const heading = parseHeading(line)
    if (heading) {
      const HeadingTag = `h${Math.min(heading[1].length, 3)}` as "h1" | "h2" | "h3"
      blocks.push(
        <HeadingTag className="markdown-heading" key={`h-${currentOffset}`}>
          {renderInlineMarkdown(heading[2], currentOffset + heading[1].length + 1, animatedFrom, visibleUntil)}
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

      offset += line.length + 1

      const separatorLine = lines[lineIndex + 1]
      if (separatorLine && isTableSeparator(separatorLine)) {
        lineIndex += 2
        offset += separatorLine.length + 1
      } else {
        lineIndex += 1
      }

      while (lineIndex < lines.length && isTableRow(lines[lineIndex])) {
        rows.push({ cells: normalizeTableCells(splitTableRow(lines[lineIndex]), columnCount), offset })
        offset += lines[lineIndex].length + 1
        lineIndex += 1
      }

      blocks.push(
        <div className="markdown-table-block" key={`t-${tableOffset}`}>
          <div className="markdown-table-wrap">
            <table className="markdown-table">
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={`th-${tableOffset}-${cellIndex}`}>
                      {renderInlineMarkdown(cell, tableOffset + cellIndex, animatedFrom, visibleUntil)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.filter((row) => row.offset < visibleUntil).map((row) => (
                  <tr key={`tr-${row.offset}`}>
                    {header.map((_, cellIndex) => (
                      <td key={`td-${row.offset}-${cellIndex}`}>
                        {renderInlineMarkdown(row.cells[cellIndex] ?? "", row.offset + cellIndex, animatedFrom, visibleUntil)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      )
      continue
    }

    const displayMath = /^\s*(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])\s*$/.exec(line)
    if (displayMath) {
      if (currentOffset + line.length <= visibleUntil) {
        blocks.push(
          <div className="latex-display-line" key={`m-${currentOffset}`}>
            <MathExpression display source={displayMath[2]} />
          </div>,
        )
      }
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
        <blockquote className="markdown-quote" key={`q-${quoteOffset}`}>
          {renderInlineMarkdown(quoteLines.join("\n"), quoteOffset, animatedFrom, visibleUntil)}
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
            {renderInlineMarkdown(item.slice(marker.length), offset + marker.length, animatedFrom, visibleUntil)}
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
          <div key={`oli-title-${itemOffset}`}>
            {renderInlineMarkdown(item.slice(marker.length), offset + marker.length, animatedFrom, visibleUntil)}
          </div>,
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
              {renderInlineMarkdown(paragraphLines.join("\n"), paragraphOffset, animatedFrom, visibleUntil)}
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
        {renderInlineMarkdown(paragraphLines.join("\n"), paragraphOffset, animatedFrom, visibleUntil)}
      </p>,
    )
  }

  return blocks
}

export function MarkdownMessage({
  content,
  isGenerating,
  reasoningDurationMs,
}: {
  content: string
  isGenerating?: boolean
  reasoningDurationMs?: number | null
}) {
  const [openTableMenu, setOpenTableMenu] = useState<string | null>(null)
  const [closingTableMenu, setClosingTableMenu] = useState<string | null>(null)
  const [isReasoningPanelOpen, setIsReasoningPanelOpen] = useState(false)
  const [, setStreamAnimationRevision] = useState(0)
  const closeTimeoutRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const previousContentLengthRef = useRef(content.length)
  const { reasoning, answer } = splitOnThinking(content)
  const markdownLookaheadCharacters = chatRuntimeConfig.stream.markdownLookaheadCharacters
  const visibleAnswer =
    isGenerating && answer.length > 0
      ? answer.slice(0, Math.max(0, answer.length - markdownLookaheadCharacters))
      : answer
  const hasAnswerStarted = answer.length > 0
  const previousAnswerLengthRef = useRef(visibleAnswer.length)
  const streamAnimationRangesRef = useRef<StreamAnimationRange[]>([])
  const streamAnimationTimeoutRef = useRef<number | null>(null)
  const isStreaming = isGenerating || content.length > previousContentLengthRef.current
  const isThinkingActive = isStreaming && !hasAnswerStarted
  const [thinkingDurationMs, setThinkingDurationMs] = useState<number | null>(reasoningDurationMs ?? null)
  const thinkingStartedAtRef = useRef<number | null>(null)
  const wasThinkingRef = useRef(false)
  const streamAnimationDuration = chatRuntimeConfig.stream.characterFadeMs
  const renderTime = performance.now()
  const activeAnimationStart = streamAnimationRangesRef.current.reduce(
    (start, range) => range.expiresAt > renderTime ? Math.min(start, range.start) : start,
    Number.POSITIVE_INFINITY,
  )
  const newAnswerStart =
    visibleAnswer.length > previousAnswerLengthRef.current
      ? Math.max(0, previousAnswerLengthRef.current)
      : Number.POSITIVE_INFINITY
  const animatedFrom = Math.min(activeAnimationStart, newAnswerStart)
  const answerBlocks = buildMarkdownBlocks(answer, animatedFrom, visibleAnswer.length)

  const allParagraphs = reasoning ? reasoning.split(/\n\n+/).filter(Boolean) : []
  const showThinkingToggle = !!reasoning || isThinkingActive
  const hasReasoningTraces = allParagraphs.length > 0

  function scheduleStreamAnimationCleanup() {
    if (streamAnimationTimeoutRef.current) {
      window.clearTimeout(streamAnimationTimeoutRef.current)
      streamAnimationTimeoutRef.current = null
    }

    const now = performance.now()
    streamAnimationRangesRef.current = streamAnimationRangesRef.current.filter(
      (range) => range.expiresAt > now,
    )

    const nextRange = streamAnimationRangesRef.current.reduce<StreamAnimationRange | null>(
      (next, range) => !next || range.expiresAt < next.expiresAt ? range : next,
      null,
    )

    if (!nextRange) {
      setStreamAnimationRevision((revision) => revision + 1)
      return
    }

    streamAnimationTimeoutRef.current = window.setTimeout(() => {
      streamAnimationRangesRef.current = streamAnimationRangesRef.current.filter(
        (range) => range.expiresAt > performance.now(),
      )
      streamAnimationTimeoutRef.current = null
      setStreamAnimationRevision((revision) => revision + 1)
      scheduleStreamAnimationCleanup()
    }, Math.max(0, nextRange.expiresAt - now))
  }

  useEffect(() => {
    setOpenTableMenu(null)
    setClosingTableMenu(null)
  }, [content])

  useEffect(() => {
    const previousAnswerLength = previousAnswerLengthRef.current

    if (visibleAnswer.length < previousAnswerLength) {
      streamAnimationRangesRef.current = []
      if (streamAnimationTimeoutRef.current) {
        window.clearTimeout(streamAnimationTimeoutRef.current)
        streamAnimationTimeoutRef.current = null
      }
    }

    if (visibleAnswer.length > previousAnswerLength) {
      const now = performance.now()
      streamAnimationRangesRef.current = [
        ...streamAnimationRangesRef.current.filter((range) => range.expiresAt > now),
        {
          end: visibleAnswer.length,
          expiresAt: now + streamAnimationDuration,
          start: previousAnswerLength,
        },
      ]
      scheduleStreamAnimationCleanup()
    }

    previousContentLengthRef.current = content.length
    previousAnswerLengthRef.current = visibleAnswer.length
  }, [content, streamAnimationDuration, visibleAnswer.length])

  useEffect(() => {
    if (!hasReasoningTraces) {
      setIsReasoningPanelOpen(false)
    }
  }, [hasReasoningTraces])

  useEffect(() => {
    if (typeof reasoningDurationMs === "number") {
      setThinkingDurationMs(reasoningDurationMs)
      return
    }

    if (isThinkingActive) {
      setThinkingDurationMs(null)
    }
  }, [isThinkingActive, reasoningDurationMs])

  useEffect(() => {
    const isThinking = (!!reasoning || isGenerating) && !hasAnswerStarted

    if (isThinking && !wasThinkingRef.current) {
      thinkingStartedAtRef.current = performance.now()
    }

    if (!isThinking && wasThinkingRef.current && thinkingStartedAtRef.current !== null) {
      setThinkingDurationMs(performance.now() - thinkingStartedAtRef.current)
      thinkingStartedAtRef.current = null
    }

    wasThinkingRef.current = isThinking
  }, [reasoning, isGenerating, hasAnswerStarted])

  useEffect(() => {
    if (!isReasoningPanelOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsReasoningPanelOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isReasoningPanelOpen])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
      }

      if (streamAnimationTimeoutRef.current) {
        window.clearTimeout(streamAnimationTimeoutRef.current)
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

  return (
    <div className="markdown-content" ref={rootRef}>
      {showThinkingToggle ? (
        <>
          <button
            className="markdown-thinking-toggle"
            type="button"
            onClick={() => setIsReasoningPanelOpen(prev => !prev)}
            aria-expanded={isReasoningPanelOpen}
            aria-haspopup="dialog"
            disabled={!hasReasoningTraces}
          >
            {thinkingDurationMs !== null || hasReasoningTraces && !isThinkingActive ? (
              <>
                {thinkingDurationMs !== null && thinkingDurationMs < FAST_REASONING_THRESHOLD_MS ? (
                  <Zap className="markdown-thinking-lamp-icon markdown-thinking-energy-icon" aria-hidden="true" />
                ) : (
                  <Lightbulb className="markdown-thinking-lamp-icon" aria-hidden="true" />
                )}
                <span className="markdown-thinking-label">
                  {isReasoningPanelOpen
                    ? "Press to close"
                    : thinkingDurationMs === null
                      ? "Thought"
                      : thinkingDurationMs < FAST_REASONING_THRESHOLD_MS
                      ? "Fast Reasoning"
                      : thinkingDurationMs < MOMENT_REASONING_THRESHOLD_MS
                      ? "Thought for a moment"
                      : `Thought for ${Math.round(thinkingDurationMs / 1000)} seconds`}
                </span>
              </>
            ) : (
              <span className={cn("markdown-thinking-label", isThinkingActive && "markdown-thinking-label-streaming")}>
                {isReasoningPanelOpen ? "Press to close" : "Thinking"}
              </span>
            )}
            {hasReasoningTraces ? <ChevronRight className="markdown-thinking-icon" aria-hidden="true" /> : null}
          </button>
          {isReasoningPanelOpen && hasReasoningTraces
            ? createPortal(
              <aside
                aria-label="Thought traces"
                aria-modal="false"
                className="thought-trace-panel"
                role="dialog"
              >
                <div className="thought-trace-panel-body">
                  {allParagraphs.map((para, index) => (
                    <section
                      className="thought-trace-item"
                      key={`trace-${index}-${para.slice(0, 20)}`}
                    >
                      <div className="thought-trace-content">
                        {buildMarkdownBlocks(para, Number.POSITIVE_INFINITY)}
                      </div>
                    </section>
                  ))}
                </div>
              </aside>,
              document.body,
            )
            : null}
        </>
      ) : null}
      {answerBlocks}
    </div>
  )
}
