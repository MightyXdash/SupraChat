import { ReasoningBlock } from "@/features/chat/types"

type ReasoningSummaryProps = {
  blocks: ReasoningBlock[]
  isStreaming: boolean
}

export function ReasoningSummary({ blocks, isStreaming }: ReasoningSummaryProps) {
  if (blocks.length === 0 && !isStreaming) {
    return null
  }

  const latestBlock = blocks[blocks.length - 1] ?? null

  return (
    <div className="reasoning-summary" data-streaming={isStreaming || undefined}>
      <div className="reasoning-summary-header">
        <span className="reasoning-summary-label">
          {isStreaming ? "Thinking" : "Thought"}
        </span>
      </div>

      {latestBlock ? (
        <div className="reasoning-summary-cur-task">
          {latestBlock.cur_task}
        </div>
      ) : null}

      {blocks.length > 0 ? (
        <div className="reasoning-summary-chain">
          {blocks.map((block, index) => (
            <div
              key={`${block.title}-${index}`}
              className="reasoning-summary-block"
            >
              <div className="reasoning-summary-dot-line">
                <div className="reasoning-summary-dot" />
                {index < blocks.length - 1 ? (
                  <div className="reasoning-summary-line" />
                ) : null}
              </div>
              <div className="reasoning-summary-block-content">
                <div className="reasoning-summary-block-title">
                  {block.title}
                </div>
                <div className="reasoning-summary-block-summary">
                  {block.summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}