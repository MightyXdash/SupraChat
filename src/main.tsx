import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource/inter/400.css"
import "@fontsource/inter/400-italic.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/600.css"
import "@fontsource/inter/700.css"
import "@fontsource/source-serif-4/400.css"
import "@fontsource/source-serif-4/400-italic.css"
// @ts-ignore: allow side-effect CSS import without type declarations
import "@fontsource/source-serif-4/600.css"
import "@fontsource/source-serif-4/600-italic.css"
import "@fontsource/source-serif-4/700.css"
import "@fontsource/source-serif-4/700-italic.css"
import "katex/dist/katex.min.css"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function waitForFonts() {
  window.suprachat?.startup?.reportProgress({
    detail: "Loading interface fonts",
    label: "Preparing interface",
    progress: 0.84,
  })

  await document.fonts?.ready
}

async function warmSurfaceLayers() {
  window.suprachat?.startup?.reportProgress({
    detail: "Rasterizing glass panels and overlay surfaces",
    label: "Optimizing surfaces",
    progress: 0.88,
  })

  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = [
    "contain: layout paint style",
    "inset: 0",
    "opacity: 0.001",
    "pointer-events: none",
    "position: fixed",
    "transform: translateZ(0)",
    "z-index: 2147483000",
  ].join(";")

  host.innerHTML = `
    <div class="conversation-search-layer">
      <div class="conversation-search-backdrop"></div>
      <section class="conversation-search-dialog">
        <div class="conversation-search-field"></div>
        <div class="conversation-search-results"></div>
      </section>
    </div>
    <div class="settings-layer">
      <div class="settings-backdrop"></div>
      <section class="settings-dialog">
        <aside class="settings-sidebar"></aside>
        <div class="settings-content"></div>
      </section>
    </div>
    <div class="confirmation-layer">
      <div class="confirmation-backdrop"></div>
      <section class="confirmation-dialog"></section>
    </div>
  `

  document.body.appendChild(host)
  await nextFrame()
  await nextFrame()

  window.suprachat?.startup?.reportProgress({
    detail: "Preparing motion layers",
    label: "Optimizing surfaces",
    progress: 0.94,
  })

  host.querySelectorAll<HTMLElement>(".settings-dialog, .conversation-search-dialog, .confirmation-dialog").forEach((element) => {
    element.style.transform = "scale(1.08) translateZ(0)"
  })

  await nextFrame()
  host.remove()
}

async function finishStartup() {
  await nextFrame()
  await nextFrame()
  await waitForFonts()
  await warmSurfaceLayers()

  window.suprachat?.startup?.reportProgress({
    detail: "Interface ready",
    label: "Ready",
    progress: 0.98,
  })
  window.suprachat?.rendererReady?.()
}

void finishStartup()
