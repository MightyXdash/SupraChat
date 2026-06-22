export function speakSuvaResponse(text: string) {
  const content = text.replace(/\s+/g, " ").trim()

  if (!content || !("speechSynthesis" in window)) {
    return Promise.resolve()
  }

  window.speechSynthesis.cancel()

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSuvaSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
}
