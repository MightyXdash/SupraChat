import { useRef, useEffect } from "react"

type VoiceWaveformProps = {
  data: Uint8Array | null
  barCount?: number
  width?: number
  height?: number
}

const DEFAULT_BAR_COUNT = 24
const DEFAULT_WIDTH = 20
const DEFAULT_HEIGHT = 18
const HISTORY_INTERVAL_MS = 50
const BAR_POP_DURATION_MS = 180
const BAR_GAP = 3
const MAX_BAR_WIDTH = 2.2

const NULL_WAVEFORM = new Uint8Array(DEFAULT_BAR_COUNT).fill(128)

type WaveformBar = {
  level: number
  bornAt: number
}

function getRmsLevel(data: Uint8Array) {
  if (data.length === 0) {
    return 0
  }

  let sumSquares = 0

  for (let index = 0; index < data.length; index += 1) {
    const normalized = (data[index] - 128) / 128
    sumSquares += normalized * normalized
  }

  return Math.min(1, Math.sqrt(sumSquares / data.length) * 3.6)
}

export function VoiceWaveform({
  data,
  barCount = DEFAULT_BAR_COUNT,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const historyRef = useRef<WaveformBar[]>([])
  const lastHistoryCommitRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function easeOutBack(progress: number) {
      const clamped = Math.max(0, Math.min(1, progress))
      const c1 = 1.12
      const c3 = c1 + 1

      return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2)
    }

    function draw(history: Array<WaveformBar | null>, now: number) {
      const dpr = window.devicePixelRatio || 1
      const styles = window.getComputedStyle(canvas)
      const configuredWaveColor = styles.getPropertyValue("--voice-wave-color").trim()
      const resolvedWaveColor =
        configuredWaveColor && !configuredWaveColor.includes("var(")
          ? configuredWaveColor
          : styles.getPropertyValue("--info").trim() || "#5b7da8"

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barW = Math.min(MAX_BAR_WIDTH, Math.max(1, (width - (barCount - 1) * BAR_GAP) / barCount))
      const totalBarWidth = barCount * barW + (barCount - 1) * BAR_GAP
      const startX = Math.max(0, (width - totalBarWidth) / 2)
      const mid = height / 2

      for (let i = 0; i < barCount; i++) {
        const bar = history[i]
        const level = bar?.level ?? 0
        const popProgress = bar ? (now - bar.bornAt) / BAR_POP_DURATION_MS : 1
        const popScale = easeOutBack(popProgress)
        const targetBarH = Math.max(2, level * (height * 0.92))
        const barH = Math.max(2, targetBarH * popScale)
        const x = startX + i * (barW + BAR_GAP)
        const y = mid - barH / 2

        ctx.fillStyle = resolvedWaveColor
        ctx.beginPath()
        ctx.roundRect(x * dpr, y * dpr, barW * dpr, barH * dpr, 2 * dpr)
        ctx.fill()
      }

    }

    if (!data) {
      historyRef.current = []
      lastHistoryCommitRef.current = 0
    } else {
      const now = performance.now()

      if (
        historyRef.current.length === 0 ||
        now - lastHistoryCommitRef.current >= HISTORY_INTERVAL_MS
      ) {
        historyRef.current = [
          ...historyRef.current,
          {
            level: getRmsLevel(data),
            bornAt: now,
          },
        ].slice(-barCount)
        lastHistoryCommitRef.current = now
      }
    }

    const paddedHistory = [
      ...Array(Math.max(0, barCount - historyRef.current.length)).fill(null),
      ...historyRef.current,
    ]

    const fallbackLevel = getRmsLevel(NULL_WAVEFORM)
    const fallbackHistory = new Array(barCount).fill(null).map(() => ({
      level: fallbackLevel,
      bornAt: 0,
    }))
    const render = () => {
      const frameNow = performance.now()
      draw(data ? paddedHistory : fallbackHistory, frameNow)

      if (
        data &&
        historyRef.current.some((bar) => frameNow - bar.bornAt < BAR_POP_DURATION_MS)
      ) {
        animFrameRef.current = requestAnimationFrame(render)
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    render()

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [data, barCount, width, height])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="voice-waveform-canvas"
      height={height}
      style={{ width, height }}
      width={width}
    />
  )
}
