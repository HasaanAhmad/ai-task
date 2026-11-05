import { extractText, getDocumentProxy } from "unpdf";

export type TextExtraction = {
  text: string;
  pageCount: number | null;
  method: "pdf_text" | "plain_text";
  likelyScanned: boolean;
};

const MIN_CHARS_PER_PAGE = 40;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractFromPdf(buffer: ArrayBuffer): Promise<TextExtraction> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : text;
  const normalized = normalizeWhitespace(merged);
  const perPage = totalPages > 0 ? normalized.length / totalPages : normalized.length;
  const likelyScanned = normalized.length < 80 || perPage < MIN_CHARS_PER_PAGE;

  return {
    text: normalized,
    pageCount: totalPages,
    method: "pdf_text",
    likelyScanned,
  };
}

export function extractFromPlainText(raw: string): TextExtraction {
  return {
    text: normalizeWhitespace(raw),
    pageCount: null,
    method: "plain_text",
    likelyScanned: false,
  };
}
