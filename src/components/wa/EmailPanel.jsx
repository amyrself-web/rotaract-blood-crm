import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Mail,KeyRound,Send,RotateCcw,X,Eye,Save,CheckCircle2,AlertTriangle,Play} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../../context/Auth'
import {Field,Toggle,Badge,Tabs,useLive,errText} from '../ui'

const AUTO=[['birthday','Birthday wishes','Donors and members with an email, on their birthday.'],
  ['camp_reminder','Camp reminder','The day before a blood camp, to everyone registered.'],
  ['certificate','Thank-you with certificate','The day after a camp, with the certificate link.'],
  ['meeting_change','Meeting moved','When a meeting is preponed or postponed.'],
  ['emergency','Emergency blood need','Eligible donors of the needed group, when an emergency request is raised.'],
  ['staff_alerts','Alerts for the team','Overpaid subscription, morning check problems and similar, to the alert emails below.'],
  ['daily_report','Morning report','A short summary of the day to the alert emails, before the send time.']]
const TONE={queued:'blue',sending:'blue',sent:'green',failed:'red',cancelled:'neutral'}
const WORDS={birthday:'{name} {club}',camp_reminder:'{name} {camp} {date} {venue} {slot} {club}',certificate:'{name} {camp} {link} {club}',emergency:'{name} {group} {hospital} {contact} {club}',
  meeting_change:'{name} {meeting} {change} {when} {venue_at} {reason} {club}',staff_alert:'{title} {body} {link} {club}',daily_report:'{date} {report} {link} {club}'}
const SAMPLE={name:'Priya',club:'Sankari Durg Arima Sangam',camp:'Mega Blood Donation Camp',date:'12 Nov 2026',venue:'Town Hall',slot:'10:00',link:'#',group:'O+',hospital:'GH Salem',contact:'98765 43210',
  meeting:'General body meeting',change:'postponed',when:'15 Nov 2026, 6:30 PM',venue_at:' at Club office',reason:'Reason: hall not available',title:'Test alert',body:'This is how alerts look.',report:'<p>(today’s numbers)</p>'}
const fill=(t,v)=>t.replace(/\{([a-z_]+)\}/g,(_,k)=>v[k]??'')
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'}):''

