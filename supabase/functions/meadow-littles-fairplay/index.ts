import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { invalid, isObject, parseBody, type Json } from './contracts.ts'

const APP = 'littles'
const BUILD = 36
const CONSUMER_VERSION = 'littles-36'
const FEATURES = ['moderation', 'warnings', 'appeals', 'maintenance', 'notices']
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

type Actor = { id: string; is_anonymous?: boolean }

function reply(status: number, value: Json) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function emptyModeration() {
  return { schema_version: 1, app: APP, banned: false, restricted: false, decisions: [] }
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' })
  if (!supabaseUrl || !publicKey || !serviceKey) return reply(503, { code: 'LITTLES_CONTROL_UNAVAILABLE' })

  try {
    const length = Number(req.headers.get('content-length') ?? 0)
    if (length > 280000) throw invalid('Request is too large')
    const authHeader = req.headers.get('authorization') ?? ''
    const tokenMatch = /^Bearer\s+(\S+)$/i.exec(authHeader)
    if (!tokenMatch) return reply(401, { code: 'LITTLES_SIGN_IN_REQUIRED' })
    const token = tokenMatch[1]
    const parsed = parseBody(await req.json())

    const userClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: identity, error: authError } = await userClient.auth.getUser(token)
    const user = identity?.user as Actor | null
    if (authError || !user?.id) return reply(401, { code: 'LITTLES_SIGN_IN_REQUIRED' })
    const userId = user.id
    const { data: validSession, error: sessionError } = await userClient.rpc('meadow_littles_validate_session')
    if (sessionError || validSession !== true) return reply(401, { code: 'LITTLES_SESSION_EXPIRED' })

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    async function isMember() {
      const { data, error } = await service.from('meadow_littles_profiles').select('user_id').eq('user_id', userId).maybeSingle()
      if (error) throw new Error('LITTLES_CONTROL_UNAVAILABLE')
      return !!data
    }

    async function moderation() {
      if (!(await isMember())) return emptyModeration()
      const { data, error } = await service.rpc('fairplay_game_moderation_status', { p_app: APP, p_user: userId })
      if (error || !isObject(data) || data.app !== APP || !Array.isArray(data.decisions)) throw new Error('LITTLES_CONTROL_UNAVAILABLE')
      return data
    }

    async function runtime() {
      const { data, error } = await service.rpc('fairplay_game_runtime', { p_app: APP, p_build: BUILD })
      if (error || !isObject(data) || data.app !== APP || !Array.isArray(data.notices)) throw new Error('LITTLES_CONTROL_UNAVAILABLE')
      return data
    }

    async function currentStatus() {
      const [moderationState, runtimeState] = await Promise.all([moderation(), runtime()])
      return { moderation: moderationState, runtime: runtimeState, build: BUILD }
    }

    if (parsed.action === 'connect') {
      // Register the authenticated account as a Littles member without
      // returning cloud data. This lets Fairplay look up decisions for a new
      // Littles account before the save-open RPC can reveal any progress.
      const { error: registerError } = await userClient.rpc('meadow_littles_register_member')
      if (registerError) throw new Error('LITTLES_CONTROL_UNAVAILABLE')
      let state = await currentStatus()
      if (state.moderation.banned === true) return reply(200, { ok: true, ...state, account: null, integration_reported: false })
      const { data: account, error: openError } = await userClient.rpc('meadow_littles_open', { p_display_name: null })
      if (openError || !isObject(account) || !isObject(account.profile) || account.profile.user_id !== userId || !isObject(account.save)) {
        throw new Error('LITTLES_CLOUD_UNAVAILABLE')
      }
      // Recheck after opening so a ban that races the first check cannot make
      // this response disclose the cloud save.
      state = await currentStatus()
      // A moderation decision can land between the initial check and the
      // profile creation RPC. Never return cloud data after that second check
      // observes a ban.
      if (state.moderation.banned === true) return reply(200, { ok: true, ...state, account: null, integration_reported: false })
      let integrationReported = false
      const { error: eventError } = await service.rpc('fairplay_game_event', {
        p_app: APP,
        p_event_id: crypto.randomUUID(),
        p_kind: 'heartbeat',
        p_player: userId,
        p_summary: 'Littles consumer connected build 36',
        p_body: { consumer_version: CONSUMER_VERSION, features: FEATURES },
      })
      integrationReported = !eventError
      return reply(200, { ok: true, ...state, account, integration_reported: integrationReported })
    }

    if (parsed.action === 'status') return reply(200, { ok: true, ...(await currentStatus()) })

    if (parsed.action === 'save') {
      if (!(await isMember())) return reply(409, { code: 'LITTLES_OPEN_REQUIRED' })
      const state = await moderation()
      if (state.banned === true) return reply(403, { code: 'LITTLES_BANNED', moderation: state })
      const input = parsed.data.save as Json
      // Actor and app come only from this verified request and server code.
      const { data, error } = await userClient.rpc('meadow_littles_save', {
        p_request_id: input.p_request_id,
        p_expected_revision: input.p_expected_revision,
        p_cloud_version: input.p_cloud_version,
        p_save_data: input.p_save_data,
        p_expected_user_id: userId,
      })
      if (error) return reply(error.message === 'LITTLES_BANNED' ? 403 : 409, { code: error.message.startsWith('LITTLES_') ? error.message : 'LITTLES_CLOUD_UNAVAILABLE' })
      return reply(200, { ok: true, result: data })
    }

    if (parsed.action === 'ack') {
      const { data, error } = await service.rpc('fairplay_game_warning_ack', {
        p_app: APP, p_user: userId, p_decision: parsed.data.decision,
      })
      if (error) return reply(403, { code: 'LITTLES_WARNING_NOT_AVAILABLE' })
      return reply(200, { ok: true, result: data, ...(await currentStatus()) })
    }

    if (parsed.action === 'appeal') {
      const { data, error } = await service.rpc('fairplay_game_appeal', {
        p_app: APP, p_user: userId, p_decision: parsed.data.decision,
        p_request_id: parsed.data.requestId, p_reason: (parsed.data.reason as string).trim(),
      })
      if (error) return reply(400, { code: 'LITTLES_APPEAL_NOT_ACCEPTED' })
      return reply(200, { ok: true, result: data, ...(await currentStatus()) })
    }

    return reply(400, { code: 'INVALID_CONTROL_REQUEST' })
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 503
    const message = status === 400 ? (error as Error).message : 'LITTLES_CONTROL_UNAVAILABLE'
    return reply(status, { code: message })
  }
})
