# Sledge — Change Order Extraction

Upload a construction change-order **PDF** or **TXT** file. Sledge pulls out the important fields (project, amounts, line items, signatures), scores how confident it is about each one, and checks whether the money math adds up.

**OCR is not enabled.** Only text-based PDFs work. Scanned / image-only PDFs are rejected on purpose.

---

## How we built it (simple steps)

1. **Accept a file** — PDF or plain text (or pasted text).
2. **Pull out the raw text** — for PDFs we use `unpdf` (no OCR). If almost no text comes out, we stop and tell you it looks scanned.
3. **Ask the LLM to structure it** — we send a short prompt plus a capped chunk of the document to OpenAI (`gpt-4o-mini`). The model returns compact JSON (short keys) to keep token use low.
4. **Normalize** — turn messy money strings like `$4,250,000.00` into numbers; turn “+7 days” into `7`.
5. **Validate** — check that additions − deductions ≈ net change, and original + net ≈ revised total. Flag missing / ambiguous / conflicting fields.
6. **Return JSON** — every field has a value, confidence score, and status (`found` / `missing` / `ambiguous` / `conflict`).

The UI is a simple upload page. The whole app is gated by one shared passphrase (`APP_PASSWORD`).

---

## Approach in one sentence

**Cheap text extraction + one small LLM call + hard math checks afterward** — don’t trust the model alone for totals.

---

## Failure modes (what goes wrong)

| Problem | What happens | What to do |
|---------|--------------|------------|
| **Scanned / image PDF** | Little or no text extracted → request rejected | Use a text PDF, or paste the text. OCR is out of scope for now. |
| **Messy / incomplete docs** | Fields come back `missing` or `ambiguous`, confidence drops | Expected — review the notes and validation panel. |
| **Conflicting numbers in the doc** | Validation shows mismatches (e.g. two different “net change” values) | Human review; we surface the conflict, we don’t invent a winner. |
| **Model returns weird JSON shapes** | We coerce common shapes (short tuples, nested fields). If JSON is totally broken, extraction fails | Retry; prompt/schema are tuned for compact output. |
| **API key / billing issues** | Clear auth or billing error | Fix `OPENAI_API_KEY` / account billing in `.env`. |
| **Huge documents** | Text is trimmed (head + tail) via `EXTRACT_MAX_CHARS` | Raise the cap if needed; more text = more tokens/cost. |
| **Handwriting / stamps only** | Not readable without OCR | Won’t be extracted. |

We also hit provider limits while building (expired OpenRouter keys, Gemini free-tier daily caps, inactive OpenAI billing). That’s why the stack settled on a working OpenAI key + `gpt-4o-mini`.

---

## Setup

```bash
pnpm install
cp .env.example .env   # set OPENAI_API_KEY + APP_PASSWORD
pnpm samples           # generate sample PDF/TXT fixtures
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and enter the passphrase from `APP_PASSWORD`.

### Live deployment

- **URL:** [https://sledge-change-order.vercel.app](https://sledge-change-order.vercel.app)
- **Passphrase:** value of `APP_PASSWORD` (currently `orderline` unless you change it on Vercel)

### Env

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `APP_PASSWORD` | Shared login passphrase |
| `EXTRACT_MAX_CHARS` | Max document chars sent to the model (default `12000`) |

---

## API

```bash
# File upload
curl -X POST http://localhost:3000/api/extract \
  -F "file=@public/samples/change-order-clean.pdf"

# Raw text
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"text":"...","filename":"co.txt"}'
```

Success responses include `data`, `validation`, `usage` (tokens), and `source` (`ocr_used: false`).

---

## Sample files

In `public/samples/`:

| File | Purpose |
|------|---------|
| `change-order-clean.txt` / `.pdf` | Complete, consistent change order |
| `change-order-messy.txt` | Ambiguous numbers, missing signatures |
| `change-order-conflict.pdf` | Conflicting totals |
| `change-order-sparse.txt` / `change-order-minimal.pdf` | Sparse / thin documents |

---

## Stack

- Next.js App Router (`POST /api/extract`)
- `unpdf` for PDF text
- OpenAI Chat Completions (JSON mode)
- Server-side normalize + financial validation
- Passphrase gate via `proxy.ts`
