import {useEffect,useState} from 'react'
import {Award} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {normPhone,nextEligible,fmt,slots} from '../lib/util'
import {makeCertificate} from '../lib/certificate'
const badge=n=>n>=10?'Life saver':n>=5?'Regular donor':n>=1?'First donation done':'Ready to donate'
export default function Portal(){
  const [p,setP]=useState(null),[err,setErr]=useState(''),[f,setF]=useState({phone:'',dob:'',consent:false}),[slot,setSlot]=useState({})
  const load=()=>supabase.rpc('my_portal').then(({data,error})=>error?setErr(error.message):setP(data))
  useEffect(()=>{load()},[])
  const call=async(fn,args)=>{setErr('');const {error}=await supabase.rpc(fn,args);error?setErr(error.message):load()}
  if(!p)return <div className="text-slate-400">{err||'Loading…'}</div>
  if(!p.donor)return <div className="mx-auto max-w-md"><h1 className="h1">Find your donor record</h1>
    <form className="card space-y-3" onSubmit={e=>{e.preventDefault();call('claim_donor',{p_phone:normPhone(f.phone),p_dob:f.dob,p_consent:f.consent})}}>
      <p className="text-sm text-slate-400">Enter the mobile number and date of birth you gave when you registered at a camp. New here? Register at the next camp first.</p>
      <input className="input" placeholder="Mobile number" required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>
      <label className="block text-sm text-slate-400">Date of birth<input type="date" className="input mt-1" required value={f.dob} onChange={e=>setF({...f,dob:e.target.value})}/></label>
      <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" required checked={f.consent} onChange={e=>setF({...f,consent:e.target.checked})}/>I agree to be contacted about camps and blood donation drives.</label>
      {err&&<p className="text-sm text-blood">{err}</p>}<button className="btn w-full">Link my record</button></form></div>
  const d=p.donor,n=p.history.length,ne=nextEligible(d.last_donation,d.gender),regIds=new Set(p.upcoming.map(u=>u.camp_id))
  return <div><h1 className="h1">Hello, {d.name}</h1>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="card mb-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
      {[['Blood group',d.blood_group||'-'],['Donations',n],['Status',badge(n)],['Next donation',!ne||ne<=new Date()?'You can donate now':'From '+fmt(ne)]].map(([l,v])=><div key={l}><div className="text-lg font-semibold text-white">{v}</div><div className="text-xs text-slate-400">{l}</div></div>)}</div>
    {p.upcoming.length>0&&<div className="card mb-5"><h2 className="mb-2 font-semibold text-white">Your upcoming camps</h2>{p.upcoming.map(u=><div key={u.camp_id} className="text-sm text-slate-300">{u.camp}, {fmt(u.date)}{u.venue&&`, ${u.venue}`}{u.slot&&` at ${u.slot}`}</div>)}</div>}
    <div className="card mb-5"><h2 className="mb-3 font-semibold text-white">Camps open for registration</h2>
      {p.open_camps.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 py-2 first:border-0"><div><div className="text-white">{c.name}</div><div className="text-sm text-slate-400">{fmt(c.date)}{c.venue&&`, ${c.venue}`}</div></div>
        {regIds.has(c.id)?<span className="text-sm text-brand">Registered</span>:<div className="flex gap-2">
          {slots(c.start_time,c.end_time).length>0&&<select className="input w-auto" value={slot[c.id]||''} onChange={e=>setSlot({...slot,[c.id]:e.target.value})}><option value="">Time slot</option>{slots(c.start_time,c.end_time).map(s=><option key={s}>{s}</option>)}</select>}
          <button className="btn" onClick={()=>call('register_me',{p_camp:c.id,p_slot:slot[c.id]||null})}>Register</button></div>}</div>)}
      {!p.open_camps.length&&<p className="text-sm text-slate-500">No camp is open right now.</p>}</div>
    <div className="card"><h2 className="mb-3 font-semibold text-white">Your donations</h2>
      {p.history.map(h=><div key={h.code} className="flex items-center justify-between border-t border-ink-700 py-2 first:border-0"><div><div className="text-white">{h.camp}</div><div className="text-sm text-slate-400">{fmt(h.date)}</div></div>
        <button className="btn" onClick={()=>makeCertificate({name:d.name,camp:h.camp,date:fmt(h.date),code:h.code})}><Award size={16}/>Certificate</button></div>)}
      {!n&&<p className="text-sm text-slate-500">Your donations will appear here after your first camp.</p>}</div></div>
}
