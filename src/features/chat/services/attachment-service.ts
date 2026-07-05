import { ChatAttachment, DocumentAttachment, ImageAttachment } from "@/features/chat/types"

function ensureAttachmentBridge() {
  const bridge = window.suprachat?.attachments

  if (!bridge) {
    throw new Error("File attachments are only available in the desktop app.")
  }

  return bridge
}

export async function pickDocumentAttachments() {
  return ensureAttachmentBridge().pickDocuments() as Promise<DocumentAttachment[]>
}

export async function pickImageAttachments() {
  return ensureAttachmentBridge().pickImages() as Promise<ImageAttachment[]>
}

export function mergeComposerAttachments(
  currentAttachments: ChatAttachment[],
  nextAttachments: ChatAttachment[],
  maxImages = 5,
) {
  const merged = [...currentAttachments]

  for (const attachment of nextAttachments) {
    if (attachment.kind === "image") {
      const existingImageCount = merged.filter((item) => item.kind === "image").length

      if (existingImageCount >= maxImages) {
        break
      }
    }

    merged.push(attachment)
  }

  return merged
}
