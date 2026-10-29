// Settings → Test data: remove the sample data (or chosen record groups) before going live.
// Needs the reset password (kept only as a hash in the database) and the word DELETE. Admins only.
import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {ShieldAlert,KeyRound,Trash2,Download,Eye,EyeOff} from 'lucide-react'
import {Link} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import {Field,errText} from './ui'

const SAMPLE=[['donors','Sample donors'],['camps','Sample camps (with their registrations, donations, money and tasks)'],['blood_units','Sample blood units'],['emergency_requests','Sample emergency requests'],
  ['members','Sample members (with their dues and attendance)'],['meetings','Sample meetings'],['pledges','Sample pledges'],['afterlife_cases','Sample eye and body donation cases'],['logins','Demo logins (never an admin, never you)']]
const GROUPS=[['donors','Donors, blood stock, emergency requests',['donors','blood_units','emergency_requests']],['camps','Camps (all types) with registrations, camp-day records, sponsors and expenses',['camps','registrations','camp_people']],
  ['members','Members, dues and meetings',['members','member_dues','meetings']],['projects','Projects, hours, events, notices and polls',['projects','events','notices']],
  ['money','Money: receipts, club expenses, trips',['contributions','club_expenses','club_trips']],['afterlife','Eye and body donation pledges and cases',['pledges','afterlife_cases']],
  ['messages','WhatsApp and email queues, message history and alerts',['wa_outbox','email_outbox']],['directory','Hospitals directory and club assets',['hospitals','club_assets']],
  ['imports','Import history',['import_batches']],['audit','Audit log (the history of every change)',['audit_logs']]]

