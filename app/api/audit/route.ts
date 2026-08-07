// POST /api/audit -- run the audit for a previously uploaded file.
//
// Body: { uploadId, email, base64?, note?, utm_source?, utm_medium?, ... }
//
// `base64` is accepted directly only while Supabase Storage is mocked; in the
// live path the bytes are re-read from storage by uploadId and the field is
// ignored. That keeps the scaffold runnable without changing the route later.

import { NextRequest } from 'next/server';
import { runAuditPipeline } from '@/lib/audit-pipeline';
import { mockStatus } from '@/lib/env';
import { jsonError, extractUtm, normaliseEmail } from '@/lib/validation';

export const runtime = 'nodejs';

// Vision + a 4k-token structured response can exceed the default 10s on Vercel.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Expected a JSON body.', 400);
  }

  const uploadId = typeof body.uploadId === 'string' ? body.uploadId : null;
  if (!uploadId) {
    return jsonError('Missing "uploadId".', 400);
  }

  const email = normaliseEmail(body.email);
  if (!email) {
    return jsonError('A valid "email" is required to run an audit.', 400);
  }

  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  const note = typeof body.note === 'string' ? body.note : undefined;

  try {
    const outcome = await runAuditPipeline({
      uploadId,
      email,
      utm: extractUtm(body),
      base64,
      note,
    });

    if (!outcome.ok) {
      // 402 is the paywall signal the client turns into a Stripe redirect.
      return jsonError(outcome.error, outcome.status, {
        used: outcome.used,
        checkoutUrl: outcome.status === 402 ? '/api/checkout' : undefined,
      });
    }

    return Response.json({
      auditId: outcome.auditId,
      isFree: outcome.isFree,
      needsManualLabelling: outcome.needsManualLabelling,
      result: outcome.result,
      usage: outcome.usage,
      mocked: outcome.mocked,
      mode: mockStatus(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audit failed.';
    return jsonError(message, 500);
  }
}
