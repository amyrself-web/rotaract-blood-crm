// Sends the CRM's queued emails through Resend or SendGrid (chosen in Settings → Email).
// Called every few minutes by the database (pg_cron + pg_net, with a private cron secret) and by the app after queuing.
// API key: RESEND_API_KEY / SENDGRID_API_KEY secret, or the key saved in Settings (stored privately in the database).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Mail = { id: string; to_email: string; to_name: string | null; subject: string; html: string }

async function sendOne(provider: string, key: string, from: string, fromName: string, replyTo: string | null, m: Mail) {
  if (provider === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromName ? `${fromName} <${from}>` : from, to: [m.to_email], subject: m.subject, html: m.html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return { ok: true, id: j.id ?? null }
    return { ok: false, error: `${r.status >= 500 || r.status === 429 ? 'retry: ' : ''}Resend: ${j.message ?? j.error ?? r.status}` }
  }
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: m.to_email, ...(m.to_name ? { name: m.to_name } : {}) }] }],
      from: { email: from, ...(fromName ? { name: fromName } : {}) }, ...(replyTo ? { reply_to: { email: replyTo } } : {}),
      subject: m.subject, content: [{ type: 'text/html', value: m.html }],
    }),
  })
  if (r.ok) return { ok: true, id: r.headers.get('x-message-id') }
  const j = await r.json().catch(() => ({}))
  return { ok: false, error: `${r.status >= 500 || r.status === 429 ? 'retry: ' : ''}SendGrid: ${j?.errors?.[0]?.message ?? r.status}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const body = await req.json().catch(() => ({}))

    // who is calling: the database's timer (cron secret) or a signed-in team member
    const cron = req.headers.get('x-cron-secret') ?? ''
    let allowed = false
    if (cron) allowed = (await admin.rpc('check_cron_secret', { p: cron })).data === true
    if (!allowed) {
      const auth = req.headers.get('Authorization') ?? ''
      const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
      const { data: { user } } = await asCaller.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
      if (user) allowed = (await Promise.all(['settings', 'messages'].map((m) => asCaller.rpc('perm', { m })))).some((r) => r.data === true)
    }
    if (!allowed) return reply({ error: 'Not allowed' }, 403)

    const { data: es } = await admin.from('email_settings').select('*').eq('id', 1).single()
    const provider = es?.provider ?? 'off'
    const envKey = provider === 'resend' ? Deno.env.get('RESEND_API_KEY') : provider === 'sendgrid' ? Deno.env.get('SENDGRID_API_KEY') : ''
    const key = envKey || (provider !== 'off' ? (await admin.rpc('email_key', { p_provider: provider })).data : '') || ''
    if (body.action === 'status') return reply({ provider, key: !!key, from: es?.from_email ?? null })
    if (provider === 'off') return reply({ sent: 0, note: 'Email is off' })
    if (!key) { await admin.rpc('email_run_status', { p: { ok: false, error: `No ${provider} API key`, at: new Date().toISOString() } }); return reply({ error: `Add the ${provider === 'resend' ? 'Resend' : 'SendGrid'} API key in Settings → Email` }, 400) }
    if (!es?.from_email) { await admin.rpc('email_run_status', { p: { ok: false, error: 'No sender address', at: new Date().toISOString() } }); return reply({ error: 'Add the sender email address in Settings → Email' }, 400) }

    const { data: batch, error } = await admin.rpc('email_claim', { p_limit: es.per_run ?? 40 })
    if (error) throw error
    let sent = 0, failed = 0, lastError = ''
    for (const m of (batch ?? []) as Mail[]) {
      const r = await sendOne(provider, key, es.from_email, es.from_name ?? '', es.reply_to ?? null, m).catch((e) => ({ ok: false, error: 'retry: ' + String(e?.message ?? e) }))
      await admin.rpc('email_result', { p_id: m.id, p_ok: r.ok, p_error: r.ok ? null : (r as { error: string }).error, p_provider_id: r.ok ? (r as { id: string | null }).id : null })
      if (r.ok) sent++; else { failed++; lastError = (r as { error: string }).error }
      await new Promise((ok) => setTimeout(ok, 120))   // stay well inside the providers' rate limits
    }
    await admin.rpc('email_run_status', { p: { ok: failed === 0, sent, failed, error: lastError || null, provider, at: new Date().toISOString() } })
    return reply({ sent, failed, error: lastError || null })
  } catch (e) {
    return reply({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
