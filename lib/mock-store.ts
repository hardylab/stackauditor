// In-memory stand-in for Supabase, used only while isMockMode.supabase is true.
//
// It exists so the whole pipeline (upload -> audit -> free-gate -> paywall) is
// demonstrable before any board registration lands. It implements the SAME
// operations the repository layer needs, so swapping to real Supabase is a
// change in lib/repository.ts only.
//
// Not durable. Resets on server restart. Never used when Supabase keys exist.
//
// IMPORTANT -- state is hung off globalThis on purpose. Next.js bundles each
// route handler separately, so a plain module-level `new Map()` produces a
// SEPARATE instance per route: /api/upload would write to one map and
// /api/audit would read an empty one. (Found exactly that way: upload returned
// an id that /api/audit then rejected as "Unknown uploadId".) The same pattern
// is why Prisma/Redis clients are globalThis-cached in Next apps.

import type { AuditRecord, AuditResult, UtmParams } from './types';

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
};

const globalRef = globalThis as unknown as { __stackauditorMock?: MockState };

const state: MockState =
  globalRef.__stackauditorMock ??
  (globalRef.__stackauditorMock = {
    uploads: new Map(),
    audits: new Map(),
    waitlist: new Map(),
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

  getAudit(id: string) {
    return state.audits.get(id) ?? null;
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
    };
  },
};
