import fs from "node:fs";
import { extractFromPdf } from "../lib/change-order/extract-text";
import { normalizeExtraction } from "../lib/change-order/normalize";
import { validateExtraction } from "../lib/change-order/validate";
import type { ChangeOrderExtraction, FieldValue } from "../lib/change-order/schema";

function field(
  value: FieldValue["value"],
  confidence = 0.9,
  status: FieldValue["status"] = "found",
): FieldValue {
  return { value, confidence, status, raw_text: null, notes: null };
}

const pdfBuf = fs.readFileSync("public/samples/change-order-clean.pdf");
const pdf = await extractFromPdf(
  pdfBuf.buffer.slice(pdfBuf.byteOffset, pdfBuf.byteOffset + pdfBuf.byteLength),
);
console.log("PDF chars", pdf.text.length, "pages", pdf.pageCount, "scanned?", pdf.likelyScanned);
console.log("PDF has Harborview?", pdf.text.includes("Harborview"));

const conflictBuf = fs.readFileSync("public/samples/change-order-conflict.pdf");
const conflict = await extractFromPdf(
  conflictBuf.buffer.slice(
    conflictBuf.byteOffset,
    conflictBuf.byteOffset + conflictBuf.byteLength,
  ),
);
console.log("Conflict PDF chars", conflict.text.length);

const mock = normalizeExtraction({
  document_type: "change_order",
  project_name: field("Harborview Medical Pavilion Expansion"),
  project_number: field("HMP-2024-118"),
  change_order_number: field("CO-007"),
  date_issued: field("2025-03-14"),
  contractor: {
    name: field("Apex"),
    company: field(null, 0, "missing"),
    address: field(null, 0, "missing"),
    contact: field(null, 0, "missing"),
  },
  client: {
    name: field("Harborview"),
    company: field(null, 0, "missing"),
    address: field(null, 0, "missing"),
    contact: field(null, 0, "missing"),
  },
  original_contract_amount: field("$4,250,000.00"),
  description_of_changes: field("steel + fireproofing"),
  additional_costs: field(63500),
  deductions: field(12000),
  net_change: field(51500),
  revised_contract_amount: field(4301500),
  schedule_impact_days: field("+7 days"),
  reason_for_change: field("AHJ"),
  change_items: [
    {
      item_number: field("1"),
      description: field("steel"),
      quantity: field(1),
      unit: field("LS"),
      unit_cost: field(48500),
      amount: field(48500),
      type: "addition",
      confidence: 0.9,
    },
    {
      item_number: field("2"),
      description: field("fire"),
      quantity: field(2400),
      unit: field("SF"),
      unit_cost: field(6.25),
      amount: field(15000),
      type: "addition",
      confidence: 0.9,
    },
    {
      item_number: field("3"),
      description: field("credit"),
      quantity: field(1),
      unit: field("LS"),
      unit_cost: field(12000),
      amount: field(12000),
      type: "deduction",
      confidence: 0.9,
    },
  ],
  approvals: [],
  missing_fields: [],
  ambiguous_fields: [],
  conflicting_fields: [],
  document_notes: [],
  overall_confidence: 0.92,
} satisfies ChangeOrderExtraction);

console.log(
  "normalized original",
  mock.original_contract_amount.value,
  "days",
  mock.schedule_impact_days.value,
);
const v = validateExtraction(mock);
console.log("validation", v.is_valid, v.recalculated);
console.log("issues", v.issues.map((i) => i.code));

const bad = validateExtraction({
  ...mock,
  net_change: field(99999),
  revised_contract_amount: field(1),
});
console.log(
  "bad validation",
  bad.is_valid,
  bad.issues.map((i) => i.code),
);
