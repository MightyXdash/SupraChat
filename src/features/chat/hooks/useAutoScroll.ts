import { useCallback, useEffect, useRef, useState } from "react"
import {
  STREAM_SCROLL_JUMP_DURATION_MS,
  STREAM_SCROLL_SETTLE_DISTANCE_PX,
} from "@/features/chat/config/ui"

type AutoScrollOptions = {
  isGenerating: boolean
  reduceMotion: boolean
  streamScrollKey: string
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

function getLatestMessageElement(scrollElement: HTMLElement) {
  const messages = scrollElement.querySelectorAll<HTMLElement>(".chat-message-row")

  return messages.item(messages.length - 1)
}

function getLatestMessageScrollTop(scrollElement: HTMLElement) {
  const latestMessage = getLatestMessageElement(scrollElement)

  if (!latestMessage) {
    return 0
  }

  const paddingBottomPx =
    Number.parseFloat(window.getComputedStyle(scrollElement).paddingBottom) || 0

  return Math.max(
    0,
    latestMessage.offsetTop + latestMessage.offsetHeight + paddingBottomPx - scrollElement.clientHeight,
  )
}

export function useAutoScroll({
  reduceMotion,
  streamScrollKey,
}: AutoScrollOptions) {
  const [isJumpToLatestVisible, setIsJumpToLatestVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const jumpAnimationFrameRef = useRef<number | null>(null)

  const cancelJumpAnimation = useCallback(() => {
    if (jumpAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(jumpAnimationFrameRef.current)
      jumpAnimationFrameRef.current = null
    }
  }, [])

  const updateJumpToLatestVisibility = useCallback(() => {
    const scrollElement = scrollRef.current
    const latestMessage = scrollElement ? getLatestMessageElement(scrollElement) : null

    if (!scrollElement || !latestMessage) {
      setIsJumpToLatestVisible(false)
      return
    }

    const targetScrollTop = getLatestMessageScrollTop(scrollElement)

    setIsJumpToLatestVisible(
      targetScrollTop - scrollElement.scrollTop > STREAM_SCROLL_SETTLE_DISTANCE_PX,
    )
  }, [])

  const clearSubmitScrollSpace = useCallback(() => {
    return
  }, [])

  const scrollLatestUserTurnIntoView = useCallback(async () => {
    return
  }, [])

  const scrollToLatestTurn = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    cancelJumpAnimation()

    const startScrollTop = scrollElement.scrollTop
    const targetScrollTop = getLatestMessageScrollTop(scrollElement)
    const distance = targetScrollTop - startScrollTop

    if (Math.abs(distance) <= STREAM_SCROLL_SETTLE_DISTANCE_PX || reduceMotion) {
      scrollElement.scrollTop = targetScrollTop
      setIsJumpToLatestVisible(false)
      return
    }

    const startedAt = performance.now()

    const step = (now: number) => {
      const progress = clampNumber((now - startedAt) / STREAM_SCROLL_JUMP_DURATION_MS, 0, 1)
      const easedProgress = easeOutCubic(progress)

      scrollElement.scrollTop = startScrollTop + distance * easedProgress

      if (progress >= 1) {
        scrollElement.scrollTop = targetScrollTop
        jumpAnimationFrameRef.current = null
        setIsJumpToLatestVisible(false)
        return
      }

      jumpAnimationFrameRef.current = window.requestAnimationFrame(step)
    }

    jumpAnimationFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelJumpAnimation, reduceMotion])

  useEffect(() => {
    window.requestAnimationFrame(updateJumpToLatestVisibility)
  }, [streamScrollKey, updateJumpToLatestVisibility])

  useEffect(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    scrollElement.addEventListener("scroll", updateJumpToLatestVisibility, { passive: true })
    updateJumpToLatestVisibility()

    return () => {
      scrollElement.removeEventListener("scroll", updateJumpToLatestVisibility)
    }
  }, [updateJumpToLatestVisibility])

  useEffect(() => {
    return () => {
      cancelJumpAnimation()
    }
  }, [cancelJumpAnimation])

  return {
    clearSubmitScrollSpace,
    isJumpToLatestVisible,
    scrollLatestUserTurnIntoView,
    scrollRef,
    scrollToLatestTurn,
  }
}
