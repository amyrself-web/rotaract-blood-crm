// People at an eye / cancer awareness / other camp: register, record what was found and done, refer, follow up.
import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {UserPlus,Search,Trash2,ChevronDown,ChevronUp,MessageCircle,Phone} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../../context/Auth'
import {Badge,useLive,errText,useConfirm,code,undoToast} from '../ui'
import WaSend from '../wa/WaSend'
import {EYE_FINDINGS,EYE_ACTIONS,CANCER_SCREENS,RESULTS,FOLLOW,typeName} from '../../lib/campTypes'
import {fmt} from '../../lib/util'

const RTONE={normal:'green',needs_care:'amber',suspicious:'red'}
const Chips=({options,value,onChange,label})=><div role="group" aria-label={label} className="flex flex-wrap gap-1.5">{options.map(([k,l])=>{const on=value.includes(k)
  return <button key={k} type="button" aria-pressed={on} onClick={()=>onChange(on?value.filter(x=>x!==k):[...value,k])} className={`rounded-full border px-2.5 py-1 text-xs ${on?'border-brand bg-brand text-white':'border-ink-600 text-fog-muted hover:bg-ink-700'}`}>{l}</button>})}</div>
const Pick=({options,value,onChange,label})=><div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">{options.map(([k,l])=>
  <button key={k} type="button" role="radio" aria-checked={value===k} onClick={()=>onChange(value===k?null:k)} className={`rounded-full border px-2.5 py-1 text-xs ${value===k?'border-brand bg-brand text-white':'border-ink-600 text-fog-muted hover:bg-ink-700'}`}>{l}</button>)}</div>

