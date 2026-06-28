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
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.suprachat?.rendererReady?.()
  })
})
