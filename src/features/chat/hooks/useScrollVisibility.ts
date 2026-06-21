import { RefObject, useEffect, useState } from "react"

const SCROLLBAR_VISIBLE_MS = 900

export function useScrollVisibility(scrollRef: RefObject<HTMLElement | null>) {
  const [isScrolling, setIsScrolling] = useState(false)

  useEffect(() => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    let scrollTimeout: number | undefined

    function showScrollbar() {
      setIsScrolling(true)
      window.clearTimeout(scrollTimeout)
      scrollTimeout = window.setTimeout(() => setIsScrolling(false), SCROLLBAR_VISIBLE_MS)
    }

    scrollElement.addEventListener("scroll", showScrollbar, { passive: true })
    scrollElement.addEventListener("wheel", showScrollbar, { passive: true })
    scrollElement.addEventListener("touchmove", showScrollbar, { passive: true })

    return () => {
      window.clearTimeout(scrollTimeout)
      scrollElement.removeEventListener("scroll", showScrollbar)
      scrollElement.removeEventListener("wheel", showScrollbar)
      scrollElement.removeEventListener("touchmove", showScrollbar)
    }
  }, [scrollRef])

  return isScrolling
}
