// Club trips: who is going, what each person pays, every expense, and what is left at the end.
import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Plus,Search,Bus,Trash2,FileText,Users,Receipt,Wallet,CheckCircle2,UserPlus,MapPin,CalendarDays} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,useLive,undoToast,code,errText,Tabs,useConfirm} from '../components/ui'
import {buildPdf,rs} from '../lib/docpdf'
import WaSend from '../components/wa/WaSend'

const STATUS=[['planned','Planned','blue'],['ongoing','On the trip','amber'],['completed','Completed','green'],['cancelled','Cancelled','neutral']]
const CATS=['Travel','Stay','Food','Tickets and entry','Guide','Shopping and gifts','Medical','Other']
const MODES=['Cash','UPI','Bank transfer','Cheque','Card']
const KIND=[['member','Member'],['family','Family'],['guest','Guest']]
const today=()=>new Date().toLocaleDateString('en-CA')
const empty={title:'',destination:'',start_date:'',end_date:'',purpose:'',per_head:'',budget:'',club_share:'',status:'planned',notes:''}
const num=v=>Number(v||0)

// money position of one trip
export function tripMoney(t,people=[],exp=[]){
  const due=people.reduce((a,p)=>a+num(p.share??t.per_head),0),paid=people.reduce((a,p)=>a+num(p.paid),0),spent=exp.reduce((a,e)=>a+num(e.amount),0)
  const funds=paid+num(t.club_share),balance=funds-spent,perHead=people.length?spent/people.length:0
  return {due,paid,pending:Math.max(0,due-paid),spent,funds,balance,perHead,budgetLeft:t.budget?num(t.budget)-spent:null}}

