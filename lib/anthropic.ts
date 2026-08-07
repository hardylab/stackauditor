// The Anthropic seam.
//
// This is the ONLY file that talks to the model. It is written against the real
// SDK surface so that going live is a matter of setting ANTHROPIC_API_KEY --
// there is no "rewrite this properly later" step. Until that key exists,
// runAuditModel() short-circuits to a deterministic fixture (MOCK_AUDIT).
//
// Design decisions worth keeping:
//   1. Structured output via forced tool use, not JSON-in-prose. The model must
//      call `emit_audit`, so we never parse free text or repair broken JSON.
//   2. Prompt caching on the system rubric. The rubric is ~1.5k static tokens
//      sent on every audit; caching cuts repeat input cost ~90% and is the
//      difference between SOL-2's $0.15/audit budget and roughly $0.30.
//   3. Input token cap (MAX_INPUT_TOKENS) enforced by the caller.

import Anthropic from '@anthropic-ai/sdk';
import { env, isMockMode } from './env';
import { MAX_INPUT_TOKENS } from './limits';
import type { AuditResult } from './types';

// Latest Sonnet. SOL-2 picked Sonnet for the vision/reasoning/cost balance.
export const AUDIT_MODEL = 'claude-sonnet-4-6';

/**
 * Static audit rubric. Deliberately verbose -- audit quality is the product.
 * Because it never varies per request it is marked cacheable below.
 */
const AUDIT_RUBRIC = `You are StackAuditor, an expert SaaS spend auditor for solo consultants and 1-5 person agencies.

You receive a screenshot or PDF of a customer's SaaS billing dashboard, subscription list, or expense export. Extract every tool you can identify, then produce a plain-language audit.

## Extraction rules
- Report a tool only if you can actually see it in the document. Never infer a tool from industry norms.
- monthly_cost_usd: normalise annual plans to monthly (divide by 12). Null if not visible.
- seats: null if not visible. Do not guess.
- confidence: your genuine certainty the tool and its figures were read correctly (0-1). Low-resolution screenshots, cropped rows, and ambiguous logos should score below 0.6.

## Finding rules
Produce findings in these categories only:
- wasted_spend: paying for a tool with no evident use, duplicate billing, or a plan tier above evident need.
- redundant_seats: more seats than the visible team size, or seats on a tool superseded by another in the same stack.
- unused_feature: paying a premium tier for a feature the rest of the stack already covers.
- security_risk: shared/generic accounts, no SSO on a tool holding customer data, or an obviously unmaintained integration.

For each finding: be specific and name the tool. "Notion and Confluence overlap" is useful; "consider reviewing your tools" is not.
estimated_monthly_saving_usd must be grounded in a cost you actually read from the document. Use null when the saving is real but the document does not show the number -- never invent a figure.

## Tone and liability
Plain language, no jargon, second person. This is informational, not financial, legal, or security advice; never phrase a finding as a compliance guarantee. Keep summary under 120 words and lead with the single biggest saving.`;

/**
 * Tool schema mirrors AuditResult in lib/types.ts. Keep them in sync.
 * Forcing this tool is what makes the output parseable by construction.
 */
const AUDIT_TOOL: Anthropic.Tool = {
  name: 'emit_audit',
  description: 'Emit the structured SaaS stack audit. Must be called exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      detected_tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            monthly_cost_usd: { type: ['number', 'null'] },
            seats: { type: ['integer', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['name', 'monthly_cost_usd', 'seats', 'confidence'],
        },
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['wasted_spend', 'redundant_seats', 'unused_feature', 'security_risk'],
            },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            title: { type: 'string' },
            detail: { type: 'string' },
            estimated_monthly_saving_usd: { type: ['number', 'null'] },
          },
          required: ['kind', 'severity', 'title', 'detail', 'estimated_monthly_saving_usd'],
        },
      },
      total_estimated_monthly_saving_usd: { type: 'number' },
      summary: { type: 'string' },
    },
    required: [
      'detected_tools',
      'findings',
      'total_estimated_monthly_saving_usd',
      'summary',
    ],
  },
};

