import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Send,Plus,Pencil,Trash2,Droplets,AlertTriangle,Truck} from 'lucide-react'
import {motion} from 'framer-motion'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,fmt,wa} from '../lib/util'
import CountUp from '../components/CountUp'
import {PageHeader,Drawer,Field,Tabs,Badge,Empty,useConfirm,errText,useLive,undoToast,code,todayIso} from '../components/ui'

const ST=['collected','in_transit','testing','available','issued','discarded']
const LB={collected:'Collected',in_transit:'In transit',testing:'Testing',available:'Available',issued:'Issued',discarded:'Discarded'}
const TONE={collected:'blue',in_transit:'amber',testing:'amber',available:'green',issued:'neutral',discarded:'red'}
const ACTIVE=['collected','in_transit','testing','available']
const EREQ={patient_ref:'',blood_group:'',units_needed:'1',hospital:'',contact_name:'',contact_phone:'',notes:''}
async function all(){let out=[],from=0;for(;;){const {data,error}=await supabase.from('blood_units').select('*').order('id').range(from,from+999);if(error)throw error;out=out.concat(data);if(data.length<1000)return out;from+=1000}}

function Req({r,units,onEdit,setStatus}){
  const {settings}=useAuth(),[open,setOpen]=useState(false),[ds,setDs]=useState(null)
  const avail=units.filter(u=>u.blood_group===r.blood_group&&u.status==='available').length
  const show=async()=>{setOpen(!open);if(ds)return
    const {data}=await supabase.from('donors').select('id,full_name,phone,gender,last_donation,area,donor_no').is('deleted_at',null).eq('blood_group',r.blood_group).eq('consent',true).limit(300)
    setDs((data||[]).filter(d=>{if(!d.last_donation)return true;const n=new Date(d.last_donation);n.setDate(n.getDate()+(d.gender==='Female'?settings.gap_female:settings.gap_male));return n<=new Date()}))}
  const msg=`URGENT: ${r.units_needed} unit(s) of ${r.blood_group} blood needed at ${r.hospital}. Contact ${r.contact_name||''} ${r.contact_phone||''}. If you are eligible and can donate, please call or reply. - ${settings.club_name}`
  return <div className={`card ${r.status==='open'?'border-blood/40':''}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-4">
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blood/12 font-display text-xl font-bold text-blood">{r.blood_group}</span><div>
    <div className="mb-0.5"><span className="code">{code('ER',r.req_no,3)}</span></div>
    <div className="font-medium text-fg">{r.units_needed} unit{r.units_needed>1?'s':''} at {r.hospital}</div>
    <div className="text-sm text-fog-muted">{[r.contact_name,r.contact_phone,r.patient_ref&&`Ref ${r.patient_ref}`].filter(Boolean).join(', ')}</div>{r.notes&&<div className="text-sm text-fog-faint">{r.notes}</div>}
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><Badge tone={r.status==='open'?'red':r.status==='fulfilled'?'green':'neutral'}><span className="capitalize">{r.status}</span></Badge><span className="text-fog-muted">{avail} unit(s) available in stock · {fmt(r.created_at)}</span></div></div></div>
    <div className="flex gap-2">{r.status==='open'&&<><button className="btn" onClick={show}>{open?'Hide donors':'Find donors'}</button><button className="btn-quiet" onClick={()=>setStatus(r,'fulfilled')}>Fulfilled</button></>}
      <button className="btn-ghost" aria-label="Edit request" onClick={()=>onEdit(r)}><Pencil size={15}/></button></div></div>
    {open&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} className="overflow-hidden"><div className="mt-4 border-t border-ink-700 pt-3">{!ds?<div className="skeleton h-8"/>:<>
      <p className="mb-2 text-sm text-fog-muted">{ds.length} eligible {r.blood_group} donors who agreed to be contacted (exact blood group match only).</p>
      {ds.slice(0,30).map(d=><div key={d.id} className="flex items-center justify-between py-1.5 text-sm"><span className="text-fg">{d.full_name} <span className="text-fog-faint">{d.area}</span></span>
        <a className="btn-quiet px-3 py-1 text-xs" target="_blank" rel="noreferrer" href={wa(d.phone,msg)}><Send size={13}/>WhatsApp</a></div>)}</>}</div></motion.div>}</div>
}

export default function Stock(){
  const {can,user}=useAuth(),confirm=useConfirm(),edit=can('stock_edit')
  const tabs=[...(can('stock')?[['overview','Overview'],['units','Units'],['handover','Handover']]:[]),...(can('emergency')?[['emergency','Emergency']]:[])]
  const [units,setUnits]=useState([]),[th,setTh]=useState({}),[hand,setHand]=useState([]),[reqs,setReqs]=useState([]),[tab,setTab]=useState(tabs[0]?.[0]),[loaded,setLoaded]=useState(false)
  const [fg,setFg]=useState(''),[fs,setFs]=useState(''),[q,setQ]=useState(''),[unit,setUnit]=useState(null),[sel,setSel]=useState(new Set()),[bank,setBank]=useState(''),[hn,setHn]=useState(''),[ef,setEf]=useState(null)
  const load=async()=>{try{setUnits(await all())
    const t=await supabase.from('stock_thresholds').select('*');setTh(Object.fromEntries((t.data||[]).map(x=>[x.blood_group,x.min_units])))
    const h=await supabase.from('handovers').select('*, blood_units(count)').order('handover_no',{ascending:false}).limit(20);setHand(h.data||[])
    const r=await supabase.from('emergency_requests').select('*').is('deleted_at',null).order('req_no',{ascending:false}).limit(50);setReqs(r.data||[])}catch(e){toast.error(errText(e))}finally{setLoaded(true)}}
  useEffect(()=>{load()},[])
  useLive(['blood_units','handovers','emergency_requests','stock_thresholds'],load)
  const rpc=async(fn,args,msg)=>{const {error}=await supabase.rpc(fn,args);if(error){toast.error(error.message);return false}if(msg)toast.success(msg);load();return true}
  const today=new Date().toLocaleDateString('en-CA'),soon=new Date(Date.now()+7*864e5).toLocaleDateString('en-CA')
  const avail=g=>units.filter(u=>u.blood_group===g&&u.status==='available').length
  const pipe=g=>units.filter(u=>u.blood_group===g&&['collected','in_transit','testing'].includes(u.status)).length
  const total=units.filter(u=>u.status==='available').length
  const expiring=units.filter(u=>ACTIVE.includes(u.status)&&u.expiry_date&&u.expiry_date<=soon).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date))
  const list=useMemo(()=>units.filter(u=>(!fg||u.blood_group===fg)&&(!fs||u.status===fs)&&(!q||u.bag_number.toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>b.collected_on.localeCompare(a.collected_on)),[units,fg,fs,q])
  const collected=units.filter(u=>u.status==='collected')
  const quickStatus=async(u,s)=>{if(['issued','discarded'].includes(s))return setUnit({...u,_status:s,_note:''})
    if(await rpc('set_unit_status',{p_unit:u.id,p_status:s,p_note:null}))undoToast(`${u.bag_number}: ${LB[s]}`,async()=>{const {error}=await supabase.rpc('set_unit_status',{p_unit:u.id,p_status:u.status,p_note:null});if(error)throw error;load()})}
  const saveUnit=async()=>{const u=unit
    if(!u.bag_number?.trim())return toast.error('Enter the bag number')
    if(!(Number(u.volume_ml)>=100&&Number(u.volume_ml)<=500))return toast.error('Volume must be between 100 and 500 ml')
    if(u.collected_on&&u.collected_on>todayIso())return toast.error('Collection date cannot be in the future')
    if(u.expiry_date&&u.collected_on&&u.expiry_date<u.collected_on)return toast.error('Expiry must be after the collection date')
    if(u._new){if(await rpc('add_unit',{p_bag:u.bag_number,p_group:u.blood_group||null,p_vol:Number(u.volume_ml),p_collected:u.collected_on||null,p_status:u._status},'Unit added'))setUnit(null);return}
    if(['issued','discarded'].includes(u._status)&&u._status!==u.status&&!u._note.trim())return toast.error(u._status==='issued'?'Say who it was issued to':'Give a reason for discarding')
    if(!await rpc('update_unit',{p_unit:u.id,p_bag:u.bag_number,p_group:u.blood_group||null,p_vol:Number(u.volume_ml),p_collected:u.collected_on,p_expiry:u.expiry_date||null,p_note:u.note||''}))return
    if(u._status!==u.status&&!await rpc('set_unit_status',{p_unit:u.id,p_status:u._status,p_note:u._note||null}))return
    toast.success('Unit updated');setUnit(null)}
  const delUnit=async()=>{if(!await confirm({title:`Delete unit ${unit.bag_number}?`,body:'Only units added by hand can be deleted. Units from a donation should be marked discarded.',action:'Delete unit'}))return
    const {data,error}=await supabase.from('blood_units').delete().eq('id',unit.id).select('id')
    if(error)return toast.error(error.message);if(!data?.length)return toast.error('Units from a recorded donation cannot be deleted. Mark them discarded instead.')
    toast.success('Unit deleted');setUnit(null);load()}
  const saveReq=async e=>{e.preventDefault();const {id,created_at,created_by,req_no,deleted_at,deleted_by,_orig,...rest}=ef
    if(!ef.blood_group)return toast.error('Choose the blood group');if(!ef.hospital.trim())return toast.error('Enter the hospital')
    if(!(Number(ef.units_needed)>=1&&Number(ef.units_needed)<=20))return toast.error('Units must be between 1 and 20')
    if(ef.contact_phone&&!/^[6-9]\d{9}$/.test(String(ef.contact_phone).replace(/\D/g,'').slice(-10)))return toast.error('Enter a valid 10-digit contact number')
    const row=Object.fromEntries(Object.entries({...rest,units_needed:Number(ef.units_needed)}).map(([k,v])=>[k,v===''?null:v]))
    const {data,error}=id?await supabase.from('emergency_requests').update(row).eq('id',id).select().single():await supabase.from('emergency_requests').insert(row).select().single()
    if(error)return toast.error(error.message);setEf(null);load()
    if(id){const prev=Object.fromEntries(Object.keys(row).map(k=>[k,_orig[k]]));undoToast('Request updated',async()=>{const x=await supabase.from('emergency_requests').update(prev).eq('id',id);if(x.error)throw x.error;load()})}
    else toast.success(`Request created as ${code('ER',data.req_no,3)}`)}
  const delReq=async()=>{const id=ef.id;const {error}=await supabase.from('emergency_requests').update({deleted_at:new Date().toISOString(),deleted_by:user.id}).eq('id',id);if(error)return toast.error(error.message)
    setEf(null);load();undoToast('Request moved to the Recycle bin',async()=>{const x=await supabase.from('emergency_requests').update({deleted_at:null,deleted_by:null}).eq('id',id);if(x.error)throw x.error;load()})}
  const reqStatus=async(r,status)=>{const {error}=await supabase.from('emergency_requests').update({status}).eq('id',r.id);if(error)return toast.error(error.message);load()
    undoToast('Marked '+status,async()=>{const x=await supabase.from('emergency_requests').update({status:r.status}).eq('id',r.id);if(x.error)throw x.error;load()})}
  const doHandover=async()=>{if(await rpc('handover_units',{p_units:[...sel],p_bank:bank,p_notes:hn||null},`${sel.size} unit(s) handed over to ${bank}`)){setSel(new Set());setBank('');setHn('')}}
  const su=k=>e=>setUnit({...unit,[k]:e.target.value}),se=k=>e=>setEf({...ef,[k]:e.target.value})
  return <div>
    <PageHeader title="Blood stock" description={can('stock')?`${total} unit${total===1?'':'s'} ready to issue, ${expiring.length} expiring within a week`:'Emergency blood requests'}
      actions={<>{tab==='units'&&edit&&<button className="btn" onClick={()=>setUnit({_new:true,bag_number:'',blood_group:'',volume_ml:'350',collected_on:today,_status:'available'})}><Plus size={16}/>Add opening stock</button>}
        {tab==='emergency'&&<button className="btn" onClick={()=>setEf({...EREQ})}><AlertTriangle size={16}/>New emergency request</button>}</>}/>
    <Tabs id="stock-tabs" value={tab} onChange={setTab} tabs={tabs}/>
    {tab==='overview'&&<><div className="card mb-5"><div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{BLOOD.map(g=>{const a=avail(g),m=th[g]??5,low=a<m
      return <div key={g} className={`tile relative overflow-hidden px-2 py-4 text-center ${low?'!border-blood/60':''}`}>
        <motion.div aria-hidden className="liquid absolute inset-x-0 bottom-0" initial={{height:0}} animate={{height:`${Math.min(100,a/Math.max(1,(th[g]??5)*2)*100)}%`}} transition={{type:'spring',stiffness:60,damping:16,delay:.1}}/>
        {low&&<span className="absolute inset-x-0 top-0 h-0.5 bg-blood"/>}<div className="relative font-display text-sm font-bold text-blood">{g}</div>
        <div className="relative mt-1 font-display text-3xl font-semibold tabular-nums text-fg"><CountUp value={a}/></div>
        <div className="relative mt-1 text-[11px] text-fog-faint">{pipe(g)} on the way</div>{low&&<div className="relative mt-1 text-[11px] font-semibold text-blood">Low</div>}</div>})}</div>
      <p className="mt-3 text-xs text-fog-faint">Big number is units ready to issue. Low means below the minimum set in Settings.</p></div>
      <div className="card"><h2 className="mb-3 font-semibold text-fg">Expiring within 7 days</h2>
        {expiring.map(u=><button key={u.id} onClick={()=>edit&&setUnit({...u,_status:u.status,_note:''})} className="flex w-full items-center justify-between border-t border-ink-700 py-2 text-left text-sm first:border-0">
          <span className="flex items-center gap-3"><span className="font-medium text-fg">{u.bag_number}</span><span className="font-display font-bold text-blood">{u.blood_group||'?'}</span><Badge tone={TONE[u.status]}>{LB[u.status]}</Badge></span>
          <span className={u.expiry_date<today?'font-semibold text-blood':'text-fog-muted'}>{u.expiry_date<today?'Expired ':''}{fmt(u.expiry_date)}</span></button>)}
        {!expiring.length&&<p className="text-sm text-fog-faint">Nothing is about to expire.</p>}</div></>}
    {tab==='units'&&<div className="card overflow-hidden p-0">
      <div className="grid gap-2 border-b border-ink-700 p-3 sm:grid-cols-[1fr_auto_auto]"><input className="input" placeholder="Search bag number" value={q} onChange={e=>setQ(e.target.value)}/>
        <select className="input w-auto" value={fg} onChange={e=>setFg(e.target.value)}><option value="">All groups</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
        <select className="input w-auto" value={fs} onChange={e=>setFs(e.target.value)}><option value="">All steps</option>{ST.map(s=><option key={s} value={s}>{LB[s]}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="table"><thead><tr><th>Bag</th><th>Group</th><th>Collected</th><th>Expires</th><th>Step</th><th/></tr></thead>
        <tbody>{list.slice(0,200).map(u=><tr key={u.id}><td><div className="font-medium text-fg">{u.bag_number}</div>{u.note&&<div className="text-xs text-fog-faint">{u.note}</div>}</td>
          <td className="font-display font-bold text-blood">{u.blood_group||'?'}</td><td className="text-fog-muted">{fmt(u.collected_on)}</td>
          <td className={ACTIVE.includes(u.status)&&u.expiry_date<today?'font-semibold text-blood':'text-fog-muted'}>{fmt(u.expiry_date)}</td>
          <td>{edit?<select aria-label={`Step for ${u.bag_number}`} className="input w-auto py-1.5 text-xs" value={u.status} onChange={e=>quickStatus(u,e.target.value)}>{ST.map(s=><option key={s} value={s}>{LB[s]}</option>)}</select>:<Badge tone={TONE[u.status]}>{LB[u.status]}</Badge>}</td>
          <td className="text-right">{edit&&<button className="btn-ghost" aria-label={`Edit ${u.bag_number}`} onClick={()=>setUnit({...u,_status:u.status,_note:''})}><Pencil size={15}/></button>}</td></tr>)}</tbody></table>
        {loaded&&!list.length&&<Empty icon={Droplets} title="No units yet">Units appear here automatically when a donation is recorded.</Empty>}</div></div>}
    {tab==='handover'&&<div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]"><div className="card"><h2 className="font-semibold text-fg">Hand over collected units to the blood bank</h2><p className="mb-4 text-sm text-fog-muted">Tick the bags you are handing over. They move to In transit.</p>
      <div className="mb-4 max-h-72 overflow-y-auto rounded-xl border border-ink-700">{collected.map(u=><label key={u.id} className="flex cursor-pointer items-center gap-3 border-b border-ink-700 px-3 py-2 text-sm last:border-0 hover:bg-ink-750">
          <input type="checkbox" checked={sel.has(u.id)} onChange={e=>{const s=new Set(sel);e.target.checked?s.add(u.id):s.delete(u.id);setSel(s)}}/>{u.bag_number}<span className="font-display font-bold text-blood">{u.blood_group||'?'}</span><span className="ml-auto text-fog-faint">{fmt(u.collected_on)}</span></label>)}
        {!collected.length&&<p className="p-4 text-sm text-fog-faint">No collected units waiting.</p>}</div>
      <div className="flex flex-wrap gap-2"><input className="input flex-1" placeholder="Blood bank name" value={bank} onChange={e=>setBank(e.target.value)}/><input className="input flex-1" placeholder="Notes (optional)" value={hn} onChange={e=>setHn(e.target.value)}/>
        <button className="btn" disabled={!sel.size||!bank} onClick={doHandover}><Truck size={15}/>Hand over {sel.size||''} units</button></div></div>
      <div className="card h-fit"><h2 className="mb-3 font-semibold text-fg">Recent handovers</h2>{hand.map(h=><div key={h.id} className="flex justify-between border-t border-ink-700 py-2 text-sm first:border-0"><span className="text-fg"><span className="code mr-1.5">{code('HO',h.handover_no)}</span>{h.bank_name}{h.notes&&<span className="text-fog-faint"> · {h.notes}</span>}</span><span className="text-fog-muted">{h.blood_units?.[0]?.count??0} units · {fmt(h.handed_on)}</span></div>)}{!hand.length&&<p className="text-sm text-fog-faint">No handovers yet.</p>}</div></div>}
    {tab==='emergency'&&<div className="space-y-3">{reqs.map(r=><Req key={r.id} r={r} units={units} setStatus={reqStatus} onEdit={x=>setEf(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v??''])))}/>)}
      {loaded&&!reqs.length&&<div className="card"><Empty icon={AlertTriangle} title="No emergency requests">Create one when a hospital asks for blood. It finds matching donors for you.</Empty></div>}</div>}

    <Drawer open={!!unit} onClose={()=>setUnit(null)} title={unit?._new?'Add opening stock':`Unit ${unit?.bag_number}`} description={unit?.donation_reg?'From a recorded donation':unit?._new?'For units already in the blood bank.':'Added by hand'}
      footer={unit&&<>{!unit._new&&!unit.donation_reg&&<button className="btn-quiet mr-auto text-blood" onClick={delUnit}><Trash2 size={15}/>Delete</button>}
        <button className="btn-quiet" onClick={()=>setUnit(null)}>Cancel</button><button className="btn" form="unit-form">{unit._new?'Add unit':'Save changes'}</button></>}>
      {unit&&<form id="unit-form" onSubmit={e=>{e.preventDefault();saveUnit()}} className="grid gap-4 sm:grid-cols-2">
        <Field label="Bag number" required><input className="input" placeholder="Bag number" required value={unit.bag_number} onChange={su('bag_number')}/></Field>
        <Field label="Blood group" required><select required className="input" value={unit.blood_group||''} onChange={su('blood_group')}><option value="">Not known</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Volume (ml)" required><input required className="input" type="number" value={unit.volume_ml||''} onChange={su('volume_ml')}/></Field>
        <Field label="Collected on" required><input required className="input" type="date" value={unit.collected_on||''} onChange={su('collected_on')}/></Field>
        {!unit._new&&<Field label="Expires on"><input className="input" type="date" value={unit.expiry_date||''} onChange={su('expiry_date')}/></Field>}
        <Field label="Step"><select className="input" value={unit._status} onChange={su('_status')}>{ST.map(s=><option key={s} value={s}>{LB[s]}</option>)}</select></Field>
        {!unit._new&&['issued','discarded'].includes(unit._status)&&unit._status!==unit.status&&<Field label={unit._status==='issued'?'Issued to':'Reason for discarding'} className="sm:col-span-2"><input className="input" autoFocus value={unit._note} onChange={su('_note')}/></Field>}
        {!unit._new&&<Field label="Note" className="sm:col-span-2"><input className="input" value={unit.note||''} onChange={su('note')}/></Field>}
      </form>}
    </Drawer>
    <Drawer open={!!ef} onClose={()=>setEf(null)} title={ef?.id?'Edit emergency request':'New emergency request'}
      footer={ef&&<>{ef.id&&<button className="btn-quiet mr-auto text-blood" onClick={delReq}><Trash2 size={15}/>Delete</button>}<button className="btn-quiet" onClick={()=>setEf(null)}>Cancel</button><button className="btn" form="req-form">{ef.id?'Save changes':'Create request'}</button></>}>
      {ef&&<form id="req-form" onSubmit={saveReq} className="grid gap-4 sm:grid-cols-2">
        <Field label="Blood group needed" required><select className="input" required value={ef.blood_group} onChange={se('blood_group')}><option value="">Choose</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Units" required><input required className="input" type="number" min="1" value={ef.units_needed} onChange={se('units_needed')}/></Field>
        <Field label="Hospital" className="sm:col-span-2" required><input className="input" placeholder="Hospital" required value={ef.hospital} onChange={se('hospital')}/></Field>
        <Field label="Contact name" required><input required className="input" value={ef.contact_name} onChange={se('contact_name')}/></Field>
        <Field label="Contact phone" required><input required className="input" value={ef.contact_phone} onChange={se('contact_phone')}/></Field>
        <Field label="Patient reference"><input className="input" value={ef.patient_ref} onChange={se('patient_ref')}/></Field>
        {ef.id&&<div><span className="label">Status</span><div className="flex gap-1">{['open','fulfilled','cancelled'].map(s=><button type="button" key={s} onClick={()=>setEf({...ef,status:s})}
          className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold capitalize ${ef.status===s?'border-brand bg-brand/15 text-fg':'border-ink-600 text-fog-muted'}`}>{s}</button>)}</div></div>}
        <Field label="Notes" className="sm:col-span-2"><textarea className="input" rows="3" value={ef.notes} onChange={se('notes')}/></Field>
      </form>}
    </Drawer>
  </div>
}
