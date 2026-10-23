// WhatsApp Cloud API (official, from Meta) sender and webhook.
//   POST ?run=1   : send waiting messages from the outbox (called every minute by pg_cron, and by the app after queuing)
//   POST ?test=1  : send one test message (signed-in user with the Settings permission)
//   GET           : Meta webhook verification (hub.verify_token must equal the WA_VERIFY_TOKEN secret)
//   POST (Meta)   : incoming replies (STOP / START) and delivery failures
// Secrets: WA_CLOUD_TOKEN (permanent access token), WA_VERIFY_TOKEN (any phrase you choose for the webhook).
// Deploy with verify_jwt = false, because Meta's webhook does not send a Supabase token.
import { createClient } from 'npm:@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Tpl = { name: string; lang?: string; params?: string[] }
type Msg = { id: string; kind: string; phone: string; name: string | null; body: string; vars: Record<string, string> | null }

async function sendOne(phoneId: string, token: string, m: Msg, tpl?: Tpl) {
  const to = '91' + m.phone
  const vars: Record<string, string> = { name: m.name ?? '', message: m.body, ...(m.vars ?? {}) }
  const payload = tpl
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: tpl.name, language: { code: tpl.lang || 'en' },
        components: tpl.params?.length ? [{ type: 'body', parameters: tpl.params.map((p) => ({ type: 'text', text: String(vars[p] ?? '-').slice(0, 1000) || '-' })) }] : [] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: m.body, preview_url: true } }
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const j = await r.json().catch(() => ({}))
  if (r.ok && j.messages?.[0]?.id) return { ok: true, id: j.messages[0].id as string }
  const code = j.error?.code, msg = j.error?.error_data?.details || j.error?.message || `HTTP ${r.status}`
  // rate limits and Meta outages are worth another try; anything else is a real failure
  const retry = [4, 80007, 130429, 131000, 131016].includes(code) || r.status >= 500
  const plain = code === 131047 ? 'Outside the 24-hour window: set an approved template for this kind of message in Settings → WhatsApp'
    : code === 131026 ? 'Could not deliver: the number may not be on WhatsApp' : msg
  return { ok: false, error: (retry ? 'retry: ' : '') + `${plain}${code ? ` (${code})` : ''}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const token = Deno.env.get('WA_CLOUD_TOKEN') ?? ''

  // Meta webhook check
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === Deno.env.get('WA_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)

  const { data: w } = await sb.from('wa_settings').select('*').eq('id', 1).single()
  if (!w) return reply({ error: 'WhatsApp settings missing; run v9-whatsapp.sql' }, 500)

  // a test message from Settings
  if (url.searchParams.get('test')) {
    const auth = req.headers.get('Authorization') ?? ''
    const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: allowed } = await asCaller.rpc('perm', { m: 'settings' })
    if (!allowed) return reply({ error: 'Only people with the Settings permission can send a test' }, 403)
    if (!token || !w.cloud_phone_id) return reply({ error: 'Add the Phone number ID in Settings and the WA_CLOUD_TOKEN secret in Supabase first' }, 400)
    const b = await req.json().catch(() => ({}))
    const phone = String(b.phone ?? '').replace(/\D/g, '').slice(-10)
    if (!/^[6-9]\d{9}$/.test(phone)) return reply({ error: 'Enter a 10-digit mobile number' }, 400)
    const tpl = b.template ? { name: b.template, lang: b.lang || 'en', params: [] } : undefined
    const r = await sendOne(w.cloud_phone_id, token, { id: 'test', kind: 'test', phone, name: 'Test', body: b.text || 'Test message from the club CRM', vars: null }, tpl)
    return reply(r, r.ok ? 200 : 400)
  }

  // send the waiting messages
  if (url.searchParams.get('run')) {
    if (w.provider !== 'cloud') return reply({ skipped: 'Cloud API is not the selected sender' })
    if (!token || !w.cloud_phone_id) return reply({ error: 'WA_CLOUD_TOKEN secret or Phone number ID missing' }, 400)
    const { data: rows, error } = await sb.rpc('wa_claim', { p_limit: Math.min(w.per_minute ?? 6, 30) })
    if (error) return reply({ error: error.message }, 500)
    const templates = (w.cloud_templates ?? {}) as Record<string, Tpl>
    let sent = 0, failed = 0
    const gap = Math.floor(50000 / Math.max(1, rows?.length ?? 1))
    for (const m of (rows ?? []) as Msg[]) {
      const r = await sendOne(w.cloud_phone_id, token, m, templates[m.kind] ?? templates['*'])
      await sb.rpc('wa_result', { p_id: m.id, p_ok: r.ok, p_error: r.ok ? null : r.error, p_msg_id: r.ok ? r.id : null })
      r.ok ? sent++ : failed++
      await sleep(Math.min(gap, 3000))
    }
    return reply({ sent, failed })
  }

  // webhook events from Meta
  const body = await req.json().catch(() => null)
  if (body?.object === 'whatsapp_business_account') {
    for (const e of body.entry ?? []) for (const ch of e.changes ?? []) {
      const v = ch.value ?? {}
      for (const m of v.messages ?? []) {
        const text = String(m.text?.body ?? m.button?.text ?? '').trim().toLowerCase(), phone = String(m.from ?? '').slice(-10)
        if (/^(stop|unsubscribe|நிறுத்து|நிறுத்தவும்)$/.test(text)) await sb.rpc('wa_optout_add', { p_phone: phone, p_reason: 'Replied STOP' })
        else if (text === 'start') await sb.rpc('wa_optout_remove', { p_phone: phone })
      }
      for (const s of v.statuses ?? []) if (s.status === 'failed') {
        const why = s.errors?.[0]?.error_data?.details || s.errors?.[0]?.title || 'Delivery failed'
        await sb.from('wa_outbox').update({ status: 'failed', error: String(why).slice(0, 300) }).eq('provider_msg_id', s.id)
      }
    }
  }
  return reply({ ok: true })
})
