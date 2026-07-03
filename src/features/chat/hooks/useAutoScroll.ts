import { useCallback, useEffect, useRef, useState } from "react"
import {
  STREAM_SCROLL_BOTTOM_SPACE_PX,
  STREAM_SCROLL_JUMP_DURATION_MS,
  STREAM_SCROLL_MAX_SPEED_PX_PER_SECOND,
  STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND,
  STREAM_SCROLL_PREDICTION_MS,
  STREAM_SCROLL_PROGRAMMATIC_GUARD_MS,
  STREAM_SCROLL_REENGAGE_DISTANCE_PX,
  STREAM_SCROLL_RESTORE_DELAY_MS,
  STREAM_SCROLL_RESTORE_MAX_DURATION_MS,
  STREAM_SCROLL_RESTORE_MIN_DURATION_MS,
  STREAM_SCROLL_SPEED_EASE,
  STREAM_SCROLL_SETTLE_DISTANCE_PX,
  STREAM_SCROLL_TARGET_DEADBAND_PX,
  SUBMIT_SCROLL_SETTLE_MS,
  SUBMIT_SCROLL_TOP_OFFSET_PX,
} from "@/features/chat/config/ui"

type AutoScrollOptions = {
  isGenerating: boolean
  reduceMotion: boolean
  streamScrollKey: string
}

function waitForScrollSettle(scrollElement: HTMLElement) {
  return new Promise<void>((resolve) => {
    let fallbackTimeout: number | undefined

    function finish() {
      window.clearTimeout(fallbackTimeout)
      scrollElement.removeEventListener("scrollend", finish)
      resolve()
    }

    scrollElement.addEventListener("scrollend", finish, { once: true })
    fallbackTimeout = window.setTimeout(finish, SUBMIT_SCROLL_SETTLE_MS)
  })
}

