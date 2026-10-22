// Master user control: create users, reset passwords, change email, delete.
// Callers must be signed in and hold the 'users' permission. Only admins can create or change admins.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ROLES = ['admin', 'coordinator', 'medical', 'volunteer', 'donor']
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (msg: string, status = 400) => reply({ error: msg }, status)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('Use POST', 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // who is calling, and may they manage users?
    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: { user } } = await asCaller.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (!user) return fail('Sign in again', 401)
    const { data: allowed } = await asCaller.rpc('perm', { m: 'users' })
    if (!allowed) return fail('You do not have permission to manage users', 403)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = me?.role === 'admin'

    const body = await req.json()
    const { action } = body
    const targetRole = async (id: string) => (await admin.from('profiles').select('role').eq('id', id).single()).data?.role
    const guardTarget = async (id: string) => {
      if (!id) throw new Error('Missing user')
      if (!isAdmin && (await targetRole(id)) === 'admin') throw new Error('Only an admin can change admin accounts')
    }

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const role = ROLES.includes(body.role) ? body.role : 'donor'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Enter a valid email')
      if (password.length < 8) return fail('Password must be at least 8 characters')
      if (role === 'admin' && !isAdmin) return fail('Only an admin can create an admin', 403)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: body.full_name ?? '' },
      })
      if (error) return fail(error.message)
      const { error: pe } = await admin.from('profiles').update({
        full_name: body.full_name || null, phone: body.phone || null, role,
        designation: body.designation || null, permissions: body.permissions ?? {}, email,
      }).eq('id', data.user.id)
      if (pe) return fail(pe.message)
      return reply({ ok: true, id: data.user.id })
    }

    if (action === 'reset_password') {
      await guardTarget(body.user_id)
      if (String(body.password ?? '').length < 8) return fail('Password must be at least 8 characters')
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password })
      return error ? fail(error.message) : reply({ ok: true })
    }

    if (action === 'update_email') {
      await guardTarget(body.user_id)
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Enter a valid email')
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { email, email_confirm: true })
      return error ? fail(error.message) : reply({ ok: true })
    }

    if (action === 'delete') {
      if (body.user_id === user.id) return fail('You cannot delete your own account')
      await guardTarget(body.user_id)
      if ((await targetRole(body.user_id)) === 'admin') {
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true)
        if ((count ?? 0) <= 1) return fail('Keep at least one active admin')
      }
      const { error } = await admin.auth.admin.deleteUser(body.user_id)
      return error ? fail(error.message) : reply({ ok: true })
    }

    return fail('Unknown action')
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
})
