// Persistence boundary.
//
// Every route handler goes through this module; nothing else touches Supabase
// or the mock store directly. That means "go live on Supabase" is a change
// confined to this file plus setting env vars -- routes stay untouched.

import { randomUUID } from 'node:crypto';
import { isMockMode } from './env';
import { mockStore } from './mock-store';
import { serviceClient, UPLOAD_BUCKET } from './supabase';
import type { AuditRecord, AuditResult, UtmParams } from './types';

export type UploadRow = {
  id: string;
  email: string | null;
  mimeType: string;
  bytes: number;
  createdAt: string;
};

export async function createUpload(input: {
  email: string | null;
  mimeType: string;
  bytes: number;
  body: Buffer;
}): Promise<UploadRow> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const row: UploadRow = {
    id,
    email: input.email,
    mimeType: input.mimeType,
    bytes: input.bytes,
    createdAt,
  };

  if (isMockMode.supabase) {
    mockStore.insertUpload(row);
    return row;
  }

  const db = serviceClient();

  const storagePath = id + '/' + 'original';
  const { error: storageError } = await db.storage
    .from(UPLOAD_BUCKET)
    .upload(storagePath, input.body, { contentType: input.mimeType, upsert: false });
  if (storageError) throw new Error('Storage upload failed: ' + storageError.message);

  const { error } = await db.from('uploads').insert({
    id,
    email: input.email,
    mime_type: input.mimeType,
    bytes: input.bytes,
    storage_path: storagePath,
  });
  if (error) throw new Error('Upload insert failed: ' + error.message);

  return row;
}

export async function getUpload(id: string): Promise<UploadRow | null> {
  if (isMockMode.supabase) return mockStore.getUpload(id);

  const db = serviceClient();
  const { data, error } = await db.from('uploads').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Upload lookup failed: ' + error.message);
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    mimeType: data.mime_type,
    bytes: data.bytes,
    createdAt: data.created_at,
  };
}

/** How many audits this email has already consumed. Drives the free gate. */
export async function countAuditsByEmail(email: string): Promise<number> {
  if (isMockMode.supabase) return mockStore.countAuditsByEmail(email);

  const db = serviceClient();
  const { count, error } = await db
    .from('audits')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase());
  if (error) throw new Error('Audit count failed: ' + error.message);
  return count ?? 0;
}

export async function createAudit(input: {
  email: string;
  isFree: boolean;
  utm: UtmParams;
}): Promise<AuditRecord> {
  const id = randomUUID();
  const row: AuditRecord = {
    id,
    email: input.email.toLowerCase(),
    status: 'pending',
    is_free: input.isFree,
    result: null,
    utm: input.utm,
  };

  if (isMockMode.supabase) {
    mockStore.insertAudit(row);
    return row;
  }

  const db = serviceClient();
  const { error } = await db.from('audits').insert({
    id,
    email: row.email,
    status: 'pending',
    is_free: input.isFree,
    utm_source: input.utm.utm_source,
    utm_medium: input.utm.utm_medium,
    utm_campaign: input.utm.utm_campaign,
    utm_content: input.utm.utm_content,
  });
  if (error) throw new Error('Audit insert failed: ' + error.message);

  return row;
}

export async function completeAudit(
  id: string,
  result: AuditResult
): Promise<AuditRecord | null> {
  if (isMockMode.supabase) return mockStore.completeAudit(id, result);

  const db = serviceClient();
  const { data, error } = await db
    .from('audits')
    .update({ status: 'complete', result, completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error('Audit update failed: ' + error.message);
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    status: data.status,
    is_free: data.is_free,
    result: data.result,
    utm: {
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
    },
  };
}

/**
 * Waitlist capture -- this is the server-side landing point for SOL-6 path b.
 * index.html currently posts UTMs to Plausible only (path a); once this route is
 * live the same hidden fields post here and land in Postgres with attribution.
 */
export async function upsertWaitlist(
  email: string,
  utm: UtmParams
): Promise<{ created: boolean }> {
  if (isMockMode.supabase) {
    const { created } = mockStore.upsertWaitlist(email, utm);
    return { created };
  }

  const db = serviceClient();
  const { error } = await db.from('waitlist').upsert(
    {
      email: email.toLowerCase(),
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
    },
    { onConflict: 'email', ignoreDuplicates: true }
  );
  if (error) throw new Error('Waitlist upsert failed: ' + error.message);

  return { created: true };
}