function Setup(){
  const {can}=useAuth(),admin=can('settings')
  const [e,setE]=useState(null),[keys,setKeys]=useState({}),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[to,setTo]=useState('')
  const load=async()=>{const [a,b]=await Promise.all([supabase.from('email_settings').select('*').eq('id',1).single(),admin?supabase.rpc('email_keys_present'):Promise.resolve({data:{}})])
    if(a.error)return toast.error(a.error.message);setE(a.data);setKeys(b.data||{})}
  useEffect(()=>{load()},[])
  const set=k=>ev=>setE({...e,[k]:ev.target.value})
  const save=async()=>{
    if(e.provider!=='off'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.from_email||''))return toast.error('Enter the sender email address')
    const bad=(e.alert_emails||'').split(',').map(x=>x.trim()).filter(x=>x&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));if(bad.length)return toast.error(`Check this email: ${bad[0]}`)
    setBusy(true)
    if(key.trim()){const k=await supabase.rpc('set_email_key',{p_provider:e.provider,p_key:key.trim()});if(k.error){setBusy(false);return toast.error(errText(k.error))}setKey('')}
    const {error}=await supabase.from('email_settings').update({provider:e.provider,from_email:e.from_email?.trim()||null,from_name:e.from_name?.trim()||null,reply_to:e.reply_to?.trim()||null,
      alert_emails:e.alert_emails?.trim()||null,auto:e.auto,per_run:Number(e.per_run)||40,updated_at:new Date().toISOString()}).eq('id',1)
    setBusy(false);if(error)return toast.error(errText(error));toast.success('Email settings saved');load()}
  const removeKey=async()=>{const {error}=await supabase.rpc('set_email_key',{p_provider:e.provider,p_key:''});if(error)return toast.error(errText(error));toast.success('Key removed');load()}
  const test=async()=>{if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))return toast.error('Enter an email address to send the test to')
    setBusy(true);const q=await supabase.rpc('email_test',{p_to:to.trim()});if(q.error){setBusy(false);return toast.error(errText(q.error))}
    const r=await supabase.functions.invoke('email-send',{body:{action:'run'}});setBusy(false)
    if(r.error){let m=r.error.message;try{m=(await r.error.context.json()).error||m}catch{/* keep */}return toast.error(`Not sent: ${m}`)}
    if(r.data?.failed)return toast.error(`Not sent: ${r.data.error}`);toast.success(r.data?.sent?`Test email sent to ${to}. Check the inbox (and spam).`:'Queued. It goes out within 10 minutes.');load()}
  if(!e)return <div className="skeleton h-64"/>
  const hasKey=keys[e.provider],last4=keys[`${e.provider}_last4`],ls=e.last_status
  return <div className="space-y-4">
    <section className="card space-y-4">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><Mail size={18}/></span>
        <div className="flex-1"><h2 className="font-semibold text-fg">Email sending</h2><p className="text-sm text-fog-muted">Send birthday wishes, reminders, certificates and alerts by email too, through Resend or SendGrid.</p></div>
        {ls&&<Badge tone={ls.ok?'green':'red'}>{ls.ok?`Last run ok · ${ls.sent??0} sent`:'Last run failed'}</Badge>}</div>
      {ls&&!ls.ok&&ls.error&&<div className="rounded-xl border border-blood/30 bg-blood/10 p-3 text-sm text-[#FF8796]">{ls.error} <span className="text-fog-faint">({when(ls.at)})</span></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Send email with"><select className="input" disabled={!admin} value={e.provider} onChange={set('provider')}><option value="off">Off (no email)</option><option value="resend">Resend</option><option value="sendgrid">SendGrid</option></select></Field>
        {e.provider!=='off'&&<Field label={`${e.provider==='resend'?'Resend':'SendGrid'} API key`} hint={hasKey?`Saved, ends in …${last4}. Type a new one only to replace it.`:'Saved privately. It cannot be read back from the app.'}>
          <div className="flex gap-2"><input className="input font-mono" type="password" autoComplete="off" disabled={!admin} placeholder={hasKey?'•••••••• saved':e.provider==='resend'?'re_…':'SG.…'} value={key} onChange={ev=>setKey(ev.target.value)}/>
            {hasKey&&admin&&<button type="button" className="btn-ghost" title="Remove saved key" onClick={removeKey}><X size={15}/></button>}</div></Field>}
        {e.provider!=='off'&&<>
          <Field label="Sender email" required hint="Must be on a domain you verified with the provider."><input className="input" type="email" disabled={!admin} placeholder="club@yourdomain.org" value={e.from_email||''} onChange={set('from_email')}/></Field>
          <Field label="Sender name"><input className="input" disabled={!admin} placeholder="Sankari Durg Arima Sangam" value={e.from_name||''} onChange={set('from_name')}/></Field>
          <Field label="Replies go to" hint="Optional."><input className="input" type="email" disabled={!admin} value={e.reply_to||''} onChange={set('reply_to')}/></Field>
          <Field label="Alert emails (team)" hint="Separate with commas. They get alerts and the morning report."><input className="input" disabled={!admin} placeholder="president@…, secretary@…" value={e.alert_emails||''} onChange={set('alert_emails')}/></Field></>}
      </div>
      {admin&&<div className="flex justify-end"><button className="btn" disabled={busy} onClick={save}><Save size={15}/>{busy?'Saving…':'Save email settings'}</button></div>}
    </section>
    {e.provider!=='off'&&<>
      <section className="card p-0"><h3 className="px-4 pt-4 font-semibold text-fg">Send these by email</h3>
        <ul className="divide-y divide-ink-700/80">{AUTO.map(([k,l,d])=><li key={k} className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1"><div className="font-medium text-fg">{l}</div><div className="text-sm text-fog-muted">{d}</div></div>
          <Toggle checked={e.auto?.[k]!==false} disabled={!admin} label={l} onChange={v=>setE({...e,auto:{...e.auto,[k]:v}})}/></li>)}</ul>
        {admin&&<p className="px-4 pb-4 text-xs text-fog-faint">Press “Save email settings” after changing these.</p>}</section>
      {admin&&<section className="card flex flex-wrap items-end gap-3"><Field label="Send a test email to" className="min-w-[220px] flex-1"><input className="input" type="email" value={to} onChange={ev=>setTo(ev.target.value)} placeholder="you@example.com"/></Field>
        <button className="btn-quiet" disabled={busy} onClick={test}><Send size={15}/>{busy?'Sending…':'Send test'}</button></section>}
    </>}
  </div>
}

