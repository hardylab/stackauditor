#!/usr/bin/env node
// Preflight smoke for StackAuditor.
//
// Runs the FULL pipeline in mock mode (MOCK_EXTERNAL=1) and asserts every
// external seam + every contract the launch runbook depends on.
//
//   pnpm dev                              # in one shell
//   MOCK_EXTERNAL=1 node scripts/preflight-check.mjs
//   MOCK_EXTERNAL=1 node scripts/preflight-check.mjs --base https://stackauditor.com
//   MOCK_EXTERNAL=1 node scripts/preflight-check.mjs --spawn   # boots next dev itself
//
// Per-seam assertions:
//   - env mode:    anthropic/supabase/stripe === mock when MOCK_EXTERNAL=1
//   - /api/waitlist: accepts JSON + UTM, rejects bad email, idempotent on email
//   - /api/upload:  accepts PNG, rejects text/plain, rejects oversized
//   - /api/audit:   first call is free + mocked=true, second hits 402 paywall,
//                   a new email gets its own free audit, unknown uploadId is 404,
//                   detected_tools + findings have valid schema
//   - /api/checkout: one-time + pro plans priced correctly, stubbed=true,
//                   seeds a pending_payment audit + returns its id as
//                   client_reference_id (the join key for the webhook)
//   - /api/webhooks/stripe: rejects malformed bodies, accepts a Stripe-shaped
//                   mock event in mock mode and flips the matching audit row
//                   from pending_payment -> paid, replays the same event id
//                   and reports already_processed (idempotency)
//
// Not covered (by design):
//   - Stripe webhook signature verification (live mode needs a signed payload)
//   - Real Anthropic model output (Step 2 -- mock fixture is a contract test)
//   - Supabase RLS policies (Step 1 -- route uses service role)
//
// Webhook (Step 4) is partially covered: in mock mode the route accepts
// unsigned events with a Stripe-shaped JSON body, so we exercise the
// idempotency gate + the audit-row flip end-to-end. The signature path is
// gated behind real keys and is only smoke-tested via the launch runbook.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const SPAWN = process.argv.includes('--spawn');
const BASE = arg('--base', SPAWN ? 'http://127.0.0.1:3100' : 'http://127.0.0.1:3000');

let failed = 0;

function ok(seam, name) {
  console.log('  PASS  ' + seam.padEnd(10) + '  ' + name);
}
function bad(seam, name, detail) {
  failed++;
  console.error('  FAIL  ' + seam.padEnd(10) + '  ' + name);
  if (detail !== undefined) {
    const s = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    console.error('         detail: ' + s.split('\n').join('\n         '));
  }
}

async function post(path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: opts.form ? undefined : { 'Content-Type': 'application/json' },
    body: opts.form ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function uploadFixture(email, type = 'image/png', bytes = null) {
  const buf = bytes ?? Buffer.from(PNG_B64, 'base64');
  const form = new FormData();
  form.set('file', new Blob([buf], { type }), 'stack.png');
  if (email) form.set('email', email);
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: form });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function waitForReady(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url + '/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ready-probe@example.com' }),
      });
      if (res.status > 0) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

async function spawnDev() {
  console.log('Spawning next dev at', BASE);
  const child = spawn('pnpm', ['dev', '--', '-p', String(new URL(BASE).port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MOCK_EXTERNAL: '1' },
  });
  child.stdout.on('data', (d) => process.stderr.write('[next] ' + d));
  child.stderr.on('data', (d) => process.stderr.write('[next] ' + d));
  const ready = await waitForReady(BASE);
  if (!ready) {
    child.kill();
    throw new Error('next dev did not become ready within 60s');
  }
  return child;
}

function assertModeMock(report) {
  const r = report.json?.mode ?? {};
  for (const seam of ['anthropic', 'supabase', 'stripe']) {
    if (r[seam] === 'mock') ok('mode', 'mode.' + seam + ' === mock');
    else bad('mode', 'mode.' + seam + ' === mock', r);
  }
}

function validateDetectedTool(t) {
  if (typeof t.name !== 'string' || t.name.length === 0) return 'name not string';
  if (t.monthly_cost_usd !== null && typeof t.monthly_cost_usd !== 'number') return 'monthly_cost_usd not number|null';
  if (t.seats !== null && (!Number.isInteger(t.seats) || t.seats < 1)) return 'seats not positive integer|null';
  if (typeof t.confidence !== 'number' || t.confidence < 0 || t.confidence > 1) return 'confidence out of [0,1]';
  return null;
}

