import {Check} from 'lucide-react'
import {useAuth} from '../context/Auth'
import {hasSupabase} from '../lib/supabase'
const PHASES=[['Foundation','Login, roles, theme, GitHub deploy',true],['Donors and camps','Registration, QR, slots, calendar',true],['Camp day','Check-in, screening, donation, live board',true],['Communication','WhatsApp links, reminders, birthday alerts, daily digest',true],['Donor portal','Donor login, certificates, public page',true],['Emergency and stock','Blood stock, expiry alerts, request board',true],['Advanced messaging','Bulk send queue, segments, inbox',false],['Insights and finance','Analytics, reports, sponsors, expenses',false]]
export default function Dashboard(){
  const {profile}=useAuth()
  return <div>
    <h1 className="h1">Welcome, {profile.full_name||'friend'}</h1>
    {!hasSupabase&&<div className="card mb-5 border-brand/40 text-sm text-slate-300">Preview mode: no database connected. Add your Supabase keys to turn on real sign-in (see README).</div>}
    <section className="card">
      <h2 className="mb-4 font-semibold text-white">Build progress</h2>
      <ol className="space-y-3">{PHASES.map(([t,d,done],i)=>
        <li key={t} className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${done?'bg-brand text-white':'border border-ink-600 text-slate-400'}`}>{done?<Check size={13}/>:i+1}</span>
          <div><div className={done?'text-white':'text-slate-300'}>{t}</div><div className="text-sm text-slate-500">{d}</div></div>
        </li>)}</ol>
    </section></div>
}
