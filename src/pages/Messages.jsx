import {useEffect,useMemo,useState} from 'react'
import {Send,Check} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,nextEligible,fmt,wa} from '../lib/util'
import CountUp from '../components/CountUp'
import {useLive,PageHeader} from '../components/ui'
const SIGN=' - Sankari Rotaract Club'
const DEFAULTS={
  birthday:'Happy Birthday {name}! Wishing you good health and happiness.'+SIGN,
  reminder_early:'Hello {name}, thank you for registering for {camp} on {date} at {venue}. Your slot: {slot}. We look forward to seeing you.'+SIGN,
  reminder_1d:'Hello {name}, a reminder that {camp} is tomorrow ({date}) at {venue}. Your slot: {slot}. Please eat well, drink water and bring a photo ID.'+SIGN,
  reminder_today:'Good morning {name}! {camp} is today at {venue}. Your slot: {slot}. See you there.'+SIGN,
  thank_you:'Thank you {name} for donating blood at {camp}. Your gift can save lives.'+SIGN,
  eligible_again:'Hello {name}, you are eligible to donate blood again. Join our next camp and save lives.'+SIGN,
  invite:'Hello {name}, Sankari Rotaract Club is holding a blood donation camp: {camp} on {date} at {venue}. Register here: {link}'}
