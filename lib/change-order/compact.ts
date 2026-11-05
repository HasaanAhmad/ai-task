import type {
  ChangeItem,
  ChangeOrderExtraction,
  FieldValue,
} from "./schema";

type StatusChar = "f" | "m" | "a" | "x";

const STATUS_MAP = {
  f: "found",
  m: "missing",
  a: "ambiguous",
  x: "conflict",
} as const;

function missingField(): FieldValue {
  return {
    value: null,
    confidence: 0,
    status: "missing",
    raw_text: null,
    notes: null,
  };
}

function normalizeStatus(raw: unknown): StatusChar {
  if (typeof raw !== "string") return "f";
  const s = raw.trim().toLowerCase();
  if (s === "f" || s === "found") return "f";
  if (s === "m" || s === "missing") return "m";
  if (s === "a" || s === "ambiguous") return "a";
  if (s === "x" || s === "conflict" || s === "conflicting") return "x";
  return "f";
}

function asConfidence(raw: unknown, fallback = 0.7): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1 && n <= 100) return Math.min(1, n / 100);
  return Math.min(1, Math.max(0, n));
}

function looksLikeFieldTuple(raw: unknown): raw is unknown[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 3) return false;
  const first = raw[0];
  // Nested field tuple: [[value, conf, status], ...]
  if (Array.isArray(first)) return false;
  if (
    first === null ||
    typeof first === "string" ||
    typeof first === "number" ||
    typeof first === "boolean"
  ) {
    if (raw.length === 1) return true;
    if (raw.length >= 2 && (typeof raw[1] === "number" || typeof raw[1] === "string")) {
      return true;
    }
  }
  return false;
}

function unwrapNestedField(raw: unknown, depth = 0): unknown {
  if (depth > 3 || raw === undefined || raw === null) return raw;

  // [[value, conf, status]] → [value, conf, status]
  if (Array.isArray(raw) && raw.length === 1 && looksLikeFieldTuple(raw[0])) {
    return unwrapNestedField(raw[0], depth + 1);
  }

  // { value: [value, conf, status] } → unwrap value first
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const inner = obj.value ?? obj.v;
    if (looksLikeFieldTuple(inner) || Array.isArray(inner)) {
      return unwrapNestedField(inner, depth + 1);
    }
  }

  return raw;
}

/** Coerce Gemini's messy field shapes into a FieldValue. */
export function coerceField(raw: unknown): FieldValue {
  if (raw === undefined || raw === null) return missingField();

  const normalized = unwrapNestedField(raw);

  // Tuple / array: [value], [value, conf], [value, conf, status]
  if (Array.isArray(normalized)) {
    if (normalized.length === 0) return missingField();

    // Still nested somehow — recurse on first element
    if (Array.isArray(normalized[0]) || (normalized[0] && typeof normalized[0] === "object")) {
      return coerceField(normalized[0]);
    }

    const value = (normalized[0] ?? null) as FieldValue["value"];
    const confidence = asConfidence(normalized[1], value === null ? 0 : 0.7);
    const status = normalizeStatus(
      normalized[2] ?? (value === null ? "m" : "f"),
    );
    return {
      value: value === undefined ? null : value,
      confidence: status === "m" && value === null ? 0 : confidence,
      status: STATUS_MAP[status],
      raw_text: null,
      notes: null,
    };
  }

  // Object forms: {value,confidence,status} or {v,c,s}
  if (typeof normalized === "object") {
    const obj = normalized as Record<string, unknown>;
    let value = obj.value ?? obj.v ?? null;

    // If value is still a field-shaped structure, unwrap it
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return coerceField(value);
    }

    const confidence = asConfidence(
      obj.confidence ?? obj.c,
      value === null ? 0 : 0.7,
    );
    const status = normalizeStatus(
      obj.status ?? obj.s ?? (value === null ? "m" : "f"),
    );
    return {
      value: (value === undefined ? null : value) as FieldValue["value"],
      confidence,
      status: STATUS_MAP[status],
      raw_text: typeof obj.raw_text === "string" ? obj.raw_text : null,
      notes: typeof obj.notes === "string" ? obj.notes : null,
    };
  }

  // Bare scalar
  if (
    typeof normalized === "string" ||
    typeof normalized === "number" ||
    typeof normalized === "boolean"
  ) {
    return {
      value: normalized,
      confidence: 0.7,
      status: "found",
      raw_text: null,
      notes: null,
    };
  }

  return missingField();
}

function coerceParty(raw: unknown): ChangeOrderExtraction["contractor"] {
  if (raw === undefined || raw === null) {
    return {
      name: missingField(),
      company: missingField(),
      address: missingField(),
      contact: missingField(),
    };
  }

  // Sometimes model returns a bare name string
  if (typeof raw === "string" || typeof raw === "number") {
    return {
      name: coerceField(raw),
      company: missingField(),
      address: missingField(),
      contact: missingField(),
    };
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      name: coerceField(obj.name ?? obj.Name),
      company: coerceField(obj.company ?? obj.Company),
      address: coerceField(obj.address ?? obj.Address),
      contact: coerceField(obj.contact ?? obj.Contact),
    };
  }

  return {
    name: missingField(),
    company: missingField(),
    address: missingField(),
    contact: missingField(),
  };
}

function scalarField(
  value: string | number | boolean | null | undefined,
  confidence = 0.7,
): FieldValue {
  if (value === undefined || value === null || value === "") {
    return missingField();
  }
  return {
    value,
    confidence,
    status: "found",
    raw_text: null,
    notes: null,
  };
}

