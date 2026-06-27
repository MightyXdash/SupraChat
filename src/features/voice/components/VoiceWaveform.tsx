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

const NULL_WAVEFORM = new Uint8Array(DEFAULT_BAR_COUNT).fill(128)

export function VoiceWaveform({
  data,
  barCount = DEFAULT_BAR_COUNT,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    function draw(current: Uint8Array) {
      const step = Math.max(1, Math.floor(current.length / barCount))
      const dpr = window.devicePixelRatio || 1
      const resolvedAccent = window
        .getComputedStyle(canvas)
        .getPropertyValue("--accent-primary")
        .trim() || "#c49a6c"

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barW = (width - (barCount - 1) * 1.5) / barCount
      const mid = height / 2

      for (let i = 0; i < barCount; i++) {
        const idx = Math.min(i * step, current.length - 1)
        const raw = current[idx] ?? 128
        const normalized = (raw - 128) / 128
        const barH = Math.max(1, Math.abs(normalized) * (height * 0.8))
        const x = i * (barW + 1.5)
        const y = mid - barH / 2

        ctx.fillStyle = resolvedAccent
        ctx.beginPath()
        ctx.roundRect(x * dpr, y * dpr, barW * dpr, barH * dpr, 2 * dpr)
        ctx.fill()
      }
    }

    draw(data ?? NULL_WAVEFORM)

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
