import {useEffect,useState} from 'react'
import {Award,UserPlus,Siren,Phone,Pencil} from 'lucide-react'
import {toast} from 'sonner'
import {celebrate} from '../lib/fx'
import {supabase} from '../lib/supabase'
import {normPhone,nextEligible,fmt,slots,BLOOD} from '../lib/util'
import {makeCertificate,certNo} from '../lib/certificate'
import {useBrand} from '../context/Brand'
import {code,useLive,PageHeader,Field,adultMax,adultMin} from '../components/ui'
import CountUp from '../components/CountUp'
import {ClaimMember} from './MyClub'
import MyData from '../components/MyData'
import {useAuth} from '../context/Auth'
import {useLang} from '../lib/i18n'
const badge=n=>n>=10?'Life saver':n>=5?'Regular donor':n>=2?'Repeat donor':n===1?'First donation done':'Ready to donate'
// milestones: first donation, 3, 5, 10, 25, 50
const MILES=[[1,'🩸','First drop'],[3,'💪','Three times'],[5,'⭐','Regular donor'],[10,'🏅','Life saver'],[25,'🏆','Hero'],[50,'👑','Legend']]
function Badges({n,t}){const next=MILES.find(([m])=>m>n)
  return <div className="card mb-5"><div className="mb-3 flex items-center gap-2"><h2 className="flex-1 font-semibold text-fg">{t('Your badges')}</h2>{next&&<span className="text-xs text-fog-muted">{next[0]-n} {t('more donations to the next badge')}</span>}</div>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{MILES.map(([m,e,l])=>{const got=n>=m;return <div key={m} className={`tile flex flex-col items-center py-3 text-center transition ${got?'border-warn/50 bg-warn/10':'opacity-40 grayscale'}`}>
      <span className="text-2xl" aria-hidden>{e}</span><span className="mt-1 text-xs font-semibold text-fg">{l}</span><span className="text-[10px] text-fog-faint">{m} {m>1?'donations':'donation'}</span></div>})}</div>
    {next&&<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-blood to-warn" style={{width:`${Math.min(100,n/next[0]*100)}%`}}/></div>}</div>}
function NewDonor({t,onDone}){
  const [open,setOpen]=useState(false),[f,setF]=useState({name:'',phone:'',dob:'',gender:'',group:'',area:'',consent:false}),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const go=async e=>{e.preventDefault();setBusy(true);setErr('');const {data,error}=await supabase.rpc('create_my_donor',{p_name:f.name,p_phone:normPhone(f.phone),p_dob:f.dob,p_gender:f.gender,p_group:f.group||null,p_area:f.area||null,p_consent:f.consent});setBusy(false)
    if(error)return setErr(error.message);celebrate();toast.success(`${t('Welcome')}! ${code('D',data.donor_no)}`);onDone()}
  if(!open)return <button className="btn-quiet mt-4 w-full" onClick={()=>setOpen(true)}><UserPlus size={16}/>{t('I am a new donor')}</button>
  return <form onSubmit={go} className="card mt-4 space-y-3"><h2 className="font-semibold text-fg">{t('I am a new donor')}</h2>
    <Field label={t('Full name')} required><input className="input" required minLength={2} value={f.name} onChange={set('name')}/></Field>
    <Field label={t('Mobile number')} required><input className="input" required inputMode="numeric" value={f.phone} onChange={set('phone')}/></Field>
    <div className="grid grid-cols-2 gap-3"><Field label={t('Date of birth')} required><input type="date" className="input" required min={adultMin()} max={adultMax()} value={f.dob} onChange={set('dob')}/></Field>
      <Field label={t('Gender')} required><select className="input" required value={f.gender} onChange={set('gender')}><option value="">-</option><option value="Male">{t('Male')}</option><option value="Female">{t('Female')}</option><option value="Other">{t('Other')}</option></select></Field></div>
    <div className="grid grid-cols-2 gap-3"><Field label={t('Blood group')}><select className="input" value={f.group} onChange={set('group')}><option value="">{t('Not known')}</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
      <Field label={t('Area or town')}><input className="input" value={f.area} onChange={set('area')}/></Field></div>
    <label className="flex gap-2 text-sm text-fog"><input type="checkbox" required checked={f.consent} onChange={set('consent')}/>{t('I agree to be contacted about camps and blood donation drives.')}</label>
    {err&&<p role="alert" className="text-sm text-blood">{err}</p>}<button className="btn w-full" disabled={busy}>{busy?t('Please wait…'):t('Create my donor record')}</button></form>
}
function Urgent({t,canGive}){
  const [rows,setRows]=useState([])
  useEffect(()=>{supabase.rpc('my_urgent').then(({data})=>setRows(data||[]))},[])
  if(!rows.length)return null
  return <div className="card mb-5 border-blood/50 bg-blood/[.06]"><h2 className="mb-2 flex items-center gap-2 font-semibold text-fg"><Siren size={18} className="text-blood"/>{t('Your blood group is needed now')}</h2>
    {!canGive&&<p className="mb-2 text-xs text-fog-muted">{t('You cannot donate yet, but you can share this with friends of the same group.')}</p>}
    <ul className="space-y-2">{rows.map((r,i)=><li key={i} className="flex flex-wrap items-center gap-3 text-sm"><span className="font-display font-semibold text-blood">{r.group}</span><span className="flex-1 text-fg">{r.units} {t('units at')} {r.hospital}<span className="block text-xs text-fog-faint">{fmt(r.at)}{r.contact?` · ${r.contact}`:''}</span></span>
      {r.phone&&<a className="btn px-3 py-1.5" href={`tel:${r.phone}`}><Phone size={14}/>{t('Call')}</a>}</li>)}</ul></div>
}
function MyDetails({t}){
  const [f,setF]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{supabase.rpc('donor_data',{p_donor:null}).then(({data})=>setF({email:data?.donor?.email||'',area:data?.donor?.area||''}))},[])
  const save=async e=>{e.preventDefault();setBusy(true);const {error}=await supabase.rpc('update_my_donor',{p_email:f.email,p_area:f.area});setBusy(false);error?toast.error(error.message):toast.success(t('Saved'))}
  if(!f)return null
  return <details className="card mt-5 p-0"><summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm font-medium text-fg"><Pencil size={17} className="text-brand"/>{t('My contact details')}</summary>
    <form onSubmit={save} className="grid gap-3 border-t border-ink-700 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field label={t('Email')}><input type="email" className="input" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></Field>
      <Field label={t('Area or town')}><input className="input" value={f.area} onChange={e=>setF({...f,area:e.target.value})}/></Field><button className="btn" disabled={busy}>{t('Save')}</button>
      <p className="text-xs text-fog-faint sm:col-span-3">{t('To change your name, mobile, date of birth or blood group, use "Correct my details" below.')}</p></form></details>
}
export default function Portal(){
  const {brand}=useBrand(),{refresh}=useAuth(),[busy,setBusy]=useState(null)
  const {t}=useLang();const [p,setP]=useState(null),[err,setErr]=useState(''),[f,setF]=useState({phone:'',dob:'',consent:false}),[slot,setSlot]=useState({})
  const load=()=>supabase.rpc('my_portal').then(({data,error})=>error?setErr(error.message):setP(data))
  useEffect(()=>{load()},[])
  useLive(['registrations','donations','camps'],load)
  const call=async(fn,args)=>{setErr('');const {data,error}=await supabase.rpc(fn,args);if(error)return setErr(error.message);if(typeof data==='string'&&data!=='ok')return setErr(data);load()}
  if(!p)return <div className="text-fog-muted">{err||t('Loading…')}</div>
  if(!p.donor)return <div className="mx-auto max-w-md"><PageHeader title={t('Find your donor record')} description={t('Link your account to your donations')}/>
    <form className="card space-y-3" onSubmit={e=>{e.preventDefault();call('claim_donor',{p_phone:normPhone(f.phone),p_dob:f.dob,p_consent:f.consent})}}>
      <p className="text-sm text-fog-muted">{t('Gave blood at our camp before? Enter the mobile number and date of birth you gave then.')}</p>
      <input className="input" placeholder={t('Mobile number')} required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>
      <label className="block text-sm text-fog-muted">{t('Date of birth')}<input type="date" className="input mt-1" required value={f.dob} onChange={e=>setF({...f,dob:e.target.value})}/></label>
      <label className="flex gap-2 text-sm text-fog"><input type="checkbox" required checked={f.consent} onChange={e=>setF({...f,consent:e.target.checked})}/>{t('I agree to be contacted about camps and blood donation drives.')}</label>
      {err&&<p className="text-sm text-blood">{err}</p>}<button className="btn w-full">{t('Link my record')}</button></form>
    <NewDonor t={t} onDone={load}/>
    <div className="mt-5"><ClaimMember compact onDone={refresh}/></div></div>
  const d=p.donor,out=p.outside||[],n=p.history.length+out.reduce((x,o)=>x+(o.units||1),0),ne=nextEligible(d.last_donation,d.gender),regIds=new Set(p.upcoming.map(u=>u.camp_id)),gave=new Set(p.history.map(h=>h.camp+'|'+h.date))
  return <div><PageHeader eyebrow={d.donor_no?code('D',d.donor_no):undefined} title={`${t('Hello')}, ${d.name}`} description={t('Thank you for being a blood donor')}/>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="card mb-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
      {[['Blood group',d.blood_group||'-'],['Donations',n],['Status',t(badge(n))],['Next donation',!ne||ne<=new Date()?t('You can donate now'):t('From')+' '+fmt(ne)]].map(([l,v])=><div key={l}><div className="text-lg font-semibold text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-muted">{t(l)}</div></div>)}</div>
    <Urgent t={t} canGive={!ne||ne<=new Date()}/>
    <Badges n={n} t={t}/>
    {p.upcoming.length>0&&<div className="card mb-5"><h2 className="mb-2 font-semibold text-fg">{t('Your upcoming camps')}</h2>{p.upcoming.map(u=><div key={u.camp_id} className="text-sm text-fog">{u.camp}, {fmt(u.date)}{u.venue&&`, ${u.venue}`}{u.slot&&` at ${u.slot}`}</div>)}</div>}
    <div className="card mb-5"><h2 className="mb-3 font-semibold text-fg">{t('Camps open for registration')}</h2>
      {p.open_camps.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 py-2 first:border-0"><div><div className="text-fg">{c.name}</div><div className="text-sm text-fog-muted">{fmt(c.date)}{c.venue&&`, ${c.venue}`}</div></div>
        {gave.has(c.name+'|'+c.date)?<span className="text-sm text-blood">{t('Donated, thank you')}</span>:regIds.has(c.id)?<span className="text-sm text-brand">{t('Registered')}</span>:<div className="flex gap-2">
          {slots(c.start_time,c.end_time).length>0&&<select className="input w-auto" value={slot[c.id]||''} onChange={e=>setSlot({...slot,[c.id]:e.target.value})}><option value="">Time slot</option>{slots(c.start_time,c.end_time).map(s=><option key={s}>{s}</option>)}</select>}
          <button className="btn" onClick={()=>call('register_me',{p_camp:c.id,p_slot:slot[c.id]||null})}>{t('Register')}</button></div>}</div>)}
      {!p.open_camps.length&&<p className="text-sm text-fog-faint">{t('No camp is open right now.')}</p>}</div>
    <div className="card"><h2 className="mb-3 font-semibold text-fg">{t('Your donations')}</h2>
      {p.history.map(h=><div key={h.code} className="flex items-center justify-between border-t border-ink-700 py-2 first:border-0"><div><div className="text-fg">{h.camp}</div><div className="text-sm text-fog-muted">{fmt(h.date)}</div></div>
        <button className="btn" disabled={busy===h.cert_no} onClick={async()=>{setBusy(h.cert_no);try{await makeCertificate({name:d.name,camp:h.camp,venue:h.venue,date:fmt(h.date),bloodGroup:d.blood_group,volume:h.volume,certificate:h.cert_no?certNo(h.cert_no):h.code,verifyCode:h.verify_code,donorNo:code('D',d.donor_no),brand});if(h.reg_id)supabase.rpc('log_certificate',{p_reg:h.reg_id,p_kind:'download'})}finally{setBusy(null)}}}><Award size={16}/>{busy===h.cert_no?t('Preparing…'):t('Certificate')}</button></div>)}
      {out.map((o,i)=><div key={'o'+i} className="flex items-center justify-between border-t border-ink-700 py-2 first:border-0"><div><div className="text-fg">{o.kind==='emergency_donation'?'Emergency donation':'Donation'} at {o.place}</div><div className="text-sm text-fog-muted">{fmt(o.date)}</div></div><span className="text-xs text-fog-faint">{t('Recorded by the club')}</span></div>)}
      {!n&&<p className="text-sm text-fog-faint">{t('Your donations will appear here after your first camp.')}</p>}</div>
    <details className="mt-5"><summary className="cursor-pointer text-sm text-fog-muted hover:text-fg">{t('Are you a member of the club? Link your member record')}</summary><div className="mt-3 max-w-md"><ClaimMember compact onDone={refresh}/></div></details>
    <MyDetails t={t}/>
    <MyData/></div>
}