function Editor({p,camp,save,remove}){
  const eye=camp.camp_type==='Eye checking',cancer=camp.camp_type==='Cancer awareness'
  const [d,setD]=useState(p);useEffect(()=>setD(p),[p.updated_at])
  const set=(k,v)=>setD(o=>({...o,[k]:v})),commit=patch=>save(p,patch)
  const field=(k,label,props={})=><label className="block text-xs text-fog-muted">{label}<input className="input mt-1 py-1.5 text-sm" value={d[k]??''} onChange={e=>set(k,e.target.value)} onBlur={e=>{const v=e.target.value.trim()||null;if(v!==(p[k]??null))commit({[k]:props.type==='number'?(v==null?null:Number(v)):v})}} {...props}/></label>
  const screens=(camp.cancer_types?.length?camp.cancer_types:['General awareness']).map(t=>[CANCER_SCREENS[t]||t,CANCER_SCREENS[t]||t])
  return <div className="space-y-3 border-t border-ink-700 bg-ink-800/40 p-3">
    <div className="grid gap-2 sm:grid-cols-4">{field('full_name','Name')}{field('age','Age',{type:'number',min:0,max:120})}
      <label className="block text-xs text-fog-muted">Gender<select className="input mt-1 py-1.5 text-sm" value={d.gender||''} onChange={e=>{set('gender',e.target.value);commit({gender:e.target.value||null})}}><option value="">-</option><option>Male</option><option>Female</option><option>Other</option></select></label>
      {field('phone','Mobile',{inputMode:'tel'})}</div>
    {eye&&<><div className="grid gap-2 sm:grid-cols-3">{field('vision_right','Vision right eye',{placeholder:'6/6'})}{field('vision_left','Vision left eye',{placeholder:'6/9'})}{field('power','Glasses power',{placeholder:'R +1.5 / L +1.75'})}</div>
      <div><div className="label">Findings</div><Chips label="Findings" options={EYE_FINDINGS.map(x=>[x,x])} value={d.findings||[]} onChange={v=>{set('findings',v);commit({findings:v,result:v.length===1&&v[0]==='Normal'?'normal':v.length?(d.result==='normal'?'needs_care':d.result||'needs_care'):d.result})}}/></div>
      <div><div className="label">What was done</div><Chips label="What was done" options={EYE_ACTIONS.map(x=>[x,x])} value={d.actions||[]} onChange={v=>{set('actions',v);commit({actions:v})}}/></div></>}
    {cancer&&<div><div className="label">Screenings done</div><Chips label="Screenings done" options={screens} value={d.screenings||[]} onChange={v=>{set('screenings',v);commit({screenings:v})}}/></div>}
    <div><div className="label">Result</div><Pick label="Result" options={RESULTS} value={d.result} onChange={v=>{set('result',v);commit({result:v})}}/></div>
    <div className="grid gap-2 sm:grid-cols-3">{field('referred_to','Referred to (hospital / doctor)')}
      <label className="block text-xs text-fog-muted">Follow-up<select className="input mt-1 py-1.5 text-sm" value={d.follow_up} onChange={e=>{set('follow_up',e.target.value);commit({follow_up:e.target.value})}}>{FOLLOW.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
      <label className="block text-xs text-fog-muted">Follow-up date<input type="date" className="input mt-1 py-1.5 text-sm" value={d.follow_up_on||''} onChange={e=>{set('follow_up_on',e.target.value);commit({follow_up_on:e.target.value||null})}}/></label></div>
    <div className="grid gap-2 sm:grid-cols-2">{field('follow_up_note','Follow-up note',{placeholder:eye?'Surgery done on …':'Biopsy / report …'})}{field('notes','Notes')}</div>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-quiet py-1 text-xs" onClick={()=>commit({status:p.status==='no_show'?'registered':'no_show'})}>{p.status==='no_show'?'Mark as came':'Did not come'}</button>
      {p.phone&&<WaSend className="btn-quiet py-1 text-xs" title="Message on WhatsApp" phone={p.phone} name={p.full_name} kind="camp_followup"
        text={`Hello ${p.full_name}, this is ${camp.partner?camp.partner+' and ':''}the club team from ${typeName(camp)} camp on ${fmt(camp.camp_date)}.${p.referred_to?` Please visit ${p.referred_to} as advised.`:''} Call us if you need help.`}><MessageCircle size={14}/>WhatsApp</WaSend>}
      {p.phone&&<a className="btn-quiet py-1 text-xs" href={`tel:${p.phone}`}><Phone size={14}/>Call</a>}
      <button type="button" className="btn-ghost ml-auto text-xs hover:text-blood" onClick={()=>remove(p)}><Trash2 size={14}/>Remove</button></div>
  </div>}

export default function People({camp,day=false}){
  const {can}=useAuth(),confirm=useConfirm()
  const [rows,setRows]=useState(null),[q,setQ]=useState(''),[f,setF]=useState(''),[open,setOpen]=useState(null),[add,setAdd]=useState({full_name:'',age:'',gender:'',phone:'',area:''}),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('camp_people').select('*').eq('camp_id',camp.id).order('token_no').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[camp.id]);useLive(['camp_people'],load)
  const eye=camp.camp_type==='Eye checking'
  const save=async(p,patch)=>{setRows(rs=>rs.map(r=>r.id===p.id?{...r,...patch}:r));const {data,error}=await supabase.from('camp_people').update(patch).eq('id',p.id).select().single();if(error){toast.error(errText(error));return load()}setRows(rs=>rs.map(r=>r.id===p.id?data:r))}
  const remove=async p=>{if(!await confirm({title:`Remove ${p.full_name}?`,body:'Their record at this camp is removed.',action:'Remove'}))return
    const {id,...row}=p;const {error}=await supabase.from('camp_people').delete().eq('id',id);if(error)return toast.error(errText(error));setOpen(null);load()
    undoToast(`${p.full_name} removed`,async()=>{const x=await supabase.from('camp_people').insert({...row,id});if(x.error)throw x.error;load()})}
  const addOne=async e=>{e.preventDefault();if(add.full_name.trim().length<2)return toast.error('Enter the name')
    const ph=add.phone.replace(/\D/g,'').slice(-10);if(add.phone&&!/^[6-9]\d{9}$/.test(ph))return toast.error('Enter a valid 10-digit mobile number or leave it empty')
    setBusy(true);const {data,error}=await supabase.from('camp_people').insert({camp_id:camp.id,full_name:add.full_name.trim(),age:add.age===''?null:Number(add.age),gender:add.gender||null,phone:ph||null,area:add.area.trim()||null,status:day?'attended':'registered',source:'desk'}).select().single()
    setBusy(false);if(error)return toast.error(error.code==='23505'?'This mobile number is already registered for this camp':errText(error))
    toast.success(`${data.full_name}: token ${code('T',data.token_no,3)}`);setAdd({full_name:'',age:'',gender:'',phone:'',area:''});load();if(day)setOpen(data.id)}
  const list=useMemo(()=>(rows||[]).filter(r=>(!q||`${r.full_name} ${r.phone||''} ${r.token_no} ${r.area||''}`.toLowerCase().includes(q.toLowerCase()))
    &&(!f||(f==='waiting'?r.status==='registered':f==='seen'?r.status==='attended':f==='referred'?!!r.referred_to:f==='follow'?r.follow_up==='pending':f==='no_show'?r.status==='no_show':r.result===f))),[rows,q,f])
  if(!rows)return <div className="skeleton h-40"/>
  const n=k=>rows.filter(k).length
  const tiles=[['Registered',rows.length],['Seen',n(r=>r.status==='attended')],['Waiting',n(r=>r.status==='registered')],...(eye?[['Spectacles',n(r=>r.actions?.includes('Spectacles given'))],['Surgery referral',n(r=>r.actions?.includes('Surgery referral'))]]:[['Normal',n(r=>r.result==='normal')],['Suspicious',n(r=>r.result==='suspicious')]]),['Follow-up pending',n(r=>r.follow_up==='pending')]]
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">{tiles.map(([l,v])=><div key={l} className="rounded-xl bg-ink-800 p-2"><div className="font-display text-xl font-semibold text-fg">{v}</div><div className="text-[11px] text-fog-faint">{l}</div></div>)}</div>
    {(can('camps')||can('campday'))&&<form onSubmit={addOne} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-[2fr_70px_110px_1.3fr_1fr_auto]">
      <input className="input py-1.5" aria-label="Name" placeholder="Name" value={add.full_name} onChange={e=>setAdd({...add,full_name:e.target.value})}/>
      <input className="input py-1.5" aria-label="Age" placeholder="Age" type="number" min="0" max="120" value={add.age} onChange={e=>setAdd({...add,age:e.target.value})}/>
      <select className="input py-1.5" aria-label="Gender" value={add.gender} onChange={e=>setAdd({...add,gender:e.target.value})}><option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option></select>
      <input className="input py-1.5" aria-label="Mobile" placeholder="Mobile (optional)" inputMode="tel" value={add.phone} onChange={e=>setAdd({...add,phone:e.target.value})}/>
      <input className="input py-1.5" aria-label="Area" placeholder="Area / village" value={add.area} onChange={e=>setAdd({...add,area:e.target.value})}/>
      <button className="btn py-1.5" disabled={busy}><UserPlus size={15}/>{day?'Add walk-in':'Add'}</button></form>}
    <div className="flex flex-wrap gap-2"><label className="relative min-w-[200px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-8" aria-label="Search people" placeholder="Search name, mobile, token" value={q} onChange={e=>setQ(e.target.value)}/></label>
      <select className="input w-auto" aria-label="Show" value={f} onChange={e=>setF(e.target.value)}><option value="">Everyone</option><option value="waiting">Waiting</option><option value="seen">Seen</option><option value="normal">Normal</option><option value="needs_care">Needs care</option><option value="suspicious">Suspicious</option><option value="referred">Referred</option><option value="follow">Follow-up pending</option><option value="no_show">Did not come</option></select></div>
    <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{list.map(r=><li key={r.id}>
      <button type="button" onClick={()=>setOpen(open===r.id?null:r.id)} aria-expanded={open===r.id} className="flex w-full flex-wrap items-center gap-2 p-3 text-left hover:bg-ink-750">
        <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-ink-700 font-display text-sm font-semibold text-fg">{code('T',r.token_no,3)}</span>
        <span className="min-w-[140px] flex-1"><span className="block text-sm font-medium text-fg">{r.full_name}{r.age!=null&&<span className="text-fog-faint"> · {r.age}{r.gender?r.gender[0]:''}</span>}</span>
          <span className="block truncate text-xs text-fog-faint">{[r.phone,r.area,r.source==='online'?'online':null,...(r.findings||[]),...(r.screenings||[])].filter(Boolean).join(' · ')}</span></span>
        {r.status==='registered'&&<Badge tone="neutral">Waiting</Badge>}{r.status==='no_show'&&<Badge tone="neutral">Did not come</Badge>}
        {r.result&&<Badge tone={RTONE[r.result]}>{RESULTS.find(x=>x[0]===r.result)?.[1]}</Badge>}
        {r.follow_up==='pending'&&<Badge tone="amber">Follow-up</Badge>}{r.follow_up==='done'&&<Badge tone="green">Followed up</Badge>}
        {open===r.id?<ChevronUp size={16} className="text-fog-faint"/>:<ChevronDown size={16} className="text-fog-faint"/>}</button>
      {open===r.id&&<Editor p={r} camp={camp} save={save} remove={remove}/>}</li>)}
      {!list.length&&<li className="p-6 text-center text-sm text-fog-faint">{rows.length?'No one matches.':'No one registered yet. Add people above, or share the registration QR.'}</li>}</ul>
  </div>}
