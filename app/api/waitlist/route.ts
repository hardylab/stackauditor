// POST /api/waitlist -- capture email + UTM attribution server-side.
//
// This is the landing point for SOL-6 path b. index.html today posts the four
// hidden utm_* fields to Formspree and fires a Plausible custom event (path a,
// client-side only). Pointing that same form at this route writes attribution
// into Postgres, so "which X thread produced paying users" becomes a SQL join
// against `audits` rather than a Plausible eyeball.
//
// Accepts both JSON and form-encoded bodies so the existing plain <form> in
// index.html can post here with no JS changes.

import { NextRequest } from 'next/server';
import { mockStatus } from '@/lib/env';
import { upsertWaitlist } from '@/lib/repository';
import { extractUtm, jsonError, normaliseEmail } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  let email: string | null;
  let utm;

  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError('Expected a JSON body.', 400);
    }
    email = normaliseEmail(body.email);
    utm = extractUtm(body);
  } else {
    // application/x-www-form-urlencoded or multipart -- the index.html path.
    const form = await req.formData();
    const params = new URLSearchParams();
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') params.set(k, v);
    }
    email = normaliseEmail(params.get('email'));
    utm = extractUtm(params);
  }

  if (!email) {
    return jsonError('A valid "email" is required.', 400);
  }

  try {
    const { created } = await upsertWaitlist(email, utm);
    return Response.json(
      { ok: true, created, utm, mode: mockStatus() },
      { status: created ? 201 : 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Waitlist capture failed.';
    return jsonError(message, 500);
  }
}
