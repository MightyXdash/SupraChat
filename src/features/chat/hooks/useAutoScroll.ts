import { useCallback, useRef } from "react"
import {
  SUBMIT_SCROLL_MIN_BOTTOM_SPACE_PX,
  SUBMIT_SCROLL_SETTLE_MS,
  SUBMIT_SCROLL_TOP_OFFSET_PX,
} from "@/features/chat/config/ui"

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

export function useAutoScroll() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const previousPaddingBottomRef = useRef<string | null>(null)

  const clearSubmitScrollSpace = useCallback(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement || previousPaddingBottomRef.current === null) {
      return
    }

    scrollElement.style.paddingBottom = previousPaddingBottomRef.current
    previousPaddingBottomRef.current = null
  }, [])

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

    if (previousPaddingBottomRef.current === null) {
      previousPaddingBottomRef.current = scrollElement.style.paddingBottom
    }

    const bottomSpace = Math.max(
      SUBMIT_SCROLL_MIN_BOTTOM_SPACE_PX,
      scrollElement.clientHeight - SUBMIT_SCROLL_TOP_OFFSET_PX,
    )

    scrollElement.style.paddingBottom = `${bottomSpace}px`

    await new Promise<void>((resolve) => {
      requestAnimationFrame(resolve)
    })

    const userMessages = scrollElement.querySelectorAll<HTMLElement>('[data-message-role="user"]')
    const latestUserMessage = userMessages.item(userMessages.length - 1)

    if (!latestUserMessage) {
      return
    }

    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    const targetScrollTop = Math.max(0, latestUserMessage.offsetTop - SUBMIT_SCROLL_TOP_OFFSET_PX)
    const nextScrollTop = Math.min(targetScrollTop, maxScrollTop)

    if (Math.abs(scrollElement.scrollTop - nextScrollTop) < 1) {
      return
    }

    scrollElement.scrollTo({
      top: nextScrollTop,
      behavior: "smooth",
    })

    await waitForScrollSettle(scrollElement)
  }, [])

  return { clearSubmitScrollSpace, scrollLatestUserTurnIntoView, scrollRef }
}
