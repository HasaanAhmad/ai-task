import { expandCompact, trimForModel } from "./compact";
import type { ChangeOrderExtraction } from "./schema";

/**
 * Tiny prompt + compact JSON keys = low input/output tokens.
 * Full schema is expanded server-side in expandCompact().
 */
const SYSTEM_PROMPT = `Extract construction change-order data. Return ONLY JSON.
Every field MUST be a 3-item array: [value|null, confidence 0-1, status]
status MUST be one of: f, m, a, x (found/missing/ambiguous/conflict).
Example: "project_name":["Harborview Pavilion",0.95,"f"]
Money/days as plain numbers. No invented facts. Omit empty optional keys.
Schema:
{"t":"change_order|change_request|unknown","project_name":[v,c,s],"project_number":[v,c,s],"change_order_number":[v,c,s],"date_issued":[v,c,s],"contractor":{"name":[v,c,s],"company":[v,c,s],"address":[v,c,s],"contact":[v,c,s]},"client":{same},"original_contract_amount":[v,c,s],"description_of_changes":[v,c,s],"additional_costs":[v,c,s],"deductions":[v,c,s],"net_change":[v,c,s],"revised_contract_amount":[v,c,s],"schedule_impact_days":[v,c,s],"reason_for_change":[v,c,s],"items":[{"n":"#","d":"desc","qty":0,"u":"unit","uc":0,"amt":0,"type":"addition|deduction|allowance|other|unknown","c":0.9}],"approvals":[{"role":"","name":"","date":"","signed":true,"c":0.9}],"missing":[],"ambiguous":[],"conflicts":[],"notes":[],"overall":0.9}`;

export type AiUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

type OpenAIResponse = {
  choices?: Array<{
    message?: { content?: string | null; refusal?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string; code?: string };
};

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}

export function getModelName(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function maxDocChars(): number {
  const raw = Number(process.env.EXTRACT_MAX_CHARS ?? "12000");
  return Number.isFinite(raw) && raw > 2000 ? raw : 12_000;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

export async function extractWithAi(
  documentText: string,
  filename: string,
): Promise<{ data: ChangeOrderExtraction; usage: AiUsage; model: string }> {
  const apiKey = getApiKey();
  const model = getModelName();
  const doc = trimForModel(documentText, maxDocChars());

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${filename}\n---\n${doc}` },
      ],
    }),
  });

  const payload = (await response.json()) as OpenAIResponse;

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message || `OpenAI request failed (${response.status})`,
    );
  }

  const content = stripCodeFence(payload.choices?.[0]?.message?.content ?? "");
  if (!content) {
    throw new Error(
      payload.choices?.[0]?.message?.refusal ||
        "Model returned empty extraction",
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("Model returned invalid JSON");
  }

  const usage = payload.usage;

  return {
    data: expandCompact(parsedJson),
    model,
    usage: {
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      total_tokens: usage?.total_tokens ?? null,
    },
  };
}