const NAMES={birthday:'Birthday',reminder_early:'Reminder, early',reminder_1d:'Reminder, day before',reminder_today:'Reminder, camp morning',thank_you:'Thank-you',eligible_again:'Eligible again',invite:'Camp invite'}
const TABS=[['birthday','Birthdays'],['reminder','Camp reminders'],['thanks','Thank-you'],['eligible','Eligible again'],['invite','Invite donors'],['templates','Templates']]
const fill=(b,v)=>b.replace(/\{(\w+)\}/g,(_,k)=>v[k]??'')
async function allDonors(){let out=[],from=0;for(;;){const {data,error}=await supabase.from('donors').select('id,full_name,phone,dob,blood_group,gender,last_donation,consent,donor_no').is('deleted_at',null).order('id').range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)return out;from+=1000}}
export default function Messages(){
  const {user,can}=useAuth(),admin=can('settings')
  const [donors,setDonors]=useState([]),[camps,setCamps]=useState([]),[tpl,setTpl]=useState(DEFAULTS),[tab,setTab]=useState('birthday'),[cid,setCid]=useState(''),[stage,setStage]=useState('early'),[grp,setGrp]=useState(''),[regs,setRegs]=useState([]),[sent,setSent]=useState(new Set()),[err,setErr]=useState(''),[draft,setDraft]=useState({})
  const today=new Date().toLocaleDateString('en-CA')
  const [tick,setTick]=useState(0)
  useLive(['donors','camps','registrations','message_log'],()=>setTick(x=>x+1))
  useEffect(()=>{(async()=>{
    try{setDonors(await allDonors())}catch(e){setErr(e.message)}
    const c=await supabase.from('camps').select('*').order('camp_date',{ascending:false})
    if(c.error)setErr(c.error.message);else{setCamps(c.data);const up=c.data.filter(x=>x.camp_date>=today&&x.status!=='closed').sort((a,b)=>a.camp_date.localeCompare(b.camp_date))[0]||c.data[0];if(up)setCid(up.id)}
    const t=await supabase.from('message_templates').select('*');if(!t.error)setTpl({...DEFAULTS,...Object.fromEntries(t.data.map(x=>[x.kind,x.body]))})})()},[tick])
  useEffect(()=>{if(cid)supabase.from('registrations').select('donor_id,slot,status').eq('camp_id',cid).then(({data})=>setRegs(data||[]))},[cid,tick])
  const camp=camps.find(c=>c.id===cid),byId=useMemo(()=>new Map(donors.map(d=>[d.id,d])),[donors])
  const link=cid?`${location.origin}${location.pathname}#/register/${cid}`:''
  const cv=x=>({camp:camp?.name,date:camp?fmt(camp.camp_date):'',venue:camp?.venue||'the venue',link,...x})
  const eligNow=donors.filter(d=>d.consent&&d.last_donation).filter(d=>{const n=nextEligible(d.last_donation,d.gender);return n&&n<=new Date()&&Date.now()-n<30*864e5})
  const bdays=donors.filter(d=>d.consent&&d.dob&&d.dob.slice(5)===today.slice(5))
  const fromRegs=st=>regs.filter(r=>r.status===st).map(r=>({d:byId.get(r.donor_id),r})).filter(x=>x.d?.consent)
  let Q={kind:'',ref:'',items:[]}
  if(tab==='birthday')Q={kind:'birthday',ref:today,items:bdays.map(d=>({d,v:{name:d.full_name}}))}
  else if(tab==='eligible')Q={kind:'eligible_again',ref:'',items:eligNow.map(d=>({d,v:{name:d.full_name},ref:d.last_donation}))}
  else if(camp&&tab==='reminder')Q={kind:'reminder_'+stage,ref:cid,items:fromRegs('registered').map(({d,r})=>({d,v:cv({name:d.full_name,slot:r.slot||'any time'})}))}
  else if(camp&&tab==='thanks')Q={kind:'thank_you',ref:cid,items:fromRegs('donated').map(({d})=>({d,v:cv({name:d.full_name})}))}
  else if(camp&&tab==='invite')Q={kind:'invite',ref:cid,items:donors.filter(d=>d.consent&&(!grp||d.blood_group===grp)).map(d=>({d,v:cv({name:d.full_name})}))}
  useEffect(()=>{if(!Q.kind)return;let s=supabase.from('message_log').select('donor_id,ref').eq('kind',Q.kind);if(Q.ref)s=s.eq('ref',Q.ref)
    s.then(({data})=>setSent(new Set((data||[]).map(x=>x.donor_id+'|'+x.ref))))},[Q.kind,Q.ref])
  const mark=async(d,ref)=>{setSent(new Set(sent).add(d.id+'|'+ref));const {error}=await supabase.from('message_log').upsert({donor_id:d.id,kind:Q.kind,ref,sent_by:user.id},{onConflict:'donor_id,kind,ref',ignoreDuplicates:true});if(error)setErr(error.message)}
  const items=Q.items.map(it=>({...it,ref:it.ref??Q.ref})).map(it=>({...it,done:sent.has(it.d.id+'|'+it.ref)})).sort((a,b)=>a.done-b.done)
  const todo=items.filter(i=>!i.done).length
  const saveTpl=async k=>{const {error}=await supabase.from('message_templates').upsert({kind:k,body:draft[k],updated_at:new Date().toISOString()});error?setErr(error.message):(setTpl({...tpl,[k]:draft[k]}),setDraft({...draft,[k]:undefined}))}
  const next=camps.filter(c=>c.camp_date>=today&&!['closed','completed'].includes(c.status)).sort((a,b)=>a.camp_date.localeCompare(b.camp_date))[0]
  const pending=donors.filter(d=>!d.consent).length
  return <div><PageHeader eyebrow="People" title="WhatsApp and alerts" description="Camp invites, birthday wishes and eligibility reminders"/>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="card mb-5"><h2 className="mb-3 font-semibold text-fg">Today, {fmt(today)}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Birthdays',bdays.length],['Camps today',camps.filter(c=>c.camp_date===today).length],['Eligible again',eligNow.length],['Consent pending',pending]].map(([l,n])=><div key={l}><div className="text-2xl font-semibold tabular-nums text-fg"><CountUp value={n}/></div><div className="text-xs text-fog-muted">{l}</div></div>)}</div>
      <p className="mt-3 text-sm text-fog-muted">{next?`Next camp: ${next.name}, ${fmt(next.camp_date)}.`:'No upcoming camp.'} Donors with consent pending are left out of every list until they agree to be contacted.</p></div>
    <div className="mb-4 flex flex-wrap gap-2">{TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab===k?'bg-brand text-white':'border border-ink-600 text-fog hover:border-brand'}`}>{l}</button>)}</div>
    {tab==='templates'?<div className="space-y-4">{Object.keys(DEFAULTS).map(k=><div key={k} className="card"><div className="mb-2 text-sm font-semibold text-fg">{NAMES[k]}</div>
        <textarea className="input" rows="3" disabled={!admin} value={draft[k]??tpl[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})}/>
        {admin&&draft[k]!==undefined&&<button className="btn mt-2" onClick={()=>saveTpl(k)}>Save</button>}</div>)}
      <p className="text-xs text-fog-faint">Words in curly brackets are filled in per donor: {'{name} {camp} {date} {venue} {slot} {link}'}. Only people with the Settings permission can edit.</p></div>
    :<>
      {['reminder','thanks','invite'].includes(tab)&&<div className="mb-3 flex flex-wrap gap-2">
        <select className="input w-auto" value={cid} onChange={e=>setCid(e.target.value)}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select>
        {tab==='reminder'&&<select className="input w-auto" value={stage} onChange={e=>setStage(e.target.value)}><option value="early">Early reminder</option><option value="1d">Day before</option><option value="today">Camp morning</option></select>}
        {tab==='invite'&&<select className="input w-auto" value={grp} onChange={e=>setGrp(e.target.value)}><option value="">All blood groups</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>}</div>}
      <p className="mb-3 text-sm text-fog-muted">{todo} to send, {items.length-todo} sent. Each button opens WhatsApp with the message ready; press send there.</p>
      {items[0]&&<div className="card mb-3 text-sm text-fog"><div className="mb-1 text-xs text-fog-faint">Message preview</div>{fill(tpl[Q.kind],items[0].v)}</div>}
      <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><tbody>{items.map(it=><tr key={it.d.id+it.ref} className="border-t border-ink-700 first:border-0">
        <td className="p-3"><div className="text-fg">{it.d.full_name}</div><div className="text-xs text-fog-faint">{it.d.phone}</div></td><td className="font-semibold text-blood">{it.d.blood_group||''}</td>
        <td className="pr-3 text-right"><a className={`btn px-3 py-1 ${it.done?'bg-ink-700 text-fog hover:bg-ink-600':''}`} target="_blank" rel="noreferrer" onClick={()=>mark(it.d,it.ref)} href={wa(it.d.phone,fill(tpl[Q.kind],it.v))}>{it.done?<><Check size={14}/>Send again</>:<><Send size={14}/>WhatsApp</>}</a></td></tr>)}
        {!items.length&&<tr><td className="p-6 text-center text-fog-faint">{!camp&&tab!=='birthday'&&tab!=='eligible'?'Create a camp first.':'Nobody in this list right now.'}</td></tr>}</tbody></table></div></>}
  </div>
}
