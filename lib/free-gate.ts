// Free-audit gating.
//
// SOL-2 decision: 1 free audit per email, then paywall. Kept isolated because
// it is the most likely thing the CEO changes (see open questions on SOL-7 --
// trial vs single free audit). Changing the policy should mean editing this
// file and nothing else.

import { FREE_AUDITS_PER_EMAIL } from './limits';
import { countAuditsByEmail } from './repository';

export type GateDecision =
  | { allowed: true; isFree: true; used: number; remaining: number }
  | { allowed: false; isFree: false; used: number; reason: 'paywall' };

/**
 * Decide whether `email` may run another audit for free.
 *
 * NOTE: this counts audits, not payments. Once Stripe is live the paid path
 * bypasses this gate entirely (checkout success -> audit with isFree=false).
 */
export async function checkFreeGate(email: string): Promise<GateDecision> {
  const used = await countAuditsByEmail(email);

  if (used < FREE_AUDITS_PER_EMAIL) {
    return {
      allowed: true,
      isFree: true,
      used,
      remaining: FREE_AUDITS_PER_EMAIL - used,
    };
  }

  return { allowed: false, isFree: false, used, reason: 'paywall' };
}