function Pw({label,value,onChange,auto='current-password'}){const [show,setShow]=useState(false)
  return <Field label={label}><div className="relative"><input className="input pr-10" type={show?'text':'password'} autoComplete={auto} value={value} onChange={e=>onChange(e.target.value)}/>
    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-fog-faint hover:text-fg" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(s=>!s)}>{show?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></Field>}

export default function DataReset(){
  const [st,setSt]=useState(null),[err,setErr]=useState(''),[mode,setMode]=useState('sample'),[groups,setGroups]=useState([]),[pw,setPw]=useState(''),[word,setWord]=useState(''),[busy,setBusy]=useState(false)
  const [setp,setSetp]=useState(null),[done,setDone]=useState(null)
  const load=()=>supabase.rpc('data_reset_status').then(({data,error})=>{if(error)setErr(errText(error));else{setSt(data);setErr('')}})
  useEffect(()=>{load()},[])
  if(err)return null   // not an admin, or the database is not on v27 yet
  if(!st)return <section className="card mt-5"><div className="skeleton h-24"/></section>
  const sampleTotal=Object.values(st.sample).reduce((a,b)=>a+b,0)
  const savePw=async()=>{if(setp.new!==setp.again)return toast.error('The two new passwords are not the same')
    const {data,error}=await supabase.rpc('set_reset_password',{p_old:setp.old||null,p_new:setp.new});if(error)return toast.error(errText(error));if(data?.error)return toast.error(data.error)
    toast.success(st.has_password?'Reset password changed':'Reset password set. Keep it safe: it is needed to remove data.');setSetp(null);load()}
  const go=async()=>{if(mode==='all'&&!groups.length)return toast.error('Tick what to remove');setBusy(true)
    const {data,error}=await supabase.rpc('data_reset',{p_password:pw,p_mode:mode,p_groups:mode==='all'?groups:[],p_confirm:word});setBusy(false)
    if(error)return toast.error(errText(error));if(data?.error){load();return toast.error(data.error)}
    setPw('');setWord('');setGroups([]);setDone(data);toast.success('Removed. Numbering starts again from 1 for every empty list.');load()}
  const lock=st.locked_until&&new Date(st.locked_until)>new Date()
  return <section className="card mt-5 border-blood/30">
    <div className="mb-1 flex items-center gap-2"><ShieldAlert size={18} className="text-blood"/><h2 className="font-semibold text-fg">Test data and a fresh start</h2></div>
    <p className="mb-4 text-sm text-fog-muted">Remove the sample and test records before you start with real data. Settings, logins, message templates and the WhatsApp link stay.
      Numbering (D-0001, C-001, M-001 …) starts again from 1 for every list that becomes empty, so your real data and imports get clean numbers.</p>

    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-ink-800/60 p-3 text-sm"><KeyRound size={16} className="text-brand"/>
      <span className="flex-1 text-fog">{st.has_password?'Reset password is set.':'Set a reset password first. Nothing can be removed without it.'}</span>
      <button type="button" className="btn-quiet" onClick={()=>setSetp(setp?null:{old:'',new:'',again:''})}>{st.has_password?'Change reset password':'Set reset password'}</button></div>
    {setp&&<div className="mb-4 grid gap-3 rounded-xl border border-ink-700 p-3 sm:grid-cols-3">
      {st.has_password&&<Pw label="Current reset password" value={setp.old} onChange={v=>setSetp({...setp,old:v})}/>}
      <Pw label="New reset password" auto="new-password" value={setp.new} onChange={v=>setSetp({...setp,new:v})}/>
      <Pw label="New password again" auto="new-password" value={setp.again} onChange={v=>setSetp({...setp,again:v})}/>
      <p className="text-xs text-fog-faint sm:col-span-3">At least 8 characters with letters and numbers. Different from your login password. It is stored only as a one-way hash, so nobody can read it back.</p>
      <div className="sm:col-span-3"><button type="button" className="btn" onClick={savePw}>Save reset password</button></div></div>}

    {st.has_password&&<>
      <div role="radiogroup" aria-label="What to remove" className="mb-4 grid gap-2 sm:grid-cols-2">{[['sample','Sample data only',`${sampleTotal} sample records and demo logins. Your own records stay.`],['all','Start fresh','Choose which kinds of records to remove completely.']].map(([k,l,h])=>
        <button key={k} type="button" role="radio" aria-checked={mode===k} onClick={()=>setMode(k)} className={`tile p-3 text-left ${mode===k?'border-blood/60 bg-blood/10 ring-2 ring-blood/20':''}`}><b className="block text-fg">{l}</b><span className="text-xs text-fog-faint">{h}</span></button>)}</div>
      {mode==='sample'?<ul className="mb-4 grid gap-1.5 text-sm sm:grid-cols-2">{SAMPLE.map(([k,l])=><li key={k} className="flex justify-between gap-3 rounded-lg bg-ink-800/50 px-3 py-1.5"><span className="text-fog-muted">{l}</span><b className="tabular-nums text-fg">{st.sample[k]}</b></li>)}</ul>
      :<div className="mb-4 space-y-1.5">{GROUPS.map(([k,l,keys])=><label key={k} className="flex cursor-pointer items-center gap-3 rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
        <input type="checkbox" checked={groups.includes(k)} onChange={e=>setGroups(e.target.checked?[...groups,k]:groups.filter(x=>x!==k))}/><span className="flex-1 text-fog">{l}</span>
        <span className="text-xs tabular-nums text-fog-faint">{keys.map(x=>st.all[x]).join(' · ')}</span></label>)}
        <button type="button" className="btn-ghost text-xs" onClick={()=>setGroups(groups.length===GROUPS.length?[]:GROUPS.map(g=>g[0]))}>{groups.length===GROUPS.length?'Untick all':'Tick all'}</button></div>}
      <p className="mb-3 text-sm text-warn">This cannot be undone from here. <Link to="/privacy" className="inline-flex items-center gap-1 text-brand hover:underline"><Download size={13}/>Download a backup first</Link>.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Pw label="Reset password" value={pw} onChange={setPw}/>
        <Field label="Type DELETE to confirm"><input className="input font-mono uppercase" autoComplete="off" value={word} onChange={e=>setWord(e.target.value)}/></Field>
        <button type="button" className="btn bg-blood hover:bg-blood/90" disabled={busy||lock||!pw||word.trim().toUpperCase()!=='DELETE'||(mode==='all'&&!groups.length)||(mode==='sample'&&!sampleTotal)} onClick={go}><Trash2 size={15}/>{busy?'Removing…':mode==='sample'?'Remove sample data':'Remove the ticked records'}</button></div>
      {lock&&<p className="mt-2 text-sm text-blood">Too many wrong passwords. Try again after {new Date(st.locked_until).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}.</p>}
      {done&&<p className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Done. {Object.entries(done).filter(([k,v])=>typeof v==='number'&&k!=='numbers_restarted'&&v>0).map(([k,v])=>`${v} ${k.replace(/_/g,' ')}`).join(', ')||'Removed.'} Numbering restarted for {done.numbers_restarted} lists.</p>}</>}
  </section>}