function TripView({trip,brand,onEdit,onClose}){
  const confirm=useConfirm()
  const [tab,setTab]=useState('people'),[people,setPeople]=useState([]),[exp,setExp]=useState([]),[members,setMembers]=useState([])
  const [p,setP]=useState({member_id:'',name:'',phone:'',kind:'member'}),[e,setE]=useState({spent_on:today(),category:'Travel',description:'',amount:'',paid_by:'',mode:'Cash',reference:''})
  const load=()=>{supabase.from('trip_people').select('*').eq('trip_id',trip.id).order('created_at').then(({data})=>setPeople(data||[]))
    supabase.from('trip_expenses').select('*').eq('trip_id',trip.id).order('spent_on').order('created_at').then(({data})=>setExp(data||[]))}
  useEffect(()=>{load();supabase.from('members').select('id,full_name,phone').is('deleted_at',null).eq('status','active').order('full_name').then(({data})=>setMembers(data||[]))},[trip.id])
  useLive(['trip_people','trip_expenses'],load)
  const m=tripMoney(trip,people,exp)
  const addPerson=async ev=>{ev.preventDefault();const mem=members.find(x=>x.id===p.member_id),name=(mem?.full_name||p.name).trim()
    if(name.length<2)return toast.error('Choose a member or type a name')
    const {error}=await supabase.from('trip_people').insert({trip_id:trip.id,member_id:mem?.id||null,name,phone:(mem?.phone||p.phone||'').replace(/\D/g,'').slice(-10)||null,kind:mem?'member':p.kind})
    if(error)return toast.error(error.code==='23505'?`${name} is already on this trip`:errText(error));setP({member_id:'',name:'',phone:'',kind:'member'});load()}
  const addAll=async()=>{const have=new Set(people.map(x=>x.member_id)),rows=members.filter(x=>!have.has(x.id)).map(x=>({trip_id:trip.id,member_id:x.id,name:x.full_name,phone:x.phone,kind:'member'}))
    if(!rows.length)return toast.message('Every active member is already on the list');const {error}=await supabase.from('trip_people').insert(rows);if(error)return toast.error(errText(error));toast.success(`${rows.length} members added`);load()}
  const upd=async(row,patch)=>{setPeople(l=>l.map(x=>x.id===row.id?{...x,...patch}:x));const {error}=await supabase.from('trip_people').update(patch).eq('id',row.id);if(error){toast.error(errText(error));load()}}
  const delPerson=async row=>{if(!await confirm({title:`Take ${row.name} off the trip?`,body:row.paid>0?`They have paid ${rs(row.paid)}. Note the refund before removing.`:'',action:'Remove'}))return
    const {id,...rest}=row;const {error}=await supabase.from('trip_people').delete().eq('id',id);if(error)return toast.error(errText(error));load()
    undoToast(`${row.name} removed`,async()=>{const x=await supabase.from('trip_people').insert({...rest,id});if(x.error)throw x.error;load()})}
  const addExp=async ev=>{ev.preventDefault();if(!(num(e.amount)>0))return toast.error('Enter the amount')
    const {error}=await supabase.from('trip_expenses').insert({...Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v===''?null:v])),trip_id:trip.id,amount:num(e.amount)})
    if(error)return toast.error(errText(error));toast.success(`${rs(e.amount)} added`);setE({...e,description:'',amount:'',reference:''});load()}
  const delExp=async x=>{const {id,...rest}=x;const {error}=await supabase.from('trip_expenses').delete().eq('id',id);if(error)return toast.error(errText(error));load()
    undoToast(`${rs(x.amount)} removed`,async()=>{const r=await supabase.from('trip_expenses').insert({...rest,id});if(r.error)throw r.error;load()})}
  const share=x=>num(x.share??trip.per_head)
  const pdf=()=>buildPdf({title:'Trip statement',heading:trip.title,subtitle:[trip.destination,`${fmt(trip.start_date)}${trip.end_date&&trip.end_date!==trip.start_date?` to ${fmt(trip.end_date)}`:''}`].filter(Boolean).join('  ·  '),
    docNo:code('TR',trip.trip_no,3),brand,footer:`Trip statement ${code('TR',trip.trip_no,3)}`,filename:`trip-${code('TR',trip.trip_no,3)}.pdf`,blocks:[
      {type:'stats',items:[['People',people.length],['Collected',rs(m.paid)],['Spent',rs(m.spent),'blood'],[m.balance>=0?'Left over':'Short by',rs(Math.abs(m.balance))]]},
      {type:'table',heading:'Who is going and what they paid',columns:['#','Name','Type','Share','Paid','Still to pay'],rows:people.map((x,i)=>[i+1,x.name,KIND.find(k=>k[0]===x.kind)?.[1],rs(share(x)),rs(x.paid),share(x)>num(x.paid)?rs(share(x)-num(x.paid)):'-']),
        opts:{columnStyles:{0:{cellWidth:9},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'}},foot:[['','Total','',rs(m.due),rs(m.paid),rs(m.pending)]]}},
      {type:'table',heading:'Expenses',columns:['Date','Category','Details','Paid by','Amount'],rows:exp.map(x=>[fmt(x.spent_on),x.category,[x.description,x.reference].filter(Boolean).join(' · '),x.paid_by||'',rs(x.amount)]),
        opts:{columnStyles:{4:{halign:'right'}},foot:[['','','','Total',rs(m.spent)]]}},
      {type:'table',heading:'Spent, by category',columns:['Category','Amount','Share'],rows:CATS.map(c=>[c,exp.filter(x=>x.category===c).reduce((a,x)=>a+num(x.amount),0)]).filter(r=>r[1]>0).map(([c,a])=>[c,rs(a),m.spent?`${Math.round(a/m.spent*100)}%`:'']),opts:{columnStyles:{1:{halign:'right'},2:{halign:'right'}}}},
      {type:'totals',rows:[['Collected from people',rs(m.paid)],['From club funds',rs(trip.club_share)],['Total money',rs(m.funds)],['Spent',rs(m.spent)],['Cost per person',rs(Math.round(m.perHead))]],final:[m.balance>=0?'Left over':'Short by',rs(Math.abs(m.balance))],negative:m.balance<0},
      {type:'signatures',items:[['','Trip coordinator'],[brand.signatory2_name,brand.signatory2_title||'Treasurer'],[brand.signatory_name,brand.signatory_title||'President']]}]}).catch(err=>toast.error(errText(err)))
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['People',people.length],['Collected',rs(m.paid)],['Spent',rs(m.spent)],[m.balance>=0?'Left over':'Short by',rs(Math.abs(m.balance))]].map(([l,v],i)=>
      <div key={l} className={`rounded-xl p-3 ${i===3?(m.balance>=0?'bg-ok/10':'bg-blood/10'):'bg-ink-800'}`}><div className={`font-display text-lg font-semibold tabular-nums ${i===3?(m.balance>=0?'text-ok':'text-blood'):'text-fg'}`}>{v}</div><div className="text-[11px] text-fog-faint">{l}</div></div>)}</div>
    {m.pending>0&&<p className="text-sm text-warn">{rs(m.pending)} still to be collected from {people.filter(x=>share(x)>num(x.paid)).length} people.</p>}
    {trip.budget>0&&<div><div className="flex justify-between text-xs text-fog-faint"><span>Budget used</span><span>{rs(m.spent)} of {rs(trip.budget)}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700"><div className={`h-full rounded-full ${m.spent>trip.budget?'bg-blood':'bg-brand'}`} style={{width:Math.min(100,m.spent/trip.budget*100)+'%'}}/></div></div>}
    <div className="flex flex-wrap items-center gap-2"><div className="flex-1"><Tabs id="trip-tabs" value={tab} onChange={setTab} tabs={[['people',`People · ${people.length}`],['expenses',`Expenses · ${exp.length}`]]}/></div>
      <button className="btn-quiet" onClick={pdf}><FileText size={15}/>Statement PDF</button><button className="btn-quiet" onClick={onEdit}>Edit trip</button></div>
    {tab==='people'&&<>
      <form onSubmit={addPerson} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
        <select className="input py-1.5" aria-label="Member" value={p.member_id} onChange={ev=>setP({...p,member_id:ev.target.value})}><option value="">Guest or family (type below)</option>{members.filter(x=>!people.some(y=>y.member_id===x.id)).map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
        {!p.member_id&&<><input className="input py-1.5" aria-label="Name" placeholder="Name" value={p.name} onChange={ev=>setP({...p,name:ev.target.value})}/>
          <select className="input py-1.5" aria-label="Type" value={p.kind} onChange={ev=>setP({...p,kind:ev.target.value})}>{KIND.filter(k=>k[0]!=='member').map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></>}
        <button className={`btn py-1.5 ${p.member_id?'sm:col-span-3 sm:justify-self-start':''}`}><UserPlus size={15}/>Add</button></form>
      <button className="btn-ghost text-xs" onClick={addAll}><Users size={14}/>Add every active member</button>
      <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{people.map(x=>{const due=share(x)-num(x.paid)
        return <li key={x.id} className="grid gap-2 p-3 sm:grid-cols-[1.3fr_100px_100px_110px_auto] sm:items-center">
          <div className="min-w-0"><div className="truncate font-medium text-fg">{x.name}</div><div className="text-xs text-fog-faint">{KIND.find(k=>k[0]===x.kind)?.[1]}{x.phone?` · ${x.phone}`:''}{x.paid_on?` · paid ${fmt(x.paid_on)}`:''}</div></div>
          <label className="text-[11px] text-fog-faint">Share<input className="input mt-0.5 py-1 text-sm" type="number" min="0" aria-label={`Share for ${x.name}`} placeholder={trip.per_head??''} defaultValue={x.share??''} onBlur={ev=>{const v=ev.target.value===''?null:num(ev.target.value);if(v!==x.share)upd(x,{share:v})}}/></label>
          <label className="text-[11px] text-fog-faint">Paid<input className="input mt-0.5 py-1 text-sm" type="number" min="0" aria-label={`Paid by ${x.name}`} defaultValue={x.paid||''} key={x.paid} onBlur={ev=>{const v=num(ev.target.value);if(v!==num(x.paid))upd(x,{paid:v,paid_on:v>0?(x.paid_on||today()):null})}}/></label>
          <select className="input mt-3.5 py-1 text-sm" aria-label={`Mode for ${x.name}`} value={x.mode||''} onChange={ev=>upd(x,{mode:ev.target.value||null})}><option value="">Mode</option>{MODES.map(k=><option key={k}>{k}</option>)}</select>
          <div className="flex items-center justify-end gap-1 sm:mt-3.5">{due>0?<button className="btn-quiet px-2 py-1 text-xs" onClick={()=>upd(x,{paid:share(x),paid_on:today()})}><CheckCircle2 size={13}/>Paid {rs(due)}</button>:<Badge tone="green">Paid</Badge>}
            {due>0&&x.phone&&<WaSend className="btn-ghost px-2 text-xs" title="Remind on WhatsApp" phone={x.phone} name={x.name} kind="direct" text={`Hello ${x.name}, a reminder for the club trip "${trip.title}"${trip.start_date?` on ${fmt(trip.start_date)}`:''}: ${rs(due)} is still to be paid. Thank you!`}>Remind</WaSend>}
            <button className="btn-ghost p-1.5 text-fog-faint hover:text-blood" aria-label={`Remove ${x.name}`} onClick={()=>delPerson(x)}><Trash2 size={14}/></button></div></li>})}
        {!people.length&&<li className="p-6 text-center text-sm text-fog-faint">Add the members and guests going on this trip.</li>}</ul></>}
    {tab==='expenses'&&<>
      <form onSubmit={addExp} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-6">
        <input className="input py-1.5" type="date" aria-label="Date" value={e.spent_on} onChange={ev=>setE({...e,spent_on:ev.target.value})}/>
        <select className="input py-1.5" aria-label="Category" value={e.category} onChange={ev=>setE({...e,category:ev.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
        <input className="input py-1.5 sm:col-span-2" aria-label="Details" placeholder="Details (bus rent, hotel …)" value={e.description} onChange={ev=>setE({...e,description:ev.target.value})}/>
        <input className="input py-1.5" type="number" min="1" step="0.01" aria-label="Amount" placeholder="Amount" value={e.amount} onChange={ev=>setE({...e,amount:ev.target.value})}/>
        <input className="input py-1.5" aria-label="Paid by" placeholder="Paid by" value={e.paid_by} onChange={ev=>setE({...e,paid_by:ev.target.value})}/>
        <select className="input py-1.5" aria-label="Payment mode" value={e.mode} onChange={ev=>setE({...e,mode:ev.target.value})}>{MODES.map(k=><option key={k}>{k}</option>)}</select>
        <input className="input py-1.5 sm:col-span-2" aria-label="Bill or reference" placeholder="Bill no. / UPI ref (optional)" value={e.reference} onChange={ev=>setE({...e,reference:ev.target.value})}/>
        <button className="btn py-1.5"><Plus size={15}/>Add expense</button></form>
      <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{exp.map(x=><li key={x.id} className="flex items-center gap-3 p-3 text-sm">
        <span className="w-20 shrink-0 text-xs text-fog-faint">{fmt(x.spent_on)}</span><span className="min-w-0 flex-1"><span className="block truncate text-fg">{x.description||x.category}</span><span className="text-xs text-fog-faint">{x.category}{x.paid_by?` · paid by ${x.paid_by}`:''}{x.mode?` · ${x.mode}`:''}{x.reference?` · ${x.reference}`:''}</span></span>
        <b className="tabular-nums text-fg">{rs(x.amount)}</b><button className="btn-ghost p-1.5 text-fog-faint hover:text-blood" aria-label={`Delete expense ${x.description||x.category}`} onClick={()=>delExp(x)}><Trash2 size={14}/></button></li>)}
        {!exp.length&&<li className="p-6 text-center text-sm text-fog-faint">No expenses yet. Add bus, stay, food and tickets as you spend.</li>}</ul>
      {exp.length>0&&<div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{CATS.map(c=>[c,exp.filter(x=>x.category===c).reduce((a,x)=>a+num(x.amount),0)]).filter(r=>r[1]>0).map(([c,a])=><div key={c} className="rounded-lg bg-ink-800 px-3 py-2"><div className="text-xs text-fog-faint">{c}</div><div className="font-semibold tabular-nums text-fg">{rs(a)}</div></div>)}</div>}
      {people.length>0&&exp.length>0&&<p className="text-sm text-fog-muted">Cost per person so far: <b className="text-fg">{rs(Math.round(m.perHead))}</b>{trip.per_head?` (collected ${rs(trip.per_head)} each)`:''}.</p>}</>}
  </div>}

export default function Trips(){
  const {brand}=useBrand(),confirm=useConfirm()
  const [rows,setRows]=useState(null),[sums,setSums]=useState({}),[q,setQ]=useState(''),[form,setForm]=useState(null),[view,setView]=useState(null),[busy,setBusy]=useState(false)
  const load=async()=>{const {data,error}=await supabase.from('club_trips').select('*').is('deleted_at',null).order('start_date',{ascending:false});if(error)return toast.error(errText(error));setRows(data)
    const [p,e]=await Promise.all([supabase.from('trip_people').select('trip_id,share,paid'),supabase.from('trip_expenses').select('trip_id,amount')])
    const s={};for(const t of data){s[t.id]=tripMoney(t,(p.data||[]).filter(x=>x.trip_id===t.id),(e.data||[]).filter(x=>x.trip_id===t.id));s[t.id].n=(p.data||[]).filter(x=>x.trip_id===t.id).length}setSums(s)}
  useEffect(()=>{load()},[]);useLive(['club_trips','trip_people','trip_expenses'],load)
  const list=useMemo(()=>(rows||[]).filter(t=>!q||`${t.title} ${t.destination}`.toLowerCase().includes(q.toLowerCase())),[rows,q])
  const set=f=>e=>setForm({...form,[f]:e.target.value})
  const save=async e=>{e.preventDefault();if(form.end_date&&form.end_date<form.start_date)return toast.error('The return date is before the start date')
    setBusy(true);const {id,trip_no,created_at,created_by,deleted_at,deleted_by,...rest}=form
    const row=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v===''?null:v]));row.club_share=num(row.club_share)
    const r=id?await supabase.from('club_trips').update(row).eq('id',id).select().single():await supabase.from('club_trips').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(errText(r.error));toast.success(id?'Trip saved':`Trip ${code('TR',r.data.trip_no,3)} created`);setForm(null);load();if(!id)setView(r.data);else if(view?.id===id)setView(r.data)}
  const del=async()=>{if(!await confirm({title:`Delete ${form.title}?`,body:'It moves to the Recycle bin with its people and expenses.',action:'Delete'}))return
    const id=form.id;const r=await supabase.from('club_trips').update({deleted_at:new Date().toISOString()}).eq('id',id);if(r.error)return toast.error(errText(r.error));setForm(null);setView(null);load()
    undoToast('Trip deleted',async()=>{await supabase.from('club_trips').update({deleted_at:null}).eq('id',id);load()})}
  const edit=t=>setForm({...empty,...Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v??'']))})
  return <div>
    <PageHeader eyebrow="Club" title="Club trips" description="Trips and outings: who is going, what each person pays, every expense, and what is left at the end."
      actions={<button className="btn" onClick={()=>setForm({...empty,start_date:today()})}><Plus size={16}/>New trip</button>}/>
    <div className="relative mb-4 max-w-md"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" aria-label="Search trips" placeholder="Search trip or place" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {rows===null?<div className="grid gap-4 md:grid-cols-2">{[0,1].map(i=><div key={i} className="skeleton h-36"/>)}</div>
    :!list.length?<div className="card"><Empty icon={Bus} title={rows.length?'Nothing matches':'No trips yet'} action={!rows.length&&<button className="btn" onClick={()=>setForm({...empty,start_date:today()})}><Plus size={16}/>New trip</button>}>Plan a club trip: add who is going, collect their share and note every expense.</Empty></div>
    :<div className="grid grid-cols-1 gap-4 md:grid-cols-2">{list.map(t=>{const s=sums[t.id]||{},st=STATUS.find(x=>x[0]===t.status)
      return <button key={t.id} onClick={()=>setView(t)} className="card text-left transition hover:border-brand/40">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><span className="code">{code('TR',t.trip_no,3)}</span><div className="mt-1 truncate font-display text-lg font-semibold text-fg">{t.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-fog-muted">{t.destination&&<span><MapPin size={13} className="mr-1 inline"/>{t.destination}</span>}<span><CalendarDays size={13} className="mr-1 inline"/>{fmt(t.start_date)}{t.end_date&&t.end_date!==t.start_date?` – ${fmt(t.end_date)}`:''}</span></div></div><Badge tone={st?.[2]}>{st?.[1]}</Badge></div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">{[[Users,s.n??0,'people'],[Wallet,rs(s.paid),'collected'],[Receipt,rs(s.spent),'spent'],[Wallet,rs(Math.abs(s.balance||0)),(s.balance||0)>=0?'left':'short']].map(([I,v,l],i)=>
          <div key={l} className="rounded-lg bg-ink-900/60 px-1 py-2"><div className={`truncate text-sm font-semibold tabular-nums ${i===3&&(s.balance||0)<0?'text-blood':'text-fg'}`}>{v}</div><div className="text-[11px] text-fog-faint">{l}</div></div>)}</div>
        {s.pending>0&&<div className="mt-2 text-xs text-warn">{rs(s.pending)} still to collect</div>}</button>})}</div>}
    <Drawer open={!!view&&!form} onClose={()=>{setView(null);load()}} width="max-w-3xl" title={view?`${code('TR',view.trip_no,3)} · ${view.title}`:''} description={view?[view.destination,fmt(view.start_date)].filter(Boolean).join(' · '):''}>
      {view&&<TripView trip={view} brand={brand} onEdit={()=>edit(view)} onClose={()=>setView(null)}/>}</Drawer>
    <Drawer open={!!form} onClose={()=>setForm(null)} title={form?.id?`Edit ${form.title}`:'New trip'} footer={form&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={del}><Trash2 size={15}/>Delete</button>}<button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="trip-form" disabled={busy}>{busy?'Saving…':'Save trip'}</button></>}>
      {form&&<form id="trip-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Trip name" required className="sm:col-span-2"><input className="input" required minLength={2} placeholder="Annual club trip" value={form.title} onChange={set('title')}/></Field>
        <Field label="Place"><input className="input" placeholder="Kodaikanal" value={form.destination} onChange={set('destination')}/></Field>
        <Field label="Status"><select className="input" value={form.status} onChange={set('status')}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Start date" required><input className="input" type="date" required value={form.start_date} onChange={set('start_date')}/></Field>
        <Field label="Return date"><input className="input" type="date" value={form.end_date} onChange={set('end_date')}/></Field>
        <Field label="Each person pays (Rs.)" hint="Change it for one person on their row"><input className="input" type="number" min="0" value={form.per_head} onChange={set('per_head')}/></Field>
        <Field label="Club pays (Rs.)" hint="From club funds, if any"><input className="input" type="number" min="0" value={form.club_share} onChange={set('club_share')}/></Field>
        <Field label="Budget (Rs.)"><input className="input" type="number" min="0" value={form.budget} onChange={set('budget')}/></Field>
        <Field label="Purpose"><input className="input" placeholder="Fellowship, district event …" value={form.purpose} onChange={set('purpose')}/></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={form.notes} onChange={set('notes')}/></Field></form>}
    </Drawer>
  </div>
}
