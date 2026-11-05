import { runChangeOrderPipeline } from "@/lib/change-order/pipeline";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    // Raw text body
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        text?: string;
        filename?: string;
      };

      if (!body.text || typeof body.text !== "string") {
        return Response.json(
          {
            success: false,
            error: "JSON body must include a non-empty `text` string.",
            code: "EMPTY_TEXT",
          },
          { status: 400 },
        );
      }

      const encoder = new TextEncoder();
      const buffer = encoder.encode(body.text).buffer;
      const result = await runChangeOrderPipeline({
        filename: body.filename || "pasted.txt",
        mimeType: "text/plain",
        buffer,
      });

      return Response.json(result, {
        status: result.success ? 200 : 422,
      });
    }

    // Multipart file upload
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");

      if (!file || !(file instanceof File)) {
        return Response.json(
          {
            success: false,
            error: "Form field `file` is required.",
            code: "EMPTY_TEXT",
          },
          { status: 400 },
        );
      }

      if (file.size > MAX_BYTES) {
        return Response.json(
          {
            success: false,
            error: "File exceeds the 15 MB limit.",
            code: "UNSUPPORTED_TYPE",
          },
          { status: 413 },
        );
      }

      const buffer = await file.arrayBuffer();
      const result = await runChangeOrderPipeline({
        filename: file.name || "upload.bin",
        mimeType: file.type || "application/octet-stream",
        buffer,
      });

      return Response.json(result, {
        status: result.success ? 200 : 422,
      });
    }

    // Plain text content-type
    if (contentType.includes("text/plain")) {
      const text = await request.text();
      const buffer = new TextEncoder().encode(text).buffer;
      const result = await runChangeOrderPipeline({
        filename: "request.txt",
        mimeType: "text/plain",
        buffer,
      });
      return Response.json(result, {
        status: result.success ? 200 : 422,
      });
    }

    return Response.json(
      {
        success: false,
        error:
          "Send multipart/form-data with `file`, or JSON `{ text, filename? }`.",
        code: "UNSUPPORTED_TYPE",
      },
      { status: 415 },
    );
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: "Unexpected server error.",
        code: "AI_FAILED",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
