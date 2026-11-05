import type { ChangeOrderExtraction, FieldValue } from "./schema";

const MONEY_RE =
  /(?:USD|US\$|\$)?\s*-?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:USD|dollars)?/i;

/** Parse a money-like value into a number, or null. */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[()]/g, (ch) => (ch === "(" ? "-" : ""));
  const match = cleaned.replace(/,/g, "").match(MONEY_RE);
  if (!match?.[1]) {
    const n = Number(cleaned.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  const n = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const negative = /^-|\(.*\)|deduct/i.test(cleaned) && !cleaned.includes("+");
  const amount = Math.round(n * 100) / 100;
  return negative && amount > 0 ? -amount : amount;
}

export function parseDays(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function asMoneyField(field: FieldValue): FieldValue {
  if (field.value === null || field.status === "missing") return field;
  const parsed = parseMoney(field.value);
  if (parsed === null) {
    return {
      ...field,
      status: field.status === "found" ? "ambiguous" : field.status,
      notes: field.notes ?? "Could not normalize monetary value",
    };
  }
  return { ...field, value: parsed };
}

function asDaysField(field: FieldValue): FieldValue {
  if (field.value === null || field.status === "missing") return field;
  const parsed = parseDays(field.value);
  if (parsed === null) {
    return {
      ...field,
      status: field.status === "found" ? "ambiguous" : field.status,
      notes: field.notes ?? "Could not normalize day count",
    };
  }
  return { ...field, value: parsed };
}

function normalizeParty(party: ChangeOrderExtraction["contractor"]) {
  return {
    name: party.name,
    company: party.company,
    address: party.address,
    contact: party.contact,
  };
}

/** Normalize money/day fields after model extraction. */
export function normalizeExtraction(
  data: ChangeOrderExtraction,
): ChangeOrderExtraction {
  return {
    ...data,
    contractor: normalizeParty(data.contractor),
    client: normalizeParty(data.client),
    original_contract_amount: asMoneyField(data.original_contract_amount),
    additional_costs: asMoneyField(data.additional_costs),
    deductions: asMoneyField(data.deductions),
    net_change: asMoneyField(data.net_change),
    revised_contract_amount: asMoneyField(data.revised_contract_amount),
    schedule_impact_days: asDaysField(data.schedule_impact_days),
    change_items: data.change_items.map((item) => ({
      ...item,
      unit_cost: asMoneyField(item.unit_cost),
      amount: asMoneyField(item.amount),
      quantity:
        item.quantity.value === null
          ? item.quantity
          : {
              ...item.quantity,
              value:
                typeof item.quantity.value === "number"
                  ? item.quantity.value
                  : parseDays(item.quantity.value) ?? item.quantity.value,
            },
    })),
  };
}
