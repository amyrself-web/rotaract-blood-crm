import {useEffect,useState} from 'react'
import {MessageCircle,Plus} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {BLOOD,normPhone,nextEligible,fmt,wa} from '../lib/util'
const empty={full_name:'',phone:'',blood_group:'',gender:'',dob:'',area:'',last_donation:'',consent:false}
export default function Donors(){
  const [rows,setRows]=useState([]),[q,setQ]=useState(''),[g,setG]=useState(''),[form,setForm]=useState(null),[err,setErr]=useState('')
  const load=()=>supabase.from('donors').select('*').order('created_at',{ascending:false}).then(({data,error})=>error?setErr(error.message):setRows(data))
  useEffect(()=>{load()},[])
  const set=k=>e=>setForm({...form,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const save=async e=>{e.preventDefault();setErr('')
    const phone=normPhone(form.phone);if(phone.length!==10)return setErr('Enter a 10-digit mobile number')
    const row=Object.fromEntries(Object.entries({...form,phone,consent_at:form.consent?new Date().toISOString():null}).map(([k,v])=>[k,v===''?null:v]))
    const {error}=await supabase.from('donors').insert(row)
    if(error)return setErr(error.code==='23505'?'This phone number is already registered':error.message)
    setForm(null);load()}
  const list=rows.filter(r=>(!g||r.blood_group===g)&&(!q||(r.full_name+r.phone+(r.area||'')).toLowerCase().includes(q.toLowerCase())))
  const elig=r=>{const n=nextEligible(r.last_donation,r.gender);return !n||n<=new Date()?'Eligible':'From '+fmt(n)}
  return <div>
    <div className="mb-5 flex items-center justify-between"><h1 className="h1 mb-0">Donors <span className="text-base font-normal text-slate-400">{rows.length}</span></h1>
      <button className="btn" onClick={()=>setForm(empty)}><Plus size={16}/>Add donor</button></div>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    {form&&<form onSubmit={save} className="card mb-5 grid gap-3 sm:grid-cols-2">
      <input className="input" placeholder="Full name" required value={form.full_name} onChange={set('full_name')}/>
      <input className="input" placeholder="Mobile (10 digits)" required value={form.phone} onChange={set('phone')}/>
      <select className="input" value={form.blood_group} onChange={set('blood_group')}><option value="">Blood group</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
      <select className="input" value={form.gender} onChange={set('gender')}><option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option></select>
      <label className="text-sm text-slate-400">Date of birth<input type="date" className="input mt-1" value={form.dob} onChange={set('dob')}/></label>
      <label className="text-sm text-slate-400">Last donation<input type="date" className="input mt-1" value={form.last_donation} onChange={set('last_donation')}/></label>
      <input className="input sm:col-span-2" placeholder="Area / town" value={form.area} onChange={set('area')}/>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.consent} onChange={set('consent')}/>Donor agreed to be contacted about camps</label>
      <div className="flex gap-2 sm:col-span-2"><button className="btn">Save donor</button><button type="button" className="btn-ghost" onClick={()=>setForm(null)}>Cancel</button></div>
    </form>}
    <div className="mb-3 flex gap-2"><input className="input" placeholder="Search name, phone, area" value={q} onChange={e=>setQ(e.target.value)}/>
      <select className="input w-32" value={g} onChange={e=>setG(e.target.value)}><option value="">All groups</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></div>
    <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
      <thead className="text-left text-slate-400"><tr><th className="p-3 font-medium">Name</th><th className="font-medium">Group</th><th className="font-medium">Area</th><th className="font-medium">Next donation</th><th/></tr></thead>
      <tbody>{list.map(r=><tr key={r.id} className="border-t border-ink-700">
        <td className="p-3"><div className="text-white">{r.full_name}</div><div className="text-xs text-slate-500">{r.phone}</div></td>
        <td className="font-semibold text-blood">{r.blood_group||'-'}</td><td>{r.area||'-'}</td><td>{elig(r)}</td>
        <td className="pr-3 text-right">{r.consent?<a className="btn-ghost inline-block" title="Message on WhatsApp" target="_blank" rel="noreferrer" href={wa(r.phone,`Hello ${r.full_name}, this is Sankari Rotaract Club.`)}><MessageCircle size={16}/></a>:<span className="text-xs text-slate-500">Consent pending</span>}</td></tr>)}
        {!list.length&&<tr><td colSpan="5" className="p-6 text-center text-slate-500">No donors yet. Add one, or share a camp registration link.</td></tr>}</tbody></table></div></div>
}
