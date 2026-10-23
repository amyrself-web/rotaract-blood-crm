import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {motion} from 'framer-motion'
import {Droplet,Tent,MessageCircle,UserPlus,Phone,StickyNote,Award,Ban,Siren,Hospital,FileText,Plus,Trash2,IdCard} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {Field,undoToast,errText,todayIso,code} from './ui'
import {donorHistoryPdf,timelineText} from '../lib/clubReports'
import {bloodDonorCard} from '../lib/cards'

const KINDS=[['outside_donation','Donated elsewhere'],['emergency_donation','Emergency donation'],['call','Phone call'],['note','Note'],['award','Award or recognition'],['deferral','Deferred (outside camp)']]
const icon=t=>t.type==='camp'?(t.status==='donated'?Droplet:t.status==='deferred'?Ban:Tent):t.type==='message'?MessageCircle:t.type==='added'?UserPlus
  :{outside_donation:Hospital,emergency_donation:Siren,call:Phone,note:StickyNote,award:Award,deferral:Ban}[t.kind]||StickyNote
const color=t=>(t.type==='camp'&&t.status==='donated')||['outside_donation','emergency_donation'].includes(t.kind)?'bg-blood text-white shadow-[0_0_0_4px_rgb(240_67_90_/_.15)]'
  :t.status==='deferred'||t.kind==='deferral'?'bg-warn text-white':t.type==='message'?'bg-ok/15 text-ok':t.kind==='award'?'bg-brand text-white':'bg-ink-700 text-fog-muted'

export default function DonorHistory({donor}){
  const {brand}=useBrand(),[h,setH]=useState(null),[add,setAdd]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.rpc('donor_history',{p_donor:donor.id}).then(({data,error})=>error?toast.error(error.message):setH(data))
  useEffect(()=>{load()},[donor.id])
  const save=async e=>{e.preventDefault();setBusy(true)
    const r=await supabase.from('donor_events').insert({donor_id:donor.id,kind:add.kind,event_date:add.event_date,place:add.place||null,units:add.units?Number(add.units):null,notes:add.notes||null}).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message);setAdd(null);load()
    undoToast('Added to history',async()=>{const x=await supabase.from('donor_events').delete().eq('id',r.data.id);if(x.error)throw x.error;load()})}
  const del=async t=>{const {data:row}=await supabase.from('donor_events').select('*').eq('id',t.id).single();const r=await supabase.from('donor_events').delete().eq('id',t.id);if(r.error)return toast.error(r.error.message);load()
    undoToast('Entry removed',async()=>{const x=await supabase.from('donor_events').insert(row);if(x.error)throw x.error;load()})}
  if(!h)return <div className="space-y-3">{[0,1,2].map(i=><div key={i} className="skeleton h-12"/>)}</div>
  const s=h.stats,gives=['outside_donation','emergency_donation'].includes(add?.kind)
  return <div>
    <div className="mb-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">{[['Donations',s.donations,true],['Lives helped',s.donations*3,true],['Camps',s.camps],['Deferred',s.deferred],['Missed',s.no_show],['Messages',s.messages]].map(([l,v,b])=>
      <div key={l} className="tile py-2.5"><div className={`text-lg font-semibold tabular-nums ${b?'text-blood':'text-fg'}`}>{v}</div><div className="text-[11px] text-fog-muted">{l}</div></div>)}</div>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-fog-muted"><span>First donation <b className="text-fg">{fmt(s.first)}</b></span><span>·</span><span>Last <b className="text-fg">{fmt(s.last)}</b></span><span>·</span><span>{s.ml} ml at our camps</span><div className="flex-1"/>
      <button className="btn-quiet px-3 py-1.5 text-xs" onClick={()=>donorHistoryPdf(brand,donor,h).catch(e=>toast.error(errText(e)))}><FileText size={14}/>History PDF</button>
      <button className="btn-quiet px-3 py-1.5 text-xs" onClick={()=>bloodDonorCard(donor,s,brand,'card').catch(e=>toast.error(errText(e)))}><IdCard size={14}/>Donor card</button>
      {!add&&<button className="btn px-3 py-1.5 text-xs" onClick={()=>setAdd({kind:'outside_donation',event_date:todayIso(),place:'',units:1,notes:''})}><Plus size={14}/>Add to history</button>}</div>
    {add&&<form onSubmit={save} className="tile mb-4 grid gap-3 p-3 sm:grid-cols-2">
      <Field label="What happened" required><select className="input" value={add.kind} onChange={e=>setAdd({...add,kind:e.target.value})}>{KINDS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Date" required><input type="date" className="input" required max={todayIso()} value={add.event_date} onChange={e=>setAdd({...add,event_date:e.target.value})}/></Field>
      {gives&&<><Field label="Where" required hint="Hospital or blood bank"><input className="input" required value={add.place} onChange={e=>setAdd({...add,place:e.target.value})}/></Field>
        <Field label="Units"><input type="number" min="1" max="4" className="input" value={add.units} onChange={e=>setAdd({...add,units:e.target.value})}/></Field></>}
      <Field label="Notes" className="sm:col-span-2"><input className="input" value={add.notes} onChange={e=>setAdd({...add,notes:e.target.value})}/></Field>
      <div className="flex gap-2 sm:col-span-2"><button className="btn" disabled={busy}>{busy?'Saving…':'Save'}</button><button type="button" className="btn-quiet" onClick={()=>setAdd(null)}>Cancel</button></div></form>}
    <ol className="relative ml-4 border-l-2 border-ink-700 pl-6">{h.timeline.map((t,i)=>{const I=icon(t)
      return <motion.li key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:Math.min(i,12)*.035}} className="relative pb-5 last:pb-0">
        <span className={`absolute -left-[37px] top-0 grid h-7 w-7 place-items-center rounded-full ring-4 ring-ink-900 ${color(t)}`}><I size={14}/></span>
        <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-xs font-medium text-fog-faint">{fmt(t.date)}{t.camp_no?` · ${code('C',t.camp_no,3)}`:''}{t.token?` · ${code('T',t.token,3)}`:''}{t.event_no?` · ${code('H',t.event_no,4)}`:''}</div>
          <div className="text-sm text-fg">{timelineText(t)}</div>
          {t.type==='camp'&&(t.hb||t.bp)&&<div className="mt-0.5 text-xs text-fog-muted">Hb {t.hb??'-'} · BP {t.bp??'-'} · weight {t.weight??'-'} kg · pulse {t.pulse??'-'}</div>}
          {t.by&&<div className="text-xs text-fog-faint">by {t.by}</div>}</div>
          {t.type==='event'&&<button className="btn-ghost text-fog-faint hover:text-blood" aria-label="Remove entry" onClick={()=>del(t)}><Trash2 size={14}/></button>}</div>
      </motion.li>})}</ol>
  </div>
}
