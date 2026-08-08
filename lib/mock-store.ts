// In-memory stand-in for Supabase, used only while isMockMode.supabase is true.
//
// It exists so the whole pipeline (upload -> audit -> free-gate -> paywall ->
// webhook -> paid-audit) is demonstrable before any board registration lands.
// It implements the SAME operations the repository layer needs, so swapping to
// real Supabase is a change in lib/repository.ts only.
//
// Not durable. Resets on server restart. Never used when Supabase keys exist.
//
// IMPORTANT -- state is hung off globalThis on purpose. Next.js bundles each
// route handler separately, so a plain module-level `new Map()` produces a
// SEPARATE instance per route: /api/upload would write to one map and
// /api/audit would read an empty one. (Found exactly that way: upload returned
// an id that /api/audit then rejected as "Unknown uploadId".) The same pattern
// is why Prisma/Redis clients are globalThis-cached in Next apps.

import type { AuditRecord, AuditResult, AuditStatus, UtmParams } from './types';

type StoredUpload = {
  id: string;
  email: string | null;
  mimeType: string;
  bytes: number;
  createdAt: string;
};

type WaitlistRow = { email: string; utm: UtmParams; createdAt: string };

type MockState = {
  uploads: Map<string, StoredUpload>;
  audits: Map<string, AuditRecord>;
  waitlist: Map<string, WaitlistRow>;
  /** event.id -> { source, processedAt }. Idempotency dedupe for the webhook. */
  processedWebhookEvents: Map<string, { source: string; processedAt: string }>;
};

const globalRef = globalThis as unknown as { __stackauditorMock?: MockState };

const state: MockState =
  globalRef.__stackauditorMock ??
  (globalRef.__stackauditorMock = {
    uploads: new Map(),
    audits: new Map(),
    waitlist: new Map(),
    processedWebhookEvents: new Map(),
  });

export const mockStore = {
  insertUpload(row: StoredUpload) {
    state.uploads.set(row.id, row);
    return row;
  },

  getUpload(id: string) {
    return state.uploads.get(id) ?? null;
  },

  countAuditsByEmail(email: string) {
    let n = 0;
    for (const a of state.audits.values()) {
      if (a.email === email.toLowerCase()) n++;
    }
    return n;
  },

  insertAudit(row: AuditRecord) {
    state.audits.set(row.id, row);
    return row;
  },

  completeAudit(id: string, result: AuditResult) {
    const row = state.audits.get(id);
    if (!row) return null;
    const next: AuditRecord = { ...row, status: 'complete', result };
    state.audits.set(id, next);
    return next;
  },

  /** Fetch by primary key (id = audits.id, which /api/checkout sets as Stripe's client_reference_id). */
  getAudit(id: string) {
    return state.audits.get(id) ?? null;
  },

  /**
   * Look up an audit by the Stripe Checkout session id. Used by the webhook
   * as a fallback when client_reference_id is missing (older checkout sessions
   * created before SOL-10, edge cases where Stripe strips the field).
   */
  getAuditByStripeSessionId(stripeSessionId: string): AuditRecord | null {
    for (const a of state.audits.values()) {
      if (a.stripe_session_id === stripeSessionId) return a;
    }
    return null;
  },

  /**
   * Atomic-ish status flip for the webhook. Used inside the dedupe gate so a
   * retry of the same event id cannot re-flip (the insert into
   * processed_webhook_events returns false, and the handler does not even
   * reach this method).
   */
  updateAuditStatus(
    id: string,
    next: { status: AuditStatus; paid_at?: string; stripe_event_id?: string }
  ) {
    const row = state.audits.get(id);
    if (!row) return null;
    const merged: AuditRecord = {
      ...row,
      status: next.status,
      paid_at: next.paid_at ?? row.paid_at,
      stripe_event_id: next.stripe_event_id ?? row.stripe_event_id,
    };
    state.audits.set(id, merged);
    return merged;
  },

  /**
   * Idempotency insert. Returns `firstSeen: true` if this is the FIRST time
   * we have seen the event id; `false` if the row already existed (the webhook
   * route short-circuits with 200 in that case).
   */
  tryRecordProcessedWebhook(eventId: string, source: string) {
    if (state.processedWebhookEvents.has(eventId)) {
      return { firstSeen: false };
    }
    state.processedWebhookEvents.set(eventId, {
      source,
      processedAt: new Date().toISOString(),
    });
    return { firstSeen: true };
  },

  upsertWaitlist(email: string, utm: UtmParams) {
    const key = email.toLowerCase();
    const existing = state.waitlist.get(key);
    const row = existing ?? { email: key, utm, createdAt: new Date().toISOString() };
    state.waitlist.set(key, row);
    return { row, created: !existing };
  },

  stats() {
    return {
      uploads: state.uploads.size,
      audits: state.audits.size,
      waitlist: state.waitlist.size,
      processedWebhookEvents: state.processedWebhookEvents.size,
    };
  },
};
