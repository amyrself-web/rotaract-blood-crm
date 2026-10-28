import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Plus,QrCode,MessageCircle,Users,Pencil,Trash2,Copy,Download,MapPin,Clock,Tent,UserPlus,UserCheck,CheckCheck} from 'lucide-react'
import {brandQr} from '../lib/qr'
import {useBrand} from '../context/Brand'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {fmt,wa,slots} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,Tabs,useConfirm,errText,useLive,undoToast,code,todayIso} from '../components/ui'
import WaSend from '../components/wa/WaSend'

const STATUS=[['planned','Planned'],['open','Registration open'],['live','Live today'],['completed','Completed'],['closed','Closed']]
const TONE={planned:'neutral',open:'blue',live:'red',completed:'green',closed:'neutral'}
const REG=['registered','checked_in','screened','donated','deferred','no_show']
export const CAMP_TYPES=['Blood donation','Eye checking','Food donation','Environment (plantation)','Cancer awareness','Others']
export const CANCERS=['Breast','Cervical','Oral','Lung','Prostate','Colorectal','Skin','Blood cancers (leukaemia, lymphoma)','Stomach','Liver','Thyroid','Ovarian','Childhood cancers','General awareness']
const TYPE_TONE={'Blood donation':'red','Eye checking':'blue','Food donation':'amber','Environment (plantation)':'green','Cancer awareness':'red','Others':'neutral'}
export const campTypeName=c=>c.camp_type==='Others'?(c.camp_type_other||'Others'):c.camp_type
const isBlood=c=>(c.camp_type||'Blood donation')==='Blood donation'
const ATT=[['present','Present'],['late','Late'],['leave','Leave'],['absent','Absent']]
const link=id=>`${location.origin}${location.pathname}#/register/${id}`

