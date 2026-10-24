import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Plus,PartyPopper,CalendarDays,MapPin,Users,QrCode,Printer,UserCheck,Trash2,Copy,Search,Link2,MessageCircle} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Tabs,Badge,Empty,useLive,undoToast,code,errText,todayIso,Toggle} from '../components/ui'
import {entryPasses} from '../lib/cards'
import {brandQr} from '../lib/qr'
import {siteUrl,enqueue} from '../lib/wa'
import WaSend,{WaBulk} from '../components/wa/WaSend'

const KINDS=['Installation','Fundraiser','Fellowship','Workshop','Awareness','Sports','Other']
const ROLES=['Guest','Member','Volunteer','Speaker','Chief guest','Media','Organiser','Participant']
const ST={planned:['Planned','blue'],open:['Registration open','green'],done:['Done','neutral'],cancelled:['Cancelled','neutral']}
const empty=()=>({title:'',kind:'Fellowship',event_date:todayIso(),start_time:'',end_time:'',venue:'',capacity:'',open_registration:false,fee:'',description:'',status:'planned'})
const t5=t=>t?String(t).slice(0,5):''

function People({ev}){
  const {brand}=useBrand(),[rows,setRows]=useState(null),[f,setF]=useState({name:'',phone:'',role:'Guest',organisation:''}),[q,setQ]=useState(''),[busy,setBusy]=useState('')
  const load=()=>supabase.from('event_people').select('*').eq('event_id',ev.id).order('pass_no').then(({data})=>setRows(data||[]))
  useEffect(()=>{load()},[ev.id]);useLive(['event_people'],load)
  const add=async e=>{e.preventDefault();const r=await supabase.from('event_people').insert({event_id:ev.id,name:f.name,phone:f.phone||null,role:f.role,organisation:f.organisation||null});if(r.error)return toast.error(r.error.message);setF({...f,name:'',phone:'',organisation:''});load()}
  const members=async()=>{const {data}=await supabase.from('members').select('id,full_name,phone').is('deleted_at',null).eq('status','active');const have=new Set((rows||[]).map(r=>r.member_id))
    const todo=(data||[]).filter(m=>!have.has(m.id));if(!todo.length)return toast('All active members are already on the list')
    for(const m of todo){const r=await supabase.from('event_people').insert({event_id:ev.id,name:m.full_name,phone:m.phone||null,role:'Member',member_id:m.id});if(r.error)return toast.error(r.error.message)}
    toast.success(`${todo.length} members added`);load()}
  const checkin=async p=>{const r=await supabase.from('event_people').update({checked_in_at:p.checked_in_at?null:new Date().toISOString()}).eq('id',p.id);if(r.error)toast.error(r.error.message);load()}
  const del=async p=>{const r=await supabase.from('event_people').delete().eq('id',p.id);if(r.error)return toast.error(r.error.message);load()
    undoToast(`${p.name} removed`,async()=>{await supabase.from('event_people').insert(p);load()})}
  const passMsg=p=>`Hello ${p.name}, you are on the list for ${ev.title} on ${fmt(ev.event_date)}${ev.start_time?` at ${t5(ev.start_time)}`:''}${ev.venue?`, ${ev.venue}`:''}. Your entry pass number is ${code('E',p.pass_no,3)}. Please show it at the entry. - ${brand.club_name||''}`
  const withPhone=(rows||[]).filter(p=>/^[6-9]\d{9}$/.test(p.phone||''))
  const sendPasses=manual=>enqueue(`Passes · ${ev.title}`,'event_pass',withPhone.map(p=>({phone:p.phone,name:p.name,member_id:p.member_id||'',ref:`${ev.id}:${p.pass_no}`,body:passMsg(p)})),null,manual)
  const passes=async()=>{setBusy('p');try{await entryPasses(rows.map(p=>({role:p.role,name:p.name,desk:p.organisation,no:code('E',p.pass_no,3)})),{name:ev.title,date:ev.event_date,venue:ev.venue},brand,'sheet')}catch(e){toast.error(errText(e))}setBusy('')}
  const list=(rows||[]).filter(p=>!q||`${p.name} ${p.phone} ${p.pass_no}`.toLowerCase().includes(q.toLowerCase())),inN=(rows||[]).filter(p=>p.checked_in_at).length
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2 text-center">{[['On the list',rows?.length??0],['Checked in',inN],['Capacity',ev.capacity||'-']].map(([l,v])=><div key={l} className="tile py-2"><div className="text-lg font-semibold text-fg">{v}</div><div className="text-[11px] text-fog-muted">{l}</div></div>)}</div>
    <form onSubmit={add} className="tile grid gap-2 p-3 sm:grid-cols-[1fr_130px_130px_auto] sm:items-end">
      <Field label="Name"><input className="input" required minLength={2} value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
      <Field label="Mobile"><input className="input" inputMode="numeric" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field>
      <Field label="Role"><select className="input" value={f.role} onChange={e=>setF({...f,role:e.target.value})}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></Field>
      <button className="btn"><Plus size={15}/>Add</button></form>
    <div className="flex flex-wrap gap-2"><button className="btn-quiet px-3 py-1.5 text-xs" onClick={members}><Users size={13}/>Add all members</button>
      <button className="btn-quiet px-3 py-1.5 text-xs" disabled={!rows?.length||!!busy} onClick={passes}><Printer size={13}/>{busy?'Preparing…':'Entry passes'}</button>
      <WaBulk count={withPhone.length} label={`WhatsApp ${withPhone.length} pass${withPhone.length===1?"":"es"}`} size="px-3 py-1.5 text-xs" autoClass="btn-quiet" manualClass="btn-quiet" onQueue={sendPasses}/>
      <div className="relative ml-auto"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input py-1.5 pl-8 text-sm" placeholder="Find" value={q} onChange={e=>setQ(e.target.value)}/></div></div>
    <ul className="divide-y divide-ink-700/80">{list.map(p=><li key={p.id} className="flex items-center gap-3 py-2 text-sm">
      <span className="code">{code('E',p.pass_no,3)}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-fg">{p.name}</span><span className="block truncate text-xs text-fog-faint">{p.role}{p.phone?` · ${p.phone}`:''}{p.organisation?` · ${p.organisation}`:''}{p.self_registered?' · registered online':''}</span></span>
      {/^[6-9]\d{9}$/.test(p.phone||'')&&<WaSend className="btn-ghost" title={`WhatsApp pass to ${p.name}`} kind="event_pass" refId={`${ev.id}:${p.pass_no}`} memberId={p.member_id} phone={p.phone} name={p.name} text={passMsg(p)}><MessageCircle size={14}/></WaSend>}
      <button className={`btn px-2.5 py-1 text-xs ${p.checked_in_at?'bg-ok hover:bg-ok/90':''}`} onClick={()=>checkin(p)}><UserCheck size={13}/>{p.checked_in_at?'In':'Check in'}</button>
      <button className="btn-ghost text-fog-faint hover:text-blood" aria-label={`Remove ${p.name}`} onClick={()=>del(p)}><Trash2 size={14}/></button></li>)}</ul></div>
}

