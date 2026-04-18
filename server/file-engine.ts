const MAX_TEXT_LENGTH = 8000;

export interface ProcessedAttachment {
  type: "image" | "document";
  filename: string;
  mimeType: string;
  text?: string;
  base64?: string;
  pageCount?: number;
  truncated?: boolean;
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_LENGTH) {
    return { text, truncated: false };
  }
  return {
    text: text.substring(0, MAX_TEXT_LENGTH) + "\n\n[Content truncated — showing first ~8000 characters]",
    truncated: true,
  };
}

export async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return { text: data.text, pageCount: data.numpages };
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromCSV(buffer: Buffer): Promise<string> {
  const text = buffer.toString("utf-8");
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return "";

  const header = lines[0];
  const preview = lines.slice(0, 51).join("\n");
  const totalRows = lines.length - 1;

  let result = `CSV Data (${totalRows} rows)\n\n${preview}`;
  if (totalRows > 50) {
    result += `\n\n[Showing first 50 of ${totalRows} rows]`;
  }
  return result;
}

export async function extractTextFromTXT(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

export async function processAttachment(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<ProcessedAttachment> {
  if (mimetype.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    return {
      type: "image",
      filename,
      mimeType: mimetype,
      base64,
    };
  }

  let rawText = "";
  let pageCount: number | undefined;

  if (mimetype === "application/pdf") {
    const result = await extractTextFromPDF(buffer);
    rawText = result.text;
    pageCount = result.pageCount;
  } else if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    rawText = await extractTextFromDOCX(buffer);
  } else if (mimetype === "text/csv" || filename.endsWith(".csv")) {
    rawText = await extractTextFromCSV(buffer);
  } else if (
    mimetype.startsWith("text/") ||
    mimetype === "application/json" ||
    filename.match(/\.(txt|md|json|js|ts|py|html|css|xml|yaml|yml|log|ini|cfg|env)$/i)
  ) {
    rawText = await extractTextFromTXT(buffer);
  } else {
    return {
      type: "document",
      filename,
      mimeType: mimetype,
      text: `[Unsupported file type: ${mimetype}. Unable to extract text from "${filename}".]`,
    };
  }

  const { text, truncated } = truncateText(rawText);

  return {
    type: "document",
    filename,
    mimeType: mimetype,
    text,
    pageCount,
    truncated,
  };
}

export function buildAttachmentContext(attachments: ProcessedAttachment[]): string {
  if (attachments.length === 0) return "";

  const parts: string[] = [];
  const docs = attachments.filter((a) => a.type === "document");
  const images = attachments.filter((a) => a.type === "image");

  if (docs.length > 0) {
    for (const doc of docs) {
      let header = `[Attached document: ${doc.filename}`;
      if (doc.pageCount) header += ` (${doc.pageCount} pages)`;
      if (doc.truncated) header += " — truncated";
      header += "]";
      parts.push(`${header}\n${doc.text}`);
    }
  }

  if (images.length > 0) {
    parts.push(`[${images.length} image(s) attached: ${images.map((i) => i.filename).join(", ")}]`);
  }

  return parts.join("\n\n");
}
