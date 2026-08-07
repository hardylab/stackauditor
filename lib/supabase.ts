// Supabase seam: Postgres (audits, waitlist) + Storage (uploads).
//
// Two clients, deliberately separated:
//   - serviceClient(): service-role key, server-only, bypasses RLS. Used by the
//     route handlers to write audits and read the free-audit counter.
//   - anonClient(): anon key, safe for the browser, RLS-constrained.
//
// Never import serviceClient() into a client component. The service role key
// bypasses every policy in supabase/migrations/0001_init.sql.
//
// SCAFFOLD BEHAVIOUR: with no Supabase keys set, both fall back to an in-memory
// store (lib/mock-store.ts) so the pipeline runs end-to-end locally.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isMockMode } from './env';

let _service: SupabaseClient | null = null;

/** Server-only. Bypasses RLS. Throws in mock mode -- callers must check isMockMode first. */
export function serviceClient(): SupabaseClient {
  if (isMockMode.supabase) {
    throw new Error(
      'serviceClient() called in mock mode. Guard with isMockMode.supabase.'
    );
  }
  if (!_service) {
    _service = createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _service;
}

/** Browser-safe, RLS-constrained. */
export function anonClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('anonClient() requires NEXT_PUBLIC_SUPABASE_* env vars.');
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}

/** Storage bucket holding raw uploads. Created by 0001_init.sql. */
export const UPLOAD_BUCKET = 'audit-uploads';
