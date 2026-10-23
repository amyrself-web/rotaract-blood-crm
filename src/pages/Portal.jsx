import {useEffect,useState} from 'react'
import {Award} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {normPhone,nextEligible,fmt,slots} from '../lib/util'
import {makeCertificate,certNo} from '../lib/certificate'
import {useBrand} from '../context/Brand'
import {code,useLive,PageHeader} from '../components/ui'
import CountUp from '../components/CountUp'
import {ClaimMember} from './MyClub'
import {useAuth} from '../context/Auth'
const badge=n=>n>=10?'Life saver':n>=5?'Regular donor':n>=2?'Repeat donor':n===1?'First donation done':'Ready to donate'
export default function Portal(){
  const {brand}=useBrand(),{refresh}=useAuth(),[busy,setBusy]=useState(null)
  const [p,setP]=useState(null),[err,setErr]=useState(''),[f,setF]=useState({phone:'',dob:'',consent:false}),[slot,setSlot]=useState({})
  const load=()=>supabase.rpc('my_portal').then(({data,error})=>error?setErr(error.message):setP(data))
  useEffect(()=>{load()},[])
  useLive(['registrations','donations','camps'],load)
  const call=async(fn,args)=>{setErr('');const {error}=await supabase.rpc(fn,args);error?setErr(error.message):load()}
  if(!p)return <div className="text-fog-muted">{err||'Loading…'}</div>
  if(!p.donor)return <div className="mx-auto max-w-md"><PageHeader title="Find your donor record" description="Link your account to your donations"/>
    <form className="card space-y-3" onSubmit={e=>{e.preventDefault();call('claim_donor',{p_phone:normPhone(f.phone),p_dob:f.dob,p_consent:f.consent})}}>
      <p className="text-sm text-fog-muted">Enter the mobile number and date of birth you gave when you registered at a camp. New here? Register at the next camp first.</p>
      <input className="input" placeholder="Mobile number" required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>
      <label className="block text-sm text-fog-muted">Date of birth<input type="date" className="input mt-1" required value={f.dob} onChange={e=>setF({...f,dob:e.target.value})}/></label>
      <label className="flex gap-2 text-sm text-fog"><input type="checkbox" required checked={f.consent} onChange={e=>setF({...f,consent:e.target.checked})}/>I agree to be contacted about camps and blood donation drives.</label>
      {err&&<p className="text-sm text-blood">{err}</p>}<button className="btn w-full">Link my record</button></form>
    <div className="mt-5"><ClaimMember compact onDone={refresh}/></div></div>
  const d=p.donor,out=p.outside||[],n=p.history.length+out.reduce((x,o)=>x+(o.units||1),0),ne=nextEligible(d.last_donation,d.gender),regIds=new Set(p.upcoming.map(u=>u.camp_id)),gave=new Set(p.history.map(h=>h.camp+'|'+h.date))
  return <div><PageHeader eyebrow={d.donor_no?code('D',d.donor_no):undefined} title={`Hello, ${d.name}`} description="Thank you for being a blood donor"/>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="card mb-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
      {[['Blood group',d.blood_group||'-'],['Donations',n],['Status',badge(n)],['Next donation',!ne||ne<=new Date()?'You can donate now':'From '+fmt(ne)]].map(([l,v])=><div key={l}><div className="text-lg font-semibold text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-muted">{l}</div></div>)}</div>
    {p.upcoming.length>0&&<div className="card mb-5"><h2 className="mb-2 font-semibold text-fg">Your upcoming camps</h2>{p.upcoming.map(u=><div key={u.camp_id} className="text-sm text-fog">{u.camp}, {fmt(u.date)}{u.venue&&`, ${u.venue}`}{u.slot&&` at ${u.slot}`}</div>)}</div>}
    <div className="card mb-5"><h2 className="mb-3 font-semibold text-fg">Camps open for registration</h2>
      {p.open_camps.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 py-2 first:border-0"><div><div className="text-fg">{c.name}</div><div className="text-sm text-fog-muted">{fmt(c.date)}{c.venue&&`, ${c.venue}`}</div></div>
        {gave.has(c.name+'|'+c.date)?<span className="text-sm text-blood">Donated, thank you</span>:regIds.has(c.id)?<span className="text-sm text-brand">Registered</span>:<div className="flex gap-2">
          {slots(c.start_time,c.end_time).length>0&&<select className="input w-auto" value={slot[c.id]||''} onChange={e=>setSlot({...slot,[c.id]:e.target.value})}><option value="">Time slot</option>{slots(c.start_time,c.end_time).map(s=><option key={s}>{s}</option>)}</select>}
          <button className="btn" onClick={()=>call('register_me',{p_camp:c.id,p_slot:slot[c.id]||null})}>Register</button></div>}</div>)}
      {!p.open_camps.length&&<p className="text-sm text-fog-faint">No camp is open right now.</p>}</div>
    <div className="card"><h2 className="mb-3 font-semibold text-fg">Your donations</h2>
      {p.history.map(h=><div key={h.code} className="flex items-center justify-between border-t border-ink-700 py-2 first:border-0"><div><div className="text-fg">{h.camp}</div><div className="text-sm text-fog-muted">{fmt(h.date)}</div></div>
        <button className="btn" disabled={busy===h.cert_no} onClick={async()=>{setBusy(h.cert_no);try{await makeCertificate({name:d.name,camp:h.camp,venue:h.venue,date:fmt(h.date),bloodGroup:d.blood_group,volume:h.volume,certificate:h.cert_no?certNo(h.cert_no):h.code,verifyCode:h.verify_code,donorNo:code('D',d.donor_no),brand})}finally{setBusy(null)}}}><Award size={16}/>{busy===h.cert_no?'Preparing…':'Certificate'}</button></div>)}
      {out.map((o,i)=><div key={'o'+i} className="flex items-center justify-between border-t border-ink-700 py-2 first:border-0"><div><div className="text-fg">{o.kind==='emergency_donation'?'Emergency donation':'Donation'} at {o.place}</div><div className="text-sm text-fog-muted">{fmt(o.date)}</div></div><span className="text-xs text-fog-faint">Recorded by the club</span></div>)}
      {!n&&<p className="text-sm text-fog-faint">Your donations will appear here after your first camp.</p>}</div>
    <details className="mt-5"><summary className="cursor-pointer text-sm text-fog-muted hover:text-fg">Are you a member of the club? Link your member record</summary><div className="mt-3 max-w-md"><ClaimMember compact onDone={refresh}/></div></details></div>
}
