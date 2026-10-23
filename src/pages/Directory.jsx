import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Plus,Search,Phone,MapPin,Hospital,Clock,Handshake,Trash2,MessageCircle,Building2} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {PageHeader,Drawer,Field,Badge,Empty,useLive,undoToast} from '../components/ui'
import {Toggle} from '../components/ui'

export const KINDS=['Hospital','Blood bank','Eye bank','Medical college','Ambulance','Other']
const TONE={'Blood bank':'red','Eye bank':'blue','Hospital':'green','Medical college':'amber','Ambulance':'red','Other':'neutral'}
const empty={name:'',kind:'Hospital',city:'',address:'',phone:'',phone2:'',contact_person:'',email:'',open_24x7:false,tie_up:false,blood_groups_note:'',notes:''}

// Hospitals, blood banks and eye banks the club works with: who to call in an emergency
export default function Directory(){
  const [rows,setRows]=useState(null),[q,setQ]=useState(''),[k,setK]=useState(''),[form,setForm]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('hospitals').select('*').is('deleted_at',null).order('tie_up',{ascending:false}).order('name').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[]);useLive(['hospitals'],load)
  const list=(rows||[]).filter(h=>(!k||h.kind===k)&&(!q||`${h.name} ${h.city} ${h.contact_person} ${h.phone}`.toLowerCase().includes(q.toLowerCase())))
  const set=f=>e=>setForm({...form,[f]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true);const {id,created_at,created_by,deleted_at,deleted_by,...rest}=form
    const row=Object.fromEntries(Object.entries(rest).map(([a,v])=>[a,v===''?null:v]))
    const r=id?await supabase.from('hospitals').update(row).eq('id',id):await supabase.from('hospitals').insert(row);setBusy(false)
    if(r.error)return toast.error(r.error.message);toast.success('Saved');setForm(null);load()}
  const del=async()=>{const id=form.id;const r=await supabase.from('hospitals').update({deleted_at:new Date().toISOString()}).eq('id',id);if(r.error)return toast.error(r.error.message);setForm(null);load()
    undoToast('Removed from the directory',async()=>{await supabase.from('hospitals').update({deleted_at:null}).eq('id',id);load()})}
  return <div>
    <PageHeader eyebrow="Camp work" title="Hospitals and blood banks" description="Who to call: blood banks, eye banks, hospitals and ambulances the club works with."
      actions={<button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add</button>}/>
    <div className="mb-4 flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, town, person" value={q} onChange={e=>setQ(e.target.value)}/></div>
      {['',...KINDS].map(x=><button key={x} onClick={()=>setK(x)} className={`chip ${k===x?'border-brand/50 bg-brand/15 text-fg':''}`}>{x||'All'}</button>)}</div>
    {rows&&!list.length?<div className="card"><Empty icon={Hospital} title={rows.length?'Nothing matches':'Directory is empty'} action={!rows.length&&<button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add the first one</button>}>Add the blood banks you send units to, the eye bank for eye donation, and hospitals that call for blood.</Empty></div>:
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map(h=><article key={h.id} className="card cursor-pointer transition hover:border-ink-500" onClick={()=>setForm({...empty,...Object.fromEntries(Object.entries(h).map(([a,v])=>[a,v??'']))})}>
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Building2 size={18}/></span>
        <div className="min-w-0 flex-1"><div className="font-semibold text-fg">{h.name}</div><div className="mt-1 flex flex-wrap gap-1.5"><Badge tone={TONE[h.kind]}>{h.kind}</Badge>{h.open_24x7&&<Badge tone="green"><Clock size={11}/>24x7</Badge>}{h.tie_up&&<Badge tone="blue"><Handshake size={11}/>Tie-up</Badge>}</div></div></div>
      <div className="mt-3 space-y-1 text-sm text-fog-muted">{(h.city||h.address)&&<div><MapPin size={13} className="mr-1.5 inline"/>{[h.address,h.city].filter(Boolean).join(', ')}</div>}{h.contact_person&&<div>Contact: <span className="text-fg">{h.contact_person}</span></div>}{h.blood_groups_note&&<div className="text-xs">{h.blood_groups_note}</div>}</div>
      {h.phone&&<div className="mt-3 flex gap-2" onClick={e=>e.stopPropagation()}><a className="btn flex-1 py-1.5" href={`tel:${h.phone}`}><Phone size={14}/>{h.phone}</a>{/^[6-9]\d{9}$/.test(h.phone)&&<a className="btn-quiet py-1.5" target="_blank" rel="noreferrer" href={`https://wa.me/91${h.phone}`} aria-label="WhatsApp"><MessageCircle size={14}/></a>}</div>}</article>)}</div>}
    <Drawer open={!!form} onClose={()=>setForm(null)} title={form?.id?form.name:'Add to directory'} footer={form&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={del}><Trash2 size={15}/>Remove</button>}<button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="hosp-form" disabled={busy}>Save</button></>}>
      {form&&<form id="hosp-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2"><input className="input" required minLength={3} value={form.name} onChange={set('name')}/></Field>
        <Field label="Type"><select className="input" value={form.kind} onChange={set('kind')}>{KINDS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Town"><input className="input" value={form.city} onChange={set('city')}/></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={form.address} onChange={set('address')}/></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')}/></Field><Field label="Other phone"><input className="input" value={form.phone2} onChange={set('phone2')}/></Field>
        <Field label="Contact person"><input className="input" value={form.contact_person} onChange={set('contact_person')}/></Field><Field label="Email"><input type="email" className="input" value={form.email} onChange={set('email')}/></Field>
        <Field label="Blood / services note" className="sm:col-span-2"><input className="input" placeholder="For example: component separation, all groups" value={form.blood_groups_note} onChange={set('blood_groups_note')}/></Field>
        <label className="flex items-center gap-3 text-sm text-fog"><Toggle checked={!!form.open_24x7} label="Open 24x7" onChange={v=>setForm({...form,open_24x7:v})}/>Open 24x7</label>
        <label className="flex items-center gap-3 text-sm text-fog"><Toggle checked={!!form.tie_up} label="Tie-up with club" onChange={v=>setForm({...form,tie_up:v})}/>Tie-up with the club</label>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={form.notes} onChange={set('notes')}/></Field></form>}
    </Drawer>
  </div>
}
