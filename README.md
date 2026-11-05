# Sledge — Change Order Extraction

Extract structured construction change-order data from **text-based PDFs** and plain text. Returns normalized fields, change items, per-field confidence scores, and financial validation.

**OCR is not enabled.** Scanned / image-only PDFs are rejected.

## Stack

- Next.js App Router API (`POST /api/extract`)
- `unpdf` for PDF text extraction
- OpenAI (`gpt-4o-mini` by default) for structured AI extraction
- Zod schema + deterministic money/schedule validation

## Setup

```bash
pnpm install
cp .env.example .env   # set OPENAI_API_KEY + APP_PASSWORD
pnpm samples           # generate sample PDF/TXT fixtures
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and enter the `APP_PASSWORD` passphrase.

### Token-lean extraction

- Compact JSON wire format (short keys) expanded server-side
- Short system prompt + OpenAI `json_object` response format
- Document text capped via `EXTRACT_MAX_CHARS` (default 12k, head+tail)
- Default model: `gpt-4o-mini`

## API

### Multipart upload

```bash
curl -X POST http://localhost:3000/api/extract \
  -F "file=@public/samples/change-order-clean.pdf"
```

### Raw text JSON

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"text":"...","filename":"co.txt"}'
```

Successful responses include `data` (structured extraction), `validation` (math checks / conflicts), and `source` metadata (`ocr_used: false`).

## Samples

Generated into `public/samples/`:

| File | Purpose |
|------|---------|
| `change-order-clean.txt` / `.pdf` | Complete, consistent change order |
| `change-order-messy.txt` | Ambiguous numbers, missing signatures |
| `change-order-conflict.pdf` | Conflicting totals |
| `change-order-sparse.txt` / `change-order-minimal.pdf` | Sparse documents |
