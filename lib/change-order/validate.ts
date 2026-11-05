import { parseMoney } from "./normalize";
import type {
  ChangeOrderExtraction,
  ValidationIssue,
} from "./schema";

const TOLERANCE = 0.02;

function money(value: unknown): number | null {
  return parseMoney(value);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

export type ValidationResult = {
  is_valid: boolean;
  issues: ValidationIssue[];
  recalculated: {
    net_change: number | null;
    revised_contract_amount: number | null;
    change_items_total: number | null;
  };
};

export function validateExtraction(data: ChangeOrderExtraction): ValidationResult {
  const issues: ValidationIssue[] = [];

  const original = money(data.original_contract_amount.value);
  const additions = money(data.additional_costs.value);
  const deductions = money(data.deductions.value);
  const net = money(data.net_change.value);
  const revised = money(data.revised_contract_amount.value);

  let changeItemsTotal: number | null = null;
  if (data.change_items.length > 0) {
    let sum = 0;
    let any = false;
    for (const item of data.change_items) {
      const amount = money(item.amount.value);
      if (amount === null) continue;
      any = true;
      const signed =
        item.type === "deduction" ? -Math.abs(amount) : amount;
      sum += signed;
    }
    changeItemsTotal = any ? Math.round(sum * 100) / 100 : null;
  }

  let expectedNet: number | null = null;
  if (additions !== null || deductions !== null) {
    expectedNet =
      Math.round(((additions ?? 0) - Math.abs(deductions ?? 0)) * 100) / 100;
  } else if (changeItemsTotal !== null) {
    expectedNet = changeItemsTotal;
  }

  let expectedRevised: number | null = null;
  if (original !== null && expectedNet !== null) {
    expectedRevised = Math.round((original + expectedNet) * 100) / 100;
  } else if (original !== null && net !== null) {
    expectedRevised = Math.round((original + net) * 100) / 100;
  }

  if (expectedNet !== null && net !== null && !nearlyEqual(expectedNet, net)) {
    issues.push({
      code: "NET_CHANGE_MISMATCH",
      severity: "error",
      message: `Net change ${net} does not match additions − deductions (${expectedNet}).`,
      fields: ["net_change", "additional_costs", "deductions"],
    });
  }

  if (
    expectedRevised !== null &&
    revised !== null &&
    !nearlyEqual(expectedRevised, revised)
  ) {
    issues.push({
      code: "REVISED_AMOUNT_MISMATCH",
      severity: "error",
      message: `Revised contract amount ${revised} does not match original + net (${expectedRevised}).`,
      fields: [
        "revised_contract_amount",
        "original_contract_amount",
        "net_change",
      ],
    });
  }

  if (
    changeItemsTotal !== null &&
    expectedNet !== null &&
    additions === null &&
    deductions === null &&
    net !== null &&
    !nearlyEqual(changeItemsTotal, net)
  ) {
    issues.push({
      code: "LINE_ITEMS_TOTAL_MISMATCH",
      severity: "warning",
      message: `Sum of change items (${changeItemsTotal}) does not match stated net change (${net}).`,
      fields: ["change_items", "net_change"],
    });
  }

  if (
    changeItemsTotal !== null &&
    (additions !== null || deductions !== null)
  ) {
    const stated =
      Math.round(((additions ?? 0) - Math.abs(deductions ?? 0)) * 100) / 100;
    if (!nearlyEqual(changeItemsTotal, stated)) {
      issues.push({
        code: "LINE_ITEMS_VS_TOTALS",
        severity: "warning",
        message: `Line-item total (${changeItemsTotal}) differs from additional costs − deductions (${stated}).`,
        fields: ["change_items", "additional_costs", "deductions"],
      });
    }
  }

  for (const path of data.missing_fields) {
    issues.push({
      code: "MISSING_FIELD",
      severity: "info",
      message: `Missing field: ${path}`,
      fields: [path],
    });
  }

  for (const path of data.ambiguous_fields) {
    issues.push({
      code: "AMBIGUOUS_FIELD",
      severity: "warning",
      message: `Ambiguous field: ${path}`,
      fields: [path],
    });
  }

  for (const path of data.conflicting_fields) {
    issues.push({
      code: "CONFLICTING_FIELD",
      severity: "error",
      message: `Conflicting values for: ${path}`,
      fields: [path],
    });
  }

  const required = [
    ["project_name", data.project_name],
    ["change_order_number", data.change_order_number],
    ["original_contract_amount", data.original_contract_amount],
    ["revised_contract_amount", data.revised_contract_amount],
  ] as const;

  for (const [path, field] of required) {
    if (field.status === "missing" || field.value === null || field.value === "") {
      if (!issues.some((i) => i.fields.includes(path) && i.code === "MISSING_FIELD")) {
        issues.push({
          code: "MISSING_FIELD",
          severity: "warning",
          message: `Required field not found: ${path}`,
          fields: [path],
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    is_valid: !hasErrors,
    issues,
    recalculated: {
      net_change: expectedNet,
      revised_contract_amount: expectedRevised,
      change_items_total: changeItemsTotal,
    },
  };
}
