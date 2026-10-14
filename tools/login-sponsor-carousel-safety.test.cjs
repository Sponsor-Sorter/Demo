const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const loginSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'login.js'), 'utf8');
const safeSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'safePresentation.js'), 'utf8');

function extractFunction(source, name, exported = false) {
  const declaration = `${exported ? 'export ' : ''}function ${name}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${name} helper should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1).replace(/^export /, '');
  }
  assert.fail(`${name} helper should be closed`);
}

const escapeHtmlSource = extractFunction(safeSource, 'escapeHtml', true);
const safeImageUrlSource = extractFunction(safeSource, 'safeImageUrl', true);
const profileHtmlSource = extractFunction(loginSource, 'profileHTML');
const helpers = new Function(
  'SUPABASE_URL',
  `${escapeHtmlSource}\n${safeImageUrlSource}\n${profileHtmlSource}\nreturn { profileHTML };`
)('https://mqixtrnhotqqybaghgny.supabase.co');

test('public sponsor carousel escapes usernames and safely encodes image paths', () => {
  const html = helpers.profileHTML({
    username: `</figcaption><img src=x onerror="alert(1)">`,
    profile_pic: `folder/avatar one.png" onerror="alert(1)`
  });

  assert.match(html, /&lt;\/figcaption&gt;&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /folder\/avatar%20one\.png%22%20onerror%3D%22alert\(1\)/);
  assert.doesNotMatch(html, /<img src=x| onerror="/);
});

test('sponsor carousel filters dot segments and keeps a safe fallback image', () => {
  const html = helpers.profileHTML({ username: 'Creator', profile_pic: '../avatar.png' });

  assert.match(html, /\/storage\/v1\/object\/public\/logos\/avatar\.png/);
  assert.match(helpers.profileHTML({ username: '', profile_pic: '' }), /src="logos\.png"/);
});
