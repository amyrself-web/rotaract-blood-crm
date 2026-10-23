import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {motion} from 'framer-motion'
import {Plus,Eye,HeartHandshake,FileText,Download,Trash2,AlertTriangle,Clock,Phone,ChevronRight,Search,Mail} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {BLOOD,normPhone,fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,Tabs,useLive,undoToast,code,errText,todayIso} from '../components/ui'
import {rotaryYear,afterlifePdf,csv,KIND_LABEL,iso} from '../lib/clubReports'
import {gratitudeLetter} from '../lib/docpdf'
import CountUp from '../components/CountUp'

const STATUS=['informed','team sent','collected','handed over','not suitable','family declined']
const sTone={informed:'amber','team sent':'blue',collected:'green','handed over':'green','not suitable':'neutral','family declined':'neutral',active:'green',fulfilled:'blue',withdrawn:'neutral',deceased:'amber'}
const emptyCase=()=>({kinds:['eye'],deceased_name:'',age:'',gender:'',address:'',area:'',died_on:todayIso(),died_at:'',cause_of_death:'',place_of_death:'Home',hospital_name:'',informed_at:'',collected_at:'',
  institution:'',institution_contact:'',team_lead:'',technician:'',corneas:'',body_received_by:'',family_contact:'',family_relation:'',family_phone:'',consent_by:'',consent_form:false,coordinated_by:'',pledge_id:'',status:'informed',not_suitable_reason:'',letter_issued:false,notes:''})
const emptyPledge=()=>({full_name:'',phone:'',dob:'',gender:'',blood_group:'',address:'',area:'',eye:true,body:false,organ:false,skin:false,pledged_on:todayIso(),witness_name:'',witness_phone:'',family_contact:'',family_phone:'',family_informed:false,card_issued:false,institution:'',notes:'',status:'active'})
const local=v=>v?new Date(v).toLocaleString('sv-SE',{timeZone:'Asia/Kolkata'}).slice(0,16).replace(' ','T'):''
const hoursAfter=c=>c.collected_at&&c.died_at?(new Date(c.collected_at)-new Date(`${c.died_on}T${c.died_at}+05:30`))/36e5:null
const kindsOf=r=>r.kinds||['eye','body','organ','skin'].filter(k=>r[k])

function Guide(){
  return <div className="card relative mb-5 overflow-hidden border-blood/30">
    <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blood/10 blur-2xl"/>
    <div className="relative flex flex-wrap items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blood/15 text-blood"><AlertTriangle size={20}/></span>
      <div className="min-w-0 flex-1"><div className="font-display font-semibold text-fg">When a family calls about eye donation</div>
        <p className="mt-0.5 text-sm text-fog-muted">Eyes must be collected within 6 hours of death. Call the eye bank first, then guide the family:</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-fog sm:grid-cols-2">{['Close both eyes and cover with wet cotton','Switch off the fan; AC can stay on','Raise the head with a pillow','Keep the death certificate or doctor note ready','Two family witnesses sign the consent form','Takes about 20 minutes and leaves no disfigurement'].map(t=><li key={t} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blood"/>{t}</li>)}</ul></div></div></div>
}

