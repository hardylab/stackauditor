// Hard limits shared by the upload + audit routes.
// Kept in one place so the client guard, the route guard, and the docs cannot drift.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

// Cost guard: SOL-2 budgets ~$0.15/audit. Capping input tokens keeps a
// pathological upload (e.g. a 40-page PDF) from blowing the per-audit budget.
export const MAX_INPUT_TOKENS = 12_000;

// Free-audit gating: SOL-2 decision is 1 free audit per email, then paywall.
export const FREE_AUDITS_PER_EMAIL = 1;
