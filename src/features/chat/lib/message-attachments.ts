import { ChatAttachment, ChatCompletionMessage, ChatMessage } from "@/features/chat/types"

function documentAttachmentPrompt(attachment: Extract<ChatAttachment, { kind: "document" }>) {
  return [
    `Document: ${attachment.name}`,
    attachment.textContent,
    attachment.truncated ? "[Document excerpt truncated to the first 4000 words.]" : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function hasVisionAttachments(attachments: ChatAttachment[] = []) {
  return attachments.some((attachment) => attachment.kind === "image")
}

export function buildMessageTextPayload(message: ChatMessage) {
  const sections = [message.content.trim()]

  for (const attachment of message.attachments ?? []) {
    if (attachment.kind === "document") {
      sections.push(documentAttachmentPrompt(attachment))
      continue
    }

    sections.push(`Image: ${attachment.name}`)
  }

  return sections.filter(Boolean).join("\n\n").trim()
}

export function buildCompletionMessage(message: ChatMessage): ChatCompletionMessage {
  const textSections = [message.content.trim()]
  const imageParts = []

  for (const attachment of message.attachments ?? []) {
    if (attachment.kind === "document") {
      textSections.push(documentAttachmentPrompt(attachment))
      continue
    }

    imageParts.push({
      type: "image_url" as const,
      image_url: {
        url: attachment.dataUrl,
      },
    })
  }

  const text = textSections.filter(Boolean).join("\n\n").trim()

  if (imageParts.length === 0) {
    return {
      role: message.role,
      content: text,
    }
  }

  const content = []

  if (text) {
    content.push({ type: "text" as const, text })
  }

  content.push(...imageParts)

  return {
    role: message.role,
    content,
  }
}

export function attachmentSummaryLabel(attachment: ChatAttachment) {
  if (attachment.kind === "document") {
    return attachment.truncated
      ? `${attachment.wordCount.toLocaleString()} words, excerpted`
      : `${attachment.wordCount.toLocaleString()} words`
  }

  return "Image"
}
