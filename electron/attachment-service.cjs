const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const yauzl = require("yauzl")

const MAX_DOCUMENT_WORDS = 4000
const MAX_IMAGE_COUNT = 5
const DOCUMENT_FILTERS = [
  { name: "Documents", extensions: ["txt", "md", "markdown", "json", "jsonl", "csv", "tsv", "yaml", "yml", "xml", "html", "htm", "docx", "pptx"] },
]
const IMAGE_FILTERS = [
  { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
]
const DOCX_ENTRY_PATTERNS = [
  /^word\/document\.xml$/i,
  /^word\/header\d+\.xml$/i,
  /^word\/footer\d+\.xml$/i,
  /^word\/footnotes\.xml$/i,
]
const PPTX_ENTRY_PATTERNS = [
  /^ppt\/slides\/slide\d+\.xml$/i,
  /^ppt\/notesSlides\/notesSlide\d+\.xml$/i,
]

function generateId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

function countWords(content) {
  return content.trim().split(/\s+/).filter(Boolean).length
}

function truncateWords(content, maxWords = MAX_DOCUMENT_WORDS) {
  const words = content.trim().split(/\s+/).filter(Boolean)

  if (words.length <= maxWords) {
    return {
      content: words.join(" "),
      truncated: false,
      wordCount: words.length,
    }
  }

  return {
    content: words.slice(0, maxWords).join(" "),
    truncated: true,
    wordCount: words.length,
  }
}

function decodeXmlEntities(content) {
  return content
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, value) => String.fromCharCode(Number.parseInt(value, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) => String.fromCharCode(Number.parseInt(value, 16)))
}

function normalizeExtractedText(content) {
  return decodeXmlEntities(content)
    .replace(/<w:tab\/>/gi, " ")
    .replace(/<a:tab\/>/gi, " ")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/a:p>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function readPlainTextDocument(filePath) {
  return fs.readFileSync(filePath, "utf8")
}

function readZipEntries(filePath, patterns) {
  return new Promise((resolve, reject) => {
    const contents = []

    yauzl.open(filePath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error("Unable to read archive."))
        return
      }

      zipFile.readEntry()

      zipFile.on("entry", (entry) => {
        if (!patterns.some((pattern) => pattern.test(entry.fileName))) {
          zipFile.readEntry()
          return
        }

        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error("Unable to read archive entry."))
            return
          }

          const chunks = []

          stream.on("data", (chunk) => {
            chunks.push(chunk)
          })
          stream.on("end", () => {
            contents.push(Buffer.concat(chunks).toString("utf8"))
            zipFile.readEntry()
          })
          stream.on("error", reject)
        })
      })

      zipFile.on("end", () => resolve(contents.join("\n")))
      zipFile.on("error", reject)
    })
  })
}

async function extractDocumentText(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === ".docx") {
    return normalizeExtractedText(await readZipEntries(filePath, DOCX_ENTRY_PATTERNS))
  }

  if (extension === ".pptx") {
    return normalizeExtractedText(await readZipEntries(filePath, PPTX_ENTRY_PATTERNS))
  }

  return readPlainTextDocument(filePath).replace(/\r\n/g, "\n").trim()
}

function fileToDataUrl(filePath) {
  const buffer = fs.readFileSync(filePath)
  const extension = path.extname(filePath).toLowerCase()
  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".gif"
          ? "image/gif"
          : extension === ".bmp"
            ? "image/bmp"
            : "image/jpeg"

  return {
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    mimeType,
  }
}

async function toDocumentAttachment(filePath) {
  const sourceText = await extractDocumentText(filePath)
  const truncated = truncateWords(sourceText)

  return {
    id: generateId("attachment-doc"),
    kind: "document",
    name: path.basename(filePath),
    filePath,
    mimeType: "text/plain",
    textContent: truncated.content,
    truncated: truncated.truncated,
    wordCount: truncated.wordCount,
    createdAt: new Date().toISOString(),
  }
}

function toImageAttachment(filePath) {
  const { dataUrl, mimeType } = fileToDataUrl(filePath)

  return {
    id: generateId("attachment-image"),
    kind: "image",
    name: path.basename(filePath),
    filePath,
    mimeType,
    dataUrl,
    createdAt: new Date().toISOString(),
  }
}

async function pickDocumentAttachments(dialog, browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    filters: DOCUMENT_FILTERS,
    properties: ["openFile", "multiSelections"],
    title: "Add document",
  })

  if (result.canceled || result.filePaths.length === 0) {
    return []
  }

  const attachments = []

  for (const filePath of result.filePaths) {
    attachments.push(await toDocumentAttachment(filePath))
  }

  return attachments
}

async function pickImageAttachments(dialog, browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    filters: IMAGE_FILTERS,
    properties: ["openFile", "multiSelections"],
    title: "Add images",
  })

  if (result.canceled || result.filePaths.length === 0) {
    return []
  }

  return result.filePaths.slice(0, MAX_IMAGE_COUNT).map(toImageAttachment)
}

module.exports = {
  MAX_DOCUMENT_WORDS,
  MAX_IMAGE_COUNT,
  pickDocumentAttachments,
  pickImageAttachments,
}