export default function Afterlife(){
  const {brand}=useBrand(),ry=rotaryYear()
  const [view,setView]=useState('cases'),[cases,setCases]=useState(null),[pledges,setPledges]=useState(null),[sum,setSum]=useState(null),[q,setQ]=useState('')
  const [cf,setCf]=useState(null),[pf,setPf]=useState(null),[busy,setBusy]=useState(false),[pdf,setPdf]=useState('')
  const load=async()=>{try{const [c,p,s]=await Promise.all([supabase.from('afterlife_cases').select('*').is('deleted_at',null).order('case_no',{ascending:false}),
      supabase.from('pledges').select('*').is('deleted_at',null).order('pledge_no',{ascending:false}),supabase.rpc('afterlife_summary',{p_from:ry.from,p_to:ry.to})])
    if(c.error)throw c.error;setCases(c.data);setPledges(p.data||[]);setSum(s.data)}catch(e){toast.error(errText(e))}}
  useEffect(()=>{load()},[]);useLive(['afterlife_cases','pledges'],load)
  const run=async(k,f)=>{setPdf(k);try{await f()}catch(e){toast.error(errText(e))}setPdf('')}
  const clean=(o,skip)=>{const r={};for(const [k,v] of Object.entries(o))if(!skip.includes(k))r[k]=v===''?null:v;return r}
  const saveCase=async e=>{e.preventDefault();if(!cf.kinds.length)return toast.error('Choose what was donated')
    if(cf.family_phone&&!/^[6-9]\d{9}$/.test(normPhone(cf.family_phone)))return toast.error('Family mobile must be 10 digits')
    setBusy(true);const row=clean({...cf,family_phone:cf.family_phone?normPhone(cf.family_phone):'',age:cf.age===''?'':Number(cf.age),corneas:cf.corneas===''?'':Number(cf.corneas),
      collected_at:cf.collected_at?new Date(cf.collected_at+':00+05:30').toISOString():'',informed_at:cf.informed_at?new Date(cf.informed_at+':00+05:30').toISOString():''},['id','case_no','created_at','created_by','deleted_at','deleted_by','_orig'])
    const r=cf.id?await supabase.from('afterlife_cases').update(row).eq('id',cf.id).select().single():await supabase.from('afterlife_cases').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message)
    if(cf.id){const prev=clean(cf._orig,['id','case_no','created_at','created_by','deleted_at','deleted_by']);undoToast('Case updated',async()=>{const x=await supabase.from('afterlife_cases').update(prev).eq('id',cf.id);if(x.error)throw x.error;load()})}
    else toast.success(`Case ${code('ED',r.data.case_no,4)} recorded`)
    setCf(null);load()}
  const savePledge=async e=>{e.preventDefault();for(const [k,l] of [['phone','Mobile'],['witness_phone','Witness mobile'],['family_phone','Family mobile']])if(pf[k]&&!/^[6-9]\d{9}$/.test(normPhone(pf[k])))return toast.error(`${l} must be 10 digits`)
    setBusy(true);const row=clean({...pf,phone:pf.phone?normPhone(pf.phone):'',witness_phone:pf.witness_phone?normPhone(pf.witness_phone):'',family_phone:pf.family_phone?normPhone(pf.family_phone):''},['id','pledge_no','created_at','created_by','deleted_at','deleted_by','_orig','donor_id','member_id'])
    const r=pf.id?await supabase.from('pledges').update(row).eq('id',pf.id).select().single():await supabase.from('pledges').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message)
    if(pf.id){const prev=clean(pf._orig,['id','pledge_no','created_at','created_by','deleted_at','deleted_by','donor_id','member_id']);undoToast('Pledge updated',async()=>{const x=await supabase.from('pledges').update(prev).eq('id',pf.id);if(x.error)throw x.error;load()})}
    else toast.success(`Pledge ${code('PL',r.data.pledge_no,4)} saved`)
    setPf(null);load()}
  const binIt=async(t,o,label,close)=>{const r=await supabase.from(t).update({deleted_at:new Date().toISOString()}).eq('id',o.id);if(r.error)return toast.error(r.error.message)
    close(null);load();undoToast(`${label} moved to the Recycle bin`,async()=>{const x=await supabase.from(t).update({deleted_at:null}).eq('id',o.id);if(x.error)throw x.error;load()})}
  const openCase=r=>setCf(r?{...emptyCase(),...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v??''])),died_at:r.died_at?.slice(0,5)||'',collected_at:local(r.collected_at),informed_at:local(r.informed_at),_orig:r}:emptyCase())
  const openPledge=r=>setPf(r?{...emptyPledge(),...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v??''])),_orig:r}:emptyPledge())
  const fromPledge=p=>{setPf(null);setCf({...emptyCase(),deceased_name:p.full_name,gender:p.gender,address:p.address,area:p.area,family_contact:p.family_contact,family_phone:p.family_phone,
    kinds:kindsOf(p),pledge_id:p.id,institution:p.institution,age:p.dob?Math.floor((Date.now()-new Date(p.dob))/31557600000):''})}
  const c1=v=>e=>setCf({...cf,[v]:e.target.type==='checkbox'?e.target.checked:e.target.value}),p1=v=>e=>setPf({...pf,[v]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const match=(s)=>!q||s.toLowerCase().includes(q.toLowerCase())
  const shownCases=(cases||[]).filter(c=>match(`${code('ED',c.case_no,4)} ${c.deceased_name} ${c.area||''} ${c.family_contact} ${c.institution||''}`))
  const shownPledges=(pledges||[]).filter(p=>match(`${code('PL',p.pledge_no,4)} ${p.full_name} ${p.phone||''} ${p.area||''}`))
  const h=cf?hoursAfter({...cf,collected_at:cf.collected_at?cf.collected_at+':00+05:30':''}):null

  return <div>
    <PageHeader title="Eye and body donation" description="Pledges from the living, and donations after death, with the family and eye bank details."
      actions={<><button className="btn-quiet" disabled={!!pdf} onClick={()=>run('reg',()=>afterlifePdf(brand,{...ry}))}><FileText size={15}/>{pdf==='reg'?'Preparing…':`Register ${ry.label}`}</button>
        <button className="btn-quiet" onClick={()=>openPledge(null)}><HeartHandshake size={15}/>New pledge</button>
        <button className="btn" onClick={()=>openCase(null)}><Plus size={16}/>Record donation</button></>}/>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Eye donations',sum?.eye,`${sum?.corneas??0} corneas · ${ry.label}`,true],['Body donations',sum?.body,`Organ ${sum?.organ??0} · skin ${sum?.skin??0}`],['Active pledges',sum?.pledges_total,`${sum?.pledges??0} new in ${ry.label}`],['Cases this year',sum?.cases,'Including not suitable']].map(([l,v,s,b])=>
        <div key={l} className="card py-4"><div className={`text-2xl font-semibold tabular-nums ${b?'text-blood':'text-fg'}`}>{v==null?<span className="skeleton inline-block h-7 w-10"/>:<CountUp value={v}/>}</div><div className="text-xs text-fog-muted">{l}</div><div className="mt-1 text-[11px] text-fog-faint">{s}</div></div>)}</div>
    <Guide/>
    <div className="mb-3 flex flex-wrap items-center gap-3"><Tabs id="al-tabs" value={view} onChange={setView} tabs={[['cases',`Donations (${cases?.length??0})`],['pledges',`Pledges (${pledges?.length??0})`]]}/>
      <div className="relative mb-5 min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, area, ID" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <button className="btn-quiet mb-5" onClick={()=>view==='cases'?csv(shownCases.map(c=>({case:code('ED',c.case_no,4),name:c.deceased_name,age:c.age,gender:c.gender,area:c.area,died_on:c.died_on,died_at:c.died_at,donated:c.kinds.join(' '),institution:c.institution,collected_at:c.collected_at,corneas:c.corneas,family:c.family_contact,relation:c.family_relation,family_phone:c.family_phone,status:c.status})),'eye-body-donations.csv')
        :csv(shownPledges.map(p=>({pledge:code('PL',p.pledge_no,4),name:p.full_name,phone:p.phone,area:p.area,pledged_on:p.pledged_on,eye:p.eye,body:p.body,organ:p.organ,skin:p.skin,card:p.card_issued,status:p.status})),'pledges.csv')}><Download size={15}/>CSV</button></div>

    {view==='cases'&&(cases===null?<div className="skeleton h-24"/>:!shownCases.length?<div className="card"><Empty icon={Eye} title="No donations recorded" action={<button className="btn" onClick={()=>openCase(null)}><Plus size={16}/>Record donation</button>}>Record each eye or body donation with the family and eye bank details.</Empty></div>
    :<div className="card overflow-hidden p-0"><ul className="divide-y divide-ink-700/80">{shownCases.map((c,i)=>{const hr=hoursAfter(c)
      return <motion.li key={c.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:Math.min(i,10)*.03}}><button onClick={()=>openCase(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand/[.04]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blood/10 text-blood">{c.kinds.includes('eye')?<Eye size={20}/>:<HeartHandshake size={20}/>}</span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="code">{code('ED',c.case_no,4)}</span><span className="truncate font-medium text-fg">{c.deceased_name}{c.age?`, ${c.age}`:''}</span>
          {c.kinds.map(k=><Badge key={k} tone="red">{KIND_LABEL[k]}</Badge>)}</span>
          <span className="mt-0.5 block truncate text-xs text-fog-faint">Died {fmt(c.died_on)}{c.area?` · ${c.area}`:''}{c.institution?` · ${c.institution}`:''} · family: {c.family_contact}</span></span>
        {hr!=null&&<span className={`hidden whitespace-nowrap text-xs sm:inline ${c.kinds.includes('eye')&&hr>6?'text-blood':'text-fog-muted'}`}><Clock size={12} className="mr-1 inline"/>{hr.toFixed(1)} h</span>}
        <Badge tone={sTone[c.status]}>{c.status}</Badge><ChevronRight size={16} className="shrink-0 text-fog-faint"/></button></motion.li>})}</ul></div>)}

    {view==='pledges'&&(pledges===null?<div className="skeleton h-24"/>:!shownPledges.length?<div className="card"><Empty icon={HeartHandshake} title="No pledges yet" action={<button className="btn" onClick={()=>openPledge(null)}><Plus size={16}/>New pledge</button>}>Record people who pledge to donate eyes or body after death.</Empty></div>
    :<div className="card overflow-hidden p-0"><ul className="divide-y divide-ink-700/80">{shownPledges.map(p=><li key={p.id}><button onClick={()=>openPledge(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand/[.04]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><HeartHandshake size={20}/></span>
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="code">{code('PL',p.pledge_no,4)}</span><span className="truncate font-medium text-fg">{p.full_name}</span>{kindsOf(p).map(k=><Badge key={k} tone="blue">{KIND_LABEL[k]}</Badge>)}</span>
        <span className="mt-0.5 block truncate text-xs text-fog-faint">Pledged {fmt(p.pledged_on)}{p.area?` · ${p.area}`:''}{p.phone?` · ${p.phone}`:''}{p.card_issued?' · card issued':''}</span></span>
      <Badge tone={sTone[p.status]}>{p.status}</Badge><ChevronRight size={16} className="shrink-0 text-fog-faint"/></button></li>)}</ul></div>)}

    <Drawer open={!!cf} onClose={()=>setCf(null)} width="max-w-2xl" title={cf?.id?`${code('ED',cf.case_no,4)} · ${cf.deceased_name}`:'Record donation after death'} description="Fields marked * are required. Times are Indian time."
      footer={cf&&<>{cf.id&&<button className="btn-quiet mr-auto text-blood" onClick={()=>binIt('afterlife_cases',cf,cf.deceased_name,setCf)}><Trash2 size={15}/>Recycle bin</button>}
        {cf.id&&['collected','handed over'].includes(cf.status)&&<button className="btn-quiet" disabled={!!pdf} onClick={()=>run('letter',async()=>{await gratitudeLetter(cf._orig,brand,fmt);if(!cf._orig.letter_issued){await supabase.from('afterlife_cases').update({letter_issued:true}).eq('id',cf.id);load()}})}><Mail size={15}/>{pdf==='letter'?'Preparing…':'Letter to family'}</button>}
        <button className="btn-quiet" onClick={()=>setCf(null)}>Cancel</button><button className="btn" form="case-form" disabled={busy}>{busy?'Saving…':cf.id?'Save changes':'Save'}</button></>}>
      {cf&&<form id="case-form" onSubmit={saveCase} className="grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2"><legend className="label">What was donated *</legend><div className="flex flex-wrap gap-2">{Object.entries(KIND_LABEL).map(([k,l])=><label key={k} className={`chip cursor-pointer px-3 py-1.5 text-sm ${cf.kinds.includes(k)?'border-blood/50 bg-blood/15 text-fg':''}`}>
          <input type="checkbox" className="sr-only" checked={cf.kinds.includes(k)} onChange={e=>setCf({...cf,kinds:e.target.checked?[...cf.kinds,k]:cf.kinds.filter(x=>x!==k)})}/>{l}</label>)}</div></fieldset>
        <h3 className="font-display text-sm font-semibold text-fg sm:col-span-2">The person who passed away</h3>
        <Field label="Name" required className="sm:col-span-2"><input className="input" required minLength={2} value={cf.deceased_name} onChange={c1('deceased_name')}/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Age"><input className="input" type="number" min="0" max="120" value={cf.age} onChange={c1('age')}/></Field>
          <Field label="Gender"><select className="input" value={cf.gender} onChange={c1('gender')}><option value="">-</option><option>Male</option><option>Female</option><option>Other</option></select></Field></div>
        <Field label="Area or town"><input className="input" value={cf.area} onChange={c1('area')}/></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={cf.address} onChange={c1('address')}/></Field>
        <Field label="Date of death" required><input type="date" className="input" required max={todayIso()} value={cf.died_on} onChange={c1('died_on')}/></Field>
        <Field label="Time of death"><input type="time" className="input" value={cf.died_at} onChange={c1('died_at')}/></Field>
        <Field label="Place of death"><select className="input" value={cf.place_of_death} onChange={c1('place_of_death')}><option>Home</option><option>Hospital</option><option>Other</option></select></Field>
        {cf.place_of_death==='Hospital'?<Field label="Hospital"><input className="input" value={cf.hospital_name} onChange={c1('hospital_name')}/></Field>:<Field label="Cause of death"><input className="input" value={cf.cause_of_death} onChange={c1('cause_of_death')}/></Field>}
        <h3 className="mt-2 font-display text-sm font-semibold text-fg sm:col-span-2">Family consent</h3>
        <Field label="Family member" required><input className="input" required value={cf.family_contact} onChange={c1('family_contact')}/></Field>
        <Field label="Relation"><select className="input" value={cf.family_relation} onChange={c1('family_relation')}><option value="">-</option>{['Son','Daughter','Wife','Husband','Father','Mother','Brother','Sister','Grandchild','Relative','Friend'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Family mobile"><input className="input" inputMode="numeric" value={cf.family_phone} onChange={c1('family_phone')}/></Field>
        <Field label="Consent signed by" hint="Names of the two witnesses"><input className="input" value={cf.consent_by} onChange={c1('consent_by')}/></Field>
        <label className="flex items-center gap-2 text-sm text-fog sm:col-span-2"><input type="checkbox" checked={!!cf.consent_form} onChange={c1('consent_form')}/>Signed consent form received</label>
        <h3 className="mt-2 font-display text-sm font-semibold text-fg sm:col-span-2">Collection</h3>
        <Field label="Eye bank / medical college"><input className="input" value={cf.institution} onChange={c1('institution')}/></Field>
        <Field label="Institution phone"><input className="input" value={cf.institution_contact} onChange={c1('institution_contact')}/></Field>
        <Field label="We were informed at"><input type="datetime-local" className="input" value={cf.informed_at} onChange={c1('informed_at')}/></Field>
        <Field label="Collected at" required={['collected','handed over'].includes(cf.status)} hint={h!=null?`${h.toFixed(1)} hours after death${cf.kinds.includes('eye')&&h>6?' · over the 6 hour limit':''}`:undefined}>
          <input type="datetime-local" className="input" required={['collected','handed over'].includes(cf.status)} value={cf.collected_at} onChange={c1('collected_at')}/></Field>
        <Field label="Team lead / doctor"><input className="input" value={cf.team_lead} onChange={c1('team_lead')}/></Field>
        {cf.kinds.includes('eye')?<Field label="Corneas collected"><select className="input" value={cf.corneas} onChange={c1('corneas')}><option value="">-</option><option value="2">2</option><option value="1">1</option><option value="0">0</option></select></Field>
          :<Field label="Body received by"><input className="input" value={cf.body_received_by} onChange={c1('body_received_by')}/></Field>}
        <Field label="Coordinated by (club)"><input className="input" value={cf.coordinated_by} onChange={c1('coordinated_by')}/></Field>
        <Field label="Linked pledge"><select className="input" value={cf.pledge_id} onChange={c1('pledge_id')}><option value="">None</option>{(pledges||[]).filter(p=>p.status!=='withdrawn'||p.id===cf.pledge_id).map(p=><option key={p.id} value={p.id}>{code('PL',p.pledge_no,4)} {p.full_name}</option>)}</select></Field>
        <Field label="Status" required><select className="input" value={cf.status} onChange={c1('status')}>{STATUS.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></Field>
        {cf.status==='not suitable'&&<Field label="Reason" required><input className="input" required value={cf.not_suitable_reason} onChange={c1('not_suitable_reason')}/></Field>}
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={cf.notes} onChange={c1('notes')}/></Field>
      </form>}
    </Drawer>

    <Drawer open={!!pf} onClose={()=>setPf(null)} width="max-w-2xl" title={pf?.id?`${code('PL',pf.pledge_no,4)} · ${pf.full_name}`:'New pledge'} description="Someone who promises to donate after death. Tell the family; their consent is still needed later."
      footer={pf&&<>{pf.id&&<button className="btn-quiet mr-auto text-blood" onClick={()=>binIt('pledges',pf,pf.full_name,setPf)}><Trash2 size={15}/>Recycle bin</button>}
        {pf.id&&['active','deceased'].includes(pf.status)&&<button className="btn-quiet" onClick={()=>fromPledge(pf)}><Eye size={15}/>Record donation</button>}
        <button className="btn-quiet" onClick={()=>setPf(null)}>Cancel</button><button className="btn" form="pledge-form" disabled={busy}>{busy?'Saving…':pf.id?'Save changes':'Save pledge'}</button></>}>
      {pf&&<form id="pledge-form" onSubmit={savePledge} className="grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2"><legend className="label">Pledges to donate *</legend><div className="flex flex-wrap gap-2">{Object.entries(KIND_LABEL).map(([k,l])=><label key={k} className={`chip cursor-pointer px-3 py-1.5 text-sm ${pf[k]?'border-brand/50 bg-brand/15 text-fg':''}`}>
          <input type="checkbox" className="sr-only" checked={!!pf[k]} onChange={p1(k)}/>{l}</label>)}</div></fieldset>
        <Field label="Full name" required className="sm:col-span-2"><input className="input" required minLength={2} value={pf.full_name} onChange={p1('full_name')}/></Field>
        <Field label="Mobile" required><input className="input" required inputMode="numeric" value={pf.phone} onChange={p1('phone')}/></Field>
        <Field label="Date of birth"><input type="date" className="input" max={todayIso()} value={pf.dob} onChange={p1('dob')}/></Field>
        <Field label="Gender"><select className="input" value={pf.gender} onChange={p1('gender')}><option value="">-</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Blood group"><select className="input" value={pf.blood_group} onChange={p1('blood_group')}><option value="">Not known</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Area or town"><input className="input" value={pf.area} onChange={p1('area')}/></Field>
        <Field label="Pledged on" required><input type="date" className="input" required max={todayIso()} value={pf.pledged_on} onChange={p1('pledged_on')}/></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={pf.address} onChange={p1('address')}/></Field>
        <Field label="Family contact" required><input className="input" required value={pf.family_contact} onChange={p1('family_contact')}/></Field>
        <Field label="Family mobile"><input className="input" inputMode="numeric" value={pf.family_phone} onChange={p1('family_phone')}/></Field>
        <Field label="Witness"><input className="input" value={pf.witness_name} onChange={p1('witness_name')}/></Field>
        <Field label="Witness mobile"><input className="input" inputMode="numeric" value={pf.witness_phone} onChange={p1('witness_phone')}/></Field>
        <Field label="Registered with (eye bank)"><input className="input" value={pf.institution} onChange={p1('institution')}/></Field>
        <Field label="Status"><select className="input" value={pf.status} onChange={p1('status')}><option value="active">Active</option><option value="withdrawn">Withdrawn</option><option value="deceased">Passed away</option><option value="fulfilled">Fulfilled</option></select></Field>
        <label className="flex items-center gap-2 text-sm text-fog"><input type="checkbox" checked={!!pf.family_informed} onChange={p1('family_informed')}/>Family has been told</label>
        <label className="flex items-center gap-2 text-sm text-fog"><input type="checkbox" checked={!!pf.card_issued} onChange={p1('card_issued')}/>Donor card issued</label>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={pf.notes} onChange={p1('notes')}/></Field>
      </form>}
    </Drawer>
  </div>
}
