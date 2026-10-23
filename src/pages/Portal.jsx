import {useEffect,useState} from 'react'
import {Award} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {normPhone,nextEligible,fmt,slots} from '../lib/util'
import {makeCertificate,certNo} from '../lib/certificate'
import {useBrand} from '../context/Brand'
import {code,useLive,PageHeader} from '../components/ui'
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
export default function Portal(){
  const {brand}=useBrand(),{refresh}=useAuth(),[busy,setBusy]=useState(null)
  const {t}=useLang();const [p,setP]=useState(null),[err,setErr]=useState(''),[f,setF]=useState({phone:'',dob:'',consent:false}),[slot,setSlot]=useState({})
  const load=()=>supabase.rpc('my_portal').then(({data,error})=>error?setErr(error.message):setP(data))
  useEffect(()=>{load()},[])
  useLive(['registrations','donations','camps'],load)
  const call=async(fn,args)=>{setErr('');const {error}=await supabase.rpc(fn,args);error?setErr(error.message):load()}
  if(!p)return <div className="text-fog-muted">{err||t('Loading…')}</div>
  if(!p.donor)return <div className="mx-auto max-w-md"><PageHeader title={t('Find your donor record')} description={t('Link your account to your donations')}/>
    <form className="card space-y-3" onSubmit={e=>{e.preventDefault();call('claim_donor',{p_phone:normPhone(f.phone),p_dob:f.dob,p_consent:f.consent})}}>
      <p className="text-sm text-fog-muted">{t('Enter the mobile number and date of birth you gave when you registered at a camp. New here? Register at the next camp first.')}</p>
      <input className="input" placeholder={t('Mobile number')} required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>
      <label className="block text-sm text-fog-muted">{t('Date of birth')}<input type="date" className="input mt-1" required value={f.dob} onChange={e=>setF({...f,dob:e.target.value})}/></label>
      <label className="flex gap-2 text-sm text-fog"><input type="checkbox" required checked={f.consent} onChange={e=>setF({...f,consent:e.target.checked})}/>{t('I agree to be contacted about camps and blood donation drives.')}</label>
      {err&&<p className="text-sm text-blood">{err}</p>}<button className="btn w-full">{t('Link my record')}</button></form>
    <div className="mt-5"><ClaimMember compact onDone={refresh}/></div></div>
  const d=p.donor,out=p.outside||[],n=p.history.length+out.reduce((x,o)=>x+(o.units||1),0),ne=nextEligible(d.last_donation,d.gender),regIds=new Set(p.upcoming.map(u=>u.camp_id)),gave=new Set(p.history.map(h=>h.camp+'|'+h.date))
  return <div><PageHeader eyebrow={d.donor_no?code('D',d.donor_no):undefined} title={`${t('Hello')}, ${d.name}`} description={t('Thank you for being a blood donor')}/>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="card mb-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
      {[['Blood group',d.blood_group||'-'],['Donations',n],['Status',t(badge(n))],['Next donation',!ne||ne<=new Date()?t('You can donate now'):t('From')+' '+fmt(ne)]].map(([l,v])=><div key={l}><div className="text-lg font-semibold text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-muted">{t(l)}</div></div>)}</div>
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
    <MyData/></div>
}
