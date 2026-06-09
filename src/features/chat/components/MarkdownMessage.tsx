import { ReactNode } from "react"
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
  cdot: "·",
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

function renderInlineMarkdown(source: string, offset: number): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(<br\s*\/?>|`[^`]+`|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([^)]+\\\)|\*\*[^*]+\*\*|\*[^*]+\*)/gi
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      nodes.push(...renderText(source.slice(cursor, match.index)))
    }

    const token = match[0]
    const tokenOffset = offset + match.index

    if (/^<br\s*\/?>$/i.test(token)) {
      nodes.push(<br key={`br-${tokenOffset}`} />)
    } else if (token.startsWith("`")) {
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

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line)

  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isTableStart(lines: string[], index: number) {
  const line = lines[index]
  const nextLine = lines[index + 1]

  return Boolean(
    line?.includes("|") &&
      nextLine &&
      isTableSeparator(nextLine) &&
      splitTableRow(line).length === splitTableRow(nextLine).length,
  )
}

export function MarkdownMessage({ content }: { content: string }) {
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

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const HeadingTag = `h${Math.min(heading[1].length, 3)}` as "h1" | "h2" | "h3"
      blocks.push(
        <HeadingTag className="markdown-heading" key={`heading-${currentOffset}`}>
          {renderInlineMarkdown(heading[2], currentOffset + heading[1].length + 1)}
        </HeadingTag>,
      )
      lineIndex += 1
      offset += line.length + 1
      continue
    }

    if (isTableStart(lines, lineIndex)) {
      const header = splitTableRow(line)
      const tableOffset = currentOffset
      const rows: { cells: string[]; offset: number }[] = []

      offset += line.length + 1
      lineIndex += 2
      offset += lines[lineIndex - 1].length + 1

      while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
        rows.push({ cells: splitTableRow(lines[lineIndex]), offset })
        offset += lines[lineIndex].length + 1
        lineIndex += 1
      }

      blocks.push(
        <div className="markdown-table-wrap" key={`table-${tableOffset}`}>
          <table className="markdown-table">
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={`th-${tableOffset}-${cellIndex}`}>
                    {renderInlineMarkdown(cell, tableOffset + cellIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`tr-${row.offset}`}>
                  {header.map((_, cellIndex) => (
                    <td key={`td-${row.offset}-${cellIndex}`}>
                      {renderInlineMarkdown(row.cells[cellIndex] ?? "", row.offset + cellIndex)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
      !/^(#{1,6})\s+/.test(lines[lineIndex]) &&
      !/^\s*---+\s*$/.test(lines[lineIndex]) &&
      !isTableStart(lines, lineIndex) &&
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
