import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Cake,HeartPulse,CalendarClock,Sun,Award,Presentation,Play,Clock} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../../context/Auth'
import {Toggle,errText} from '../ui'
import {kick} from '../../lib/wa'

const RULES=[
  ['birthday',Cake,'Birthday wishes','Donors whose birthday is today.'],
  ['eligible_again',HeartPulse,'Can donate again','When 3 months (men) or 4 months (women) have passed since the last donation.'],
  ['reminder_1d',CalendarClock,'Camp reminder, day before','Everyone registered for tomorrow’s camp, with their slot.'],
  ['reminder_today',Sun,'Camp reminder, morning','Everyone registered for today’s camp, at 7 am.'],
  ['followup',Award,'Next-day thank-you with certificate','The day after a camp, every donor gets a thank-you, a “drink water” reminder and a link to download their certificate.'],
  ['meeting_1d',Presentation,'Meeting reminder for members','Active club members, the day before each meeting.']]

export default function AutoRules(){
  const {can}=useAuth(),admin=can('settings')
  const [w,setW]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('wa_settings').select('auto,last_rules_at,last_rules,provider').eq('id',1).single().then(({data,error})=>error?toast.error(error.message):setW(data))
  useEffect(()=>{load()},[])
  const set=async(k,v)=>{const auto={...w.auto,[k]:v};setW({...w,auto});const {error}=await supabase.from('wa_settings').update({auto,updated_at:new Date().toISOString()}).eq('id',1);if(error){toast.error(error.message);load()}}
  const run=async()=>{setBusy(true);const {data,error}=await supabase.rpc('wa_daily_rules',{p_day:null});setBusy(false);if(error)return toast.error(errText(error))
    const n=Object.values(data||{}).reduce((a,b)=>a+(Number(b)||0),0);toast.success(n?`${n} messages added to the Outbox`:'No new messages for today');kick();load()}
  if(!w)return <div className="skeleton h-64"/>
  return <div className="space-y-4">
    <div className="card flex flex-wrap items-center gap-3"><Clock size={20} className="text-brand"/><div className="min-w-0 flex-1"><div className="font-semibold text-fg">Every morning at 8 am</div>
      <div className="text-sm text-fog-muted">The CRM puts today’s messages in the Outbox by itself. Each person gets each message only once.{w.last_rules_at?` Last run ${new Date(w.last_rules_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})}.`:''}</div></div>
      <button className="btn-quiet" disabled={busy} onClick={run}><Play size={15}/>{busy?'Checking…':'Run now'}</button></div>
    <ul className="card divide-y divide-ink-700/80 p-0">{RULES.map(([k,I,l,d])=><li key={k} className="flex items-center gap-4 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><I size={18}/></span>
      <div className="min-w-0 flex-1"><div className="font-medium text-fg">{l}</div><div className="text-sm text-fog-muted">{d}</div>{w.last_rules?.[k]!=null&&<div className="mt-0.5 text-xs text-fog-faint">Last run: {w.last_rules[k]} queued</div>}</div>
      <Toggle checked={!!w.auto?.[k]} disabled={!admin} label={l} onChange={v=>set(k,v)}/></li>)}</ul>
    <p className="text-xs text-fog-faint">The words of each message are in the Templates tab.{!admin&&' Only people with the Settings permission can switch these on or off.'}</p>
  </div>
}
