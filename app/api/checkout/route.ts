// POST /api/checkout -- create a Stripe Checkout session.
//
// STUB. Per SOL-7 this deliberately does NOT create a live session; it returns a
// placeholder URL so the paywall flow is clickable end-to-end. The real call is
// written out below the guard so wiring it up is deleting the early return.
//
// SOL-10: this route now also seeds an audit row in `pending_payment` status
// BEFORE returning the (placeholder) checkout URL. The webhook handler at
// /api/webhooks/stripe later flips that row to `paid` based on
// `client_reference_id` (= audit.id). Pre-generating the audit row gives the
// webhook a stable join key that survives the user never landing on the
// success page.

import { NextRequest } from 'next/server';
import { env, isMockMode, mockStatus } from '@/lib/env';
import { createPendingPaymentAudit } from '@/lib/repository';
import { jsonError, extractUtm, normaliseEmail } from '@/lib/validation';

export const runtime = 'nodejs';

// SOL-2 pricing: $19 one-time audit, $9/mo Pro.
const PLANS = {
  one_time: { label: 'Single audit', amountCents: 1900, mode: 'payment' as const },
  pro: { label: 'Pro (monthly re-audit)', amountCents: 900, mode: 'subscription' as const },
};

export type PlanId = keyof typeof PLANS;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Expected a JSON body.', 400);
  }

  const planId = (typeof body.plan === 'string' ? body.plan : 'one_time') as PlanId;
  const plan = PLANS[planId];
  if (!plan) {
    return jsonError('Unknown plan.', 400, { validPlans: Object.keys(PLANS) });
  }

  const email = normaliseEmail(body.email);
  if (!email) {
    return jsonError('A valid "email" is required for checkout.', 400);
  }

  const utm = extractUtm(body);
  // We don't have a Stripe session id yet in mock mode, but the audit row needs
  // a sentinel so /api/webhooks/stripe can dedupe and resolve by it. The mock
  // path uses `cs_test_placeholder_<planId>` to mirror the live session id.
  const placeholderSessionId = 'cs_test_placeholder_' + planId + '_' + Date.now();
  const audit = await createPendingPaymentAudit({
    email,
    utm,
    stripeSessionId: placeholderSessionId,
  });

  if (isMockMode.stripe) {
    // Placeholder. Shaped exactly like the live response so the client that
    // consumes it needs no change when Stripe keys land.
    return Response.json({
      checkoutUrl:
        env.siteUrl +
        '/checkout/placeholder?plan=' +
        planId +
        '&email=' +
        encodeURIComponent(email) +
        '&audit=' +
        audit.id,
      sessionId: placeholderSessionId,
      clientReferenceId: audit.id,
      auditId: audit.id,
      plan: { id: planId, ...plan },
      stubbed: true,
      mode: mockStatus(),
    });
  }

  // ---- Live path (inert until STRIPE_SECRET_KEY + price IDs are set) --------
  // const stripe = new Stripe(env.stripeSecretKey!);
  // const session = await stripe.checkout.sessions.create({
  //   mode: plan.mode,
  //   customer_email: email,
  //   // audit.id is the join key the webhook uses to find this audit row.
  //   // /api/webhooks/stripe reads this back off event.data.object.client_reference_id.
  //   client_reference_id: audit.id,
  //   // Belt and braces: Stripe also lets us pass metadata we can echo back,
  //   // useful if client_reference_id is ever stripped by an older API version.
  //   metadata: { audit_id: audit.id },
  //   line_items: [{
  //     price: planId === 'pro' ? env.stripePricePro! : env.stripePriceOneTime!,
  //     quantity: 1,
  //   }],
  //   success_url: env.siteUrl + '/audit?session_id={CHECKOUT_SESSION_ID}',
  //   cancel_url: env.siteUrl + '/#pricing',
  // });
  // return Response.json({ checkoutUrl: session.url, sessionId: session.id, clientReferenceId: audit.id, auditId: audit.id, stubbed: false });

  return jsonError(
    'Stripe is configured but the live checkout path is not enabled yet.',
    501
  );
}
