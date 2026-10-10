const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Run pure helpers and safety guards without any network or database client.
function fixture() {
  let download;
  const alerts = [];
  class DownloadURL extends URL {
    static createObjectURL(blob) { download = blob; return 'blob:preview'; }
    static revokeObjectURL() {}
  }
  const source = fs.readFileSync(path.join(__dirname, '../js/adminLogic.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '');
  const context = vm.createContext({
    URL: DownloadURL, Blob, console,
    document: {
      addEventListener() {},
      body: { appendChild() {} },
      createElement: () => ({ click() {}, remove() {} })
    },
    alert: message => alerts.push(message),
    confirm: () => { throw new Error('Guard should run before confirmation'); }
  });
  context.window = context;
  context.adminUserId = 'self';
  vm.runInContext(source, context);
  return { context, alerts, download: () => download };
}

test('user-authored text is escaped and executable result URLs are rejected', () => {
  const { context } = fixture();
  assert.equal(vm.runInContext('esc("<img src=x onerror=alert(1)>")', context), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(vm.runInContext('safeResultUrl("javascript:alert(1)")', context), '#');
  assert.equal(vm.runInContext('safeResultUrl("https://example.com/export.json")', context), 'https://example.com/export.json');
});

test('CSV values cannot start spreadsheet formulas', async () => {
  const { context, download } = fixture();
  vm.runInContext('exportToCSV("preview.csv", [{value:"=SUM(1,2)"},{value:" +SUM(1,2)"},{value:"@cmd"}])', context);
  const csv = await download().text();
  assert.match(csv, /"'=SUM/);
  assert.match(csv, /"' \+SUM/);
  assert.match(csv, /"'@cmd/);
});

test('administrators cannot ban themselves or revoke their own access', async () => {
  const { context, alerts } = fixture();
  await vm.runInContext('window.banUser("self", false)', context);
  await vm.runInContext('window.toggleAdmin("self", true)', context);
  assert.equal(alerts.length, 2);
  assert.match(alerts[0], /cannot ban your own/);
  assert.match(alerts[1], /cannot revoke your own/);
});
