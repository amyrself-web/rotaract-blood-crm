import {useEffect,useState} from 'react'
import {Send} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,nextEligible,fmt,wa} from '../lib/util'
const ST=['collected','in_transit','testing','available','issued','discarded']
const LB={collected:'Collected',in_transit:'In transit',testing:'Testing',available:'Available',issued:'Issued',discarded:'Discarded'}
const ACTIVE=['collected','in_transit','testing','available']
const TABS=[['overview','Overview'],['units','Units'],['handover','Handover'],['emergency','Emergency']]
const EREQ={patient_ref:'',blood_group:'',units_needed:'1',hospital:'',contact_name:'',contact_phone:'',notes:''}
async function all(){let out=[],from=0;for(;;){const {data,error}=await supabase.from('blood_units').select('*').order('id').range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)return out;from+=1000}}
function Req({r,units,setStatus}){
  const [open,setOpen]=useState(false),[ds,setDs]=useState(null)
  const avail=units.filter(u=>u.blood_group===r.blood_group&&u.status==='available').length
  const show=async()=>{setOpen(!open);if(ds)return
    const {data}=await supabase.from('donors').select('id,full_name,phone,gender,last_donation,area').eq('blood_group',r.blood_group).eq('consent',true).limit(300)
    setDs((data||[]).filter(d=>{const n=nextEligible(d.last_donation,d.gender);return !n||n<=new Date()}))}
  const msg=`URGENT: ${r.units_needed} unit(s) of ${r.blood_group} blood needed at ${r.hospital}. Contact ${r.contact_name||''} ${r.contact_phone||''}. If you are eligible and can donate, please call or reply. - Sankari Rotaract Club`
  return <div className="card"><div className="flex flex-wrap items-start justify-between gap-3"><div>
    <div className="text-white"><span className="text-xl font-semibold text-blood">{r.blood_group}</span> x {r.units_needed} at {r.hospital}</div>
    <div className="text-sm text-slate-400">{r.contact_name} {r.contact_phone} {r.patient_ref&&`· Ref ${r.patient_ref}`}</div>{r.notes&&<div className="text-sm text-slate-500">{r.notes}</div>}
    <div className="mt-1 text-sm">{avail} unit(s) available in stock · {fmt(r.created_at)} · <span className="capitalize">{r.status}</span></div></div>
    {r.status==='open'&&<div className="flex gap-2"><button className="btn" onClick={show}>{open?'Hide donors':'Find donors'}</button><button className="btn-ghost text-sm" onClick={()=>setStatus(r.id,'fulfilled')}>Fulfilled</button><button className="btn-ghost text-sm" onClick={()=>setStatus(r.id,'cancelled')}>Cancel</button></div>}</div>
    {open&&<div className="mt-4 border-t border-ink-700 pt-3">{!ds?<span className="text-sm text-slate-400">Loading…</span>:<>
      <p className="mb-2 text-sm text-slate-400">{ds.length} eligible {r.blood_group} donors who agreed to be contacted (exact blood group match only).</p>
      {ds.slice(0,30).map(d=><div key={d.id} className="flex items-center justify-between py-1 text-sm"><span className="text-white">{d.full_name} <span className="text-slate-500">{d.area}</span></span>
        <a className="btn px-3 py-1" target="_blank" rel="noreferrer" href={wa(d.phone,msg)}><Send size={14}/>WhatsApp</a></div>)}</>}</div>}</div>
}
export default function Stock(){
  const {profile}=useAuth(),role=profile.role,medic=['admin','medical'].includes(role),admin=role==='admin',staff=['admin','coordinator'].includes(role)
  const [units,setUnits]=useState([]),[th,setTh]=useState({}),[hand,setHand]=useState([]),[reqs,setReqs]=useState([]),[tab,setTab]=useState('overview'),[err,setErr]=useState('')
  const [fg,setFg]=useState(''),[fs,setFs]=useState(''),[q,setQ]=useState(''),[add,setAdd]=useState(null),[sel,setSel]=useState(new Set()),[bank,setBank]=useState(''),[hn,setHn]=useState(''),[ef,setEf]=useState(null)
  const load=async()=>{try{setUnits(await all())
    const t=await supabase.from('stock_thresholds').select('*');setTh(Object.fromEntries((t.data||[]).map(x=>[x.blood_group,x.min_units])))
    const h=await supabase.from('handovers').select('*, blood_units(count)').order('handed_on',{ascending:false}).limit(20);setHand(h.data||[])
    const r=await supabase.from('emergency_requests').select('*').order('created_at',{ascending:false}).limit(50);setReqs(r.data||[])}catch(e){setErr(e.message)}}
  useEffect(()=>{load()},[])
  const rpc=async(fn,args)=>{setErr('');const {error}=await supabase.rpc(fn,args);if(error)return setErr(error.message);load();return true}
  const today=new Date().toLocaleDateString('en-CA'),soon=new Date(Date.now()+7*864e5).toLocaleDateString('en-CA')
  const avail=g=>units.filter(u=>u.blood_group===g&&u.status==='available').length
  const pipe=g=>units.filter(u=>u.blood_group===g&&['collected','in_transit','testing'].includes(u.status)).length
  const expiring=units.filter(u=>ACTIVE.includes(u.status)&&u.expiry_date&&u.expiry_date<=soon).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))
  const changeStatus=(u,s)=>{let note=null;if(['issued','discarded'].includes(s)){note=window.prompt(s==='issued'?'Issued to (patient or hospital):':'Reason for discarding:');if(!note)return}rpc('set_unit_status',{p_unit:u.id,p_status:s,p_note:note})}
  const list=units.filter(u=>(!fg||u.blood_group===fg)&&(!fs||u.status===fs)&&(!q||u.bag_number.toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b.collected_on.localeCompare(a.collected_on))
  const collected=units.filter(u=>u.status==='collected')
  const saveReq=async e=>{e.preventDefault();const row=Object.fromEntries(Object.entries({...ef,units_needed:Number(ef.units_needed)}).map(([k,v])=>[k,v===''?null:v]))
    const {error}=await supabase.from('emergency_requests').insert(row);error?setErr(error.message):(setEf(null),load())}
  const reqStatus=async(id,status)=>{const {error}=await supabase.from('emergency_requests').update({status}).eq('id',id);error?setErr(error.message):load()}
  const doHandover=async()=>{if(await rpc('handover_units',{p_units:[...sel],p_bank:bank,p_notes:hn||null})){setSel(new Set());setBank('');setHn('')}}
  return <div><h1 className="h1">Blood stock</h1>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="mb-4 flex flex-wrap gap-2">{TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab===k?'bg-brand text-white':'border border-ink-600 text-slate-300 hover:border-brand'}`}>{l}</button>)}</div>
    {tab==='overview'&&<><div className="card mb-5"><div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{BLOOD.map(g=>{const a=avail(g),m=th[g]??5,low=a<m
      return <div key={g} className={`rounded-lg border py-3 text-center ${low?'border-blood':'border-ink-600'}`}><div className="font-semibold text-blood">{g}</div><div className="text-2xl text-white">{a}</div>
        <div className="text-xs text-slate-400">{pipe(g)} on the way</div>{low&&<div className="text-xs text-blood">Low</div>}</div>})}</div>
      <p className="mt-3 text-xs text-slate-500">Large number is units available. Low means below the minimum set for that group.</p></div>
      <div className="card mb-5"><h2 className="mb-2 font-semibold text-white">Expiring within 7 days</h2>
        {expiring.map(u=><div key={u.id} className="flex justify-between border-t border-ink-700 py-1 text-sm first:border-0"><span>{u.bag_number} <span className="font-semibold text-blood">{u.blood_group||'?'}</span> · {LB[u.status]}</span><span className={u.expiry_date<today?'text-blood':'text-slate-300'}>{u.expiry_date<today?'Expired ':''}{fmt(u.expiry_date)}</span></div>)}
        {!expiring.length&&<p className="text-sm text-slate-500">Nothing is about to expire.</p>}</div>
      <div className="card"><h2 className="mb-2 font-semibold text-white">Minimum units per group</h2><div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{BLOOD.map(g=><label key={g} className="text-center text-xs text-slate-400">{g}
        <input className="input mt-1 text-center" type="number" min="0" disabled={!admin} defaultValue={th[g]??5} key={g+(th[g]??5)} onBlur={async e=>{const {error}=await supabase.from('stock_thresholds').upsert({blood_group:g,min_units:Number(e.target.value)});error?setErr(error.message):setTh({...th,[g]:Number(e.target.value)})}}/></label>)}</div>
        <p className="mt-2 text-xs text-slate-500">Only the admin can change these. Whole blood expiry is set to 35 days from collection; confirm this with your partner blood bank.</p></div></>}
    {tab==='units'&&<>{medic&&<div className="mb-3">{add?<form className="card grid gap-3 sm:grid-cols-4" onSubmit={async e=>{e.preventDefault();if(await rpc('add_unit',{p_bag:add.bag,p_group:add.group||null,p_vol:Number(add.vol),p_collected:add.date||null,p_status:add.status}))setAdd(null)}}>
        <input className="input" placeholder="Bag number" required value={add.bag} onChange={e=>setAdd({...add,bag:e.target.value})}/>
        <select className="input" value={add.group} onChange={e=>setAdd({...add,group:e.target.value})}><option value="">Group unknown</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
        <input className="input" type="number" value={add.vol} onChange={e=>setAdd({...add,vol:e.target.value})}/>
        <input className="input" type="date" value={add.date} onChange={e=>setAdd({...add,date:e.target.value})}/>
        <select className="input" value={add.status} onChange={e=>setAdd({...add,status:e.target.value})}>{ST.map(s=><option key={s} value={s}>{LB[s]}</option>)}</select>
        <div className="flex gap-2 sm:col-span-3"><button className="btn">Add unit</button><button type="button" className="btn-ghost text-sm" onClick={()=>setAdd(null)}>Cancel</button></div></form>
        :<button className="btn" onClick={()=>setAdd({bag:'',group:'',vol:'350',date:today,status:'available'})}>Add opening stock</button>}</div>}
      <div className="mb-3 flex flex-wrap gap-2"><input className="input w-48" placeholder="Search bag number" value={q} onChange={e=>setQ(e.target.value)}/>
        <select className="input w-auto" value={fg} onChange={e=>setFg(e.target.value)}><option value="">All groups</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
        <select className="input w-auto" value={fs} onChange={e=>setFs(e.target.value)}><option value="">All steps</option>{ST.map(s=><option key={s} value={s}>{LB[s]}</option>)}</select></div>
      <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th className="p-3 font-medium">Bag</th><th className="font-medium">Group</th><th className="font-medium">Collected</th><th className="font-medium">Expires</th><th className="font-medium">Step</th></tr></thead>
        <tbody>{list.slice(0,200).map(u=><tr key={u.id} className="border-t border-ink-700"><td className="p-3 text-white">{u.bag_number}{u.note&&<div className="text-xs text-slate-500">{u.note}</div>}</td><td className="font-semibold text-blood">{u.blood_group||'?'}</td><td>{fmt(u.collected_on)}</td><td className={ACTIVE.includes(u.status)&&u.expiry_date<today?'text-blood':''}>{fmt(u.expiry_date)}</td>
          <td>{medic?<select className="input w-auto py-1" value={u.status} onChange={e=>changeStatus(u,e.target.value)}>{ST.map(s=><option key={s} value={s}>{LB[s]}</option>)}</select>:LB[u.status]}</td></tr>)}
          {!list.length&&<tr><td colSpan="5" className="p-6 text-center text-slate-500">No units yet. Units appear here automatically when a donation is recorded.</td></tr>}</tbody></table></div></>}
    {tab==='handover'&&<><div className="card mb-5"><h2 className="mb-1 font-semibold text-white">Hand over collected units to the blood bank</h2><p className="mb-3 text-sm text-slate-400">Tick the bags you are handing over. They move to In transit.</p>
      <div className="mb-3 max-h-64 overflow-y-auto">{collected.map(u=><label key={u.id} className="flex items-center gap-3 border-t border-ink-700 py-1.5 text-sm first:border-0"><input type="checkbox" checked={sel.has(u.id)} onChange={e=>{const s=new Set(sel);e.target.checked?s.add(u.id):s.delete(u.id);setSel(s)}}/>{u.bag_number}<span className="font-semibold text-blood">{u.blood_group||'?'}</span><span className="text-slate-500">{fmt(u.collected_on)}</span></label>)}
        {!collected.length&&<p className="text-sm text-slate-500">No collected units waiting.</p>}</div>
      <div className="flex flex-wrap gap-2"><input className="input w-56" placeholder="Blood bank name" value={bank} onChange={e=>setBank(e.target.value)}/><input className="input w-56" placeholder="Notes (optional)" value={hn} onChange={e=>setHn(e.target.value)}/>
        <button className="btn" disabled={!sel.size||!bank} onClick={doHandover}>Hand over {sel.size||''} units</button></div></div>
      <div className="card"><h2 className="mb-2 font-semibold text-white">Recent handovers</h2>{hand.map(h=><div key={h.id} className="flex justify-between border-t border-ink-700 py-1.5 text-sm first:border-0"><span>{h.bank_name}{h.notes&&<span className="text-slate-500"> · {h.notes}</span>}</span><span className="text-slate-300">{h.blood_units?.[0]?.count??0} units · {fmt(h.handed_on)}</span></div>)}{!hand.length&&<p className="text-sm text-slate-500">No handovers yet.</p>}</div></>}
    {tab==='emergency'&&<div className="space-y-3">{staff&&(ef?<form className="card grid gap-3 sm:grid-cols-2" onSubmit={saveReq}>
        <select className="input" required value={ef.blood_group} onChange={e=>setEf({...ef,blood_group:e.target.value})}><option value="">Blood group needed</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
        <input className="input" type="number" min="1" placeholder="Units" value={ef.units_needed} onChange={e=>setEf({...ef,units_needed:e.target.value})}/>
        <input className="input" placeholder="Hospital" required value={ef.hospital} onChange={e=>setEf({...ef,hospital:e.target.value})}/>
        <input className="input" placeholder="Patient reference (optional)" value={ef.patient_ref} onChange={e=>setEf({...ef,patient_ref:e.target.value})}/>
        <input className="input" placeholder="Contact name" value={ef.contact_name} onChange={e=>setEf({...ef,contact_name:e.target.value})}/>
        <input className="input" placeholder="Contact phone" value={ef.contact_phone} onChange={e=>setEf({...ef,contact_phone:e.target.value})}/>
        <input className="input sm:col-span-2" placeholder="Notes" value={ef.notes} onChange={e=>setEf({...ef,notes:e.target.value})}/>
        <div className="flex gap-2 sm:col-span-2"><button className="btn">Create request</button><button type="button" className="btn-ghost text-sm" onClick={()=>setEf(null)}>Cancel</button></div></form>
      :<button className="btn" onClick={()=>setEf(EREQ)}>New emergency request</button>)}
      {reqs.map(r=><Req key={r.id} r={r} units={units} setStatus={reqStatus}/>)}{!reqs.length&&<div className="card text-center text-slate-500">No emergency requests.</div>}</div>}
  </div>
}
