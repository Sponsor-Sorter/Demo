const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'finder.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'finder-discovery.css'), 'utf8');

test('Finder stays behind an accessible session gate until the profile is loaded', () => {
  assert.match(page, /<body[^>]*data-page="finder"[^>]*data-auth-state="checking"/);
  assert.match(page, /<div id="finder-auth-status"[^>]*role="status"[^>]*aria-live="polite">Checking your session…<\/div>/);
  assert.match(styles, /body\[data-page="finder"\]\[data-auth-state="checking"\]\s*>\s*:not\(\.page-skip-link\):not\(#finder-auth-status\)[\s\S]*?visibility:\s*hidden\s*!important/);
  assert.match(styles, /\.finder-auth-status\s*\{[\s\S]*?width:\s*min\(34rem,\s*calc\(100vw\s*-\s*2rem\)\)/);
});

test('Finder profile query failure exposes a retry without revealing the dashboard', () => {
  const authHandler = page.slice(page.indexOf("document.addEventListener('DOMContentLoaded', async () => {"));
  assert.match(authHandler, /if\s*\(profileError\s*\|\|\s*!profile\)\s*\{/);
  assert.match(authHandler, /Your Finder profile could not be loaded/);
  assert.match(authHandler, /retry\.addEventListener\('click',\s*\(\)\s*=>\s*window\.location\.reload\(\)\)/);
  assert.match(authHandler, /document\.body\.dataset\.authState\s*=\s*'error'/);
  assert.ok(authHandler.indexOf("document.body.removeAttribute('data-auth-state')") > authHandler.indexOf('if (profileError || !profile)'));
  assert.ok(authHandler.indexOf("document.getElementById('finder-auth-status').hidden = true") < authHandler.indexOf("document.body.removeAttribute('data-auth-state')"));
});