function coerceItemType(
  raw: unknown,
): ChangeItem["type"] {
  if (typeof raw !== "string") return "unknown";
  const s = raw.trim().toLowerCase();
  if (s.includes("deduct") || s.includes("credit") || s === "deduction") {
    return "deduction";
  }
  if (s.includes("add") || s === "addition") return "addition";
  if (s.includes("allow")) return "allowance";
  if (s === "other") return "other";
  return "unknown";
}

function coerceItem(raw: unknown): ChangeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const conf = asConfidence(item.c ?? item.confidence, 0.7);

  // Support both compact and verbose keys
  const description =
    item.d ?? item.description ?? item.desc ?? item.Description;
  const amount = item.amt ?? item.amount ?? item.Amount;
  const number = item.n ?? item.item_number ?? item.number ?? item.Item;
  const qty = item.qty ?? item.quantity;
  const unit = item.u ?? item.unit;
  const unitCost = item.uc ?? item.unit_cost ?? item.unitCost;

  return {
    item_number: coerceField(number ?? null),
    description: coerceField(description ?? null),
    quantity: coerceField(qty ?? null),
    unit: coerceField(unit ?? null),
    unit_cost: coerceField(unitCost ?? null),
    amount: coerceField(amount ?? null),
    type: coerceItemType(item.type),
    confidence: conf,
  };
}

function coerceApproval(
  raw: unknown,
): ChangeOrderExtraction["approvals"][number] | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    role: coerceField(a.role ?? a.Role ?? null),
    name: coerceField(a.name ?? a.Name ?? null),
    date: coerceField(a.date ?? a.Date ?? null),
    signed: coerceField(a.signed ?? a.Signed ?? null),
  };
}

function coerceDocType(
  raw: unknown,
): ChangeOrderExtraction["document_type"] {
  if (typeof raw !== "string") return "unknown";
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s.includes("change_request") || s === "cr" || s === "cor") {
    return "change_request";
  }
  if (s.includes("change_order") || s === "co" || s.includes("changeorder")) {
    return "change_order";
  }
  return "unknown";
}

function coerceStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return String(obj.path ?? obj.field ?? obj.message ?? JSON.stringify(item));
      }
      return String(item);
    })
    .filter(Boolean);
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

/**
 * Expand / coerce arbitrary model JSON into the full app schema.
 * Tolerant of Gemini omitting tuple slots or using verbose keys.
 */
export function expandCompact(raw: unknown): ChangeOrderExtraction {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const itemsRaw = pick(obj, ["items", "change_items", "line_items"]) ?? [];
  const items = (Array.isArray(itemsRaw) ? itemsRaw : [])
    .map(coerceItem)
    .filter((x): x is ChangeItem => x !== null);

  const approvalsRaw = pick(obj, ["approvals", "signatures"]) ?? [];
  const approvals = (Array.isArray(approvalsRaw) ? approvalsRaw : [])
    .map(coerceApproval)
    .filter(
      (x): x is ChangeOrderExtraction["approvals"][number] => x !== null,
    );

  const overallRaw = pick(obj, ["overall", "overall_confidence"]);
  const overall = asConfidence(overallRaw, 0.5);

  return {
    document_type: coerceDocType(pick(obj, ["t", "document_type", "type"])),
    project_name: coerceField(pick(obj, ["project_name", "projectName"])),
    project_number: coerceField(
      pick(obj, ["project_number", "projectNumber", "project_no"]),
    ),
    change_order_number: coerceField(
      pick(obj, [
        "change_order_number",
        "changeOrderNumber",
        "co_number",
        "number",
      ]),
    ),
    date_issued: coerceField(pick(obj, ["date_issued", "dateIssued", "date"])),
    contractor: coerceParty(pick(obj, ["contractor", "gc", "general_contractor"])),
    client: coerceParty(pick(obj, ["client", "owner", "customer"])),
    original_contract_amount: coerceField(
      pick(obj, ["original_contract_amount", "originalContractAmount"]),
    ),
    description_of_changes: coerceField(
      pick(obj, ["description_of_changes", "description", "changes"]),
    ),
    additional_costs: coerceField(
      pick(obj, ["additional_costs", "additions", "adds"]),
    ),
    deductions: coerceField(pick(obj, ["deductions", "deducts", "credits"])),
    net_change: coerceField(pick(obj, ["net_change", "netChange", "net"])),
    revised_contract_amount: coerceField(
      pick(obj, ["revised_contract_amount", "revisedContractAmount", "revised"]),
    ),
    schedule_impact_days: coerceField(
      pick(obj, ["schedule_impact_days", "scheduleImpact", "days"]),
    ),
    reason_for_change: coerceField(
      pick(obj, ["reason_for_change", "reason"]),
    ),
    change_items: items,
    approvals,
    missing_fields: coerceStringList(pick(obj, ["missing", "missing_fields"])),
    ambiguous_fields: coerceStringList(
      pick(obj, ["ambiguous", "ambiguous_fields"]),
    ),
    conflicting_fields: coerceStringList(
      pick(obj, ["conflicts", "conflicting_fields"]),
    ),
    document_notes: coerceStringList(pick(obj, ["notes", "document_notes"])),
    overall_confidence: overall,
  };
}

/** Soft-trim document text for the model while keeping head + tail. */
export function trimForModel(text: string, maxChars = 12_000): string {
  const cleaned = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 32;
  return `${cleaned.slice(0, head)}\n\n[…truncated…]\n\n${cleaned.slice(-tail)}`;
}
