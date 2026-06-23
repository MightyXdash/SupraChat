export function answerTextFromAssistantMessage(content: string) {
  return content
    .replace(/<suprachat-think>[\s\S]*?<\/suprachat-think>/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
}

export function speechTextFromAssistantMessage(content: string) {
  return answerTextFromAssistantMessage(content)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200d\uFE0E\uFE0F]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
