// Food distribution points, sapling batches (with survival checks) and awareness talks for a camp.
import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Plus,Trash2,MapPin,Sprout,Utensils,Mic,LocateFixed} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {Badge,useLive,errText,useConfirm,undoToast} from '../ui'
import {FOOD_GROUPS} from '../../lib/campTypes'
import {fmt} from '../../lib/util'

const t5=t=>t?String(t).slice(0,5):''
const nowHm=()=>{const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
const Tile=({l,v,sub})=><div className="rounded-xl bg-ink-800 p-2 text-center"><div className="font-display text-xl font-semibold text-fg">{v}</div><div className="text-[11px] text-fog-faint">{l}</div>{sub&&<div className="text-[10px] text-fog-faint">{sub}</div>}</div>
function useRows(table,camp){const [rows,setRows]=useState(null)
  const load=()=>supabase.from(table).select('*').eq('camp_id',camp.id).order('created_at').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[camp.id]);useLive([table],load);return [rows,load]}
function useRemove(table,load,label){const confirm=useConfirm()
  return async row=>{if(!await confirm({title:`Delete ${label(row)}?`,action:'Delete'}))return;const {error}=await supabase.from(table).delete().eq('id',row.id);if(error)return toast.error(errText(error));load()
    undoToast(`${label(row)} deleted`,async()=>{const x=await supabase.from(table).insert(row);if(x.error)throw x.error;load()})}}

export function Food({camp}){
  const [rows,load]=useRows('camp_food',camp),[f,setF]=useState({place:'',group_type:'',people:'',packets:'',items:'',served_by:''}),remove=useRemove('camp_food',load,r=>r.place)
  const add=async e=>{e.preventDefault();if(f.place.trim().length<2)return toast.error('Enter the place');if(f.people===''||Number(f.people)<0)return toast.error('Enter how many people were served')
    const {error}=await supabase.from('camp_food').insert({camp_id:camp.id,place:f.place.trim(),group_type:f.group_type||null,people:Number(f.people),packets:f.packets===''?null:Number(f.packets),items:f.items.trim()||camp.details?.menu||null,served_by:f.served_by.trim()||null,served_at:nowHm()})
    if(error)return toast.error(errText(error));toast.success(`${f.people} served at ${f.place}`);setF({...f,place:'',group_type:'',people:'',packets:''});load()}
  if(!rows)return <div className="skeleton h-32"/>
  const people=rows.reduce((a,r)=>a+(r.people||0),0),packets=rows.reduce((a,r)=>a+(r.packets||0),0),target=camp.target_people
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2"><Tile l="People served" v={people} sub={target?`of ${target}`:''}/><Tile l="Packets given" v={packets} sub={camp.details?.packets_planned?`of ${camp.details.packets_planned}`:''}/><Tile l="Places" v={rows.length}/></div>
    {target>0&&<div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand transition-all" style={{width:Math.min(100,people/target*100)+'%'}}/></div>}
    <form onSubmit={add} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-6">
      <input className="input py-1.5 sm:col-span-2" aria-label="Place" placeholder="Place, e.g. Anbu Illam" value={f.place} onChange={e=>setF({...f,place:e.target.value})}/>
      <select className="input py-1.5" aria-label="Group" value={f.group_type} onChange={e=>setF({...f,group_type:e.target.value})}><option value="">Who</option>{FOOD_GROUPS.map(g=><option key={g}>{g}</option>)}</select>
      <input className="input py-1.5" aria-label="People served" type="number" min="0" placeholder="People" value={f.people} onChange={e=>setF({...f,people:e.target.value})}/>
      <input className="input py-1.5" aria-label="Packets" type="number" min="0" placeholder="Packets" value={f.packets} onChange={e=>setF({...f,packets:e.target.value})}/>
      <button className="btn py-1.5"><Plus size={15}/>Add</button>
      <input className="input py-1.5 sm:col-span-3" aria-label="Items" placeholder={camp.details?.menu?`Items (${camp.details.menu})`:'Items, e.g. Lemon rice, water'} value={f.items} onChange={e=>setF({...f,items:e.target.value})}/>
      <input className="input py-1.5 sm:col-span-3" aria-label="Served by" placeholder="Served by (team / vehicle)" value={f.served_by} onChange={e=>setF({...f,served_by:e.target.value})}/></form>
    <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{rows.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <Utensils size={16} className="text-brand"/><div className="min-w-[160px] flex-1"><div className="font-medium text-fg">{r.place}{r.group_type&&<span className="text-fog-faint"> · {r.group_type}</span>}</div>
        <div className="text-xs text-fog-faint">{[t5(r.served_at),r.items,r.served_by].filter(Boolean).join(' · ')}</div></div>
      <Badge tone="green">{r.people} people</Badge>{r.packets!=null&&<Badge tone="neutral">{r.packets} packets</Badge>}
      <button className="btn-ghost hover:text-blood" aria-label={`Delete ${r.place}`} onClick={()=>remove(r)}><Trash2 size={15}/></button></li>)}
      {!rows.length&&<li className="p-6 text-center text-sm text-fog-faint">No food served yet. Add each place as you serve.</li>}</ul></div>}

