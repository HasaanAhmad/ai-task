import { extractWithAi } from "./ai-extract";
import {
  extractFromPdf,
  extractFromPlainText,
} from "./extract-text";
import { normalizeExtraction } from "./normalize";
import type { ExtractionError, ExtractionResult } from "./schema";
import { validateExtraction } from "./validate";

const PDF_TYPES = new Set(["application/pdf"]);
const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

function isPdf(filename: string, mime: string): boolean {
  return (
    PDF_TYPES.has(mime) ||
    filename.toLowerCase().endsWith(".pdf")
  );
}

function isText(filename: string, mime: string): boolean {
  const lower = filename.toLowerCase();
  return (
    TEXT_TYPES.has(mime) ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    mime.startsWith("text/")
  );
}

export async function runChangeOrderPipeline(input: {
  filename: string;
  mimeType: string;
  buffer: ArrayBuffer;
}): Promise<ExtractionResult | ExtractionError> {
  const started = Date.now();
  const { filename, mimeType, buffer } = input;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      success: false,
      error: "OPENAI_API_KEY is missing. Add it to your .env file.",
      code: "MISSING_API_KEY",
    };
  }

  if (!isPdf(filename, mimeType) && !isText(filename, mimeType)) {
    return {
      success: false,
      error: "Unsupported file type. Upload a PDF or plain text (.txt) file.",
      code: "UNSUPPORTED_TYPE",
      details: `Received ${mimeType || "unknown"} (${filename})`,
    };
  }

  let text: string;
  let pageCount: number | null = null;
  let method: "pdf_text" | "plain_text";

  try {
    if (isPdf(filename, mimeType)) {
      const extracted = await extractFromPdf(buffer);
      text = extracted.text;
      pageCount = extracted.pageCount;
      method = extracted.method;

      if (extracted.likelyScanned || text.length < 40) {
        return {
          success: false,
          error:
            "Little or no extractable text was found. This PDF may be scanned or image-only. OCR is not enabled in this version — use a text-based PDF or paste the text.",
          code: "LIKELY_SCANNED",
          details: `Extracted ${text.length} characters across ${pageCount ?? "?"} page(s).`,
        };
      }
    } else {
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
        new Uint8Array(buffer),
      );
      const extracted = extractFromPlainText(decoded);
      text = extracted.text;
      method = extracted.method;
    }
  } catch (err) {
    return {
      success: false,
      error: "Failed to extract text from the file.",
      code: "PDF_PARSE_FAILED",
      details: err instanceof Error ? err.message : String(err),
    };
  }

  if (!text.trim()) {
    return {
      success: false,
      error: "The file contained no readable text.",
      code: "EMPTY_TEXT",
    };
  }

  try {
    const { data: raw, usage, model } = await extractWithAi(text, filename);
    const data = normalizeExtraction(raw);
    const validation = validateExtraction(data);

    return {
      success: true,
      source: {
        filename,
        mime_type: mimeType || "application/octet-stream",
        extraction_method: method,
        ocr_used: false,
        character_count: text.length,
        page_count: pageCount,
      },
      extracted_text_preview:
        text.length > 1500 ? `${text.slice(0, 1500)}…` : text,
      data,
      validation,
      model,
      processing_ms: Date.now() - started,
      usage,
    };
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    const authFailure =
      /api key|unauthorized|permission|invalid.*key|expired|incorrect api key|403|401/i.test(
        details,
      );
    const quotaFailure =
      /quota|rate.?limit|resource.?exhausted|insufficient.?quota|billing/i.test(
        details,
      );
    return {
      success: false,
      error: authFailure
        ? "OpenAI authentication failed. Check that OPENAI_API_KEY in .env is valid."
        : quotaFailure
          ? "OpenAI quota/billing issue. Check your OpenAI account billing."
          : "AI extraction failed.",
      code: authFailure ? "MISSING_API_KEY" : "AI_FAILED",
      details,
    };
  }
}
