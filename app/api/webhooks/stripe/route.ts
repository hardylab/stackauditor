// POST /api/webhooks/stripe
//
// Receives Stripe events (audit pipeline conversion signal). Four properties:
//
//   1. Raw-body read. Next.js route handlers get a parsed JSON body by default
//      via req.json(); Stripe requires the raw bytes for `constructEvent` to
//      match the HMAC. We read req.text() FIRST and parse shape locally.
//
//   2. Signature verification. `stripe.webhooks.constructEvent` re-derives the
//      HMAC against STRIPE_WEBHOOK_SECRET and rejects with NoSigHeader /
//      SignatureVerificationError on a bad signature. We return 400 so Stripe
//      does NOT retry on tampered payloads.
//
//   3. Idempotency. We insert into processed_webhook_events (text PK =
//      event.id) BEFORE running side effects. A duplicate insert returns
//      firstSeen=false and we short-circuit with 200. Stripe will retry on
//      non-2xx, so this is the gate that keeps a flaky DB row from double-
//      billing the audit queue.
//
//   4. Side effect. For `checkout.session.completed` we flip the audit row
//      from `pending_payment` -> `paid`, writing stripe_event_id for
//      traceability. The join key is the Checkout session's
//      `client_reference_id` (we set that to `audits.id` in /api/checkout).
//      Fallback: look up by `session.id` against audits.stripe_session_id.
//
// Mock mode: when MOCK_EXTERNAL=1 (scripts/preflight-check.mjs), Stripe
// signature verification is bypassed and the request body is interpreted as a
// plain JSON event with the shape Stripe would have sent. This lets CI run
// the full audit-pipeline conversion path end-to-end without real keys.

import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { env, forceMock } from '@/lib/env';
import {
  getAudit,
  getAuditByStripeSessionId,
  markAuditPaid,
  tryRecordProcessedWebhook,
} from '@/lib/repository';

export const runtime = 'nodejs';

const KNOWN_EVENT_TYPES = new Set([
  'checkout.session.completed',
]);

type StripeCheckoutSessionLike = {
  id: string;
  client_reference_id?: string | null;
  customer_email?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeEventLike = {
  id: string;
  type: string;
  data: { object: StripeCheckoutSessionLike };
};

export async function POST(req: NextRequest) {
  const body = await req.text();

  let event: StripeEventLike;
  if (forceMock) {
    // Mock path: skip signature verification entirely. The preflight script
    // emits events shaped exactly like Stripe's, so we just parse + validate.
    try {
      const parsed = JSON.parse(body) as StripeEventLike;
      event = parsed;
    } catch {
      return Response.json({ error: 'Malformed JSON body.' }, { status: 400 });
    }
  } else {
    // Live path: STRIPE_WEBHOOK_SECRET + STRIPE_SECRET_KEY are both required
    // for signature verification to work. Missing env -> 503 (board needs to
    // provision) rather than 400 (looks like a bug to Stripe).
    if (!env.stripeWebhookSecret) {
      return Response.json(
        { error: 'STRIPE_WEBHOOK_SECRET is not configured.' },
        { status: 503 }
      );
    }
    if (!env.stripeSecretKey) {
      return Response.json(
        { error: 'STRIPE_SECRET_KEY is not configured.' },
        { status: 503 }
      );
    }
    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return Response.json({ error: 'Missing Stripe-Signature header.' }, { status: 400 });
    }
    const stripe = new Stripe(env.stripeSecretKey);
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        env.stripeWebhookSecret
      ) as unknown as StripeEventLike;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown signature error';
      return Response.json({ error: 'Invalid signature.', detail: message }, { status: 400 });
    }
  }

  if (!event?.id || !event?.type) {
    return Response.json({ error: 'Event missing id/type.' }, { status: 400 });
  }
  if (!KNOWN_EVENT_TYPES.has(event.type)) {
    // Acknowledge but no-op. Stripe sends lots of event types; only the ones
    // we explicitly handle do anything. 200 keeps Stripe from retrying.
    return Response.json({ received: true, handled: false, type: event.type });
  }

  // Idempotency gate. Insert processed_webhook_events.id = event.id; if the
  // event id has been seen, the insert collides and we return 200 immediately.
  let firstSeen: boolean;
  try {
    ({ firstSeen } = await tryRecordProcessedWebhook({ eventId: event.id }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Idempotency failed.';
    // 5xx -> Stripe retries. We have not yet run any side effect, so a retry
    // will work once the DB is healthy again.
    return Response.json({ error: message }, { status: 500 });
  }
  if (!firstSeen) {
    console.log('[webhook] already_processed event_id=' + event.id);
    return Response.json({ received: true, already_processed: true });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    let audit = null;
    if (session.client_reference_id) {
      audit = await getAudit(session.client_reference_id);
    }
    if (!audit && session.id) {
      audit = await getAuditByStripeSessionId(session.id);
    }
    if (!audit) {
      // We have NOT run a side effect on a row, but we DID record the event
      // id as processed. Acknowledging with 200 keeps Stripe from retrying;
      // the audit row will never flip to paid because there is no join key.
      // This is the right behaviour for legacy Checkout sessions created
      // before SOL-10 (no client_reference_id, no stripe_session_id on
      // audits).
      console.warn(
        '[webhook] no audit found for event=' +
          event.id +
          ' session=' +
          (session.id ?? 'unknown') +
          ' client_reference_id=' +
          (session.client_reference_id ?? 'unset')
      );
      return Response.json({ received: true, auditFound: false, eventId: event.id });
    }
    try {
      const updated = await markAuditPaid({
        auditId: audit.id,
        stripeEventId: event.id,
      });
      if (!updated) {
        // Row vanished between the lookup and the update -- race with a
        // cleanup path. Surface as 5xx so Stripe retries.
        return Response.json({ error: 'Audit row vanished during update.' }, { status: 500 });
      }
      return Response.json({
        received: true,
        auditId: updated.id,
        status: updated.status,
        paidAt: updated.paid_at,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mark paid failed.';
      return Response.json({ error: message }, { status: 500 });
    }
  }

  return Response.json({ received: true, type: event.type });
}