/** Deterministic fixture returned whenever ANTHROPIC_API_KEY is absent. */
export const MOCK_AUDIT: AuditResult = {
  detected_tools: [
    { name: 'Notion', monthly_cost_usd: 40, seats: 5, confidence: 0.94 },
    { name: 'Confluence', monthly_cost_usd: 29, seats: 5, confidence: 0.88 },
    { name: 'Zoom Pro', monthly_cost_usd: 45, seats: 3, confidence: 0.91 },
    { name: 'Dropbox Business', monthly_cost_usd: 75, seats: 5, confidence: 0.83 },
  ],
  findings: [
    {
      kind: 'wasted_spend',
      severity: 'high',
      title: 'Notion and Confluence do the same job',
      detail:
        'You are paying for two team wikis at once. Confluence has 5 seats at $29/mo while Notion covers the same documents for your team. Consolidating on one removes the smaller bill outright.',
      estimated_monthly_saving_usd: 29,
    },
    {
      kind: 'redundant_seats',
      severity: 'medium',
      title: 'Dropbox is billed for 5 seats',
      detail:
        'Dropbox Business is billed for 5 seats but only 3 people appear on your Zoom plan. If the team is really 3, two seats at roughly $15 each are being paid for nobody.',
      estimated_monthly_saving_usd: 30,
    },
    {
      kind: 'security_risk',
      severity: 'medium',
      title: 'No SSO on the tool holding client files',
      detail:
        'Dropbox Business is holding client files without single sign-on visible on this plan. Individual passwords on a shared client-data store is the most common way a small agency loses a client account. This is informational, not a compliance assessment.',
      estimated_monthly_saving_usd: null,
    },
  ],
  total_estimated_monthly_saving_usd: 59,
  summary:
    'Your biggest win is dropping Confluence: Notion already covers it, saving $29/mo. Trimming two unused Dropbox seats adds about $30/mo more, so roughly $59/mo or $708/yr is recoverable without changing how you work. Separately, your client files sit in Dropbox without SSO -- worth fixing before it becomes a client conversation.',
};

export type AuditModelInput = {
  /** Base64-encoded upload (no data: prefix). */
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  /** Optional user-supplied hints, e.g. manually labelled tools. */
  note?: string;
};

export type AuditModelOutput = {
  result: AuditResult;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  mocked: boolean;
};

function buildContent(input: AuditModelInput): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];

  if (input.mediaType === 'application/pdf') {
    blocks.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: input.data },
    });
  } else {
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: input.mediaType, data: input.data },
    });
  }

  blocks.push({
    type: 'text',
    text: input.note
      ? 'Audit this SaaS stack. User notes: ' + input.note
      : 'Audit this SaaS stack.',
  });

  return blocks;
}

/**
 * Run the audit model. Returns structured output or throws.
 *
 * In mock mode this resolves immediately with MOCK_AUDIT and zeroed usage --
 * the caller cannot tell the difference apart from `mocked: true`.
 */
export async function runAuditModel(
  input: AuditModelInput
): Promise<AuditModelOutput> {
  if (isMockMode.anthropic) {
    return {
      result: MOCK_AUDIT,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      mocked: true,
    };
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey! });

  const message = await client.messages.create({
    model: AUDIT_MODEL,
    max_tokens: 4096,
    // Cache the rubric: static across every request, ~1.5k tokens, 90% cheaper on read.
    system: [
      {
        type: 'text',
        text: AUDIT_RUBRIC,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [AUDIT_TOOL],
    // Force the tool so output is structured by construction, never prose.
    tool_choice: { type: 'tool', name: 'emit_audit' },
    messages: [{ role: 'user', content: buildContent(input) }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new Error(
      'Model did not call emit_audit (stop_reason: ' + message.stop_reason + ')'
    );
  }

  return {
    result: toolUse.input as AuditResult,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
    },
    mocked: false,
  };
}

/** Rough guard so an oversized upload cannot blow the per-audit cost budget. */
export function estimateInputTokens(base64Length: number): number {
  // ~750 tokens per 1000 base64 chars is a safe over-estimate for images.
  return Math.ceil((base64Length / 1000) * 750);
}

export function exceedsTokenBudget(base64Length: number): boolean {
  return estimateInputTokens(base64Length) > MAX_INPUT_TOKENS;
}
