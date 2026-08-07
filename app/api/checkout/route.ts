// POST /api/checkout -- create a Stripe Checkout session.
//
// STUB. Per SOL-7 this deliberately does NOT create a live session; it returns a
// placeholder URL so the paywall flow is clickable end-to-end. The real call is
// written out below the guard so wiring it up is deleting the early return.

import { NextRequest } from 'next/server';
import { env, isMockMode, mockStatus } from '@/lib/env';
import { jsonError, normaliseEmail } from '@/lib/validation';

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

  if (isMockMode.stripe) {
    // Placeholder. Shaped exactly like the live response so the client that
    // consumes it needs no change when Stripe keys land.
    return Response.json({
      checkoutUrl:
        env.siteUrl + '/checkout/placeholder?plan=' + planId + '&email=' + encodeURIComponent(email),
      sessionId: 'cs_test_placeholder_' + planId,
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
  //   line_items: [{
  //     price: planId === 'pro' ? env.stripePricePro! : env.stripePriceOneTime!,
  //     quantity: 1,
  //   }],
  //   success_url: env.siteUrl + '/audit?session_id={CHECKOUT_SESSION_ID}',
  //   cancel_url: env.siteUrl + '/#pricing',
  // });
  // return Response.json({ checkoutUrl: session.url, sessionId: session.id, stubbed: false });

  return jsonError(
    'Stripe is configured but the live checkout path is not enabled yet.',
    501
  );
}
