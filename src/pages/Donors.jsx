import {useEffect,useMemo,useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {toast} from 'sonner'
import {MessageCircle,Plus,Search,Users,Trash2,Download} from 'lucide-react'
import Papa from 'papaparse'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,normPhone,fmt,wa} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,useConfirm,errText} from '../components/ui'

const empty={full_name:'',phone:'',email:'',blood_group:'',gender:'',dob:'',area:'',last_donation:'',consent:false}
const PAGE=25
async function all(){let out=[],from=0;for(;;){const {data,error}=await supabase.from('donors').select('*').order('created_at',{ascending:false}).range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)return out;from+=1000}}

export default function Donors(){
  const {settings,can}=useAuth(),confirm=useConfirm(),[sp]=useSearchParams()
  const [rows,setRows]=useState(null),[q,setQ]=useState(sp.get('q')||''),[g,setG]=useState(''),[elig,setElig]=useState(''),[consent,setConsent]=useState(''),[page,setPage]=useState(0),[form,setForm]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>all().then(setRows).catch(e=>toast.error(errText(e)))
  useEffect(()=>{load()},[])
  useEffect(()=>setPage(0),[q,g,elig,consent])
  const next=r=>{if(!r.last_donation)return null;const d=new Date(r.last_donation);d.setDate(d.getDate()+(r.gender==='Female'?settings.gap_female:settings.gap_male));return d}
  const ok=r=>{const n=next(r);return !n||n<=new Date()}
  const list=useMemo(()=>(rows||[]).filter(r=>(!g||r.blood_group===g)&&(!elig||(elig==='yes'?ok(r):!ok(r)))&&(!consent||String(r.consent)===consent)
    &&(!q||`${r.full_name} ${r.phone} ${r.area||''} ${r.email||''}`.toLowerCase().includes(q.toLowerCase()))),[rows,q,g,elig,consent,settings])
  const shown=list.slice(page*PAGE,page*PAGE+PAGE),pages=Math.ceil(list.length/PAGE)
  const set=k=>e=>setForm({...form,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const save=async e=>{e.preventDefault();const phone=normPhone(form.phone);if(phone.length!==10)return toast.error('Enter a 10-digit mobile number')
    setBusy(true);const {id,created_at,user_id,...rest}=form
    const row=Object.fromEntries(Object.entries({...rest,phone}).map(([k,v])=>[k,v===''?null:v]))
    if(form.consent&&!form.consent_at)row.consent_at=new Date().toISOString();if(!form.consent)row.consent_at=null
    const {error}=id?await supabase.from('donors').update(row).eq('id',id):await supabase.from('donors').insert(row)
    setBusy(false);if(error)return toast.error(error.code==='23505'?'This mobile number is already registered':error.message)
    toast.success(id?'Donor updated':'Donor added');setForm(null);load()}
  const remove=async()=>{if(!await confirm({title:`Delete ${form.full_name}?`,body:'Their registrations and donation history are deleted too. This cannot be undone.',action:'Delete donor'}))return
    const {error}=await supabase.from('donors').delete().eq('id',form.id);if(error)return toast.error(error.message);toast.success('Donor deleted');setForm(null);load()}
  const exportCsv=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([Papa.unparse(list.map(({id,user_id,...r})=>r))],{type:'text/csv'}));a.download='donors.csv';a.click()}
  return <div>
    <PageHeader title="Donors" description={rows?`${rows.length} donors, ${rows.filter(r=>r.consent).length} can be contacted`:'Loading donors'}
      actions={<><button className="btn-quiet" onClick={exportCsv} disabled={!list.length}><Download size={15}/>Export</button><button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add donor</button></>}/>
    <div className="card overflow-hidden p-0">
      <div className="grid gap-2 border-b border-ink-700 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, mobile, area, email" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="input w-auto" value={g} onChange={e=>setG(e.target.value)}><option value="">All groups</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
        <select className="input w-auto" value={elig} onChange={e=>setElig(e.target.value)}><option value="">Any eligibility</option><option value="yes">Can donate now</option><option value="no">Waiting period</option></select>
        <select className="input w-auto" value={consent} onChange={e=>setConsent(e.target.value)}><option value="">Any consent</option><option value="true">Can contact</option><option value="false">Consent pending</option></select></div>
      <div className="overflow-x-auto"><table className="table"><thead><tr><th>Donor</th><th>Group</th><th>Area</th><th>Last donation</th><th>Next donation</th><th/></tr></thead>
        <tbody>{rows===null?[0,1,2,3].map(i=><tr key={i}><td colSpan="6"><div className="skeleton h-8"/></td></tr>)
        :shown.map(r=><tr key={r.id} className="cursor-pointer" onClick={()=>setForm({...empty,...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v??'']))})}>
          <td><div className="font-medium text-white">{r.full_name}</div><div className="text-xs text-fog-faint">{r.phone}</div></td>
          <td><span className="font-display font-semibold text-blood">{r.blood_group||'-'}</span></td><td className="text-fog-muted">{r.area||'-'}</td>
          <td className="text-fog-muted">{fmt(r.last_donation)}</td>
          <td>{ok(r)?<Badge tone="green">Can donate</Badge>:<span className="text-fog-muted">{fmt(next(r))}</span>}</td>
          <td className="text-right" onClick={e=>e.stopPropagation()}>{r.consent?<a className="btn-ghost" title="Message on WhatsApp" target="_blank" rel="noreferrer" href={wa(r.phone,`Hello ${r.full_name}, this is ${settings.club_name}.`)}><MessageCircle size={16}/></a>:<Badge>Consent pending</Badge>}</td></tr>)}
        </tbody></table>
        {rows&&!list.length&&<Empty icon={Users} title={rows.length?'No donors match':'No donors yet'} action={!rows.length&&<button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add donor</button>}>
          {rows.length?'Change the search or filters.':'Add one here, import from Excel, or share a camp registration link.'}</Empty>}</div>
      {pages>1&&<div className="flex items-center justify-between border-t border-ink-700 px-4 py-3 text-sm text-fog-muted"><span>{page*PAGE+1} to {Math.min(list.length,(page+1)*PAGE)} of {list.length}</span>
        <div className="flex gap-2"><button className="btn-quiet" disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><button className="btn-quiet" disabled={page>=pages-1} onClick={()=>setPage(page+1)}>Next</button></div></div>}
    </div>
    <Drawer open={!!form} onClose={()=>setForm(null)} title={form?.id?'Edit donor':'Add donor'} description={form?.id?`Added ${fmt(form.created_at)}${form.source?` from ${form.source}`:''}`:'Mobile number must be unique.'}
      footer={form&&<>{form.id&&can('donors')&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Delete</button>}
        <button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="donor-form" disabled={busy}>{busy?'Saving…':form.id?'Save changes':'Add donor'}</button></>}>
      {form&&<form id="donor-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><input className="input" required value={form.full_name} onChange={set('full_name')}/></Field>
        <Field label="Mobile"><input className="input" required inputMode="numeric" value={form.phone} onChange={set('phone')}/></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')}/></Field>
        <Field label="Blood group"><select className="input" value={form.blood_group} onChange={set('blood_group')}><option value="">Not known</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Gender"><select className="input" value={form.gender} onChange={set('gender')}><option value="">Not given</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Date of birth"><input type="date" className="input" value={form.dob} onChange={set('dob')}/></Field>
        <Field label="Last donation"><input type="date" className="input" value={form.last_donation} onChange={set('last_donation')}/></Field>
        <Field label="Area or town" className="sm:col-span-2"><input className="input" value={form.area} onChange={set('area')}/></Field>
        <label className="flex items-start gap-3 rounded-xl border border-ink-600 p-3 text-sm sm:col-span-2"><input type="checkbox" className="mt-0.5" checked={!!form.consent} onChange={set('consent')}/>
          <span><span className="font-medium text-white">Agreed to be contacted</span><span className="block text-fog-muted">Only donors who agreed get WhatsApp reminders and invites.</span></span></label>
      </form>}
    </Drawer>
  </div>
}