function getPaddingBottomPx(scrollElement: HTMLElement) {
  return Number.parseFloat(window.getComputedStyle(scrollElement).paddingBottom) || 0
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

function getLiveMessageScrollTop(scrollElement: HTMLElement, paddingBottomPx: number) {
  const latestMessage = getLatestMessageElement(scrollElement)

  if (!latestMessage) {
    return 0
  }

  return Math.max(
    0,
    latestMessage.offsetTop + latestMessage.offsetHeight + paddingBottomPx - scrollElement.clientHeight,
  )
}

export function useAutoScroll({
  isGenerating,
  reduceMotion,
  streamScrollKey,
}: AutoScrollOptions) {
  const [isJumpToLatestVisible, setIsJumpToLatestVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const jumpAnimationFrameRef = useRef<number | null>(null)
  const restoreAnimationFrameRef = useRef<number | null>(null)
  const restoreDelayTimeoutRef = useRef<number | null>(null)
  const streamAnimationFrameRef = useRef<number | null>(null)
  const streamFollowEnabledRef = useRef(true)
  const streamLastFrameAtRef = useRef<number | null>(null)
  const streamLastTargetAtRef = useRef<number | null>(null)
  const streamLastTargetScrollTopRef = useRef<number | null>(null)
  const streamTargetScrollTopRef = useRef<number | null>(null)
  const streamVelocityPxPerSecondRef = useRef(0)
  const isGeneratingRef = useRef(isGenerating)
  const isProgrammaticScrollRef = useRef(false)
  const lastProgrammaticScrollAtRef = useRef(0)
  const previousIsGeneratingRef = useRef(isGenerating)
  const streamPaddingSpaceRef = useRef<{
    inlinePaddingBottom: string
    paddingBottomPx: number
  } | null>(null)
  const submitScrollSpaceRef = useRef<{
    inlinePaddingBottom: string
    paddingBottomPx: number
  } | null>(null)

  const getBaselinePaddingBottom = useCallback((scrollElement: HTMLElement) => {
    const restoredPaddingBottom =
      submitScrollSpaceRef.current?.paddingBottomPx ??
      streamPaddingSpaceRef.current?.paddingBottomPx ??
      getPaddingBottomPx(scrollElement)

    return Math.max(
      restoredPaddingBottom,
      isGeneratingRef.current ? STREAM_SCROLL_BOTTOM_SPACE_PX : restoredPaddingBottom,
    )
  }, [])

  const isNearLiveMessageEdge = useCallback(
    (scrollElement: HTMLElement) => {
      const targetScrollTop = getLiveMessageScrollTop(
        scrollElement,
        getBaselinePaddingBottom(scrollElement),
      )

      return targetScrollTop - scrollElement.scrollTop <= STREAM_SCROLL_REENGAGE_DISTANCE_PX
    },
    [getBaselinePaddingBottom],
  )

  const updateJumpToLatestVisibility = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement || !getLatestMessageElement(scrollElement)) {
      setIsJumpToLatestVisible(false)
      return
    }

    setIsJumpToLatestVisible(!isNearLiveMessageEdge(scrollElement))
  }, [isNearLiveMessageEdge])

  const markProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = true
    lastProgrammaticScrollAtRef.current = performance.now()
  }, [])

  const isProgrammaticScrollActive = useCallback(() => (
    isProgrammaticScrollRef.current ||
    performance.now() - lastProgrammaticScrollAtRef.current < STREAM_SCROLL_PROGRAMMATIC_GUARD_MS
  ), [])

  const releaseProgrammaticScroll = useCallback(() => {
    window.setTimeout(() => {
      if (performance.now() - lastProgrammaticScrollAtRef.current >= STREAM_SCROLL_PROGRAMMATIC_GUARD_MS) {
        isProgrammaticScrollRef.current = false
      }
    }, STREAM_SCROLL_PROGRAMMATIC_GUARD_MS)
  }, [])

  const cancelStreamAnimation = useCallback(() => {
    if (streamAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(streamAnimationFrameRef.current)
      streamAnimationFrameRef.current = null
    }

    streamLastFrameAtRef.current = null
    streamLastTargetAtRef.current = null
    streamLastTargetScrollTopRef.current = null
    streamTargetScrollTopRef.current = null
    streamVelocityPxPerSecondRef.current = 0
    isProgrammaticScrollRef.current = false
  }, [])

  const cancelJumpAnimation = useCallback(() => {
    if (jumpAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(jumpAnimationFrameRef.current)
      jumpAnimationFrameRef.current = null
    }
  }, [])

  const cancelRestoreAnimation = useCallback(() => {
    if (restoreDelayTimeoutRef.current !== null) {
      window.clearTimeout(restoreDelayTimeoutRef.current)
      restoreDelayTimeoutRef.current = null
    }

    if (restoreAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreAnimationFrameRef.current)
      restoreAnimationFrameRef.current = null
    }
  }, [])

  const finishStreamScrollSpaceRestore = useCallback((
    scrollElement: HTMLElement,
    inlinePaddingBottom: string,
  ) => {
    scrollElement.style.paddingBottom = inlinePaddingBottom
    streamPaddingSpaceRef.current = null
    restoreAnimationFrameRef.current = null
    releaseProgrammaticScroll()
  }, [releaseProgrammaticScroll])

  const restoreStreamScrollSpace = useCallback((startingVelocityPxPerSecond = 0, immediate = false) => {
    const scrollElement = scrollRef.current

    if (!scrollElement || streamPaddingSpaceRef.current === null) {
      return
    }

    const { inlinePaddingBottom, paddingBottomPx } = streamPaddingSpaceRef.current
    const currentPaddingBottomPx = getPaddingBottomPx(scrollElement)
    const reducedScrollHeight = scrollElement.scrollHeight - currentPaddingBottomPx + paddingBottomPx
    const restoredMaxScrollTop = Math.max(0, reducedScrollHeight - scrollElement.clientHeight)

    cancelRestoreAnimation()

    if (immediate || reduceMotion || scrollElement.scrollTop <= restoredMaxScrollTop) {
      if (scrollElement.scrollTop > restoredMaxScrollTop) {
        markProgrammaticScroll()
        scrollElement.scrollTop = restoredMaxScrollTop
        releaseProgrammaticScroll()
      }

      finishStreamScrollSpaceRestore(scrollElement, inlinePaddingBottom)
      return
    }

    const startScrollTop = scrollElement.scrollTop
    const distance = startScrollTop - restoredMaxScrollTop
    const startingVelocity = clampNumber(
      startingVelocityPxPerSecond || STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND,
      STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND,
      STREAM_SCROLL_MAX_SPEED_PX_PER_SECOND,
    )
    const durationMs = clampNumber(
      distance > 0 ? 3000 * (distance / startingVelocity) : STREAM_SCROLL_RESTORE_MIN_DURATION_MS,
      STREAM_SCROLL_RESTORE_MIN_DURATION_MS,
      STREAM_SCROLL_RESTORE_MAX_DURATION_MS,
    )
    const startedAt = performance.now()

    const step = (now: number) => {
      const progress = clampNumber((now - startedAt) / durationMs, 0, 1)
      const easedProgress = easeOutCubic(progress)

      markProgrammaticScroll()
      scrollElement.scrollTop = startScrollTop - distance * easedProgress

      if (progress >= 1) {
        scrollElement.scrollTop = restoredMaxScrollTop
        finishStreamScrollSpaceRestore(scrollElement, inlinePaddingBottom)
        return
      }

      releaseProgrammaticScroll()
      restoreAnimationFrameRef.current = window.requestAnimationFrame(step)
    }

    restoreAnimationFrameRef.current = window.requestAnimationFrame(step)
  }, [
    cancelRestoreAnimation,
    finishStreamScrollSpaceRestore,
    reduceMotion,
    releaseProgrammaticScroll,
    markProgrammaticScroll,
  ])

  const ensureStreamScrollSpace = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement || submitScrollSpaceRef.current !== null) {
      return
    }

    cancelRestoreAnimation()

    const currentPaddingBottomPx = getPaddingBottomPx(scrollElement)

    if (streamPaddingSpaceRef.current === null) {
      streamPaddingSpaceRef.current = {
        inlinePaddingBottom: scrollElement.style.paddingBottom,
        paddingBottomPx: currentPaddingBottomPx,
      }
    }

    const nextPaddingBottom = Math.max(
      streamPaddingSpaceRef.current.paddingBottomPx,
      STREAM_SCROLL_BOTTOM_SPACE_PX,
    )

    if (currentPaddingBottomPx < nextPaddingBottom) {
      scrollElement.style.paddingBottom = `${nextPaddingBottom}px`
    }
  }, [cancelRestoreAnimation])

  const animateStreamScroll = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement || !isGeneratingRef.current || !streamFollowEnabledRef.current) {
      cancelStreamAnimation()
      return
    }

    ensureStreamScrollSpace()

    if (!reduceMotion && streamAnimationFrameRef.current !== null) {
      return
    }

    const liveMessageScrollTop = getLiveMessageScrollTop(
      scrollElement,
      getBaselinePaddingBottom(scrollElement),
    )
    const nextTargetScrollTop = Math.max(scrollElement.scrollTop, liveMessageScrollTop)
    streamTargetScrollTopRef.current = nextTargetScrollTop
    streamLastTargetAtRef.current = performance.now()
    streamLastTargetScrollTopRef.current = liveMessageScrollTop

    if (reduceMotion) {
      markProgrammaticScroll()
      scrollElement.scrollTop = nextTargetScrollTop
      releaseProgrammaticScroll()
      return
    }

    const step = () => {
      const currentScrollElement = scrollRef.current

      if (!currentScrollElement || !isGeneratingRef.current || !streamFollowEnabledRef.current) {
        cancelStreamAnimation()
        return
      }

      const liveMessageScrollTop = getLiveMessageScrollTop(
        currentScrollElement,
        getBaselinePaddingBottom(currentScrollElement),
      )
      const now = performance.now()
      const lastFrameAt = streamLastFrameAtRef.current ?? now
      const elapsedSeconds = clampNumber((now - lastFrameAt) / 1000, 1 / 120, 0.12)
      const previousMeasuredTarget = streamLastTargetScrollTopRef.current
      const previousMeasuredAt = streamLastTargetAtRef.current ?? now

      streamLastFrameAtRef.current = now

      if (previousMeasuredTarget === null) {
        streamLastTargetAtRef.current = now
        streamLastTargetScrollTopRef.current = liveMessageScrollTop
      } else if (liveMessageScrollTop > previousMeasuredTarget) {
        const targetElapsedSeconds = Math.max((now - previousMeasuredAt) / 1000, 1 / 120)
        const sampledVelocity = clampNumber(
          (liveMessageScrollTop - previousMeasuredTarget) / targetElapsedSeconds,
          STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND,
          STREAM_SCROLL_MAX_SPEED_PX_PER_SECOND,
        )
        const currentVelocity = streamVelocityPxPerSecondRef.current

        streamVelocityPxPerSecondRef.current =
          currentVelocity > 0
            ? currentVelocity * (1 - STREAM_SCROLL_SPEED_EASE) + sampledVelocity * STREAM_SCROLL_SPEED_EASE
            : sampledVelocity
        streamLastTargetAtRef.current = now
        streamLastTargetScrollTopRef.current = liveMessageScrollTop
      } else if (liveMessageScrollTop < previousMeasuredTarget) {
        streamLastTargetAtRef.current = now
        streamLastTargetScrollTopRef.current = liveMessageScrollTop
      }

      const liveDistance = liveMessageScrollTop - currentScrollElement.scrollTop
      const currentVelocity = streamVelocityPxPerSecondRef.current
      const currentTargetDistance = Math.max(
        0,
        (streamTargetScrollTopRef.current ?? liveMessageScrollTop) - currentScrollElement.scrollTop,
      )
      const nextVelocity =
        currentVelocity > 0
          ? currentVelocity
          : currentTargetDistance > STREAM_SCROLL_SETTLE_DISTANCE_PX
          ? STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND
          : liveDistance <= STREAM_SCROLL_SETTLE_DISTANCE_PX
          ? 0
          : clampNumber(
            liveDistance / 0.9,
            STREAM_SCROLL_MIN_SPEED_PX_PER_SECOND,
            STREAM_SCROLL_MAX_SPEED_PX_PER_SECOND,
          )
      const targetAgeMs = Math.max(0, now - (streamLastTargetAtRef.current ?? now))
      const predictedScrollTop =
        liveMessageScrollTop +
        nextVelocity * (Math.min(targetAgeMs, STREAM_SCROLL_PREDICTION_MS) / 1000)
      const maxScrollTop = Math.max(
        0,
        currentScrollElement.scrollHeight - currentScrollElement.clientHeight,
      )

      streamVelocityPxPerSecondRef.current = nextVelocity
      const desiredTargetScrollTop = Math.min(
        maxScrollTop,
        Math.max(currentScrollElement.scrollTop, liveMessageScrollTop, predictedScrollTop),
      )
      const previousTargetScrollTop = streamTargetScrollTopRef.current

      streamTargetScrollTopRef.current =
        previousTargetScrollTop === null ||
        desiredTargetScrollTop > previousTargetScrollTop + STREAM_SCROLL_TARGET_DEADBAND_PX ||
        currentScrollElement.scrollTop >= previousTargetScrollTop - STREAM_SCROLL_TARGET_DEADBAND_PX
          ? desiredTargetScrollTop
          : previousTargetScrollTop

      const targetScrollTop = streamTargetScrollTopRef.current ?? currentScrollElement.scrollTop
      const distance = targetScrollTop - currentScrollElement.scrollTop

      if (Math.abs(distance) <= STREAM_SCROLL_SETTLE_DISTANCE_PX) {
        streamAnimationFrameRef.current = window.requestAnimationFrame(step)
        return
      }

      const scrollDelta = Math.min(distance, nextVelocity * elapsedSeconds)

      markProgrammaticScroll()
      currentScrollElement.scrollTop += scrollDelta
      releaseProgrammaticScroll()
      streamAnimationFrameRef.current = window.requestAnimationFrame(step)
    }

    streamAnimationFrameRef.current = window.requestAnimationFrame(step)
  }, [
    cancelStreamAnimation,
    ensureStreamScrollSpace,
    getBaselinePaddingBottom,
    reduceMotion,
    releaseProgrammaticScroll,
    markProgrammaticScroll,
  ])

  const clearSubmitScrollSpace = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement || submitScrollSpaceRef.current === null) {
      return
    }

    const { inlinePaddingBottom, paddingBottomPx } = submitScrollSpaceRef.current
    const currentPaddingBottomPx = getPaddingBottomPx(scrollElement)
    const reducedScrollHeight = scrollElement.scrollHeight - currentPaddingBottomPx + paddingBottomPx
    const restoredMaxScrollTop = Math.max(0, reducedScrollHeight - scrollElement.clientHeight)

    if (scrollElement.scrollTop > restoredMaxScrollTop) {
      markProgrammaticScroll()
      scrollElement.scrollTop = restoredMaxScrollTop
      releaseProgrammaticScroll()
    }

    scrollElement.style.paddingBottom = inlinePaddingBottom
    submitScrollSpaceRef.current = null
  }, [markProgrammaticScroll, releaseProgrammaticScroll])

  const scrollLatestUserTurnIntoView = useCallback(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })

    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    const userMessages = scrollElement.querySelectorAll<HTMLElement>('[data-message-role="user"]')
    const latestUserMessage = userMessages.item(userMessages.length - 1)

    if (!latestUserMessage) {
      return
    }

    if (submitScrollSpaceRef.current === null) {
      submitScrollSpaceRef.current = {
        inlinePaddingBottom: scrollElement.style.paddingBottom,
        paddingBottomPx: getPaddingBottomPx(scrollElement),
      }
    }

    const targetScrollTop = Math.max(0, latestUserMessage.offsetTop - SUBMIT_SCROLL_TOP_OFFSET_PX)
    const currentPaddingBottomPx = getPaddingBottomPx(scrollElement)
    const contentHeight = scrollElement.scrollHeight - currentPaddingBottomPx
    const baselinePaddingBottom = submitScrollSpaceRef.current.paddingBottomPx
    const baselineMaxScrollTop = Math.max(
      0,
      contentHeight + baselinePaddingBottom - scrollElement.clientHeight,
    )
    const requiredPaddingBottom = Math.max(
      baselinePaddingBottom,
      baselineMaxScrollTop >= targetScrollTop
        ? baselinePaddingBottom
        : Math.ceil(targetScrollTop + scrollElement.clientHeight - contentHeight),
    )

    scrollElement.style.paddingBottom = `${requiredPaddingBottom}px`

    await new Promise<void>((resolve) => {
      requestAnimationFrame(resolve)
    })

    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    const nextScrollTop = Math.min(targetScrollTop, maxScrollTop)

    if (Math.abs(scrollElement.scrollTop - nextScrollTop) < 1) {
      return
    }

    markProgrammaticScroll()
    scrollElement.scrollTo({
      top: nextScrollTop,
      behavior: "smooth",
    })

    await waitForScrollSettle(scrollElement)
    releaseProgrammaticScroll()
  }, [markProgrammaticScroll, releaseProgrammaticScroll])

  const scrollToLatestTurn = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    cancelJumpAnimation()
    cancelRestoreAnimation()

    const startScrollTop = scrollElement.scrollTop
    const targetScrollTop = getLiveMessageScrollTop(
      scrollElement,
      getBaselinePaddingBottom(scrollElement),
    )
    const distance = targetScrollTop - startScrollTop

    if (Math.abs(distance) <= STREAM_SCROLL_SETTLE_DISTANCE_PX || reduceMotion) {
      markProgrammaticScroll()
      scrollElement.scrollTop = targetScrollTop
      streamFollowEnabledRef.current = true
      setIsJumpToLatestVisible(false)
      releaseProgrammaticScroll()

      if (isGeneratingRef.current) {
        animateStreamScroll()
      } else {
        restoreStreamScrollSpace(0, true)
      }

      return
    }

    const startedAt = performance.now()

    const step = (now: number) => {
      const progress = clampNumber((now - startedAt) / STREAM_SCROLL_JUMP_DURATION_MS, 0, 1)
      const easedProgress = easeOutCubic(progress)

      markProgrammaticScroll()
      scrollElement.scrollTop = startScrollTop + distance * easedProgress

      if (progress >= 1) {
        scrollElement.scrollTop = targetScrollTop
        jumpAnimationFrameRef.current = null
        streamFollowEnabledRef.current = true
        setIsJumpToLatestVisible(false)
        releaseProgrammaticScroll()

        if (isGeneratingRef.current) {
          animateStreamScroll()
        } else {
          restoreStreamScrollSpace(0, true)
        }

        return
      }

      releaseProgrammaticScroll()
      jumpAnimationFrameRef.current = window.requestAnimationFrame(step)
    }

    jumpAnimationFrameRef.current = window.requestAnimationFrame(step)
  }, [
    animateStreamScroll,
    cancelJumpAnimation,
    cancelRestoreAnimation,
    getBaselinePaddingBottom,
    reduceMotion,
    releaseProgrammaticScroll,
    markProgrammaticScroll,
    restoreStreamScrollSpace,
  ])

  useEffect(() => {
    window.requestAnimationFrame(updateJumpToLatestVisibility)
  }, [streamScrollKey, updateJumpToLatestVisibility])

  useEffect(() => {
    isGeneratingRef.current = isGenerating

    if (!isGenerating) {
      const endingVelocityPxPerSecond = streamVelocityPxPerSecondRef.current
      const shouldDelayRestore = previousIsGeneratingRef.current && streamPaddingSpaceRef.current !== null

      previousIsGeneratingRef.current = false
      cancelStreamAnimation()
      cancelRestoreAnimation()

      if (!shouldDelayRestore) {
        restoreStreamScrollSpace(endingVelocityPxPerSecond, true)
        updateJumpToLatestVisibility()
        return
      }

      restoreDelayTimeoutRef.current = window.setTimeout(() => {
      restoreDelayTimeoutRef.current = null
        restoreStreamScrollSpace(endingVelocityPxPerSecond)
        updateJumpToLatestVisibility()
      }, STREAM_SCROLL_RESTORE_DELAY_MS)
      return
    }

    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    if (!previousIsGeneratingRef.current) {
      streamFollowEnabledRef.current =
        submitScrollSpaceRef.current !== null || isNearLiveMessageEdge(scrollElement)
    }

    previousIsGeneratingRef.current = true

    if (streamFollowEnabledRef.current) {
      animateStreamScroll()
    }
  }, [
    animateStreamScroll,
    cancelRestoreAnimation,
    cancelStreamAnimation,
    isGenerating,
    isNearLiveMessageEdge,
    restoreStreamScrollSpace,
    streamScrollKey,
    updateJumpToLatestVisibility,
  ])

  useEffect(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    function reengageIfNearLiveEdge() {
      window.requestAnimationFrame(() => {
        const currentScrollElement = scrollRef.current

        if (
          currentScrollElement &&
          isGeneratingRef.current &&
          isNearLiveMessageEdge(currentScrollElement)
        ) {
          streamFollowEnabledRef.current = true
          animateStreamScroll()
        }
      })
    }

    function handleWheel(event: WheelEvent) {
      if (!isGeneratingRef.current) {
        return
      }

      if (event.deltaY < 0) {
        streamFollowEnabledRef.current = false
        cancelStreamAnimation()
        return
      }

      reengageIfNearLiveEdge()
    }

    let touchStartY: number | null = null

    function handleTouchStart(event: TouchEvent) {
      touchStartY = event.touches.item(0)?.clientY ?? null
    }

    function handleTouchMove(event: TouchEvent) {
      if (!isGeneratingRef.current || touchStartY === null) {
        return
      }

      const currentY = event.touches.item(0)?.clientY ?? touchStartY

      if (currentY - touchStartY > 4) {
        streamFollowEnabledRef.current = false
        cancelStreamAnimation()
      } else {
        reengageIfNearLiveEdge()
      }

      touchStartY = currentY
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isGeneratingRef.current) {
        return
      }

      if (["ArrowUp", "Home", "PageUp"].includes(event.key)) {
        streamFollowEnabledRef.current = false
        cancelStreamAnimation()
        return
      }

      if (["ArrowDown", "End", "PageDown", " "].includes(event.key)) {
        reengageIfNearLiveEdge()
      }
    }

    function handleScroll() {
      updateJumpToLatestVisibility()

      if (!isGeneratingRef.current || isProgrammaticScrollActive()) {
        return
      }

      if (isNearLiveMessageEdge(scrollElement)) {
        streamFollowEnabledRef.current = true
        animateStreamScroll()
      } else {
        streamFollowEnabledRef.current = false
        cancelStreamAnimation()
      }
    }

    scrollElement.addEventListener("scroll", handleScroll, { passive: true })
    scrollElement.addEventListener("touchmove", handleTouchMove, { passive: true })
    scrollElement.addEventListener("touchstart", handleTouchStart, { passive: true })
    scrollElement.addEventListener("wheel", handleWheel, { passive: true })
    window.addEventListener("keydown", handleKeyDown)
    updateJumpToLatestVisibility()

    return () => {
      scrollElement.removeEventListener("scroll", handleScroll)
      scrollElement.removeEventListener("touchmove", handleTouchMove)
      scrollElement.removeEventListener("touchstart", handleTouchStart)
      scrollElement.removeEventListener("wheel", handleWheel)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    animateStreamScroll,
    cancelStreamAnimation,
    isNearLiveMessageEdge,
    isProgrammaticScrollActive,
    updateJumpToLatestVisibility,
  ])

  useEffect(() => {
    return () => {
      cancelJumpAnimation()
      cancelStreamAnimation()
      cancelRestoreAnimation()
      restoreStreamScrollSpace(0, true)
    }
  }, [cancelJumpAnimation, cancelRestoreAnimation, cancelStreamAnimation, restoreStreamScrollSpace])

  return {
    clearSubmitScrollSpace,
    isJumpToLatestVisible,
    scrollLatestUserTurnIntoView,
    scrollRef,
    scrollToLatestTurn,
  }
}