function Registrants({camp,onChanged}){
  const {settings}=useAuth(),confirm=useConfirm(),[rows,setRows]=useState(null),[q,setQ]=useState(''),[add,setAdd]=useState(''),[found,setFound]=useState([])
  const load=()=>supabase.from('registrations').select('*,donors(full_name,phone,blood_group,consent,donor_no)').eq('camp_id',camp.id).order('token_no').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[camp.id])
  useLive(['registrations'],load)
  useEffect(()=>{if(add.trim().length<2)return setFound([]);const t=setTimeout(async()=>{const s=add.replace(/[%,()]/g,'')
    const {data}=await supabase.from('donors').select('id,full_name,phone,blood_group').is('deleted_at',null).or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`).limit(6);setFound(data||[])},200);return()=>clearTimeout(t)},[add])
  const upd=async(r,patch)=>{const prev=Object.fromEntries(Object.keys(patch).map(k=>[k,r[k]]))
    const {error}=await supabase.from('registrations').update(patch).eq('id',r.id);if(error)return toast.error(error.message);load();onChanged()
    undoToast(`${r.donors.full_name}: ${Object.keys(patch)[0]==='slot'?'slot':'status'} changed`,async()=>{const x=await supabase.from('registrations').update(prev).eq('id',r.id);if(x.error)throw x.error;load()})}
  const del=async r=>{if(['screened','donated','deferred'].includes(r.status)&&!await confirm({title:`Remove ${r.donors.full_name} from this camp?`,body:'Their screening and donation record for this camp are removed too and cannot be brought back.',action:'Remove'}))return
    const {donors,...row}=r
    const {error}=await supabase.from('registrations').delete().eq('id',r.id);if(error)return toast.error(error.message);load();onChanged()
    if(['registered','checked_in','no_show'].includes(r.status))undoToast(`${donors.full_name} removed from camp`,async()=>{const x=await supabase.from('registrations').insert(row);if(x.error)throw x.error;load()})
    else toast.success('Removed from camp')}
  const enrol=async d=>{const {error}=await supabase.from('registrations').insert({camp_id:camp.id,donor_id:d.id});if(error)return toast.error(error.code==='23505'?'Already registered for this camp':error.message)
    toast.success(`${d.full_name} added`);setAdd('');setFound([]);load();onChanged()}
  const list=(rows||[]).filter(r=>!q||`${r.donors.full_name} ${r.donors.phone}`.toLowerCase().includes(q.toLowerCase()))
  const s=slots(camp.start_time,camp.end_time)
  return <div className="space-y-4">
    <div className="relative"><Field label="Add a donor to this camp"><input className="input" placeholder="Type a name or mobile" value={add} onChange={e=>setAdd(e.target.value)}/></Field>
      {found.length>0&&<div className="absolute z-10 mt-1 w-full rounded-xl border border-ink-600 bg-ink-800 p-1 shadow-2xl">{found.map(d=><button key={d.id} onClick={()=>enrol(d)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-700">
        <UserPlus size={14} className="text-brand"/><span className="flex-1 text-fg">{d.full_name}</span><span className="text-fog-faint">{d.blood_group} {d.phone}</span></button>)}</div>}</div>
    <input className="input" placeholder={`Search ${rows?.length??''} registrants`} value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">{list.map(r=><div key={r.id} className="flex flex-wrap items-center gap-2 p-3">
      <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-ink-700 font-display text-sm font-semibold text-fg" title="Token number">{code('T',r.token_no,3)}</span>
      <div className="min-w-[140px] flex-1"><div className="text-sm font-medium text-fg">{r.donors.full_name} <span className="font-display text-blood">{r.donors.blood_group}</span></div><div className="text-xs text-fog-faint">{code('D',r.donors.donor_no)} · {r.donors.phone}</div></div>
      <select className="input w-auto py-1.5 text-xs" value={r.slot||''} onChange={e=>upd(r,{slot:e.target.value||null})}><option value="">Any time</option>{s.map(x=><option key={x}>{x}</option>)}</select>
      <select className="input w-auto py-1.5 text-xs" value={r.status} onChange={e=>upd(r,{status:e.target.value})} disabled={['donated','screened','deferred'].includes(r.status)} title="Screening and donation steps are set on Camp day">
        {REG.map(x=><option key={x} value={x} disabled={['screened','donated','deferred'].includes(x)}>{x.replace('_',' ')}</option>)}</select>
      {r.donors.consent&&<WaSend className="btn-ghost" title="Send reminder on WhatsApp" phone={r.donors.phone} name={r.donors.full_name} donorId={r.donor_id} text={`Hello ${r.donors.full_name}, reminder: ${camp.name} on ${fmt(camp.camp_date)}${r.slot?' at '+r.slot:''}${camp.venue?', '+camp.venue:''}. Thank you for donating blood. ${settings.club_name}`}><MessageCircle size={15}/></WaSend>}
      <button className="btn-ghost hover:text-blood" title="Remove from camp" onClick={()=>del(r)}><Trash2 size={15}/></button></div>)}
      {rows&&!list.length&&<div className="p-6 text-center text-sm text-fog-faint">No registrants yet.</div>}</div>
  </div>
}

function CampMembers({camp}){
  const [members,setMembers]=useState(null),[att,setAtt]=useState({}),[q,setQ]=useState('')
  const load=async()=>{const [m,a]=await Promise.all([supabase.from('members').select('id,member_no,full_name,position,status').is('deleted_at',null).order('member_no'),
      supabase.from('camp_attendance').select('*').eq('camp_id',camp.id)])
    if(m.error)return toast.error(m.error.message);if(a.error)return toast.error(a.error.message)
    setMembers((m.data||[]).filter(x=>x.status!=='inactive'||(a.data||[]).some(r=>r.member_id===x.id)));setAtt(Object.fromEntries((a.data||[]).map(r=>[r.member_id,r])))}
  useEffect(()=>{load()},[camp.id])
  useLive(['camp_attendance'],load)
  const lateGuess=()=>{if(!camp.start_time||camp.camp_date!==todayIso())return null;const [h,m]=camp.start_time.split(':').map(Number),n=new Date();return Math.max(0,n.getHours()*60+n.getMinutes()-(h*60+m))}
  const save=async(mid,patch)=>{const cur=att[mid]||{camp_id:camp.id,member_id:mid,status:'present',late_minutes:null,duty:null}
    const row={...cur,...patch};if(row.status!=='late')row.late_minutes=null;else if(patch.status==='late'&&row.late_minutes==null)row.late_minutes=lateGuess()
    setAtt(a=>({...a,[mid]:row}));const {noted_at,...up}=row
    const {error}=await supabase.from('camp_attendance').upsert(up);if(error){toast.error(errText(error));load()}}
  const clear=async mid=>{const {error}=await supabase.from('camp_attendance').delete().eq('camp_id',camp.id).eq('member_id',mid);if(error)return toast.error(error.message);setAtt(a=>{const n={...a};delete n[mid];return n})}
  const allPresent=async()=>{const rows=(members||[]).filter(m=>!att[m.id]).map(m=>({camp_id:camp.id,member_id:m.id,status:'present'}))
    if(!rows.length)return toast('Everyone is already marked');const {error}=await supabase.from('camp_attendance').insert(rows);if(error)return toast.error(errText(error));toast.success(`${rows.length} marked present`);load()}
  if(!members)return <div className="skeleton h-40"/>
  const vals=Object.values(att),cnt=s=>vals.filter(r=>r.status===s).length
  const list=members.filter(m=>!q||`${m.full_name} ${m.member_no}`.toLowerCase().includes(q.toLowerCase()))
  return <div className="space-y-4">
    <div className="grid grid-cols-5 gap-2 text-center">{[['Present',cnt('present')+cnt('late'),'text-ok'],['Late',cnt('late'),'text-brand'],['Leave',cnt('leave'),'text-warn'],['Absent',cnt('absent'),'text-blood'],['Not marked',members.length-vals.length,'text-fog-faint']].map(([l,n,c])=>
      <div key={l} className="rounded-xl bg-ink-800 p-2"><div className={`font-display text-xl font-semibold ${c}`}>{n}</div><div className="text-[11px] text-fog-faint">{l}</div></div>)}</div>
    <div className="flex gap-2"><input className="input" placeholder={`Search ${members.length} members`} value={q} onChange={e=>setQ(e.target.value)}/>
      <button className="btn-quiet shrink-0" onClick={allPresent}><CheckCheck size={15}/>Mark the rest present</button></div>
    <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">{list.map(m=>{const r=att[m.id]
      return <div key={m.id} className="flex flex-wrap items-center gap-2 p-3">
        <div className="min-w-[140px] flex-1"><div className="text-sm font-medium text-fg">{m.full_name}</div><div className="text-xs text-fog-faint">{code('M',m.member_no)}{m.position?` · ${m.position}`:''}</div></div>
        <div className="flex overflow-hidden rounded-lg border border-ink-600">{ATT.map(([k,l])=><button key={k} type="button" aria-pressed={r?.status===k} onClick={()=>save(m.id,{status:k})}
          className={`px-2.5 py-1.5 text-xs ${r?.status===k?{present:'bg-ok text-white',late:'bg-brand text-white',leave:'bg-warn text-white',absent:'bg-blood text-white'}[k]:'text-fog-muted hover:bg-ink-700'}`}>{l}</button>)}</div>
        {r?.status==='late'&&<label className="flex items-center gap-1 text-xs text-fog-muted"><input aria-label="Minutes late" className="input w-16 py-1 text-xs" type="number" min="0" max="600" value={r.late_minutes??''} onChange={e=>setAtt(a=>({...a,[m.id]:{...r,late_minutes:e.target.value===''?null:Number(e.target.value)}}))} onBlur={e=>save(m.id,{late_minutes:e.target.value===''?null:Number(e.target.value)})}/>min</label>}
        {r&&<input aria-label="Duty" className="input w-32 py-1 text-xs" placeholder="Duty (optional)" defaultValue={r.duty||''} onBlur={e=>{const v=e.target.value.trim()||null;if(v!==(r.duty||null))save(m.id,{duty:v})}}/>}
        {r&&<button className="btn-ghost text-xs" title="Clear mark" onClick={()=>clear(m.id)}>×</button>}
      </div>})}
      {!list.length&&<div className="p-6 text-center text-sm text-fog-faint">No members found.</div>}</div>
    <p className="text-xs text-fog-faint">Late members count as present; the minutes late show in the attendance report.</p>
  </div>
}

export default function Camps(){
  const {settings,user}=useAuth(),confirm=useConfirm(),{brand}=useBrand()
  const [rows,setRows]=useState(null),[form,setForm]=useState(null),[view,setView]=useState(null),[tab,setTab]=useState('share'),[qr,setQr]=useState(''),[filter,setFilter]=useState('active'),[busy,setBusy]=useState(false),[type,setType]=useState('')
  const load=()=>supabase.from('camps').select('*, registrations(count)').is('deleted_at',null).order('camp_date',{ascending:false}).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[])
  useLive(['camps','registrations'],load)
  const blank={camp_type:'Blood donation',camp_type_other:'',cancer_types:[],about:'',beneficiaries:'',name:'',camp_date:'',start_time:'09:00',end_time:'15:00',venue:'',target_donors:'',slot_capacity:settings.default_slot_capacity??'',budget:'',status:'planned'}
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e.preventDefault()
    if(!form.name.trim())return toast.error('Enter the camp name');if(!form.camp_date)return toast.error('Choose the camp date')
    if(form.camp_type==='Others'&&!form.camp_type_other.trim())return toast.error('Enter the camp type name')
    if(form.camp_type==='Cancer awareness'&&!(form.cancer_types||[]).length)return toast.error('Choose at least one cancer type')
    if(form.start_time&&form.end_time&&form.end_time<=form.start_time)return toast.error('End time must be after the start time')
    if(!form.id&&form.camp_date<todayIso()&&!await confirm({title:'This date is in the past',body:'Create the camp anyway? Use this only to record an old camp.',action:'Create anyway',danger:false}))return
    setBusy(true);const {id,registrations,created_at,camp_no,deleted_at,deleted_by,_orig,...rest}=form
    const row=Object.fromEntries(Object.entries({...rest,name:rest.name.trim()}).map(([k,v])=>[k,v===''?null:v]))
    if(row.camp_type!=='Others')row.camp_type_other=null;if(row.camp_type!=='Cancer awareness')row.cancer_types=null
    if(row.camp_type!=='Blood donation'){row.target_donors=null;row.slot_capacity=null}
    const {data,error}=id?await supabase.from('camps').update(row).eq('id',id).select().single():await supabase.from('camps').insert(row).select().single()
    setBusy(false);if(error)return toast.error(errText(error));setForm(null);load()
    if(id){const prev=Object.fromEntries(Object.keys(row).map(k=>[k,_orig[k]]));undoToast('Camp updated',async()=>{const x=await supabase.from('camps').update(prev).eq('id',id);if(x.error)throw x.error;load()})}
    else toast.success(`Camp created as ${code('C',data.camp_no,3)}`)}
  const remove=async()=>{const id=form.id,name=form.name
    const {error}=await supabase.from('camps').update({deleted_at:new Date().toISOString(),deleted_by:user.id}).eq('id',id);if(error)return toast.error(error.message)
    setForm(null);load();undoToast(`${name} moved to the Recycle bin`,async()=>{const x=await supabase.from('camps').update({deleted_at:null,deleted_by:null}).eq('id',id);if(x.error)throw x.error;load()})}
  const setStatus=async(c,status)=>{const prev=c.status;const {error}=await supabase.from('camps').update({status}).eq('id',c.id);if(error)return toast.error(error.message);load()
    undoToast(`${c.name}: ${STATUS.find(s=>s[0]===status)[1]}`,async()=>{const x=await supabase.from('camps').update({status:prev}).eq('id',c.id);if(x.error)throw x.error;load()})}
  const open=async(c,t)=>{setView(c);setTab(t);setQr(await brandQr(link(c.id),brand,{size:640,quiet:2}))}
  const list=useMemo(()=>(rows||[]).filter(c=>(!type||(c.camp_type||'Blood donation')===type)&&(filter==='all'||(filter==='active'?!['completed','closed'].includes(c.status):['completed','closed'].includes(c.status)))),[rows,filter,type])
  return <div>
    <PageHeader title="Camps" description="Plan camps, open registration and share the QR link."
      actions={<button className="btn" onClick={()=>setForm(blank)}><Plus size={16}/>New camp</button>}/>
    <div className="flex flex-wrap items-start gap-3"><div className="flex-1"><Tabs id="camp-filter" value={filter} onChange={setFilter} tabs={[['active','Upcoming and live'],['past','Past'],['all','All']]}/></div>
      <select aria-label="Camp type" className="input w-auto py-1.5 text-sm" value={type} onChange={e=>setType(e.target.value)}><option value="">All camp types</option>{CAMP_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
    {rows===null?<div className="grid gap-4 md:grid-cols-2">{[0,1].map(i=><div key={i} className="card"><div className="skeleton h-24"/></div>)}</div>
    :!list.length?<div className="card"><Empty icon={Tent} title="No camps here" action={<button className="btn" onClick={()=>setForm(blank)}><Plus size={16}/>New camp</button>}>Create a camp, then set it to Registration open to share the QR.</Empty></div>
    :<div className="grid gap-4 md:grid-cols-2">{list.map(c=>{const n=c.registrations?.[0]?.count??0
      return <article key={c.id} className="card flex flex-col">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="code">{code('C',c.camp_no,3)}</span><Badge tone={TYPE_TONE[c.camp_type]||'neutral'}>{campTypeName(c)}</Badge></div><h2 className="truncate font-display text-lg font-semibold text-fg">{c.name}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog-muted"><span className="flex items-center gap-1.5"><Clock size={14}/>{fmt(c.camp_date)}{c.start_time&&`, ${c.start_time.slice(0,5)}`}</span>
            <span className="flex items-center gap-1.5"><MapPin size={14}/>{c.venue||'Venue not set'}</span></div></div>
          <Badge tone={TONE[c.status]}>{STATUS.find(s=>s[0]===c.status)?.[1]}</Badge></div>
        {isBlood(c)?<div className="mt-4 flex items-baseline gap-2"><span className="font-display text-3xl font-semibold text-fg">{n}</span><span className="text-sm text-fog-muted">registered{c.target_donors?` of ${c.target_donors}`:''}</span>
          {c.slot_capacity&&<span className="ml-auto text-xs text-fog-faint">{c.slot_capacity} per slot</span>}</div>
        :<div className="mt-4"><div className="flex items-baseline gap-2"><span className="font-display text-3xl font-semibold text-fg">{c.beneficiaries??'–'}</span><span className="text-sm text-fog-muted">people helped</span></div>
          {c.cancer_types?.length>0&&<div className="mt-2 flex flex-wrap gap-1">{c.cancer_types.map(t=><span key={t} className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] text-fog-muted">{t}</span>)}</div>}
          {c.about&&<p className="mt-2 line-clamp-2 text-sm text-fog-muted">{c.about}</p>}</div>}
        {isBlood(c)&&c.target_donors&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full origin-left animate-grow rounded-full bg-gradient-to-r from-brand-deep to-brand" style={{width:Math.min(100,n/c.target_donors*100)+'%'}}/></div>}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
          <select aria-label="Camp status" className="input w-auto py-1.5 text-xs" value={c.status} onChange={e=>setStatus(c,e.target.value)}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
          {isBlood(c)&&<button className="btn-quiet py-1.5 text-xs" onClick={()=>open(c,'people')}><Users size={14}/>Registrants</button>}
          <button className="btn-quiet py-1.5 text-xs" onClick={()=>open(c,'members')}><UserCheck size={14}/>Members attendance</button>
          {isBlood(c)&&c.status==='open'&&<button className="btn-quiet py-1.5 text-xs" onClick={()=>open(c,'share')}><QrCode size={14}/>QR and link</button>}
          <button className="btn-ghost ml-auto" title="Edit camp" onClick={()=>setForm({...blank,...Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v??''])),cancer_types:c.cancer_types||[],_orig:c})}><Pencil size={15}/></button></div>
      </article>})}</div>}

    <Drawer open={!!form} onClose={()=>setForm(null)} title={form?.id?`Edit camp ${code('C',form.camp_no,3)}`:'New camp'} description="Fields marked * are required."
      footer={form&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Move to Recycle bin</button>}
        <button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="camp-form" disabled={busy}>{busy?'Saving…':form.id?'Save changes':'Create camp'}</button></>}>
      {form&&<form id="camp-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Camp type" required><select className="input" value={form.camp_type} onChange={set('camp_type')}>{CAMP_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        {form.camp_type==='Others'?<Field label="Type name" required><input className="input" maxLength={60} placeholder="e.g. Dental check-up" value={form.camp_type_other} onChange={set('camp_type_other')}/></Field>:<div className="hidden sm:block"/>}
        {form.camp_type==='Cancer awareness'&&<div role="group" aria-label="Cancer types covered" className="sm:col-span-2"><span className="label">Cancer types covered<span aria-hidden="true" className="ml-0.5 text-blood">*</span></span><div className="flex flex-wrap gap-1.5">
          <button type="button" className="rounded-full border border-brand/50 px-2.5 py-1 text-xs text-brand" onClick={()=>setForm({...form,cancer_types:form.cancer_types.length===CANCERS.length?[]:[...CANCERS]})}>{form.cancer_types.length===CANCERS.length?'Clear all':'All types'}</button>
          {CANCERS.map(t=>{const on=form.cancer_types.includes(t);return <button key={t} type="button" aria-pressed={on} onClick={()=>setForm({...form,cancer_types:on?form.cancer_types.filter(x=>x!==t):[...form.cancer_types,t]})}
            className={`rounded-full border px-2.5 py-1 text-xs ${on?'border-brand bg-brand text-white':'border-ink-600 text-fog-muted hover:bg-ink-700'}`}>{t}</button>})}</div></div>}
        <Field label="Camp name" required className="sm:col-span-2"><input className="input" required minLength={3} maxLength={80} value={form.name} onChange={set('name')}/></Field>
        <Field label="Date" required><input type="date" required className="input" value={form.camp_date} onChange={set('camp_date')}/></Field>
        <Field label="Status" required><select className="input" value={form.status} onChange={set('status')}>{STATUS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Starts" required><input type="time" required className="input" value={form.start_time} onChange={set('start_time')}/></Field>
        <Field label="Ends" required><input type="time" required className="input" value={form.end_time} onChange={set('end_time')}/></Field>
        <Field label="Venue" required className="sm:col-span-2"><input className="input" required value={form.venue} onChange={set('venue')}/></Field>
        {form.camp_type==='Blood donation'?<><Field label="Target donors"><input className="input" type="number" min="1" value={form.target_donors} onChange={set('target_donors')}/></Field>
        <Field label="Donors per time slot" hint="Empty means no limit."><input className="input" type="number" min="1" value={form.slot_capacity} onChange={set('slot_capacity')}/></Field></>
        :<Field label="People helped" hint="Fill in after the camp."><input className="input" type="number" min="0" value={form.beneficiaries} onChange={set('beneficiaries')}/></Field>}
        <Field label="Budget (Rs.)"><input className="input" type="number" min="0" value={form.budget} onChange={set('budget')}/></Field>
        <Field label="About the camp" hint="Shown on the front page." className="sm:col-span-2"><textarea className="input" rows={3} maxLength={600} value={form.about} onChange={set('about')}/></Field>
      </form>}
    </Drawer>

    <Drawer open={!!view} onClose={()=>{setView(null);load()}} width="max-w-2xl" title={view?.name} description={view&&`${fmt(view.camp_date)}${view.venue?`, ${view.venue}`:''}`}>
      {view&&<><Tabs id="camp-view" value={tab} onChange={setTab} tabs={[...(isBlood(view)?[['people','Registrants']]:[]),['members','Members attendance'],...(isBlood(view)&&view.status==='open'?[['share','QR and link']]:[])]}/>
        {tab==='members'?<CampMembers camp={view}/>:tab==='people'?<Registrants camp={view} onChanged={()=>{}}/>
        :<div className="flex flex-col items-center gap-4 text-center"><img src={qr} alt={`QR code to register for ${view.name}`} className="h-64 w-64 rounded-2xl bg-white p-3"/>
          <p className="max-w-sm text-sm text-fog-muted">Print this on the poster or share it on WhatsApp. Donors scan it to register.</p>
          <code className="max-w-full break-all rounded-lg bg-ink-800 px-3 py-2 text-xs text-fog-muted">{link(view.id)}</code>
          <div className="flex gap-2"><button className="btn" onClick={()=>{navigator.clipboard.writeText(link(view.id));toast.success('Link copied')}}><Copy size={15}/>Copy link</button>
            <a className="btn-quiet" download={`${view.name}-qr.png`} href={qr}><Download size={15}/>Download QR</a></div></div>}</>}
    </Drawer>
  </div>
}
