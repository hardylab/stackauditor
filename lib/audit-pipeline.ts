// Pipeline orchestration: the one function that turns an upload into an audit.
//
//   getUpload -> free gate -> createAudit(pending) -> model -> completeAudit
//
// Route handlers stay thin; this is where the ordering guarantees live. In
// particular the audit row is created BEFORE the model runs so that a failed
// model call still consumes nothing and leaves a diagnosable 'pending' row.

import { exceedsTokenBudget, runAuditModel } from './anthropic';
import { checkFreeGate } from './free-gate';
import { completeAudit, createAudit, getUpload } from './repository';
import { CONFIDENCE_FLOOR, type AuditResult, type UtmParams } from './types';
import type { AllowedMimeType } from './limits';

export type PipelineInput = {
  uploadId: string;
  email: string;
  utm: UtmParams;
  /** Base64 upload body. In the live path this is re-read from Supabase Storage. */
  base64: string;
  note?: string;
};

export type PipelineOutput =
  | {
      ok: true;
      auditId: string;
      isFree: boolean;
      result: AuditResult;
      needsManualLabelling: boolean;
      mocked: boolean;
      usage: Awaited<ReturnType<typeof runAuditModel>>['usage'];
    }
  | { ok: false; status: number; error: string; used?: number };

/**
 * True when the model was not confident enough to trust the extraction.
 * SOL-2 risk mitigation: fall back to asking the user to label tools manually.
 */
export function needsManualLabelling(result: AuditResult): boolean {
  if (result.detected_tools.length === 0) return true;
  return result.detected_tools.some((t) => t.confidence < CONFIDENCE_FLOOR);
}

export async function runAuditPipeline(
  input: PipelineInput
): Promise<PipelineOutput> {
  const upload = await getUpload(input.uploadId);
  if (!upload) {
    return { ok: false, status: 404, error: 'Unknown uploadId.' };
  }

  if (exceedsTokenBudget(input.base64.length)) {
    return {
      ok: false,
      status: 413,
      error: 'Upload too large to audit within the per-audit cost budget.',
    };
  }

  const gate = await checkFreeGate(input.email);
  if (!gate.allowed) {
    return {
      ok: false,
      status: 402,
      error: 'Free audit already used. Purchase required.',
      used: gate.used,
    };
  }

  const audit = await createAudit({
    email: input.email,
    isFree: gate.isFree,
    utm: input.utm,
  });

  const { result, usage, mocked } = await runAuditModel({
    data: input.base64,
    mediaType: upload.mimeType as AllowedMimeType,
    note: input.note,
  });

  await completeAudit(audit.id, result);

  return {
    ok: true,
    auditId: audit.id,
    isFree: gate.isFree,
    result,
    needsManualLabelling: needsManualLabelling(result),
    mocked,
    usage,
  };
}