function validateFinding(f) {
  if (!['wasted_spend', 'redundant_seats', 'unused_feature', 'security_risk'].includes(f.kind)) return 'bad kind';
  if (!['low', 'medium', 'high'].includes(f.severity)) return 'bad severity';
  if (typeof f.title !== 'string' || f.title.length === 0) return 'title empty';
  if (typeof f.detail !== 'string' || f.detail.length === 0) return 'detail empty';
  if (f.estimated_monthly_saving_usd !== null && typeof f.estimated_monthly_saving_usd !== 'number') return 'saving not number|null';
  return null;
}

async function run() {
  const unique = Date.now();
  const emailA = 'preflight-a-' + unique + '@example.com';
  const emailB = 'preflight-b-' + unique + '@example.com';

  console.log('');
  console.log('StackAuditor preflight against ' + BASE);
  console.log('');

  // --- mode ---
  console.log('== env mode ==');
  const probe = await post('/api/waitlist', { email: 'probe-' + unique + '@example.com' });
  if (probe.status === 201) ok('mode', 'probe request accepted');
  else bad('mode', 'probe request accepted', probe);
  assertModeMock(probe);

  // --- waitlist ---
  console.log('');
  console.log('== /api/waitlist ==');
  const w1 = await post('/api/waitlist', {
    email: emailA,
    utm_source: 'preflight',
    utm_content: 'x-thread-1',
  });
  if (w1.status === 201) ok('waitlist', 'accepts email + UTM'); else bad('waitlist', 'accepts email + UTM', w1);
  if (w1.json?.created === true) ok('waitlist', 'first insert returns created=true'); else bad('waitlist', 'first insert returns created=true', w1.json);
  if (w1.json?.utm?.utm_source === 'preflight') ok('waitlist', 'echoes utm_source'); else bad('waitlist', 'echoes utm_source', w1.json?.utm);
  if (w1.json?.utm?.utm_content === 'x-thread-1') ok('waitlist', 'echoes utm_content'); else bad('waitlist', 'echoes utm_content', w1.json?.utm);

  const w2 = await post('/api/waitlist', { email: emailA });
  if (w2.status === 200 && w2.json?.created === false) ok('waitlist', 'upsert by email returns created=false');
  else bad('waitlist', 'upsert by email returns created=false', w2);

  const wBad = await post('/api/waitlist', { email: 'not-an-email' });
  if (wBad.status === 400) ok('waitlist', 'rejects invalid email'); else bad('waitlist', 'rejects invalid email', wBad);

  const wTruncated = await post('/api/waitlist', { email: emailA, utm_source: '   ' });
  if (wTruncated.json?.utm?.utm_source === null) ok('waitlist', 'whitespace-only utm normalised to null');
  else bad('waitlist', 'whitespace-only utm normalised to null', wTruncated.json?.utm);

  // --- upload ---
  console.log('');
  console.log('== /api/upload ==');
  const up = await uploadFixture(emailA);
  if (up.status === 201 && up.json?.uploadId) ok('upload', 'accepts PNG'); else bad('upload', 'accepts PNG', up);
  const uploadId = up.json?.uploadId;

  if (up.json?.mode?.supabase === 'mock') ok('upload', 'response reports mode.supabase=mock');
  else bad('upload', 'response reports mode.supabase=mock', up.json?.mode);

  const upBad = await uploadFixture(emailA, 'text/plain');
  if (upBad.status === 415) ok('upload', 'rejects text/plain with 415'); else bad('upload', 'rejects text/plain with 415', upBad);

  const upBig = await uploadFixture(emailA, 'image/png', Buffer.alloc(9 * 1024 * 1024));
  if (upBig.status === 413) ok('upload', 'rejects oversized with 413'); else bad('upload', 'rejects oversized with 413', upBig);

  // --- audit ---
  console.log('');
  console.log('== /api/audit ==');
  const a1 = await post('/api/audit', { uploadId, email: emailA, base64: PNG_B64 });
  if (a1.status === 200) ok('audit', 'first audit succeeds'); else bad('audit', 'first audit succeeds', a1);
  if (a1.json?.isFree === true) ok('audit', 'first audit is free'); else bad('audit', 'first audit is free', a1.json);
  if (a1.json?.mocked === true) ok('audit', 'first audit reports mocked=true'); else bad('audit', 'first audit reports mocked=true', a1.json);

  const tools = a1.json?.result?.detected_tools ?? [];
  if (tools.length > 0) ok('audit', 'result.detected_tools non-empty'); else bad('audit', 'result.detected_tools non-empty', a1.json?.result);
  let badTool = null;
  for (const t of tools) { badTool = validateDetectedTool(t); if (badTool) break; }
  if (!badTool) ok('audit', 'all ' + tools.length + ' detected_tools conform to schema');
  else bad('audit', 'detected_tools conform to schema', badTool);

  const findingsList = a1.json?.result?.findings ?? [];
  if (findingsList.length > 0) ok('audit', 'result.findings non-empty'); else bad('audit', 'result.findings non-empty', a1.json?.result);
  let badFinding = null;
  for (const f of findingsList) { badFinding = validateFinding(f); if (badFinding) break; }
  if (!badFinding) ok('audit', 'all ' + findingsList.length + ' findings conform to schema');
  else bad('audit', 'findings conform to schema', badFinding);

  if (typeof a1.json?.result?.total_estimated_monthly_saving_usd === 'number') ok('audit', 'total_estimated_monthly_saving_usd is a number');
  else bad('audit', 'total_estimated_monthly_saving_usd is a number', a1.json?.result);

  if (a1.json?.mode?.anthropic === 'mock') ok('audit', 'response reports mode.anthropic=mock');
  else bad('audit', 'response reports mode.anthropic=mock', a1.json?.mode);

  // second audit -> paywall
  const a2 = await post('/api/audit', { uploadId, email: emailA, base64: PNG_B64 });
  if (a2.status === 402) ok('audit', 'second audit hits paywall (402)'); else bad('audit', 'second audit hits paywall (402)', a2);
  if (a2.json?.checkoutUrl === '/api/checkout') ok('audit', 'paywall body points at /api/checkout');
  else bad('audit', 'paywall body points at /api/checkout', a2.json);

  // different email -> own free audit
  const a3 = await post('/api/audit', { uploadId, email: emailB, base64: PNG_B64 });
  if (a3.status === 200 && a3.json?.isFree === true) ok('audit', 'new email gets own free audit');
  else bad('audit', 'new email gets own free audit', a3);

  const aNoEmail = await post('/api/audit', { uploadId, base64: PNG_B64 });
  if (aNoEmail.status === 400) ok('audit', 'rejects missing email'); else bad('audit', 'rejects missing email', aNoEmail);

  const aBadUpload = await post('/api/audit', {
    uploadId: '00000000-0000-0000-0000-000000000000',
    email: emailB,
    base64: PNG_B64,
  });
  if (aBadUpload.status === 404) ok('audit', 'rejects unknown uploadId (404)'); else bad('audit', 'rejects unknown uploadId (404)', aBadUpload);

  // --- checkout ---
  console.log('');
  console.log('== /api/checkout ==');
  const c1 = await post('/api/checkout', { email: emailA, plan: 'one_time' });
  if (c1.status === 200 && c1.json?.checkoutUrl) ok('checkout', 'returns a checkoutUrl'); else bad('checkout', 'returns a checkoutUrl', c1);
  if (c1.json?.stubbed === true) ok('checkout', 'flagged stubbed=true'); else bad('checkout', 'flagged stubbed=true', c1.json);
  if (c1.json?.plan?.amountCents === 1900) ok('checkout', 'one-time plan amount is $19'); else bad('checkout', 'one-time plan amount is $19', c1.json?.plan);
  if (c1.json?.mode?.stripe === 'mock') ok('checkout', 'response reports mode.stripe=mock'); else bad('checkout', 'response reports mode.stripe=mock', c1.json?.mode);

  const c2 = await post('/api/checkout', { email: emailA, plan: 'pro' });
  if (c2.json?.plan?.amountCents === 900) ok('checkout', 'pro plan amount is $9'); else bad('checkout', 'pro plan amount is $9', c2.json?.plan);
  if (c2.json?.plan?.mode === 'subscription') ok('checkout', 'pro plan mode is subscription'); else bad('checkout', 'pro plan mode is subscription', c2.json?.plan);

  const cBad = await post('/api/checkout', { email: emailA, plan: 'enterprise' });
  if (cBad.status === 400) ok('checkout', 'rejects unknown plan'); else bad('checkout', 'rejects unknown plan', cBad);

  // --- checkout seeds pending_payment audit ---
  const cPaid = await post('/api/checkout', {
    email: emailA,
    plan: 'one_time',
    utm_source: 'preflight',
  });
  if (cPaid.json?.auditId) ok('checkout', 'seeds pending_payment audit row')
    else bad('checkout', 'seeds pending_payment audit row', cPaid);
  if (typeof cPaid.json?.clientReferenceId === 'string' && cPaid.json.clientReferenceId.length > 0)
    ok('checkout', 'response carries clientReferenceId')
    else bad('checkout', 'response carries clientReferenceId', cPaid.json);

  // --- webhook ---
  console.log('');
  console.log('== /api/webhooks/stripe ==');

  // Malformed JSON body -> 400. The route refuses to parse unsigned garbage
  // and stamps it as a bad signature / shape.
  const whMalformed = await fetch(BASE + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'this-is-not-json',
  });
  if (whMalformed.status === 400) ok('webhook', 'rejects malformed JSON body with 400')
    else bad('webhook', 'rejects malformed JSON body with 400', { status: whMalformed.status });

  // Hand-rolled event matching the audit we just created. /api/webhooks/stripe
  // runs in mock mode (MOCK_EXTERNAL=1), so we don't need a Stripe signature;
  // the route shape-validates and then joins by client_reference_id.
  const eventId = 'evt_preflight_' + unique;
  const whEvent = await fetch(BASE + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: cPaid.json.sessionId,
          client_reference_id: cPaid.json.auditId,
          customer_email: emailA,
        },
      },
    }),
  });
  const whEventJson = await whEvent.json().catch(() => null);
  if (whEvent.status === 200) ok('webhook', 'accepts valid mock event with 200')
    else bad('webhook', 'accepts valid mock event with 200', { status: whEvent.status, json: whEventJson });
  if (whEventJson?.auditId === cPaid.json.auditId) ok('webhook', 'first processing returns matching auditId')
    else bad('webhook', 'first processing returns matching auditId', whEventJson);
  if (whEventJson?.status === 'paid') ok('webhook', 'audit row flipped to paid')
    else bad('webhook', 'audit row flipped to paid', whEventJson);

  // Replay the same event id -> idempotency gate. The route short-circuits
  // with already_processed: true; the audit row stays paid.
  const whReplay = await fetch(BASE + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: cPaid.json.sessionId,
          client_reference_id: cPaid.json.auditId,
          customer_email: emailA,
        },
      },
    }),
  });
  const whReplayJson = await whReplay.json().catch(() => null);
  if (whReplay.status === 200 && whReplayJson?.already_processed === true)
    ok('webhook', 'replay short-circuits with already_processed: true')
    else bad('webhook', 'replay short-circuits with already_processed: true', { status: whReplay.status, json: whReplayJson });

  // Event with no matching audit -> 200 + auditFound: false. The idempotency
  // gate still records the event id so Stripe cannot retry-spam us, but the
  // route does NOT mutate a row.
  const whOrphanEventId = 'evt_preflight_orphan_' + unique;
  const whOrphan = await fetch(BASE + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: whOrphanEventId,
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_no_matching_audit', client_reference_id: null } },
    }),
  });
  const whOrphanJson = await whOrphan.json().catch(() => null);
  if (whOrphan.status === 200 && whOrphanJson?.auditFound === false)
    ok('webhook', 'orphan event acknowledged with auditFound: false')
    else bad('webhook', 'orphan event acknowledged with auditFound: false', { status: whOrphan.status, json: whOrphanJson });
}

let devProcess = null;
try {
  if (SPAWN) {
    devProcess = await spawnDev();
  }
  await run();
} finally {
  if (devProcess) devProcess.kill();
}

console.log('');
if (failed > 0) {
  console.error(failed + ' check(s) failed.');
  process.exit(1);
}
console.log('All preflight checks passed.');

