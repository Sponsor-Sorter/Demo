const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rawSource = fs.readFileSync(path.join(__dirname, '../js/FamBot.js'), 'utf8');
const signupSource = fs.readFileSync(path.join(__dirname, '../js/formSubmit.js'), 'utf8');
const source = rawSource.split('// --- Modal/UX Logic ---')[0]
  .replace("import { supabase } from './supabaseClient.js';", '')
  .replace(/^export async function /m, 'async function ')
  .replace(/^export function /m, 'function ');

function fixture(fetchImpl, overrides = {}) {
  const calls = [];
  const modals = [];
  const context = {
    fetch: async (...args) => {
      calls.push(args);
      return fetchImpl(...args);
    },
    supabase: { supabaseKey: 'synthetic-project-key', auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-session', user: { id: '00000000-0000-4000-8000-000000000001' } } } }) } },
    AbortController, TextEncoder, setTimeout, clearTimeout,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000002' },
    famBotShowModal: (result, type) => modals.push({ result, type }),
    ...overrides,
  };
  vm.runInNewContext(source + '\nthis.famBotModerateWithModal = famBotModerateWithModal;', context);
  return { calls, modals, moderate: context.famBotModerateWithModal };
}

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body && typeof body === 'object' && !Array.isArray(body) ? { banned: false, allowed: !body.flagged, strikes: 0, check_id: '00000000-0000-4000-8000-000000000003', policy_version: 'fambot-three-distinct-v1', replayed: false, flaggedCategories: [], ...body } : body });

test('valid synthetic decision sends normalized content, owner, request ID and context', async () => {
  const page = fixture(async () => jsonResponse({ flagged: false, score: 0 }));
  const result = await page.moderate({
    user_id: '00000000-0000-4000-8000-000000000001', content: 'synthetic text', jwt: 'synthetic-jwt', type: 'comment',
  });
  assert.equal(result.allowed, true);
  assert.equal(page.modals.length, 0);
  assert.equal(page.calls.length, 1);
  const [url, request] = page.calls[0];
  assert.match(url, /\/functions\/v1\/FamBot$/);
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer synthetic-jwt');
  assert.equal(request.headers.apikey, 'synthetic-project-key');
  assert.deepEqual(JSON.parse(request.body), { user_id: '00000000-0000-4000-8000-000000000001', content: 'synthetic text', request_id: '00000000-0000-4000-8000-000000000002', type: 'comment' });
});

test('flagged synthetic content is denied and reports classification without claiming an account sanction', async () => {
  const page = fixture(async () => jsonResponse({ flagged: true, message: 'Synthetic blocked', strikes: 1 }));
  const result = await page.moderate({ user_id: '00000000-0000-4000-8000-000000000001', content: 'synthetic text', type: 'review' });
  assert.equal(result.allowed, false);
  assert.equal(page.modals.length, 1);
  assert.equal(page.modals[0].type, 'review');
  assert.equal(page.modals[0].result.message, 'Synthetic blocked');
});

test('synthetic category text is escaped and response sanction claims are omitted', () => {
  let rendered;
  const closeButton = { onclick: null };
  const document = {
    getElementById: id => id === 'fambot-close' ? closeButton : null,
    createElement: () => (rendered = { id: '', innerHTML: '', remove() {} }),
    body: { appendChild() {} },
  };
  const context = { document };
  vm.runInNewContext(rawSource
    .replace("import { supabase } from './supabaseClient.js';", '')
    .replace(/^export async function /m, 'async function '), context);
  context.famBotShowModal({
    flagged: true,
    message: 'You are banned from submitting content.',
    banned: true,
    strikes: 3,
    flaggedCategories: ['<svg onload=alert(2)>'],
  }, 'comment');
  assert.match(rendered.innerHTML, /Comment Flagged/);
  assert.match(rendered.innerHTML, /was flagged and was not submitted/);
  assert.match(rendered.innerHTML, /account status is not shown here/);
  assert.match(rendered.innerHTML, /&lt;svg onload=alert\(2\)&gt;/);
  assert.doesNotMatch(rendered.innerHTML, /You are banned|banned from submitting|strike|<svg onload=/i);
});

