import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Plus,QrCode,MessageCircle,Users,Pencil,Trash2,Copy,Download,MapPin,Clock,Tent,UserPlus} from 'lucide-react'
import QRCode from 'qrcode'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {fmt,wa,slots} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,Tabs,useConfirm,errText} from '../components/ui'

const STATUS=[['planned','Planned'],['open','Registration open'],['live','Live today'],['completed','Completed'],['closed','Closed']]
const TONE={planned:'neutral',open:'blue',live:'red',completed:'green',closed:'neutral'}
const REG=['registered','checked_in','screened','donated','deferred','no_show']
const link=id=>`${location.origin}${location.pathname}#/register/${id}`

function Registrants({camp,onChanged}){
  const {settings}=useAuth(),confirm=useConfirm(),[rows,setRows]=useState(null),[q,setQ]=useState(''),[add,setAdd]=useState(''),[found,setFound]=useState([])
  const load=()=>supabase.from('registrations').select('id,slot,status,donor_id,donors(full_name,phone,blood_group,consent)').eq('camp_id',camp.id).order('slot').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[camp.id])
  useEffect(()=>{if(add.trim().length<2)return setFound([]);const t=setTimeout(async()=>{const s=add.replace(/[%,()]/g,'')
    const {data}=await supabase.from('donors').select('id,full_name,phone,blood_group').or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`).limit(6);setFound(data||[])},200);return()=>clearTimeout(t)},[add])
  const upd=async(id,patch)=>{const {error}=await supabase.from('registrations').update(patch).eq('id',id);if(error)return toast.error(error.message);load();onChanged()}
  const del=async r=>{if(!await confirm({title:`Remove ${r.donors.full_name} from this camp?`,body:'Their screening and donation record for this camp are removed too.',action:'Remove'}))return
    const {error}=await supabase.from('registrations').delete().eq('id',r.id);if(error)return toast.error(error.message);toast.success('Removed from camp');load();onChanged()}
  const enrol=async d=>{const {error}=await supabase.from('registrations').insert({camp_id:camp.id,donor_id:d.id});if(error)return toast.error(error.code==='23505'?'Already registered for this camp':error.message)
    toast.success(`${d.full_name} added`);setAdd('');setFound([]);load();onChanged()}
  const list=(rows||[]).filter(r=>!q||`${r.donors.full_name} ${r.donors.phone}`.toLowerCase().includes(q.toLowerCase()))
  const s=slots(camp.start_time,camp.end_time)
  return <div className="space-y-4">
    <div className="relative"><Field label="Add a donor to this camp"><input className="input" placeholder="Type a name or mobile" value={add} onChange={e=>setAdd(e.target.value)}/></Field>
      {found.length>0&&<div className="absolute z-10 mt-1 w-full rounded-xl border border-ink-600 bg-ink-800 p-1 shadow-2xl">{found.map(d=><button key={d.id} onClick={()=>enrol(d)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-700">
        <UserPlus size={14} className="text-brand"/><span className="flex-1 text-white">{d.full_name}</span><span className="text-fog-faint">{d.blood_group} {d.phone}</span></button>)}</div>}</div>
    <input className="input" placeholder={`Search ${rows?.length??''} registrants`} value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">{list.map(r=><div key={r.id} className="flex flex-wrap items-center gap-2 p-3">
      <div className="min-w-[140px] flex-1"><div className="text-sm font-medium text-white">{r.donors.full_name} <span className="font-display text-blood">{r.donors.blood_group}</span></div><div className="text-xs text-fog-faint">{r.donors.phone}</div></div>
      <select className="input w-auto py-1.5 text-xs" value={r.slot||''} onChange={e=>upd(r.id,{slot:e.target.value||null})}><option value="">Any time</option>{s.map(x=><option key={x}>{x}</option>)}</select>
      <select className="input w-auto py-1.5 text-xs" value={r.status} onChange={e=>upd(r.id,{status:e.target.value})} disabled={['donated','screened','deferred'].includes(r.status)} title="Screening and donation steps are set on Camp day">
        {REG.map(x=><option key={x} value={x} disabled={['screened','donated','deferred'].includes(x)}>{x.replace('_',' ')}</option>)}</select>
      {r.donors.consent&&<a className="btn-ghost" target="_blank" rel="noreferrer" title="Send reminder on WhatsApp" href={wa(r.donors.phone,`Hello ${r.donors.full_name}, reminder: ${camp.name} on ${fmt(camp.camp_date)}${r.slot?' at '+r.slot:''}${camp.venue?', '+camp.venue:''}. Thank you for donating blood. ${settings.club_name}`)}><MessageCircle size={15}/></a>}
      <button className="btn-ghost hover:text-blood" title="Remove from camp" onClick={()=>del(r)}><Trash2 size={15}/></button></div>)}
      {rows&&!list.length&&<div className="p-6 text-center text-sm text-fog-faint">No registrants yet.</div>}</div>
  </div>
}

export default function Camps(){
  const {settings}=useAuth(),confirm=useConfirm()
  const [rows,setRows]=useState(null),[form,setForm]=useState(null),[view,setView]=useState(null),[tab,setTab]=useState('share'),[qr,setQr]=useState(''),[filter,setFilter]=useState('active'),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('camps').select('*, registrations(count)').order('camp_date',{ascending:false}).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[])
  const blank={name:'',camp_date:'',start_time:'09:00',end_time:'15:00',venue:'',target_donors:'',slot_capacity:settings.default_slot_capacity??'',budget:'',status:'planned'}
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true);const {id,registrations,created_at,...rest}=form
    const row=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v===''?null:v]))
    const {error}=id?await supabase.from('camps').update(row).eq('id',id):await supabase.from('camps').insert(row)
    setBusy(false);if(error)return toast.error(errText(error));toast.success(id?'Camp updated':'Camp created');setForm(null);load()}
  const remove=async()=>{if(!await confirm({title:`Delete ${form.name}?`,body:'All registrations, screenings, donations, tasks, volunteers, sponsors and expenses for this camp are deleted. Blood units stay in stock.',action:'Delete camp'}))return
    const {error}=await supabase.from('camps').delete().eq('id',form.id);if(error)return toast.error(error.message);toast.success('Camp deleted');setForm(null);load()}
  const setStatus=async(c,status)=>{const {error}=await supabase.from('camps').update({status}).eq('id',c.id);if(error)return toast.error(error.message);toast.success(`${c.name}: ${STATUS.find(s=>s[0]===status)[1]}`);load()}
  const open=async(c,t)=>{setView(c);setTab(t);setQr(await QRCode.toDataURL(link(c.id),{width:320,margin:1,color:{dark:'#070D1A',light:'#ffffff'}}))}
  const list=useMemo(()=>(rows||[]).filter(c=>filter==='all'||(filter==='active'?!['completed','closed'].includes(c.status):['completed','closed'].includes(c.status))),[rows,filter])
  return <div>
    <PageHeader title="Camps" description="Plan camps, open registration and share the QR link."
      actions={<button className="btn" onClick={()=>setForm(blank)}><Plus size={16}/>New camp</button>}/>
    <Tabs id="camp-filter" value={filter} onChange={setFilter} tabs={[['active','Upcoming and live'],['past','Past'],['all','All']]}/>
    {rows===null?<div className="grid gap-4 md:grid-cols-2">{[0,1].map(i=><div key={i} className="card"><div className="skeleton h-24"/></div>)}</div>
    :!list.length?<div className="card"><Empty icon={Tent} title="No camps here" action={<button className="btn" onClick={()=>setForm(blank)}><Plus size={16}/>New camp</button>}>Create a camp, then set it to Registration open to share the QR.</Empty></div>
    :<div className="grid gap-4 md:grid-cols-2">{list.map(c=>{const n=c.registrations?.[0]?.count??0
      return <article key={c.id} className="card flex flex-col">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-display text-lg font-semibold text-white">{c.name}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog-muted"><span className="flex items-center gap-1.5"><Clock size={14}/>{fmt(c.camp_date)}{c.start_time&&`, ${c.start_time.slice(0,5)}`}</span>
            <span className="flex items-center gap-1.5"><MapPin size={14}/>{c.venue||'Venue not set'}</span></div></div>
          <Badge tone={TONE[c.status]}>{STATUS.find(s=>s[0]===c.status)?.[1]}</Badge></div>
        <div className="mt-4 flex items-baseline gap-2"><span className="font-display text-3xl font-semibold text-white">{n}</span><span className="text-sm text-fog-muted">registered{c.target_donors?` of ${c.target_donors}`:''}</span>
          {c.slot_capacity&&<span className="ml-auto text-xs text-fog-faint">{c.slot_capacity} per slot</span>}</div>
        {c.target_donors&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full origin-left animate-grow rounded-full bg-gradient-to-r from-brand-deep to-brand" style={{width:Math.min(100,n/c.target_donors*100)+'%'}}/></div>}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
          <select aria-label="Camp status" className="input w-auto py-1.5 text-xs" value={c.status} onChange={e=>setStatus(c,e.target.value)}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
          <button className="btn-quiet py-1.5 text-xs" onClick={()=>open(c,'people')}><Users size={14}/>Registrants</button>
          {c.status==='open'&&<button className="btn-quiet py-1.5 text-xs" onClick={()=>open(c,'share')}><QrCode size={14}/>QR and link</button>}
          <button className="btn-ghost ml-auto" title="Edit camp" onClick={()=>setForm({...blank,...Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v??'']))})}><Pencil size={15}/></button></div>
      </article>})}</div>}

    <Drawer open={!!form} onClose={()=>setForm(null)} title={form?.id?'Edit camp':'New camp'}
      footer={form&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Delete</button>}
        <button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="camp-form" disabled={busy}>{busy?'Saving…':form.id?'Save changes':'Create camp'}</button></>}>
      {form&&<form id="camp-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Camp name" className="sm:col-span-2"><input className="input" required value={form.name} onChange={set('name')}/></Field>
        <Field label="Date"><input type="date" required className="input" value={form.camp_date} onChange={set('camp_date')}/></Field>
        <Field label="Status"><select className="input" value={form.status} onChange={set('status')}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Starts"><input type="time" className="input" value={form.start_time} onChange={set('start_time')}/></Field>
        <Field label="Ends"><input type="time" className="input" value={form.end_time} onChange={set('end_time')}/></Field>
        <Field label="Venue" className="sm:col-span-2"><input className="input" value={form.venue} onChange={set('venue')}/></Field>
        <Field label="Target donors"><input className="input" type="number" min="1" value={form.target_donors} onChange={set('target_donors')}/></Field>
        <Field label="Donors per time slot" hint="Empty means no limit."><input className="input" type="number" min="1" value={form.slot_capacity} onChange={set('slot_capacity')}/></Field>
        <Field label="Budget (Rs.)"><input className="input" type="number" min="0" value={form.budget} onChange={set('budget')}/></Field>
      </form>}
    </Drawer>

    <Drawer open={!!view} onClose={()=>{setView(null);load()}} width="max-w-2xl" title={view?.name} description={view&&`${fmt(view.camp_date)}${view.venue?`, ${view.venue}`:''}`}>
      {view&&<><Tabs id="camp-view" value={tab} onChange={setTab} tabs={[['people','Registrants'],...(view.status==='open'?[['share','QR and link']]:[])]}/>
        {tab==='people'?<Registrants camp={view} onChanged={()=>{}}/>
        :<div className="flex flex-col items-center gap-4 text-center"><img src={qr} alt={`QR code to register for ${view.name}`} className="h-64 w-64 rounded-2xl bg-white p-3"/>
          <p className="max-w-sm text-sm text-fog-muted">Print this on the poster or share it on WhatsApp. Donors scan it to register.</p>
          <code className="max-w-full break-all rounded-lg bg-ink-800 px-3 py-2 text-xs text-fog-muted">{link(view.id)}</code>
          <div className="flex gap-2"><button className="btn" onClick={()=>{navigator.clipboard.writeText(link(view.id));toast.success('Link copied')}}><Copy size={15}/>Copy link</button>
            <a className="btn-quiet" download={`${view.name}-qr.png`} href={qr}><Download size={15}/>Download QR</a></div></div>}</>}
    </Drawer>
  </div>
}
