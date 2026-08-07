// Request validation shared by the route handlers.
// Small and dependency-free on purpose -- a schema library is not worth the
// bundle at four endpoints.

import { EMPTY_UTM, type UtmParams } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** Pull utm_* out of a JSON body or a URLSearchParams, tolerating absence. */
export function extractUtm(source: Record<string, unknown> | URLSearchParams): UtmParams {
  const get = (key: string): string | null => {
    const raw =
      source instanceof URLSearchParams ? source.get(key) : source[key];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    // Guard against someone stuffing a novel into an attribution column.
    return trimmed.length === 0 ? null : trimmed.slice(0, 200);
  };

  return {
    ...EMPTY_UTM,
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
  };
}

export function jsonError(message: string, status: number, extra?: object) {
  return Response.json({ error: message, ...extra }, { status });
}