test('signup FamBot modal separates blocked signup content from account status', () => {
  const start = signupSource.indexOf('// FamBot modal renderer');
  assert.notEqual(start, -1);
  const source = signupSource.slice(start);
  let rendered;
  const context = {
    document: {
      getElementById: id => id === 'fambot-close' ? { onclick: null } : null,
      createElement: () => (rendered = { id: '', innerHTML: '', remove() {} }),
      body: { appendChild() {} },
    },
  };
  vm.runInNewContext(source + '\nthis.showFamBotModal = showFamBotModal;', context);
  context.showFamBotModal({
    flagged: true,
    message: 'Your account has been banned.',
    banned: true,
    strikes: 3,
    flaggedCategories: ['synthetic category'],
  });
  assert.match(rendered.innerHTML, /Signup Content Flagged/);
  assert.match(rendered.innerHTML, /signup content was flagged and was not submitted/);
  assert.match(rendered.innerHTML, /account status is not shown here/);
  assert.match(rendered.innerHTML, /synthetic category/i);
  assert.doesNotMatch(rendered.innerHTML, /Your account has been banned|banned|strike/i);
});

test('inline profile feedback does not display unverified FamBot response messages', () => {
  const profileSource = fs.readFileSync(path.join(__dirname, '../js/settingsPage.js'), 'utf8');
  const start = profileSource.indexOf('// -------- FamBot moderation for inline profile details --------');
  const end = profileSource.indexOf('// -------- End FamBot moderation --------', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = profileSource.slice(start, end);
  assert.match(block, /modResult\.unavailable/);
  assert.match(block, /account status is not shown here/);
  assert.doesNotMatch(block, /modResult\.message/);
});

test('non-success HTTP status with an unflagged body is denied', async () => {
  const page = fixture(async () => jsonResponse({ flagged: false, message: 'synthetic provider error' }, false));
  const result = await page.moderate({ user_id: '00000000-0000-4000-8000-000000000001', content: 'synthetic text' });
  assert.equal(result.allowed, false);
  assert.equal(result.unavailable, true);
  assert.match(result.message, /could not check this content/i);
  assert.equal(page.modals[0].result.unavailable, true);
});

test('missing or malformed moderation decisions fail closed', async () => {
  for (const body of [null, {}, { flagged: 'false' }, 'not-an-object']) {
    const page = fixture(async () => jsonResponse(body));
    const result = await page.moderate({ user_id: '00000000-0000-4000-8000-000000000001', content: 'synthetic text' });
    assert.equal(result.allowed, false);
    assert.equal(result.unavailable, true);
  }
});

test('network rejection and invalid JSON fail closed with the same retry message', async () => {
  const failures = [
    async () => { throw new Error('synthetic offline'); },
    async () => ({ ok: true, json: async () => { throw new Error('synthetic invalid JSON'); } }),
  ];
  for (const fetchImpl of failures) {
    const page = fixture(fetchImpl);
    const result = await page.moderate({ user_id: '00000000-0000-4000-8000-000000000001', content: 'synthetic text' });
    assert.equal(result.allowed, false);
    assert.equal(result.unavailable, true);
    assert.equal(result.message, 'We could not check this content right now. Please try again.');
    assert.equal(page.modals.length, 1);
  }
});

test('flagged response cannot override local denial with allowed true', async () => {
  const page=fixture(async()=>jsonResponse({flagged:true,banned:false,allowed:true}));
  const result=await page.moderate({content:'synthetic flagged response',type:'comment'});
  assert.equal(result.allowed,false);assert.equal(result.flagged,true);assert.equal(page.modals.length,1);
});
test('banned or contradictory clean decisions never grant permission', async () => {
  for(const body of [{flagged:false,banned:true,allowed:true},{flagged:false,allowed:false},{flagged:false,allowed:true,unavailable:true},{flagged:false,allowed:true,ok:false}]) {
    const page=fixture(async()=>jsonResponse(body));const result=await page.moderate({content:'synthetic'});assert.equal(result.allowed,false);
  }
});
test('decision metadata and strict booleans are required', async () => {
  for(const patch of [{banned:undefined},{allowed:undefined},{strikes:-1},{strikes:1.5},{check_id:'bad'},{policy_version:'other'},{replayed:'true'},{flaggedCategories:{}}]) {
    const page=fixture(async()=>jsonResponse({flagged:false,...patch}));assert.equal((await page.moderate({content:'synthetic'})).allowed,false);
  }
});
test('missing JWT and actor use current session without exposing tokens', async () => {
  const page=fixture(async()=>jsonResponse({flagged:false}));
  const result=await page.moderate({content:'synthetic',type:'profile'});
  assert.equal(result.allowed,true);assert.equal(page.calls[0][1].headers.Authorization,'Bearer synthetic-session');
  assert.equal(JSON.parse(page.calls[0][1].body).user_id,'00000000-0000-4000-8000-000000000001');
});
test('unavailable session or mismatched fallback actor makes no provider request', async () => {
  const page=fixture(async()=>jsonResponse({flagged:false}));
  assert.equal((await page.moderate({user_id:'00000000-0000-4000-8000-000000000009',content:'synthetic'})).allowed,false);
  const missing=fixture(async()=>jsonResponse({flagged:false}),{supabase:{auth:{getSession:async()=>({data:{session:null}})}}});
  assert.equal((await missing.moderate({content:'synthetic'})).allowed,false);assert.equal(page.calls.length+missing.calls.length,0);
});
test('content is NFC normalized and limited by codepoints rather than UTF16 units', async () => {
  const page=fixture(async()=>jsonResponse({flagged:false}));
  assert.equal((await page.moderate({content:'  e\u0301  '})).allowed,true);assert.equal(JSON.parse(page.calls[0][1].body).content,'é');
  assert.equal((await page.moderate({content:'😀'.repeat(12000)})).allowed,true);
  const before=page.calls.length;assert.equal((await page.moderate({content:'😀'.repeat(12001)})).allowed,false);assert.equal(page.calls.length,before);
});
test('oversized JSON body, empty text and unknown context are rejected locally', async () => {
  const page=fixture(async()=>jsonResponse({flagged:false}));
  for(const input of [{content:'\u0000'.repeat(12000)},{content:'   '},{content:'synthetic',type:'arbitrary'}]) assert.equal((await page.moderate(input)).allowed,false);
  assert.equal(page.calls.length,0);
});
test('25second whole-operation timeout aborts once without retry', async () => {
  let expire,timeout,cleared=0;
  const page=fixture(async()=>new Promise(()=>{}),{setTimeout:(callback,ms)=>{expire=callback;timeout=ms;return 1;},clearTimeout:()=>{cleared++;}});
  const promise=page.moderate({user_id:'00000000-0000-4000-8000-000000000001',jwt:'synthetic',content:'synthetic'});
  assert.equal(timeout,25000);expire();const result=await promise;
  assert.equal(result.allowed,false);assert.equal(result.unavailable,true);assert.equal(page.calls.length,1);assert.equal(page.calls[0][1].signal.aborted,true);assert.equal(cleared,1);
});
test('explicit request reference can be retained for a deliberate retry', async () => {
  const page=fixture(async()=>jsonResponse({flagged:false}));const request_id='00000000-0000-4000-8000-000000000008';
  for(let index=0;index<2;index++) await page.moderate({content:'synthetic',request_id,type:'review_reply'});
  assert.equal(page.calls.length,2);assert.ok(page.calls.every(([,request])=>JSON.parse(request.body).request_id===request_id));
});
test('Web Admin FamBot log query includes bans and administrator unbans', () => {
  const admin=fs.readFileSync(path.join(__dirname,'../js/adminLogic.js'),'utf8');
  assert.match(admin,/\.in\("action", \["auto-strike", "auto-ban", "fambot-unban"\]\)/);
});
