import {useEffect,useMemo,useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {toast} from 'sonner'
import {MessageCircle,Plus,Search,Users,Trash2,Download,ArrowUpDown,ArrowUp,ArrowDown,ChevronRight} from 'lucide-react'
import Papa from 'papaparse'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,normPhone,fmt,wa} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,useConfirm,errText,useLive,undoToast,code,adultMax,adultMin,todayIso,Tabs} from '../components/ui'
import DonorHistory from '../components/DonorHistory'

const empty={full_name:'',phone:'',email:'',blood_group:'',gender:'',dob:'',area:'',last_donation:'',consent:false}
const PAGE=25
async function all(){let out=[],from=0;for(;;){const {data,error}=await supabase.from('donors').select('*').is('deleted_at',null).order('donor_no').range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)return out;from+=1000}}

export default function Donors(){
  const {settings,can,user}=useAuth(),confirm=useConfirm(),[sp]=useSearchParams()
  const [rows,setRows]=useState(null),[q,setQ]=useState(sp.get('q')||''),[g,setG]=useState(''),[elig,setElig]=useState(''),[consent,setConsent]=useState(''),[page,setPage]=useState(0),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[dtab,setDtab]=useState('details'),[sort,setSort]=useState(()=>{try{return JSON.parse(localStorage.getItem('donor-sort'))||['no',1]}catch{return ['no',1]}})
  const load=()=>all().then(setRows).catch(e=>toast.error(errText(e)))
  useEffect(()=>{load()},[])
  useLive(['donors'],load)
  useEffect(()=>setPage(0),[q,g,elig,consent,sort])
  useEffect(()=>{try{localStorage.setItem('donor-sort',JSON.stringify(sort))}catch{}},[sort])
  const next=r=>{if(!r.last_donation)return null;const d=new Date(r.last_donation);d.setDate(d.getDate()+(r.gender==='Female'?settings.gap_female:settings.gap_male));return d}
  const ok=r=>{const n=next(r);return !n||n<=new Date()}
  const list=useMemo(()=>(rows||[]).filter(r=>(!g||r.blood_group===g)&&(!elig||(elig==='yes'?ok(r):!ok(r)))&&(!consent||String(r.consent)===consent)
    &&(!q||`${code('D',r.donor_no)} ${r.full_name} ${r.phone} ${r.area||''} ${r.email||''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a,b)=>{const [k,d]=sort,v=x=>k==='no'?x.donor_no:k==='name'?x.full_name.toLowerCase():k==='group'?BLOOD.indexOf(x.blood_group??'')>>>0:k==='area'?(x.area||'~').toLowerCase():k==='last'?(x.last_donation||''):k==='next'?(next(x)?.getTime()||0):0
      const A=v(a),B=v(b);return (A<B?-1:A>B?1:a.donor_no-b.donor_no)*d}),[rows,q,g,elig,consent,settings,sort])
  const Th=({k,children,className=''})=>{const on=sort[0]===k,I=on?(sort[1]>0?ArrowUp:ArrowDown):ArrowUpDown
    return <th className={className} aria-sort={on?(sort[1]>0?'ascending':'descending'):'none'}><button onClick={()=>setSort(on?[k,-sort[1]]:[k,1])} className={`inline-flex items-center gap-1 transition-colors hover:text-fg ${on?'text-fg':''}`}>{children}<I size={12} className={on?'':'opacity-40'}/></button></th>}
  const edit=(r,t='details')=>{setDtab(t);setForm({...empty,...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v??''])),_orig:r})}
  useEffect(()=>{if(rows&&sp.get('history')&&q){const r=rows.find(x=>x.phone===q);if(r)edit(r,'history')}},[rows])
  const shown=list.slice(page*PAGE,page*PAGE+PAGE),pages=Math.ceil(list.length/PAGE)
  const set=k=>e=>setForm({...form,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const save=async e=>{e.preventDefault();const phone=normPhone(form.phone);if(!/^[6-9]\d{9}$/.test(phone))return toast.error('Enter a valid 10-digit mobile number')
    if(!form.full_name.trim()||form.full_name.trim().length<2)return toast.error('Enter the full name')
    if(form.dob&&(form.dob>adultMax()||form.dob<adultMin()))return toast.error('Donors must be 18 to 65 years old')
    if(form.last_donation&&form.last_donation>todayIso())return toast.error('Last donation cannot be in the future')
    setBusy(true);const {id,created_at,user_id,donor_no,deleted_at,deleted_by,_orig,...rest}=form
    const row=Object.fromEntries(Object.entries({...rest,full_name:rest.full_name.trim(),phone}).map(([k,v])=>[k,v===''?null:v]))
    if(form.consent&&!form.consent_at)row.consent_at=new Date().toISOString();if(!form.consent)row.consent_at=null
    const {data,error}=id?await supabase.from('donors').update(row).eq('id',id).select().single():await supabase.from('donors').insert(row).select().single()
    setBusy(false)
    if(error){if(error.code==='23505'){const {data:old}=await supabase.from('donors').select('full_name,deleted_at').eq('phone',phone).maybeSingle()
        return toast.error(old?.deleted_at?`${old.full_name} with this mobile is in the Recycle bin. Restore them instead.`:'This mobile number is already registered')}
      return toast.error(error.message)}
    setForm(null);load()
    if(id){const prev=Object.fromEntries(Object.keys(row).map(k=>[k,_orig[k]]));undoToast('Donor updated',async()=>{const r=await supabase.from('donors').update(prev).eq('id',id);if(r.error)throw r.error;load()})}
    else toast.success(`Donor added as ${code('D',data.donor_no)}`)}
  const remove=async()=>{const id=form.id,name=form.full_name
    const {error}=await supabase.from('donors').update({deleted_at:new Date().toISOString(),deleted_by:user.id}).eq('id',id);if(error)return toast.error(error.message)
    setForm(null);load();undoToast(`${name} moved to the Recycle bin`,async()=>{const r=await supabase.from('donors').update({deleted_at:null,deleted_by:null}).eq('id',id);if(r.error)throw r.error;load()})}
  const exportCsv=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([Papa.unparse(list.map(({id,user_id,...r})=>r))],{type:'text/csv'}));a.download='donors.csv';a.click()}
  return <div>
    <PageHeader title="Donors" description={rows?`${rows.length} donors, ${rows.filter(r=>r.consent).length} can be contacted`:'Loading donors'}
      actions={<><button className="btn-quiet" onClick={exportCsv} disabled={!list.length}><Download size={15}/>Export</button><button className="btn" onClick={()=>{setDtab('details');setForm({...empty})}}><Plus size={16}/>Add donor</button></>}/>
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-2 gap-2 border-b border-ink-700 p-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative col-span-2 lg:col-span-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, mobile, area, email" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="input lg:w-auto" aria-label="Blood group" value={g} onChange={e=>setG(e.target.value)}><option value="">All groups</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
        <select className="input lg:w-auto" aria-label="Eligibility" value={elig} onChange={e=>setElig(e.target.value)}><option value="">Any eligibility</option><option value="yes">Can donate now</option><option value="no">Waiting period</option></select>
        <select className="input lg:w-auto" aria-label="Consent" value={consent} onChange={e=>setConsent(e.target.value)}><option value="">Any consent</option><option value="true">Can contact</option><option value="false">Consent pending</option></select>
        <select className="input lg:w-auto" aria-label="Sort" value={sort.join(':')} onChange={e=>{const [k,d]=e.target.value.split(':');setSort([k,+d])}}>
          <option value="no:1">ID: D-0001 first</option><option value="no:-1">ID: newest first</option><option value="name:1">Name A to Z</option><option value="name:-1">Name Z to A</option>
          <option value="group:1">Blood group</option><option value="area:1">Area</option><option value="last:-1">Last donation, recent first</option></select></div>
      <div className="hidden overflow-x-auto md:block"><table className="table table-fixed">
        <colgroup><col className="w-[92px]"/><col/><col className="w-[84px]"/><col className="w-[15%]"/><col className="w-[14%]"/><col className="w-[15%]"/><col className="w-[64px]"/></colgroup>
        <thead><tr><Th k="no">ID</Th><Th k="name">Donor</Th><Th k="group">Group</Th><Th k="area">Area</Th><Th k="last">Last donation</Th><Th k="next">Next donation</Th><th/></tr></thead>
        <tbody>{rows===null?[0,1,2,3].map(i=><tr key={i}><td colSpan="7"><div className="skeleton h-8"/></td></tr>)
        :shown.map(r=><tr key={r.id} className="cursor-pointer" onClick={()=>edit(r)}>
          <td><span className="code whitespace-nowrap">{code('D',r.donor_no)}</span></td>
          <td className="truncate"><div className="truncate font-medium text-fg">{r.full_name}</div><div className="mt-0.5 text-xs tabular-nums text-fog-faint">{r.phone}</div></td>
          <td><span className="inline-grid h-8 min-w-[2.5rem] place-items-center rounded-lg bg-blood/10 px-1.5 font-display text-sm font-semibold text-blood">{r.blood_group||'-'}</span></td>
          <td className="truncate text-fog-muted">{r.area||'-'}</td>
          <td className="whitespace-nowrap tabular-nums text-fog-muted">{fmt(r.last_donation)}</td>
          <td className="whitespace-nowrap">{ok(r)?<Badge tone="green">Can donate</Badge>:<span className="tabular-nums text-fog-muted">{fmt(next(r))}</span>}</td>
          <td className="text-right" onClick={e=>e.stopPropagation()}>{r.consent?<a className="btn-ghost" title="Message on WhatsApp" aria-label={`WhatsApp ${r.full_name}`} target="_blank" rel="noreferrer" href={wa(r.phone,`Hello ${r.full_name}, this is ${settings.club_name}.`)}><MessageCircle size={16}/></a>
            :<span title="Consent pending" className="mr-2 inline-block h-2 w-2 rounded-full bg-warn"/>}</td></tr>)}
        </tbody></table></div>
      <ul className="divide-y divide-ink-700/80 md:hidden">{rows===null?[0,1,2,3].map(i=><li key={i} className="p-4"><div className="skeleton h-10"/></li>)
        :shown.map(r=><li key={r.id}><button onClick={()=>edit(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-brand/[.06]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blood/10 font-display text-sm font-semibold text-blood">{r.blood_group||'-'}</span>
          <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-medium text-fg">{r.full_name}</span>{!r.consent&&<span title="Consent pending" className="h-2 w-2 shrink-0 rounded-full bg-warn"/>}</span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-fog-faint"><span className="code whitespace-nowrap">{code('D',r.donor_no)}</span><span className="truncate">{r.area||r.phone}</span></span></span>
          <span className="shrink-0 text-right text-xs">{ok(r)?<Badge tone="green">Can donate</Badge>:<span className="whitespace-nowrap text-fog-muted">From {next(r)?.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>}</span>
          <ChevronRight size={16} className="shrink-0 text-fog-faint"/></button></li>)}</ul>
      <div>
        {rows&&!list.length&&<Empty icon={Users} title={rows.length?'No donors match':'No donors yet'} action={!rows.length&&<button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add donor</button>}>
          {rows.length?'Change the search or filters.':'Add one here, import from Excel, or share a camp registration link.'}</Empty>}</div>
      {pages>1&&<div className="flex items-center justify-between border-t border-ink-700 px-4 py-3 text-sm text-fog-muted"><span>{page*PAGE+1} to {Math.min(list.length,(page+1)*PAGE)} of {list.length}</span>
        <div className="flex gap-2"><button className="btn-quiet" disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><button className="btn-quiet" disabled={page>=pages-1} onClick={()=>setPage(page+1)}>Next</button></div></div>}
    </div>
    <Drawer open={!!form} onClose={()=>setForm(null)} width={dtab==='history'&&form?.id?'max-w-2xl':'max-w-lg'} title={form?.id?`Edit donor ${code('D',form.donor_no)}`:'Add donor'} description={form?.id?`Added ${fmt(form.created_at)}${form.source?` from ${form.source}`:''}`:'Fields marked * are required. Mobile number must be unique.'}
      footer={form&&(dtab==='details'||!form.id)&&<>{form.id&&can('donors')&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Move to Recycle bin</button>}
        <button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="donor-form" disabled={busy}>{busy?'Saving…':form.id?'Save changes':'Add donor'}</button></>}>
      {form?.id&&<Tabs id="donor-tabs" value={dtab} onChange={setDtab} tabs={[['details','Details'],['history','Full history']]}/>}
      {form?.id&&dtab==='history'&&<DonorHistory donor={form._orig}/>}
      {form&&(dtab==='details'||!form.id)&&<form id="donor-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2"><input className="input" required minLength={2} maxLength={80} value={form.full_name} onChange={set('full_name')}/></Field>
        <Field label="Mobile" required hint="10 digits, starts with 6, 7, 8 or 9"><input className="input" required inputMode="numeric" value={form.phone} onChange={set('phone')}/></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')}/></Field>
        <Field label="Blood group" required><select required className="input" value={form.blood_group} onChange={set('blood_group')}><option value="">Not known</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Gender" required><select required className="input" value={form.gender} onChange={set('gender')}><option value="">Not given</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Date of birth" hint="Donors must be 18 to 65" required><input required type="date" className="input" min={adultMin()} max={adultMax()} value={form.dob} onChange={set('dob')}/></Field>
        <Field label="Last donation"><input type="date" className="input" max={todayIso()} value={form.last_donation} onChange={set('last_donation')}/></Field>
        <Field label="Area or town" className="sm:col-span-2" required><input required className="input" value={form.area} onChange={set('area')}/></Field>
        <label className="flex items-start gap-3 rounded-xl border border-ink-600 p-3 text-sm sm:col-span-2"><input type="checkbox" className="mt-0.5" checked={!!form.consent} onChange={set('consent')}/>
          <span><span className="font-medium text-fg">Agreed to be contacted</span><span className="block text-fog-muted">Only donors who agreed get WhatsApp reminders and invites.</span></span></label>
      </form>}
    </Drawer>
  </div>
}