export function Saplings({camp}){
  const [rows,load]=useRows('camp_saplings',camp),[f,setF]=useState({species:'',count:'',place:'',landmark:'',planted_by:'',guardian:'',guardian_phone:'',lat:'',lng:''}),[chk,setChk]=useState({}),remove=useRemove('camp_saplings',load,r=>`${r.count} ${r.species}`)
  const locate=()=>{if(!navigator.geolocation)return toast.error('Location is not available on this device');navigator.geolocation.getCurrentPosition(p=>{setF(o=>({...o,lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6)}));toast.success('Location added')},()=>toast.error('Allow location to add it'),{enableHighAccuracy:true,timeout:10000})}
  const add=async e=>{e.preventDefault();if(f.species.trim().length<2)return toast.error('Enter the species');if(!(Number(f.count)>0))return toast.error('Enter how many were planted')
    const ph=f.guardian_phone.replace(/\D/g,'').slice(-10);if(f.guardian_phone&&!/^[6-9]\d{9}$/.test(ph))return toast.error('Enter a valid 10-digit mobile for the guardian')
    const {error}=await supabase.from('camp_saplings').insert({camp_id:camp.id,species:f.species.trim(),count:Number(f.count),place:f.place.trim()||null,landmark:f.landmark.trim()||null,planted_by:f.planted_by.trim()||null,guardian:f.guardian.trim()||null,guardian_phone:ph||null,lat:f.lat||null,lng:f.lng||null})
    if(error)return toast.error(errText(error));toast.success(`${f.count} ${f.species} added`);setF({...f,species:'',count:'',landmark:'',lat:'',lng:''});load()}
  const check=async r=>{const v=chk[r.id];if(v===''||v==null||Number(v)<0)return toast.error('Enter how many are alive');if(Number(v)>r.count)return toast.error('Alive cannot be more than planted')
    const {error}=await supabase.from('camp_sapling_checks').insert({sapling_id:r.id,alive:Number(v)});if(error)return toast.error(errText(error));toast.success('Survival check saved');setChk({...chk,[r.id]:''});load()}
  if(!rows)return <div className="skeleton h-32"/>
  const planted=rows.reduce((a,r)=>a+r.count,0),checked=rows.filter(r=>r.alive!=null),alive=checked.reduce((a,r)=>a+r.alive,0),base=checked.reduce((a,r)=>a+r.count,0),target=camp.target_people
  const months=Math.floor((Date.now()-new Date(camp.camp_date))/(30*864e5))
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2"><Tile l="Saplings planted" v={planted} sub={target?`of ${target}`:''}/><Tile l="Batches" v={rows.length}/><Tile l="Surviving" v={base?`${Math.round(alive/base*100)}%`:'–'} sub={base?`${alive} of ${base} checked`:'not checked yet'}/></div>
    {target>0&&<div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-ok transition-all" style={{width:Math.min(100,planted/target*100)+'%'}}/></div>}
    {months>=3&&<p className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm text-fg">{months} months since planting: visit the sites and record how many are alive for each batch.</p>}
    <form onSubmit={add} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-6">
      <input className="input py-1.5 sm:col-span-2" aria-label="Species" list="species-list" placeholder="Species, e.g. Neem" value={f.species} onChange={e=>setF({...f,species:e.target.value})}/>
      <datalist id="species-list">{['Neem','Pungai','Banyan','Peepal','Mango','Jamun','Teak','Bamboo','Coconut','Guava','Amla','Vagai','Poovarasu','Nagalingam'].map(s=><option key={s} value={s}/>)}</datalist>
      <input className="input py-1.5" aria-label="Count" type="number" min="1" placeholder="Count" value={f.count} onChange={e=>setF({...f,count:e.target.value})}/>
      <input className="input py-1.5 sm:col-span-2" aria-label="Place" placeholder="Place" value={f.place} onChange={e=>setF({...f,place:e.target.value})}/>
      <button className="btn py-1.5"><Plus size={15}/>Add</button>
      <input className="input py-1.5 sm:col-span-2" aria-label="Landmark" placeholder="Landmark / row" value={f.landmark} onChange={e=>setF({...f,landmark:e.target.value})}/>
      <input className="input py-1.5" aria-label="Planted by" placeholder="Planted by" value={f.planted_by} onChange={e=>setF({...f,planted_by:e.target.value})}/>
      <input className="input py-1.5" aria-label="Who waters" placeholder="Who waters" value={f.guardian} onChange={e=>setF({...f,guardian:e.target.value})}/>
      <input className="input py-1.5" aria-label="Their mobile" placeholder="Their mobile" inputMode="tel" value={f.guardian_phone} onChange={e=>setF({...f,guardian_phone:e.target.value})}/>
      <button type="button" className="btn-quiet py-1.5 text-xs" onClick={locate}><LocateFixed size={14}/>{f.lat?'Location ✓':'Add location'}</button></form>
    <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{rows.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <Sprout size={16} className="text-ok"/><div className="min-w-[160px] flex-1"><div className="font-medium text-fg">{r.count} {r.species}{r.place&&<span className="text-fog-faint"> · {r.place}</span>}</div>
        <div className="text-xs text-fog-faint">{[r.landmark,r.planted_by&&`by ${r.planted_by}`,r.guardian&&`waters: ${r.guardian}${r.guardian_phone?' '+r.guardian_phone:''}`].filter(Boolean).join(' · ')}
          {r.lat&&<> · <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${r.lat},${r.lng}`}><MapPin size={11} className="inline"/> map</a></>}</div></div>
      {r.alive!=null&&<Badge tone={r.alive/r.count>=0.7?'green':'amber'}>{r.alive} alive · {fmt(r.last_check)}</Badge>}
      <span className="flex items-center gap-1"><input className="input w-20 py-1 text-xs" type="number" min="0" max={r.count} aria-label={`Alive now, ${r.species}`} placeholder="Alive" value={chk[r.id]??''} onChange={e=>setChk({...chk,[r.id]:e.target.value})}/>
        <button className="btn-quiet py-1 text-xs" onClick={()=>check(r)}>Check</button></span>
      <button className="btn-ghost hover:text-blood" aria-label={`Delete ${r.species}`} onClick={()=>remove(r)}><Trash2 size={15}/></button></li>)}
      {!rows.length&&<li className="p-6 text-center text-sm text-fog-faint">No saplings yet. Add each batch as it is planted.</li>}</ul></div>}

export function Sessions({camp}){
  const [rows,load]=useRows('camp_sessions',camp),[f,setF]=useState({topic:'',speaker:'',attendees:'',materials:''}),remove=useRemove('camp_sessions',load,r=>r.topic)
  const add=async e=>{e.preventDefault();if(f.topic.trim().length<2)return toast.error('Enter the topic')
    const {error}=await supabase.from('camp_sessions').insert({camp_id:camp.id,topic:f.topic.trim(),speaker:f.speaker.trim()||null,attendees:f.attendees===''?null:Number(f.attendees),materials:f.materials===''?null:Number(f.materials),held_at:nowHm()})
    if(error)return toast.error(errText(error));toast.success('Talk added');setF({topic:'',speaker:'',attendees:'',materials:''});load()}
  if(!rows)return <div className="skeleton h-24"/>
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2"><Tile l="Talks" v={rows.length}/><Tile l="People who listened" v={rows.reduce((a,r)=>a+(r.attendees||0),0)}/><Tile l="Pamphlets given" v={rows.reduce((a,r)=>a+(r.materials||0),0)}/></div>
    <form onSubmit={add} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-6">
      <input className="input py-1.5 sm:col-span-2" aria-label="Topic" placeholder="Topic, e.g. Breast cancer signs" value={f.topic} onChange={e=>setF({...f,topic:e.target.value})}/>
      <input className="input py-1.5" aria-label="Speaker" placeholder="Speaker" value={f.speaker} onChange={e=>setF({...f,speaker:e.target.value})}/>
      <input className="input py-1.5" aria-label="People who listened" type="number" min="0" placeholder="People" value={f.attendees} onChange={e=>setF({...f,attendees:e.target.value})}/>
      <input className="input py-1.5" aria-label="Pamphlets given" type="number" min="0" placeholder="Pamphlets" value={f.materials} onChange={e=>setF({...f,materials:e.target.value})}/>
      <button className="btn py-1.5"><Mic size={15}/>Add talk</button></form>
    <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{rows.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <Mic size={16} className="text-brand"/><div className="flex-1"><div className="font-medium text-fg">{r.topic}</div><div className="text-xs text-fog-faint">{[t5(r.held_at),r.speaker].filter(Boolean).join(' · ')}</div></div>
      {r.attendees!=null&&<Badge tone="green">{r.attendees} people</Badge>}{r.materials!=null&&<Badge tone="neutral">{r.materials} pamphlets</Badge>}
      <button className="btn-ghost hover:text-blood" aria-label={`Delete ${r.topic}`} onClick={()=>remove(r)}><Trash2 size={15}/></button></li>)}
      {!rows.length&&<li className="p-5 text-center text-sm text-fog-faint">No talks recorded yet.</li>}</ul></div>}
