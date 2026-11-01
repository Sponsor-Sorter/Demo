export type Json = Record<string, unknown>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function invalid(message: string) {
  return Object.assign(new Error(message), { status: 400 })
}

export function isObject(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function parseBody(value: unknown): { action: string; data: Json } {
  if (!isObject(value) || typeof value.action !== 'string') throw invalid('Invalid request')
  const action = value.action
  const allowed: Record<string, string[]> = {
    connect: ['action'], status: ['action'],
    ack: ['action', 'decision'], appeal: ['action', 'decision', 'requestId', 'reason'],
    save: ['action', 'save'],
  }
  if (!allowed[action] || Object.keys(value).some((key) => !allowed[action].includes(key))) throw invalid('Unsupported control request')
  if (action === 'ack' || action === 'appeal') {
    if (typeof value.decision !== 'string' || !UUID.test(value.decision)) throw invalid('Invalid decision')
  }
  if (action === 'appeal') {
    if (typeof value.requestId !== 'string' || !UUID.test(value.requestId)) throw invalid('Invalid request id')
    if (typeof value.reason !== 'string' || value.reason.trim().length < 5 || value.reason.length > 2000) throw invalid('Appeal reason must be 5 to 2000 characters')
  }
  if (action === 'save') {
    const save = value.save
    const keys = ['p_request_id', 'p_expected_revision', 'p_cloud_version', 'p_save_data']
    if (!isObject(save) || Object.keys(save).some((key) => !keys.includes(key)) || keys.some((key) => !(key in save))) throw invalid('Invalid save request')
    if (typeof save.p_request_id !== 'string' || !UUID.test(save.p_request_id)) throw invalid('Invalid save request id')
    if (!Number.isSafeInteger(save.p_expected_revision) || Number(save.p_expected_revision) < 0) throw invalid('Invalid save revision')
    if (save.p_cloud_version !== 1 || !isObject(save.p_save_data) || save.p_save_data.schema !== 1) throw invalid('Invalid save data')
    if (new TextEncoder().encode(JSON.stringify(save.p_save_data)).byteLength > 262144) throw invalid('Save is too large')
  }
  return { action, data: value }
}