export default function Events(){
  const {brand}=useBrand(),[rows,setRows]=useState(null),[form,setForm]=useState(null),[tab,setTab]=useState('details'),[busy,setBusy]=useState(false),[qr,setQr]=useState('')
  const load=async()=>{const r=await supabase.from('events').select('*,event_people(count)').is('deleted_at',null).order('event_date',{ascending:false});if(r.error)return toast.error(r.error.message);setRows(r.data)}
  useEffect(()=>{load()},[]);useLive(['events','event_people'],load)
  const link=id=>`${siteUrl()}#/event/${id}`
  const open=e=>{setTab(e?'people':'details');setQr('');setForm(e?{...empty(),...Object.fromEntries(Object.entries(e).filter(([k])=>k!=='event_people').map(([k,v])=>[k,v??'']))}:empty());if(e?.open_registration)brandQr(link(e.id),brand,{size:480,quiet:2}).then(setQr)}
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true);const {id,event_no,created_at,created_by,deleted_at,deleted_by,...rest}=form
    const row=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v===''?null:v]))
    const r=id?await supabase.from('events').update(row).eq('id',id).select().single():await supabase.from('events').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message);toast.success(id?'Event saved':`Event ${code('EV',r.data.event_no,3)} created`);load();open(r.data)}
  const del=async()=>{const id=form.id;await supabase.from('events').update({deleted_at:new Date().toISOString()}).eq('id',id);setForm(null);load();undoToast('Event removed',async()=>{await supabase.from('events').update({deleted_at:null}).eq('id',id);load()})}
  const up=(rows||[]).filter(e=>e.event_date>=todayIso()),past=(rows||[]).filter(e=>e.event_date<todayIso())
  const Card=({e})=>{const d=new Date(e.event_date);return <button onClick={()=>open(e)} className="card flex items-center gap-4 p-4 text-left transition hover:border-ink-500">
    <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-brand/10 py-1.5 text-center"><div className="text-[10px] font-semibold uppercase text-fog-muted">{d.toLocaleDateString('en-IN',{month:'short'})}</div><div className="font-display text-xl font-semibold text-fg">{d.getDate()}</div></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold text-fg">{e.title}</span><Badge tone={ST[e.status][1]}>{ST[e.status][0]}</Badge></div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fog-muted"><span>{e.kind}</span>{e.start_time&&<span>{t5(e.start_time)}</span>}{e.venue&&<span><MapPin size={11} className="mr-1 inline"/>{e.venue}</span>}<span><Users size={11} className="mr-1 inline"/>{e.event_people?.[0]?.count||0}{e.capacity?` / ${e.capacity}`:''}</span></div></div></button>}
  return <div>
    <PageHeader eyebrow="Club" title="Club events" description="Installation, fundraisers, workshops and fellowship: guest list, online registration, entry passes and check-in." actions={<button className="btn" onClick={()=>open(null)}><Plus size={16}/>New event</button>}/>
    {rows&&!rows.length?<div className="card"><Empty icon={PartyPopper} title="No events yet" action={<button className="btn" onClick={()=>open(null)}><Plus size={16}/>New event</button>}>Plan the installation ceremony or a fundraiser. Share a registration link, print passes and check people in at the door.</Empty></div>
    :<div className="space-y-6">{up.length>0&&<section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fog-muted">Coming up</h2><div className="grid gap-3 md:grid-cols-2">{up.reverse().map(e=><Card key={e.id} e={e}/>)}</div></section>}
      {past.length>0&&<section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fog-muted">Past</h2><div className="grid gap-3 md:grid-cols-2">{past.map(e=><Card key={e.id} e={e}/>)}</div></section>}</div>}
    <Drawer open={!!form} onClose={()=>setForm(null)} width="max-w-2xl" title={form?.id?`${code('EV',form.event_no,3)} · ${form.title}`:'New event'} description={form?.id?`${fmt(form.event_date)}${form.venue?` · ${form.venue}`:''}`:'Fields marked * are required.'}
      footer={form&&tab==='details'&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={del}><Trash2 size={15}/>Remove</button>}<button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="event-form" disabled={busy}>{form.id?'Save':'Create event'}</button></>}>
      {form&&<>{form.id&&<Tabs id="ev-tabs" value={tab} onChange={setTab} tabs={[['people','Guest list'],['details','Details'],...(form.open_registration?[['share','Registration link']]:[])]}/>}
        {tab==='people'&&form.id&&<People ev={form}/>}
        {tab==='share'&&form.id&&<div className="flex flex-col items-center gap-4 text-center">{qr?<img src={qr} alt="Registration QR code" className="h-64 w-64 rounded-2xl bg-white p-2"/>:<div className="skeleton h-64 w-64"/>}
          <div className="break-all font-mono text-xs text-fog-muted">{link(form.id)}</div>
          <div className="flex gap-2"><button className="btn-quiet" onClick={()=>navigator.clipboard?.writeText(link(form.id)).then(()=>toast.success('Link copied'))}><Copy size={15}/>Copy link</button>{qr&&<a className="btn-quiet" href={qr} download={`event-${form.event_no}-qr.png`}><QrCode size={15}/>Download QR</a>}</div></div>}
        {tab==='details'&&<form id="event-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" required className="sm:col-span-2"><input className="input" required minLength={3} value={form.title} onChange={set('title')}/></Field>
          <Field label="Type"><select className="input" value={form.kind} onChange={set('kind')}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={set('status')}>{Object.entries(ST).map(([k,[l]])=><option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Date" required><input type="date" className="input" required value={form.event_date} onChange={set('event_date')}/></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="From"><input type="time" className="input" value={t5(form.start_time)} onChange={set('start_time')}/></Field><Field label="To"><input type="time" className="input" value={t5(form.end_time)} onChange={set('end_time')}/></Field></div>
          <Field label="Venue"><input className="input" value={form.venue} onChange={set('venue')}/></Field>
          <Field label="Most people" hint="Leave empty for no limit"><input type="number" min="1" className="input" value={form.capacity} onChange={set('capacity')}/></Field>
          <Field label="Entry fee (Rs.)"><input type="number" min="0" className="input" value={form.fee} onChange={set('fee')}/></Field>
          <label className="mt-6 flex items-center gap-3 text-sm text-fog"><Toggle checked={!!form.open_registration} label="Online registration" onChange={v=>setForm({...form,open_registration:v})}/>Anyone with the link can register</label>
          <Field label="About the event" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={form.description} onChange={set('description')}/></Field></form>}</>}
    </Drawer>
  </div>
}
