import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {Droplet} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {BLOOD,normPhone,fmt,slots} from '../lib/util'
export default function Register(){
  const {campId}=useParams(),[camp,setCamp]=useState(undefined),[f,setF]=useState({name:'',phone:'',group:'',dob:'',area:'',slot:'',consent:false}),[msg,setMsg]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false)
  useEffect(()=>{if(hasSupabase)supabase.from('camps').select('*').eq('id',campId).maybeSingle().then(({data})=>setCamp(data))},[campId])
  const set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const submit=async e=>{e.preventDefault();setBusy(true);setMsg('')
    const {error}=await supabase.rpc('register_for_camp',{p_camp:campId,p_name:f.name,p_phone:normPhone(f.phone),p_group:f.group||null,p_dob:f.dob||null,p_area:f.area||null,p_slot:f.slot||null,p_consent:f.consent})
    setBusy(false);error?setMsg(error.message):setDone(true)}
  const head=<div className="mb-5 text-center"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-blood/15 text-blood"><Droplet/></span><h1 className="text-xl font-semibold text-white">Sankari Rotaract Club</h1><p className="text-sm text-slate-400">Blood donation camp registration</p></div>
  return <div className="grid min-h-screen place-items-center bg-gradient-to-b from-ink-900 to-ink-950 p-5"><div className="w-full max-w-md">{head}
    {camp===undefined?<div className="card text-center text-slate-400">Loading…</div>
    :!camp||camp.status!=='open'?<div className="card text-center">Registration for this camp is not open. Please check with the club.</div>
    :done?<div className="card text-center"><h2 className="text-lg font-semibold text-white">You are registered</h2><p className="mt-2 text-slate-300">{camp.name}<br/>{fmt(camp.camp_date)}{f.slot&&` at ${f.slot}`}{camp.venue&&`, ${camp.venue}`}</p><p className="mt-3 text-sm text-slate-400">Please bring a photo ID. Thank you for donating blood.</p></div>
    :<form onSubmit={submit} className="card space-y-3">
      <div className="text-sm text-slate-300"><span className="font-semibold text-white">{camp.name}</span><br/>{fmt(camp.camp_date)}{camp.venue&&`, ${camp.venue}`}</div>
      <input className="input" placeholder="Full name" required value={f.name} onChange={set('name')}/>
      <input className="input" inputMode="numeric" placeholder="Mobile number (10 digits)" required value={f.phone} onChange={set('phone')}/>
      <label className="block text-sm text-slate-400">Date of birth<input type="date" required className="input mt-1" value={f.dob} onChange={set('dob')}/></label>
      <select className="input" value={f.group} onChange={set('group')}><option value="">Blood group (if you know it)</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
      <input className="input" placeholder="Area / town" value={f.area} onChange={set('area')}/>
      {slots(camp.start_time,camp.end_time).length>0&&<select className="input" required value={f.slot} onChange={set('slot')}><option value="">Choose a time slot</option>{slots(camp.start_time,camp.end_time).map(s=><option key={s}>{s}</option>)}</select>}
      <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" className="mt-1" required checked={f.consent} onChange={set('consent')}/><span>I agree to be contacted about this camp and future blood donation drives, and to my details being stored for this purpose.</span></label>
      {msg&&<p className="text-sm text-blood">{msg}</p>}
      <button className="btn w-full" disabled={busy}>Register</button></form>}
  </div></div>
}
