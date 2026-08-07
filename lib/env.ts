// Single source of truth for external-service configuration.
//
// Every value here maps 1:1 to a row in docs/audit-pipeline-deps.md. When the
// board provisions a service, the only change needed is setting the env var in
// Vercel -- no code edit.
//
// SCAFFOLD BEHAVIOUR: none of these are required to boot. Missing keys put the
// corresponding client into mock mode (see isMockMode) so the whole pipeline is
// runnable end-to-end locally before any board registration lands.

function optional(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

export const env = {
  supabaseUrl: optional('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: optional('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  stripeSecretKey: optional('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
  stripePriceOneTime: optional('STRIPE_PRICE_ONE_TIME'),
  stripePricePro: optional('STRIPE_PRICE_PRO'),
  resendApiKey: optional('RESEND_API_KEY'),
  siteUrl: optional('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000',
} as const;

/**
 * Force-mock switch. Set MOCK_EXTERNAL=1 to run the full pipeline with no
 * external calls even if keys happen to be present (used by scripts/scaffold-check.mjs).
 */
export const forceMock = process.env.MOCK_EXTERNAL === '1';

export const isMockMode = {
  anthropic: forceMock || env.anthropicApiKey === null,
  supabase:
    forceMock || env.supabaseUrl === null || env.supabaseServiceRoleKey === null,
  stripe: forceMock || env.stripeSecretKey === null,
} as const;

/** Reported by every route so the caller can see which seams are live. */
export function mockStatus() {
  return {
    anthropic: isMockMode.anthropic ? 'mock' : 'live',
    supabase: isMockMode.supabase ? 'mock' : 'live',
    stripe: isMockMode.stripe ? 'mock' : 'live',
  };
}
