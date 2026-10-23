import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Package,Plus,Trash2,FileText,BadgeCheck,Printer} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {Badge,Empty,Field,useLive,undoToast,code,errText} from './ui'
import {buildPdf,rs} from '../lib/docpdf'
import {entryPasses} from '../lib/cards'

const CATS=['Banners and printing','Medical supplies','Refreshments','Certificates and gifts','Stationery','Furniture and setup','Other']
const SOURCES=['To buy','Sponsored','Borrowed','Blood bank','Club stock']
const STATUS=[['needed','Needed','amber'],['arranged','Arranged','blue'],['at venue','At venue','green'],['returned','Returned','neutral']]
// a standard kit for a blood donation camp; quantities are a starting point for about 100 donors
const KIT=[['Flex banner (main entrance)','Banners and printing',1,'nos','To buy'],['Standee with registration QR','Banners and printing',2,'nos','To buy'],['Direction boards','Banners and printing',4,'nos','To buy'],
  ['Donor registration forms','Stationery',150,'nos','Club stock'],['Consent forms','Stationery',150,'nos','Blood bank'],['Pens','Stationery',20,'nos','Club stock'],['Token slips','Stationery',150,'nos','Club stock'],
  ['Certificates (printed)','Certificates and gifts',120,'nos','To buy'],['Mementos for doctors and sponsors','Certificates and gifts',6,'nos','To buy'],
  ['Fruit juice','Refreshments',120,'packs','Sponsored'],['Biscuits','Refreshments',120,'packs','Sponsored'],['Drinking water','Refreshments',10,'cans','Sponsored'],
  ['Donor couches / beds','Medical supplies',6,'nos','Blood bank'],['Blood bags','Medical supplies',120,'nos','Blood bank'],['Hb meter and strips','Medical supplies',1,'set','Blood bank'],['First aid kit','Medical supplies',1,'set','Club stock'],
  ['Tables','Furniture and setup',8,'nos','Borrowed'],['Chairs','Furniture and setup',40,'nos','Borrowed'],['Sound system','Furniture and setup',1,'set','Borrowed']]

export function Materials({camp,canEdit=true}){
  const {brand}=useBrand(),[rows,setRows]=useState(null),[f,setF]=useState({item:'',category:'Banners and printing',qty_needed:1,unit:'nos',source:'To buy',responsible:''}),[cat,setCat]=useState('')
  const load=()=>camp&&supabase.from('camp_materials').select('*').eq('camp_id',camp.id).order('category').order('item_no').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{setRows(null);load()},[camp?.id]);useLive(['camp_materials'],load)
  const add=async e=>{e.preventDefault();const r=await supabase.from('camp_materials').insert({...f,qty_needed:Number(f.qty_needed),camp_id:camp.id});if(r.error)return toast.error(r.error.message);setF({...f,item:'',qty_needed:1,responsible:''});load()}
  const kit=async()=>{const r=await supabase.from('camp_materials').insert(KIT.map(([item,category,qty_needed,unit,source])=>({camp_id:camp.id,item,category,qty_needed,unit,source})));if(r.error)return toast.error(r.error.message);toast.success(`${KIT.length} standard items added. Change the numbers to suit your camp.`);load()}
  const upd=async(m,p)=>{setRows(x=>x.map(y=>y.id===m.id?{...y,...p}:y));const r=await supabase.from('camp_materials').update(p).eq('id',m.id);if(r.error){toast.error(r.error.message);load()}}
  const del=async m=>{const r=await supabase.from('camp_materials').delete().eq('id',m.id);if(r.error)return toast.error(r.error.message);load()
    undoToast(`${m.item} removed`,async()=>{const x=await supabase.from('camp_materials').insert(m);if(x.error)throw x.error;load()})}
  const pdf=()=>buildPdf({title:'Materials list',heading:camp.name,subtitle:`${fmt(camp.camp_date)}${camp.venue?`  ·  ${camp.venue}`:''}`,brand,footer:`Materials · ${camp.name}`,filename:`materials-${String(camp.name).replace(/\W+/g,'-').toLowerCase()}.pdf`,
    blocks:[{type:'stats',items:[['Items',rows.length],['Ready',rows.filter(m=>m.status!=='needed').length],['Still needed',rows.filter(m=>m.status==='needed').length,'blood'],['Cost',rs(rows.reduce((a,m)=>a+Number(m.cost||0),0))]]},
      ...CATS.filter(c=>rows.some(m=>m.category===c)).map(c=>({type:'table',heading:c,columns:['✓','Item','Needed','Ready','Source','Responsible','Status'],
        rows:rows.filter(m=>m.category===c).map(m=>['',m.item,`${Number(m.qty_needed)} ${m.unit||''}`,Number(m.qty_ready)||'',m.source,m.responsible||'',STATUS.find(s=>s[0]===m.status)?.[1]]),
        opts:{columnStyles:{0:{cellWidth:8},2:{halign:'right'},3:{halign:'right'}}}})),
      {type:'signatures',items:[['','Checked by'],['','Camp coordinator']]}]}).catch(e=>toast.error(errText(e)))
  if(!camp)return null
  const shown=(rows||[]).filter(m=>!cat||m.category===cat),need=(rows||[]).filter(m=>m.status==='needed').length
  return <div className="card">
    <div className="mb-4 flex flex-wrap items-center gap-2"><div className="flex-1 text-sm text-fog-muted">{rows?`${rows.length} items · ${need} still needed`:'Loading…'}</div>
      {rows&&!rows.length&&canEdit&&<button className="btn" onClick={kit}><Package size={15}/>Add standard camp kit</button>}
      {rows?.length>0&&<button className="btn-quiet" onClick={pdf}><FileText size={15}/>Materials list PDF</button>}</div>
    {canEdit&&<form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-[1fr_170px_80px_80px_130px_auto]">
      <input className="input" required minLength={2} placeholder="Item" aria-label="Item" value={f.item} onChange={e=>setF({...f,item:e.target.value})}/>
      <select className="input" aria-label="Category" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
      <input className="input" type="number" min="1" step="any" required aria-label="Quantity" value={f.qty_needed} onChange={e=>setF({...f,qty_needed:e.target.value})}/>
      <input className="input" aria-label="Unit" placeholder="nos" value={f.unit} onChange={e=>setF({...f,unit:e.target.value})}/>
      <select className="input" aria-label="Source" value={f.source} onChange={e=>setF({...f,source:e.target.value})}>{SOURCES.map(c=><option key={c}>{c}</option>)}</select>
      <button className="btn"><Plus size={15}/>Add</button></form>}
    {rows?.length>0&&<div className="mb-3 flex flex-wrap gap-2">{['',...CATS.filter(c=>rows.some(m=>m.category===c))].map(c=><button key={c} onClick={()=>setCat(c)} className={`chip ${cat===c?'border-brand/50 bg-brand/15 text-fg':''}`}>{c||'All'}</button>)}</div>}
    {rows&&!rows.length?<Empty icon={Package} title="No materials listed">Add the standard kit, or add items one by one: banners, forms, refreshments, certificates, furniture.</Empty>:
    <ul className="divide-y divide-ink-700/80">{shown.map(m=><li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
      <span className="code">{code('MI',m.item_no,3)}</span><span className="min-w-0 flex-1"><span className="font-medium text-fg">{m.item}</span><span className="block text-xs text-fog-faint">{m.category} · {m.source}{m.responsible?` · ${m.responsible}`:''}</span></span>
      <span className="tabular-nums text-fog-muted">{canEdit?<input className="input w-16 px-2 py-1 text-right" type="number" min="0" step="any" aria-label={`Ready quantity for ${m.item}`} value={m.qty_ready} onChange={e=>upd(m,{qty_ready:Number(e.target.value)})}/>:Number(m.qty_ready)} / {Number(m.qty_needed)} {m.unit}</span>
      {canEdit?<select className="input w-auto px-2 py-1 text-xs" aria-label={`Status of ${m.item}`} value={m.status} onChange={e=>upd(m,{status:e.target.value})}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
        :<Badge tone={STATUS.find(s=>s[0]===m.status)?.[2]}>{STATUS.find(s=>s[0]===m.status)?.[1]}</Badge>}
      {canEdit&&<input className="input w-32 px-2 py-1 text-xs" placeholder="Responsible" aria-label={`Responsible for ${m.item}`} defaultValue={m.responsible||''} onBlur={e=>e.target.value!==(m.responsible||'')&&upd(m,{responsible:e.target.value||null})}/>}
      {canEdit&&<button className="btn-ghost text-fog-faint hover:text-blood" aria-label={`Remove ${m.item}`} onClick={()=>del(m)}><Trash2 size={14}/></button>}</li>)}</ul>}
  </div>
}

