#!/usr/bin/env node
// End-to-end check of the audit pipeline scaffold against a running dev server.
//
//   pnpm dev            # in one shell (MOCK_EXTERNAL=1 is implied with no keys)
//   node scripts/scaffold-check.mjs --base http://127.0.0.1:3000
//
// Verifies the pipeline contract, not the model output: upload validation, the
// free-audit gate, the paywall handoff, and UTM capture. Runs entirely against
// mocked externals, so it needs no keys and is safe in CI.

const baseArg = process.argv.indexOf('--base');
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : 'http://127.0.0.1:3000';

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('OK   ' + name);
  } else {
    console.error('FAIL ' + name + (detail ? ' -- ' + JSON.stringify(detail) : ''));
    failed++;
  }
}

async function post(path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: opts.form ? undefined : { 'Content-Type': 'application/json' },
    body: opts.form ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function uploadFixture(email, type = 'image/png', bytes = null) {
  const buf = bytes ?? Buffer.from(PNG_B64, 'base64');
  const form = new FormData();
  form.set('file', new Blob([buf], { type }), 'stack.png');
  if (email) form.set('email', email);
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: form });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const unique = Date.now();
const emailA = 'a' + unique + '@example.com';
const emailB = 'b' + unique + '@example.com';

// --- waitlist -------------------------------------------------------------
const wl = await post('/api/waitlist', {
  email: emailA,
  utm_source: 'x',
  utm_content: 'x-thread-1',
});
check('waitlist accepts email + UTM', wl.status === 201, wl);
check('waitlist echoes utm_source', wl.json?.utm?.utm_source === 'x', wl.json);
check('waitlist echoes utm_content', wl.json?.utm?.utm_content === 'x-thread-1', wl.json);

const wlBad = await post('/api/waitlist', { email: 'not-an-email' });
check('waitlist rejects invalid email', wlBad.status === 400, wlBad);

// --- upload ---------------------------------------------------------------
const up = await uploadFixture(emailA);
check('upload accepts PNG', up.status === 201 && !!up.json?.uploadId, up);
const uploadId = up.json?.uploadId;

const upBad = await uploadFixture(emailA, 'text/plain');
check('upload rejects text/plain', upBad.status === 415, upBad);

const upBig = await uploadFixture(emailA, 'image/png', Buffer.alloc(9 * 1024 * 1024));
check('upload rejects oversized file', upBig.status === 413, upBig);

// --- audit + free gate ----------------------------------------------------
const a1 = await post('/api/audit', { uploadId, email: emailA, base64: PNG_B64 });
check('first audit succeeds', a1.status === 200, a1);
check('first audit is free', a1.json?.isFree === true, a1.json);
check('audit returns detected tools', (a1.json?.result?.detected_tools?.length ?? 0) > 0, a1.json);
check('audit returns findings', (a1.json?.result?.findings?.length ?? 0) > 0, a1.json);
check('audit reports mocked model', a1.json?.mocked === true, a1.json);

const a2 = await post('/api/audit', { uploadId, email: emailA, base64: PNG_B64 });
check('second audit hits paywall (402)', a2.status === 402, a2);
check('paywall points at checkout', a2.json?.checkoutUrl === '/api/checkout', a2.json);

const a3 = await post('/api/audit', { uploadId, email: emailB, base64: PNG_B64 });
check('new email gets its own free audit', a3.status === 200 && a3.json?.isFree === true, a3);

const aNoEmail = await post('/api/audit', { uploadId, base64: PNG_B64 });
check('audit requires email', aNoEmail.status === 400, aNoEmail);

const aBadUpload = await post('/api/audit', {
  uploadId: '00000000-0000-0000-0000-000000000000',
  email: emailB,
  base64: PNG_B64,
});
check('audit rejects unknown uploadId', aBadUpload.status === 404, aBadUpload);

// --- checkout stub --------------------------------------------------------
const co = await post('/api/checkout', { email: emailA, plan: 'one_time' });
check('checkout returns placeholder URL', co.status === 200 && !!co.json?.checkoutUrl, co);
check('checkout is flagged as stubbed', co.json?.stubbed === true, co.json);
check('one-time plan is $19', co.json?.plan?.amountCents === 1900, co.json);

const coPro = await post('/api/checkout', { email: emailA, plan: 'pro' });
check('pro plan is $9/mo', coPro.json?.plan?.amountCents === 900, coPro.json);

const coBad = await post('/api/checkout', { email: emailA, plan: 'enterprise' });
check('checkout rejects unknown plan', coBad.status === 400, coBad);

console.log('');
if (failed > 0) {
  console.error(failed + ' check(s) failed.');
  process.exit(1);
}
console.log('All scaffold checks passed.');