function Templates(){
  const {can}=useAuth(),admin=can('settings')
  const [rows,setRows]=useState(null),[k,setK]=useState(''),[d,setD]=useState(null),[prev,setPrev]=useState(false),[frame,setFrame]=useState('')
  useEffect(()=>{supabase.from('email_templates').select('*').order('name').then(({data,error})=>{if(error)return toast.error(error.message);setRows(data);if(data?.length){setK(data[0].kind);setD(data[0])}})},[])
  useEffect(()=>{if(!prev||!d)return;supabase.rpc('email_frame',{p_title:fill(d.subject,SAMPLE),p_content:fill(d.html,SAMPLE)}).then(({data})=>setFrame(data||''))},[prev,d])
  const pick=x=>{setK(x);setD(rows.find(r=>r.kind===x));setPrev(false)}
  const save=async()=>{if(!d.subject.trim()||!d.html.trim())return toast.error('Subject and message cannot be empty')
    const {error}=await supabase.from('email_templates').update({subject:d.subject,html:d.html,updated_at:new Date().toISOString()}).eq('kind',d.kind);if(error)return toast.error(errText(error))
    setRows(rs=>rs.map(r=>r.kind===d.kind?d:r));toast.success('Template saved')}
  if(!rows)return <div className="skeleton h-64"/>
  return <div className="grid gap-4 md:grid-cols-[220px_1fr]">
    <ul className="card space-y-1 p-2">{rows.map(r=><li key={r.kind}><button onClick={()=>pick(r.kind)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${k===r.kind?'bg-ink-700 text-fg':'text-fog-muted hover:bg-ink-750'}`}>{r.name}</button></li>)}</ul>
    {d&&<section className="card space-y-4">
      <Field label="Subject"><input className="input" disabled={!admin} value={d.subject} onChange={e=>setD({...d,subject:e.target.value})}/></Field>
      <Field label="Message (HTML)" hint={`Words you can use: ${WORDS[d.kind]||'{name} {club}'}`}><textarea className="input font-mono text-xs" rows={9} disabled={!admin} value={d.html} onChange={e=>setD({...d,html:e.target.value})}/></Field>
      <div className="flex flex-wrap gap-2"><button className="btn-quiet" onClick={()=>setPrev(p=>!p)}><Eye size={15}/>{prev?'Hide preview':'Preview'}</button>
        {admin&&<button className="btn ml-auto" onClick={save}><Save size={15}/>Save template</button>}</div>
      {prev&&<iframe title="Email preview" sandbox="" srcDoc={frame} className="h-[480px] w-full rounded-xl border border-ink-700 bg-white"/>}
    </section>}
  </div>
}

function Queue(){
  const [rows,setRows]=useState(null),[f,setF]=useState('')
  const load=()=>{let q=supabase.from('email_outbox').select('id,kind,to_email,to_name,subject,status,error,attempts,created_at,sent_at,send_after').order('created_at',{ascending:false}).limit(200)
    if(f)q=q.eq('status',f);q.then(({data,error})=>error?toast.error(error.message):setRows(data))}
  useEffect(()=>{load()},[f])
  useLive(['email_outbox'],load)
  const act=async(fn,ids,msg)=>{const {data,error}=await supabase.rpc(fn,{p_ids:ids});if(error)return toast.error(errText(error));toast.success(`${data} ${msg}`);load()}
  const run=async()=>{const r=await supabase.functions.invoke('email-send',{body:{action:'run'}});if(r.error){let m=r.error.message;try{m=(await r.error.context.json()).error||m}catch{/* keep */}return toast.error(m)}
    toast.success(`${r.data?.sent??0} sent${r.data?.failed?`, ${r.data.failed} failed`:''}`);load()}
  const counts=useMemo(()=>(rows||[]).reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{}),[rows])
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><select aria-label="Status" className="input w-auto py-1.5 text-sm" value={f} onChange={e=>setF(e.target.value)}><option value="">All emails</option>{['queued','sent','failed','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}</select>
      {!f&&rows&&<span className="text-xs text-fog-faint">{Object.entries(counts).map(([k,n])=>`${n} ${k}`).join(' · ')}</span>}
      <button className="btn-quiet ml-auto" onClick={run}><Play size={15}/>Send waiting now</button>
      {counts.failed>0&&<button className="btn-quiet" onClick={()=>act('email_retry',rows.filter(r=>r.status==='failed').map(r=>r.id),'set to retry')}><RotateCcw size={15}/>Retry failed</button>}</div>
    <div className="card divide-y divide-ink-700/80 p-0">{rows===null?<div className="skeleton m-4 h-24"/>:!rows.length?<div className="p-8 text-center text-sm text-fog-faint">No emails yet.</div>
      :rows.map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-fg">{r.subject}</div>
          <div className="truncate text-xs text-fog-faint">{r.to_name?`${r.to_name} · `:''}{r.to_email} · {when(r.sent_at||r.created_at)}</div>
          {r.error&&<div className="text-xs text-[#FF8796]">{r.error}</div>}</div>
        <Badge tone={TONE[r.status]}>{r.status}</Badge>
        {['failed','cancelled'].includes(r.status)&&<button className="btn-ghost" title="Retry" onClick={()=>act('email_retry',[r.id],'set to retry')}><RotateCcw size={15}/></button>}
        {['queued','failed'].includes(r.status)&&<button className="btn-ghost hover:text-blood" title="Cancel" onClick={()=>act('email_cancel',[r.id],'cancelled')}><X size={15}/></button>}
      </div>)}</div>
  </div>
}

export function HealthCard(){
  const [h,setH]=useState(undefined),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('health_checks').select('*').order('day',{ascending:false}).limit(1).maybeSingle().then(({data})=>setH(data||null))
  useEffect(()=>{load()},[])
  const run=async()=>{setBusy(true);const {data,error}=await supabase.rpc('run_morning_check');setBusy(false);if(error)return toast.error(errText(error))
    data.ok?toast.success('All good. Everything is ready for today.'):toast.error(`${data.issues.length} thing(s) need attention`);load()}
  if(h===undefined)return null
  return <section className="card space-y-3">
    <div className="flex flex-wrap items-center gap-3">{!h?<KeyRound size={20} className="text-fog-faint"/>:h.ok?<CheckCircle2 size={20} className="text-ok"/>:<AlertTriangle size={20} className="text-warn"/>}
      <div className="min-w-0 flex-1"><div className="font-semibold text-fg">Morning check</div>
        <div className="text-sm text-fog-muted">Half an hour before the send time the CRM checks the sender, the phone link, email and the queue, and alerts the team if something is wrong.{h?` Last check: ${when(h.created_at)}.`:''}</div></div>
      <button className="btn-quiet" disabled={busy} onClick={run}><Play size={15}/>{busy?'Checking…':'Check now'}</button></div>
    {h&&(h.ok?<div className="rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok">All good: the sender is {h.info?.sender}, WhatsApp by {h.info?.whatsapp}, email {h.info?.email}. Birthdays today: {(h.info?.donor_birthdays||0)+(h.info?.member_birthdays||0)}.</div>
      :<ul className="space-y-1 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">{h.issues.map((x,i)=><li key={i}>• {x}</li>)}</ul>)}
  </section>
}

export default function EmailPanel(){
  const {can}=useAuth(),[t,setT]=useState('outbox')
  return <div className="space-y-4">
    <Tabs id="email-tabs" value={t} onChange={setT} tabs={[['outbox','Sent and waiting'],...(can('settings')?[['setup','Setup']]:[]),['templates','Templates']]}/>
    {t==='outbox'&&<Queue/>}{t==='setup'&&<Setup/>}{t==='templates'&&<Templates/>}
  </div>
}
