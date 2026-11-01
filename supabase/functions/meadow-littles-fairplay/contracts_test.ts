import { parseBody } from './contracts.ts'

const decision = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'

Deno.test('status accepts only the action and no caller identity', () => {
  if (parseBody({ action: 'status' }).action !== 'status') throw new Error('status was not accepted')
  for (const key of ['app', 'p_app', 'user', 'userId', 'actor', 'player', 'p_user']) {
    let rejected = false
    try { parseBody({ action: 'status', [key]: 'meadow' }) } catch { rejected = true }
    if (!rejected) throw new Error(`caller-supplied ${key} was accepted`)
  }
})

Deno.test('save permits only bounded save data and rejects actor overrides', () => {
  const save = {
    action: 'save',
    save: {
      p_request_id: requestId,
      p_expected_revision: 2,
      p_cloud_version: 1,
      p_save_data: { schema: 1, state: {} },
    },
  }
  if (parseBody(save).action !== 'save') throw new Error('valid save was not accepted')
  for (const key of ['p_expected_user_id', 'p_user', 'p_app']) {
    let rejected = false
    try { parseBody({ ...save, save: { ...save.save, [key]: '22222222-2222-4222-8222-222222222222' } }) } catch { rejected = true }
    if (!rejected) throw new Error(`save actor override ${key} was accepted`)
  }
})

Deno.test('appeal input is bounded and decisions are opaque IDs', () => {
  if (parseBody({ action: 'appeal', decision, requestId, reason: 'Please review this decision.' }).action !== 'appeal') throw new Error('valid appeal was not accepted')
  for (const payload of [
    { action: 'appeal', decision: 'other-user', requestId, reason: 'Please review this decision.' },
    { action: 'appeal', decision, requestId, reason: 'no' },
    { action: 'appeal', decision, requestId, reason: 'please review', extra: 'spoof' },
  ]) {
    let rejected = false
    try { parseBody(payload) } catch { rejected = true }
    if (!rejected) throw new Error('invalid appeal payload was accepted')
  }
})

Deno.test('report and social actions are absent from Littles contract', () => {
  for (const action of ['report', 'match', 'lobby', 'admit']) {
    let rejected = false
    try { parseBody({ action }) } catch { rejected = true }
    if (!rejected) throw new Error(`unsupported action ${action} was accepted`)
  }
})
