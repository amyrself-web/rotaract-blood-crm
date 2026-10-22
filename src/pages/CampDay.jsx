import {toast} from 'sonner'
import {useEffect,useState} from 'react'
import {UserPlus} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,normPhone,fmt} from '../lib/util'
import CountUp from '../components/CountUp'
const LABEL={registered:'Registered',checked_in:'Checked in',screened:'Cleared to donate',donated:'Donated',deferred:'Deferred',no_show:'No-show'}
const TONE={registered:'text-fog-muted',checked_in:'text-brand',screened:'text-brand',donated:'text-white font-semibold',deferred:'text-blood',no_show:'text-fog-faint'}
const Field=({label,children})=><label className="text-sm text-fog-muted">{label}{children}</label>
function Screen({row,run,close}){
  const {settings:S}=useAuth()
  const [v,setV]=useState({hb:'',sys:'',dia:'',wt:'',pulse:'',notes:'',reason:'',days:'90'})
  const set=k=>e=>setV({...v,[k]:e.target.value}),n=x=>x===''?null:Number(x),issues=[]
  if(v.hb&&+v.hb<S.min_hb)issues.push(`Hb below ${S.min_hb}`)
  if(v.wt&&+v.wt<S.min_weight)issues.push(`Weight below ${S.min_weight} kg`)
  if(v.sys&&(+v.sys<100||+v.sys>180))issues.push('Systolic BP outside 100 to 180')
  if(v.dia&&(+v.dia<50||+v.dia>100))issues.push('Diastolic BP outside 50 to 100')
  if(v.pulse&&(+v.pulse<50||+v.pulse>100))issues.push('Pulse outside 50 to 100')
  const gap=row.last_donation?Math.floor((Date.now()-new Date(row.last_donation))/864e5):null,need=row.gender==='Female'?S.gap_female:S.gap_male
  if(gap!==null&&gap<need)issues.push(`Last donated ${gap} days ago (gap is ${need} days)`)
  const send=d=>run('save_screening',{p_reg:row.reg_id,p_hb:n(v.hb),p_sys:n(v.sys),p_dia:n(v.dia),p_wt:n(v.wt),p_pulse:n(v.pulse),p_decision:d,p_reason:d==='deferred'?v.reason:null,p_until:d==='deferred'?new Date(Date.now()+Number(v.days||0)*864e5).toISOString().slice(0,10):null,p_notes:v.notes||null})
  return <div className="card mb-5"><h2 className="mb-3 font-semibold text-white">Screening: {row.full_name} <span className="text-blood">{row.blood_group}</span></h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Field label="Hb (g/dL)"><input className="input mt-1" type="number" step="0.1" value={v.hb} onChange={set('hb')}/></Field>
      <Field label="Weight (kg)"><input className="input mt-1" type="number" step="0.1" value={v.wt} onChange={set('wt')}/></Field>
      <Field label="BP high"><input className="input mt-1" type="number" value={v.sys} onChange={set('sys')}/></Field>
      <Field label="BP low"><input className="input mt-1" type="number" value={v.dia} onChange={set('dia')}/></Field>
      <Field label="Pulse"><input className="input mt-1" type="number" value={v.pulse} onChange={set('pulse')}/></Field></div>
    <input className="input mt-3" placeholder="Notes (optional)" value={v.notes} onChange={set('notes')}/>
    <p className={`mt-3 text-sm ${issues.length?'text-blood':'text-fog-muted'}`}>{issues.length?issues.join('. ')+'.':v.hb&&v.wt&&v.sys&&v.dia?'Readings meet the usual criteria.':'Enter the readings.'} The final decision is the medical officer's.</p>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <button className="btn" onClick={()=>send('eligible')}>Cleared to donate</button>
      <input className="input w-48" placeholder="Reason for deferral" value={v.reason} onChange={set('reason')}/>
      <input className="input w-20" type="number" min="1" title="Days" value={v.days} onChange={set('days')}/><span className="pb-2 text-sm text-fog-muted">days</span>
      <button className="btn bg-blood hover:bg-rose-600" disabled={!v.reason} onClick={()=>send('deferred')}>Defer</button>
      <button className="btn-ghost text-sm" onClick={close}>Cancel</button></div></div>
}
function Donate({row,run,close}){
  const [v,setV]=useState({bag:'',vol:'350',reaction:''}),set=k=>e=>setV({...v,[k]:e.target.value})
  return <div className="card mb-5"><h2 className="mb-3 font-semibold text-white">Record donation: {row.full_name} <span className="text-blood">{row.blood_group}</span></h2>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="Bag number"><input className="input mt-1" value={v.bag} onChange={set('bag')}/></Field>
      <Field label="Volume (ml)"><input className="input mt-1" type="number" value={v.vol} onChange={set('vol')}/></Field>
      <Field label="Reaction (if any)"><input className="input mt-1" value={v.reaction} onChange={set('reaction')}/></Field></div>
    <div className="mt-3 flex gap-2"><button className="btn" disabled={!v.bag} onClick={()=>run('record_donation',{p_reg:row.reg_id,p_bag:v.bag,p_vol:Number(v.vol),p_reaction:v.reaction||null})}>Record donation</button><button className="btn-ghost text-sm" onClick={close}>Cancel</button></div></div>
}
function Walk({camp,run,close}){
  const [v,setV]=useState({name:'',phone:'',dob:'',group:'',area:'',consent:false}),set=k=>e=>setV({...v,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  return <form className="card mb-5 grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();run('walk_in',{p_camp:camp,p_name:v.name,p_phone:normPhone(v.phone),p_group:v.group||null,p_dob:v.dob||null,p_area:v.area||null,p_consent:v.consent})}}>
    <input className="input" placeholder="Full name" required value={v.name} onChange={set('name')}/><input className="input" placeholder="Mobile (10 digits)" required value={v.phone} onChange={set('phone')}/>
    <Field label="Date of birth"><input className="input mt-1" type="date" required value={v.dob} onChange={set('dob')}/></Field>
    <select className="input self-end" value={v.group} onChange={set('group')}><option value="">Blood group</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
    <input className="input sm:col-span-2" placeholder="Area / town" value={v.area} onChange={set('area')}/>
    <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" required checked={v.consent} onChange={set('consent')}/>Donor agrees to be contacted and to their details being stored</label>
    <div className="flex gap-2 sm:col-span-2"><button className="btn">Add and check in</button><button type="button" className="btn-ghost text-sm" onClick={close}>Cancel</button></div></form>
}
export default function CampDay(){
  const {can}=useAuth(),medic=can('screening')
  const [camps,setCamps]=useState([]),[cid,setCid]=useState(''),[rows,setRows]=useState([]),[q,setQ]=useState(''),[f,setF]=useState(''),[act,setAct]=useState(null),[err,setErr]=useState('')
  useEffect(()=>{supabase.from('camps').select('*').in('status',['open','live']).order('camp_date').then(({data,error})=>{if(error)return setErr(error.message);setCamps(data);const p=data.find(c=>c.status==='live')||data[0];if(p)setCid(p.id)})},[])
  const load=()=>cid&&supabase.rpc('camp_worklist',{p_camp:cid}).then(({data,error})=>error?setErr(error.message):setRows(data))
  useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[cid])
  const run=async(fn,args)=>{setErr('');const {error}=await supabase.rpc(fn,args);if(error){toast.error(error.message);return setErr(error.message)}setAct(null);load()}
  const camp=camps.find(c=>c.id===cid),by=s=>rows.filter(r=>r.status===s).length
  const donated=rows.filter(r=>r.status==='donated'),litres=(donated.reduce((a,r)=>a+(r.volume_ml||0),0)/1000).toFixed(1)
  const arrived=rows.filter(r=>!['registered','no_show'].includes(r.status)).length
  const list=rows.filter(r=>(!f||r.status===f)&&(!q||(r.full_name+r.phone).toLowerCase().includes(q.toLowerCase())))
  if(!camps.length)return <div className="card text-center text-fog-muted">No open or live camp. Set a camp to Open or Live on the Camps page.</div>
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="h1 mb-0">Camp day</h1>
      <div className="flex gap-2"><select className="input w-auto" value={cid} onChange={e=>setCid(e.target.value)}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)}, {c.status})</option>)}</select>
        {can('campday')&&<button className="btn" onClick={()=>setAct({type:'walk'})}><UserPlus size={16}/>Walk-in</button>}</div></div>
    {err&&<div role="alert" className="mb-4 rounded-xl border border-blood/40 bg-blood/10 px-4 py-3 text-sm text-[#FF8796]">{err}</div>}
    <div className="card mb-5">
      <div className="grid grid-cols-3 gap-4 text-center sm:grid-cols-6">{[['Registered',rows.length],['Arrived',arrived],['Cleared',by('screened')],['Donated',donated.length],['Deferred',by('deferred')],['Blood collected',litres+' L']].map(([l,n])=><div key={l}><div className="text-2xl font-semibold tabular-nums text-white"><CountUp value={n}/></div><div className="text-xs text-fog-muted">{l}</div></div>)}</div>
      {camp?.target_donors&&<div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-rose-700 to-blood transition-all duration-700" style={{width:Math.min(100,donated.length/camp.target_donors*100)+'%'}}/></div><div className="mt-1 text-xs text-fog-muted">{donated.length} of {camp.target_donors} target donors</div></div>}
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">{BLOOD.map(b=><div key={b} className="tile py-2 text-center"><div className="font-semibold text-blood">{b}</div><div className="text-lg tabular-nums text-white"><CountUp value={donated.filter(r=>r.blood_group===b).length}/></div></div>)}</div></div>
    {act?.type==='walk'&&<Walk camp={cid} run={run} close={()=>setAct(null)}/>}
    {act?.type==='screen'&&<Screen row={act.row} run={run} close={()=>setAct(null)}/>}
    {act?.type==='donate'&&<Donate row={act.row} run={run} close={()=>setAct(null)}/>}
    <div className="mb-3 flex gap-2"><input className="input" placeholder="Search name or phone" value={q} onChange={e=>setQ(e.target.value)}/>
      <select className="input w-44" value={f} onChange={e=>setF(e.target.value)}><option value="">All steps</option>{Object.entries(LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="text-left text-fog-muted"><tr><th className="p-3 font-medium">Donor</th><th className="font-medium">Group</th><th className="font-medium">Slot</th><th className="font-medium">Step</th><th/></tr></thead>
      <tbody>{list.map(r=><tr key={r.reg_id} className="border-t border-ink-700">
        <td className="p-3"><div className="text-white">{r.full_name}</div><div className="text-xs text-fog-faint">{r.phone}</div></td>
        <td className="font-semibold text-blood">{r.blood_group||'-'}</td><td>{r.slot||'-'}</td><td className={TONE[r.status]}>{LABEL[r.status]}{r.bag_number&&<span className="text-xs text-fog-faint"> · {r.bag_number}</span>}</td>
        <td className="space-x-2 pr-3 text-right">
          {['registered','no_show'].includes(r.status)&&<button className="btn px-3 py-1" onClick={()=>run('set_reg_status',{p_reg:r.reg_id,p_status:'checked_in'})}>Check in</button>}
          {r.status==='registered'&&<button className="btn-ghost text-xs" onClick={()=>run('set_reg_status',{p_reg:r.reg_id,p_status:'no_show'})}>No-show</button>}
          {can('campday')&&r.status==='checked_in'&&<button className="btn-ghost text-xs" title="Undo check-in" onClick={()=>run('set_reg_status',{p_reg:r.reg_id,p_status:'registered'})}>Undo</button>}
          {medic&&r.status==='checked_in'&&<button className="btn px-3 py-1" onClick={()=>setAct({type:'screen',row:r})}>Screen</button>}
          {medic&&r.status==='screened'&&<button className="btn px-3 py-1" onClick={()=>setAct({type:'donate',row:r})}>Record donation</button>}</td></tr>)}
        {!list.length&&<tr><td colSpan="5" className="p-6 text-center text-fog-faint">No donors here yet.</td></tr>}</tbody></table></div></div>
}
