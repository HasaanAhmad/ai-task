import { z } from "zod";

/** Single extracted field with confidence and status. */
export const FieldSchema = z.object({
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .describe("Normalized extracted value, or null if missing"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Model confidence from 0 to 1"),
  status: z
    .enum(["found", "missing", "ambiguous", "conflict"])
    .describe("Extraction status for this field"),
  raw_text: z
    .union([z.string(), z.null()])
    .describe("Verbatim snippet from the document, if any"),
  notes: z
    .union([z.string(), z.null()])
    .describe("Ambiguity, conflict, or normalization notes"),
});

export const PartySchema = z.object({
  name: FieldSchema,
  company: FieldSchema,
  address: FieldSchema,
  contact: FieldSchema,
});

export const ChangeItemSchema = z.object({
  item_number: FieldSchema,
  description: FieldSchema,
  quantity: FieldSchema,
  unit: FieldSchema,
  unit_cost: FieldSchema,
  amount: FieldSchema,
  type: z
    .enum(["addition", "deduction", "allowance", "other", "unknown"])
    .describe("Whether this line increases or decreases the contract"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence for this change item"),
});

export const SignatureSchema = z.object({
  role: FieldSchema,
  name: FieldSchema,
  date: FieldSchema,
  signed: FieldSchema,
});

/** Structured extraction the model must return. */
export const ChangeOrderExtractionSchema = z.object({
  document_type: z
    .enum(["change_order", "change_request", "unknown"])
    .describe("Detected document type"),
  project_name: FieldSchema,
  project_number: FieldSchema,
  change_order_number: FieldSchema,
  date_issued: FieldSchema,
  contractor: PartySchema,
  client: PartySchema,
  original_contract_amount: FieldSchema,
  description_of_changes: FieldSchema,
  additional_costs: FieldSchema,
  deductions: FieldSchema,
  net_change: FieldSchema,
  revised_contract_amount: FieldSchema,
  schedule_impact_days: FieldSchema,
  reason_for_change: FieldSchema,
  change_items: z
    .array(ChangeItemSchema)
    .describe("Individual change request / line items found"),
  approvals: z.array(SignatureSchema).describe("Approval / signature blocks"),
  missing_fields: z
    .array(z.string())
    .describe("Field paths that could not be extracted"),
  ambiguous_fields: z
    .array(z.string())
    .describe("Field paths with unclear or multiple possible values"),
  conflicting_fields: z
    .array(z.string())
    .describe("Field paths where values conflict within the document"),
  document_notes: z
    .array(z.string())
    .describe("Quality issues: formatting, missing sections, inconsistencies"),
  overall_confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall extraction confidence"),
});

export type FieldValue = z.infer<typeof FieldSchema>;
export type ChangeItem = z.infer<typeof ChangeItemSchema>;
export type ChangeOrderExtraction = z.infer<typeof ChangeOrderExtractionSchema>;

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  fields: string[];
};

export type ExtractionResult = {
  success: true;
  source: {
    filename: string;
    mime_type: string;
    extraction_method: "pdf_text" | "plain_text";
    ocr_used: false;
    character_count: number;
    page_count: number | null;
  };
  extracted_text_preview: string;
  data: ChangeOrderExtraction;
  validation: {
    is_valid: boolean;
    issues: ValidationIssue[];
    recalculated: {
      net_change: number | null;
      revised_contract_amount: number | null;
      change_items_total: number | null;
    };
  };
  model: string;
  processing_ms: number;
  usage: {
    prompt_tokens: number | null;
    completion_tokens: number | null;
    total_tokens: number | null;
  };
};

export type ExtractionError = {
  success: false;
  error: string;
  code:
    | "UNSUPPORTED_TYPE"
    | "EMPTY_TEXT"
    | "PDF_PARSE_FAILED"
    | "LIKELY_SCANNED"
    | "AI_FAILED"
    | "VALIDATION_FAILED"
    | "MISSING_API_KEY";
  details?: string;
};
