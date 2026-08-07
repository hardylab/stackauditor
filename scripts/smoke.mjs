#!/usr/bin/env node
// Minimal smoke test: index.html and 404.html exist, doctype + root tags match.
import fs from 'node:fs';

const required = ['index.html', '404.html', 'assets/favicon.svg', 'README.md', 'LICENSE'];
let failed = 0;
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error('Missing required file:', f);
    failed++;
  } else {
    console.log('OK ', f);
  }
}

function expectContains(file, snippets) {
  const txt = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const s of snippets) {
    if (!txt.includes(s.toLowerCase())) {
      console.error(`FAIL ${file}: missing "${s}"`);
      failed++;
    }
  }
}

expectContains('index.html', [
  '<!doctype html>',
  '<html',
  '</html>',
  '<body',
  '</body>',
  'StackAuditor',
  'Stop bleeding SaaS dollars.',
  'Join waitlist',
  'github.com/hardylab/stackauditor',
]);

expectContains('404.html', ['<!doctype html>', '</html>']);

if (failed > 0) {
  console.error(`\nSmoke test FAILED: ${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nSmoke test PASSED.');
