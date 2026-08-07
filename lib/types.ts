// Shared contracts for the audit pipeline.
// The AuditResult shape is also the JSON schema we force the model to emit
// (see lib/anthropic.ts AUDIT_TOOL), so changing it here means changing the
// tool schema too.

export type UtmParams = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

export const EMPTY_UTM: UtmParams = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
};

/** One SaaS tool the model identified in the uploaded screenshot / PDF. */
export type DetectedTool = {
  name: string;
  monthly_cost_usd: number | null;
  seats: number | null;
  /** 0-1. Below CONFIDENCE_FLOOR we ask the user to confirm manually. */
  confidence: number;
};

export type AuditFinding = {
  kind: 'wasted_spend' | 'redundant_seats' | 'unused_feature' | 'security_risk';
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  /** Null when the saving is real but not quantifiable from the upload alone. */
  estimated_monthly_saving_usd: number | null;
};

export type AuditResult = {
  detected_tools: DetectedTool[];
  findings: AuditFinding[];
  total_estimated_monthly_saving_usd: number;
  summary: string;
};

/** Below this the UI must ask the user to label tools manually (SOL-2 risk item). */
export const CONFIDENCE_FLOOR = 0.6;

export type AuditRecord = {
  id: string;
  email: string;
  status: 'pending' | 'complete' | 'failed';
  is_free: boolean;
  result: AuditResult | null;
  utm: UtmParams;
};
