"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type {
  ExtractionError,
  ExtractionResult,
  FieldValue,
} from "@/lib/change-order/schema";

type Result = ExtractionResult | ExtractionError;

function confidenceColor(score: number): string {
  if (score >= 0.8) return "text-[var(--ok)]";
  if (score >= 0.5) return "text-[var(--warn)]";
  return "text-[var(--err)]";
}

function statusLabel(status: FieldValue["status"]): string {
  switch (status) {
    case "found":
      return "Found";
    case "missing":
      return "Missing";
    case "ambiguous":
      return "Ambiguous";
    case "conflict":
      return "Conflict";
  }
}

function formatValue(value: FieldValue["value"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function FieldRow({
  label,
  field,
}: {
  label: string;
  field: FieldValue;
}) {
  return (
    <div className="grid gap-2 border-b border-[var(--line)] py-3 sm:grid-cols-[1fr_1.4fr_110px] sm:items-center">
      <div className="text-sm font-medium text-[var(--ink)]">{label}</div>
      <div>
        <div className="font-mono text-sm text-[var(--ink)]">
          {formatValue(field.value)}
        </div>
        {field.notes ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{field.notes}</p>
        ) : null}
        {field.raw_text ? (
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
            “{field.raw_text}”
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide">
          <span className="text-[var(--muted)]">{statusLabel(field.status)}</span>
          <span className={`font-mono ${confidenceColor(field.confidence)}`}>
            {Math.round(field.confidence * 100)}%
          </span>
        </div>
        <div className="confidence-bar">
          <span style={{ width: `${Math.round(field.confidence * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function Extractor() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function onFileChange(next: File | null) {
    setFile(next);
    setResult(null);
    setError(null);
  }

  async function runExtract() {
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        let response: Response;

        if (mode === "paste") {
          if (!pasteText.trim()) {
            setError("Paste some change-order text first.");
            return;
          }
          response = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: pasteText,
              filename: "pasted-change-order.txt",
            }),
          });
        } else {
          if (!file) {
            setError("Choose a PDF or TXT file first.");
            return;
          }
          const form = new FormData();
          form.append("file", file);
          response = await fetch("/api/extract", {
            method: "POST",
            body: form,
          });
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const json = (await response.json()) as Result;
        setResult(json);
        if (!json.success) {
          setError(json.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8">
      <header className="animate-rise mb-10 flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight text-[var(--ink)] sm:text-6xl">
            Sledge
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Upload a change order PDF or text file. We pull structured fields,
            line items, and confidence scores — then check the math.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="self-start font-mono text-xs uppercase tracking-wide text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          Lock
        </button>
      </header>

      <div className="animate-rise-delay mb-6 rounded-sm border border-[var(--accent)]/35 bg-[color-mix(in_srgb,var(--accent)_8%,white)] px-4 py-3 text-sm text-[var(--ink)]">
        <strong className="font-semibold">OCR is not enabled.</strong> Only
        text-based PDFs and plain text are supported. Scanned or image-only PDFs
        will be rejected.
      </div>

      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(18,32,51,0.06)] sm:p-6">
          <div className="mb-5 flex gap-2 font-mono text-xs uppercase tracking-wide">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`rounded-sm px-3 py-1.5 transition ${
                mode === "file"
                  ? "bg-[var(--ink)] text-[var(--panel)]"
                  : "bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              File upload
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`rounded-sm px-3 py-1.5 transition ${
                mode === "paste"
                  ? "bg-[var(--ink)] text-[var(--panel)]"
                  : "bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Paste text
            </button>
          </div>

          {mode === "file" ? (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) onFileChange(dropped);
              }}
              className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--line)] bg-[color-mix(in_srgb,var(--background)_70%,white)] px-6 py-14 text-center transition hover:border-[var(--accent)]"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />
              <p className="text-lg font-semibold text-[var(--ink)]">
                Drop a PDF or TXT here
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                or click to browse · max 15 MB
              </p>
              {file ? (
                <p className="mt-4 font-mono text-sm text-[var(--accent-deep)]">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              ) : null}
            </div>
          ) : (
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste change-order text…"
              rows={12}
              className="w-full resize-y rounded-sm border border-[var(--line)] bg-white px-3 py-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={runExtract}
              className="rounded-sm bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Extracting…" : "Extract change order"}
            </button>
            <a
              href="/samples/change-order-clean.txt"
              className="text-sm text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              download
            >
              Sample TXT
            </a>
            <a
              href="/samples/change-order-clean.pdf"
              className="text-sm text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              download
            >
              Sample PDF
            </a>
            <a
              href="/samples/change-order-messy.txt"
              className="text-sm text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              download
            >
              Messy sample
            </a>
          </div>

          {pending ? (
            <div className="mt-5">
              <div className="h-1 overflow-hidden rounded-full bg-[var(--line)]">
                <div className="animate-pulse-bar h-full w-full bg-[var(--accent)]" />
              </div>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                Parsing document → AI structured extract → validation
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 border border-[var(--err)]/30 bg-[color-mix(in_srgb,var(--err)_8%,white)] px-3 py-2 text-sm text-[var(--err)]">
              <p>{error}</p>
              {result && !result.success && result.details ? (
                <p className="mt-1 font-mono text-[11px] text-[var(--err)]/80">
                  {result.details}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          <h2 className="text-xl font-bold text-[var(--ink)]">Pipeline</h2>
          <ol className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <li>
              <span className="font-mono text-[var(--accent)]">01</span> Accept
              PDF or raw text
            </li>
            <li>
              <span className="font-mono text-[var(--accent)]">02</span> Extract
              embedded text (no OCR)
            </li>
            <li>
              <span className="font-mono text-[var(--accent)]">03</span> AI
              identifies fields &amp; change items
            </li>
            <li>
              <span className="font-mono text-[var(--accent)]">04</span> Normalize
              money / days
            </li>
            <li>
              <span className="font-mono text-[var(--accent)]">05</span> Validate
              financials &amp; conflicts
            </li>
            <li>
              <span className="font-mono text-[var(--accent)]">06</span> Return
              JSON with per-field confidence
            </li>
          </ol>
          <p className="mt-6 border-t border-[var(--line)] pt-4 font-mono text-xs leading-relaxed text-[var(--muted)]">
            Token-lean OpenAI calls (compact JSON, capped doc text). Samples in{" "}
            <code>/samples</code>. Passphrase gate via <code>APP_PASSWORD</code>.
          </p>
        </aside>
      </section>

      {result?.success ? (
        <ResultsView result={result} />
      ) : null}
    </div>
  );
}

function ResultsView({ result }: { result: ExtractionResult }) {
  const { data, validation, source } = result;

  return (
    <section className="animate-rise mt-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">Extraction</h2>
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">
            {source.filename} · {source.character_count} chars ·{" "}
            {source.page_count ?? "n/a"} pages · {result.processing_ms} ms ·{" "}
            {result.model}
            {result.usage.total_tokens != null
              ? ` · ${result.usage.total_tokens} tokens (${result.usage.prompt_tokens ?? "?"} in / ${result.usage.completion_tokens ?? "?"} out)`
              : null}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
            Overall confidence
          </p>
          <p
            className={`text-3xl font-bold ${confidenceColor(data.overall_confidence)}`}
          >
            {Math.round(data.overall_confidence * 100)}%
          </p>
        </div>
      </div>

      {!validation.is_valid ? (
        <div className="border border-[var(--err)]/30 bg-[color-mix(in_srgb,var(--err)_7%,white)] px-4 py-3 text-sm text-[var(--err)]">
          Financial or field conflicts detected — review validation below.
        </div>
      ) : (
        <div className="border border-[var(--ok)]/30 bg-[color-mix(in_srgb,var(--ok)_7%,white)] px-4 py-3 text-sm text-[var(--ok)]">
          No hard validation errors. Totals look consistent within tolerance.
        </div>
      )}

      <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">
          Core fields
        </h3>
        <FieldRow label="Document type" field={{
          value: data.document_type,
          confidence: data.overall_confidence,
          status: "found",
          raw_text: null,
          notes: null,
        }} />
        <FieldRow label="Project name" field={data.project_name} />
        <FieldRow label="Project number" field={data.project_number} />
        <FieldRow label="Change order #" field={data.change_order_number} />
        <FieldRow label="Date issued" field={data.date_issued} />
        <FieldRow label="Contractor" field={data.contractor.name} />
        <FieldRow label="Client" field={data.client.name} />
        <FieldRow
          label="Original contract"
          field={data.original_contract_amount}
        />
        <FieldRow label="Additional costs" field={data.additional_costs} />
        <FieldRow label="Deductions" field={data.deductions} />
        <FieldRow label="Net change" field={data.net_change} />
        <FieldRow
          label="Revised contract"
          field={data.revised_contract_amount}
        />
        <FieldRow label="Schedule impact (days)" field={data.schedule_impact_days} />
        <FieldRow label="Description" field={data.description_of_changes} />
        <FieldRow label="Reason" field={data.reason_for_change} />
      </div>

      <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <h3 className="mb-4 text-lg font-bold text-[var(--ink)]">
          Change items ({data.change_items.length})
        </h3>
        {data.change_items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No line items found.</p>
        ) : (
          <div className="space-y-3">
            {data.change_items.map((item, idx) => (
              <div
                key={idx}
                className="border border-[var(--line)] bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
                      {formatValue(item.item_number.value)} · {item.type}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                      {formatValue(item.description.value)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-[var(--ink)]">
                      {formatValue(item.amount.value)}
                    </p>
                    <p
                      className={`font-mono text-xs ${confidenceColor(item.confidence)}`}
                    >
                      {Math.round(item.confidence * 100)}% conf
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.approvals.length > 0 ? (
        <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">
            Approvals / signatures
          </h3>
          {data.approvals.map((sig, idx) => (
            <div key={idx} className="border-b border-[var(--line)] py-3 last:border-0">
              <FieldRow label="Role" field={sig.role} />
              <FieldRow label="Name" field={sig.name} />
              <FieldRow label="Date" field={sig.date} />
              <FieldRow label="Signed" field={sig.signed} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          <h3 className="mb-3 text-lg font-bold text-[var(--ink)]">
            Validation
          </h3>
          <dl className="mb-4 space-y-1 font-mono text-xs text-[var(--muted)]">
            <div className="flex justify-between gap-4">
              <dt>Recalc net change</dt>
              <dd className="text-[var(--ink)]">
                {validation.recalculated.net_change ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Recalc revised amount</dt>
              <dd className="text-[var(--ink)]">
                {validation.recalculated.revised_contract_amount ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Line items total</dt>
              <dd className="text-[var(--ink)]">
                {validation.recalculated.change_items_total ?? "—"}
              </dd>
            </div>
          </dl>
          {validation.issues.length === 0 ? (
            <p className="text-sm text-[var(--ok)]">No issues reported.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {validation.issues.map((issue, idx) => (
                <li
                  key={idx}
                  className={
                    issue.severity === "error"
                      ? "text-[var(--err)]"
                      : issue.severity === "warning"
                        ? "text-[var(--warn)]"
                        : "text-[var(--muted)]"
                  }
                >
                  <span className="font-mono text-[11px] uppercase">
                    {issue.severity}
                  </span>{" "}
                  — {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
          <h3 className="mb-3 text-lg font-bold text-[var(--ink)]">
            Document notes
          </h3>
          {data.document_notes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No quality notes.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              {data.document_notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <details className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <summary className="cursor-pointer text-lg font-bold text-[var(--ink)]">
          Raw JSON
        </summary>
        <pre className="mt-4 max-h-[480px] overflow-auto rounded-sm bg-[var(--ink)] p-4 font-mono text-[11px] leading-relaxed text-[#e8eef5]">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>

      <details className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <summary className="cursor-pointer text-lg font-bold text-[var(--ink)]">
          Extracted text preview
        </summary>
        <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--muted)]">
          {result.extracted_text_preview}
        </pre>
      </details>
    </section>
  );
}
