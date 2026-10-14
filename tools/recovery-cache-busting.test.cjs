const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('entry pages request the updated recovery, privacy and chat module URLs', () => {
  assert.match(fs.readFileSync('login.html', 'utf8'), /js\/login\.js\?v=20261015-recovery1/);
  assert.match(fs.readFileSync('reset-password.html', 'utf8'), /js\/resetPassword\.js\?v=20261015-recovery1/);
  for (const page of ['dashboardsponsor.html', 'dashboardsponsee.html']) {
    const html = fs.readFileSync(page, 'utf8');
    assert.match(html, /js\/messages\.js\?v=20261015-cache1/, page);
    assert.match(html, /js\/privacy\.js\?v=20261015-privacy1/, page);
  }
});