export function Passes({camp,volunteers}){
  const {brand}=useBrand(),[busy,setBusy]=useState(''),[blank,setBlank]=useState({role:'Guest',count:9}),[layout,setLayout]=useState('sheet')
  const ev={name:camp.name,date:camp.camp_date,venue:camp.venue}
  const go=async(k,people)=>{setBusy(k);try{await entryPasses(people,ev,brand,layout);toast.success(`${people.length} pass${people.length>1?'es':''} ready`)}catch(e){toast.error(errText(e))}setBusy('')}
  return <div className="card space-y-5">
    <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h3 className="font-semibold text-fg">Entry passes</h3><p className="text-sm text-fog-muted">Badges to wear at the camp, with the camp name, role and a QR code.</p></div>
      <select className="input w-auto" aria-label="Print layout" value={layout} onChange={e=>setLayout(e.target.value)}><option value="sheet">A4 sheet, 9 per page, with cut marks</option><option value="card">One per page, card size</option></select></div>
    <div className="tile flex flex-wrap items-center gap-3 p-4"><BadgeCheck size={20} className="text-brand"/><div className="flex-1"><div className="font-medium text-fg">Volunteer passes</div><div className="text-xs text-fog-muted">{volunteers.length} volunteers with their desk and shift</div></div>
      <button className="btn" disabled={!volunteers.length||!!busy} onClick={()=>go('v',volunteers.map(x=>({role:'Volunteer',name:x.name,desk:x.desk,shift:x.shift,no:code('V',x.volunteer_no,3)})))}><Printer size={15}/>{busy==='v'?'Preparing…':'Volunteer passes'}</button></div>
    <div className="tile grid gap-3 p-4 sm:grid-cols-[1fr_160px_100px_auto] sm:items-end"><div><div className="font-medium text-fg">Blank passes</div><div className="text-xs text-fog-muted">For doctors, guests, media and organisers. Write the name by hand.</div></div>
      <Field label="Role"><select className="input" value={blank.role} onChange={e=>setBlank({...blank,role:e.target.value})}>{['Doctor','Guest','Media','Organiser','Volunteer'].map(r=><option key={r}>{r}</option>)}</select></Field>
      <Field label="How many"><input className="input" type="number" min="1" max="90" value={blank.count} onChange={e=>setBlank({...blank,count:e.target.value})}/></Field>
      <button className="btn-quiet" disabled={!!busy} onClick={()=>go('b',Array.from({length:Math.min(90,Math.max(1,Number(blank.count)||1))},(_,i)=>({role:blank.role,no:`${blank.role[0]}-${String(i+1).padStart(2,'0')}`})))}><Printer size={15}/>{busy==='b'?'Preparing…':'Blank passes'}</button></div>
  </div>
}
