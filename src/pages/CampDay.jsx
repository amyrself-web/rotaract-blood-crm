import {toast} from 'sonner'
import {useLive,code,adultMax,adultMin,useConfirm,PageHeader,Tabs,Badge} from '../components/ui'
import Team from '../components/camp/Team'
import People from '../components/camp/People'
import Summary,{tilesOf} from '../components/camp/Summary'
import {Food,Saplings,Sessions} from '../components/camp/Records'
import {isBlood,kindOf,typeName} from '../lib/campTypes'
import {celebrate} from '../lib/fx'
import {useEffect,useRef,useState} from 'react'
import {UserPlus,Undo2,Search,WifiOff,CloudUpload,X} from 'lucide-react'
import {isNetError,readQueue,enqueueAction,dropAction,flush,cacheGet,cacheSet} from '../lib/offline'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,normPhone,fmt} from '../lib/util'
import CountUp from '../components/CountUp'
import TokenPrint,{PrintOne,autoPrint} from '../components/camp/TokenPrint'
import {useBrand} from '../context/Brand'
const LABEL={registered:'Registered',checked_in:'Checked in',screened:'Cleared to donate',donated:'Donated',deferred:'Deferred',no_show:'No-show'}
const TONE={registered:'text-fog-muted',checked_in:'text-brand',screened:'text-brand',donated:'text-fg font-semibold',deferred:'text-blood',no_show:'text-fog-faint'}
const Field=({label,children})=><label className="text-sm text-fog-muted">{label}{children}</label>
function Screen({row,run,close}){
  const {settings:S}=useAuth()
  const [v,setV]=useState({hb:'',sys:'',dia:'',wt:'',pulse:'',notes:'',reason:'',days:'90'})
  const set=k=>e=>setV({...v,[k]:e.target.value}),n=x=>x===''?null:Number(x),issues=[]
  if(v.hb&&+v.hb<S.min_hb)issues.push(`Hb below ${S.min_hb}`)
  if(v.wt&&+v.wt<S.min_weight)issues.push(`Weight below ${S.min_weight} kg`)
  if(v.sys&&(+v.sys<100||+v.sys>180))issues.push('Systolic BP outside 100 to 180')
  if(v.dia&&(+v.dia<50||+v.dia>100))issues.push('Diastolic BP outside 50 to 100')
  if(v.pulse&&(+v.pulse<50||+v.pulse>100))issues.push('Pulse outside 50 to 100')
  const gap=row.last_donation?Math.floor((Date.now()-new Date(row.last_donation))/864e5):null,need=row.gender==='Female'?S.gap_female:S.gap_male
  if(gap!==null&&gap<need)issues.push(`Last donated ${gap} days ago (gap is ${need} days)`)
  const send=d=>run('save_screening',{p_reg:row.reg_id,p_hb:n(v.hb),p_sys:n(v.sys),p_dia:n(v.dia),p_wt:n(v.wt),p_pulse:n(v.pulse),p_decision:d,p_reason:d==='deferred'?v.reason:null,p_until:d==='deferred'?new Date(Date.now()+Number(v.days||0)*864e5).toISOString().slice(0,10):null,p_notes:v.notes||null})
  return <div className="card mb-5"><h2 className="mb-3 font-semibold text-fg">Screening: {row.full_name} <span className="text-blood">{row.blood_group}</span></h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Field label="Hb (g/dL)"><input className="input mt-1" type="number" step="0.1" value={v.hb} onChange={set('hb')}/></Field>
      <Field label="Weight (kg)"><input className="input mt-1" type="number" step="0.1" value={v.wt} onChange={set('wt')}/></Field>
      <Field label="BP high"><input className="input mt-1" type="number" value={v.sys} onChange={set('sys')}/></Field>
      <Field label="BP low"><input className="input mt-1" type="number" value={v.dia} onChange={set('dia')}/></Field>
      <Field label="Pulse"><input className="input mt-1" type="number" value={v.pulse} onChange={set('pulse')}/></Field></div>
    <input className="input mt-3" placeholder="Notes (optional)" value={v.notes} onChange={set('notes')}/>
    <p className={`mt-3 text-sm ${issues.length?'text-blood':'text-fog-muted'}`}>{issues.length?issues.join('. ')+'.':v.hb&&v.wt&&v.sys&&v.dia?'Readings meet the usual criteria.':'Enter the readings.'} The final decision is the medical officer's.</p>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <button className="btn" onClick={()=>send('eligible')}>Cleared to donate</button>
      <input className="input w-48" placeholder="Reason for deferral" value={v.reason} onChange={set('reason')}/>
      <input className="input w-20" type="number" min="1" title="Days" value={v.days} onChange={set('days')}/><span className="pb-2 text-sm text-fog-muted">days</span>
      <button className="btn bg-blood hover:bg-rose-600" disabled={!v.reason} onClick={()=>send('deferred')}>Defer</button>
      <button className="btn-ghost text-sm" onClick={close}>Cancel</button></div></div>
}
function Donate({row,run,close}){
  const [v,setV]=useState({bag:'',vol:'350',reaction:''}),set=k=>e=>setV({...v,[k]:e.target.value})
  return <div className="card mb-5"><h2 className="mb-3 font-semibold text-fg">Record donation: {row.full_name} <span className="text-blood">{row.blood_group}</span></h2>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="Bag number"><input className="input mt-1" value={v.bag} onChange={set('bag')}/></Field>
      <Field label="Volume (ml)"><input className="input mt-1" type="number" value={v.vol} onChange={set('vol')}/></Field>
      <Field label="Reaction (if any)"><input className="input mt-1" value={v.reaction} onChange={set('reaction')}/></Field></div>
    <div className="mt-3 flex gap-2"><button className="btn" disabled={!v.bag} onClick={()=>run('record_donation',{p_reg:row.reg_id,p_bag:v.bag,p_vol:Number(v.vol),p_reaction:v.reaction||null})}>Record donation</button><button className="btn-ghost text-sm" onClick={close}>Cancel</button></div></div>
}
function Walk({camp,run,close,onAdded}){
  const [v,setV]=useState({name:'',phone:'',dob:'',group:'',area:'',consent:false}),set=k=>e=>setV({...v,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  return <form className="card mb-5 grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();const ok=await run('walk_in',{p_camp:camp,p_name:v.name,p_phone:normPhone(v.phone),p_group:v.group||null,p_dob:v.dob||null,p_area:v.area||null,p_consent:v.consent});if(ok&&onAdded)onAdded(normPhone(v.phone))}}>
    <input className="input" placeholder="Full name" required minLength={2} value={v.name} onChange={set('name')}/><input className="input" placeholder="Mobile (10 digits)" required inputMode="numeric" value={v.phone} onChange={set('phone')}/>
    <Field label="Date of birth"><input className="input mt-1" type="date" required min={adultMin()} max={adultMax()} value={v.dob} onChange={set('dob')}/></Field>
    <select className="input self-end" value={v.group} onChange={set('group')}><option value="">Blood group</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select>
    <input className="input sm:col-span-2" placeholder="Area / town" value={v.area} onChange={set('area')}/>
    <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" required checked={v.consent} onChange={set('consent')}/>Donor agrees to be contacted and to their details being stored</label>
    <div className="flex gap-2 sm:col-span-2"><button className="btn">Add and check in</button><button type="button" className="btn-ghost text-sm" onClick={close}>Cancel</button></div></form>
}
// what the board looks like after the actions still waiting on this device
function overlay(rows,queue,cid){
  let out=rows.map(r=>({...r}))
  for(const a of queue){if(a.camp!==cid)continue
    if(a.fn==='walk_in'){out.push({reg_id:'tmp-'+a.id,full_name:a.args.p_name,phone:a.args.p_phone,blood_group:a.args.p_group,status:'checked_in',donor_no:null,token_no:null,pending:true,tmp:true});continue}
    const row=out.find(x=>x.reg_id===a.args.p_reg);if(!row)continue
    row.pending=true
    if(a.fn==='set_reg_status')row.status=a.args.p_status
    if(a.fn==='save_screening')row.status=a.args.p_decision==='eligible'?'screened':'deferred'
    if(a.fn==='record_donation'){row.status='donated';row.bag_number=a.args.p_bag;row.volume_ml=a.args.p_vol}}
  return out
}
const tokenItem=r=>({token:r.token_no,name:r.full_name,line:[r.blood_group,r.slot?`Slot ${String(r.slot).slice(0,5)}`:null].filter(Boolean).join(' · '),arrived:!['registered','no_show'].includes(r.status)})
export default function CampDay(){
  const {can}=useAuth(),medic=can('screening'),confirm=useConfirm(),{brand}=useBrand()
  const [camps,setCamps]=useState([]),[cid,setCid]=useState(''),[rows,setRows]=useState([]),[q,setQ]=useState(''),[f,setF]=useState(''),[act,setAct]=useState(null),[err,setErr]=useState('')
  const [dtab,setDtab]=useState('main')
  const [queue,setQueue]=useState(readQueue()),[offline,setOffline]=useState(!navigator.onLine),[syncing,setSyncing]=useState(false)
  useEffect(()=>{supabase.from('camps').select('*').in('status',['open','live']).is('deleted_at',null).order('camp_date').then(r=>r,e=>({data:null,error:e})).then(({data,error})=>{
    if(error){if(!isNetError(error))return setErr(error.message);data=cacheGet('campday-camps')||[];setOffline(true)}else cacheSet('campday-camps',data)
    setCamps(data);const p=data.find(c=>c.status==='live')||data[0];if(p)setCid(p.id)})},[])
  const load=async()=>{if(!cid)return;const w=await supabase.rpc('camp_board',{p_camp:cid}).then(r=>r,e=>({error:e}))
    if(w.error){if(isNetError(w.error)){setOffline(true);setRows(cacheGet('board-'+cid)||[]);return}return setErr(w.error.message)}
    setOffline(false);setErr('');setRows(w.data||[]);cacheSet('board-'+cid,w.data||[])}
  const loadRef=useRef(load);loadRef.current=load
  useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[cid])
  useLive(['registrations','donations','screenings','donors'],()=>load())
  const sync=async()=>{if(!readQueue().some(a=>!a.error))return;setSyncing(true);const n=await flush();setSyncing(false);if(n){toast.success(`${n} saved change${n>1?'s':''} sent`);loadRef.current()}}
  useEffect(()=>{const q=()=>setQueue(readQueue()),on=()=>{setOffline(false);sync()},off=()=>setOffline(true)
    window.addEventListener('offline-queue',q);window.addEventListener('online',on);window.addEventListener('offline',off);const t=setInterval(sync,20000);sync()
    return()=>{window.removeEventListener('offline-queue',q);window.removeEventListener('online',on);window.removeEventListener('offline',off);clearInterval(t)}},[])
  const run=async(fn,args,msg)=>{setErr('')
    const {data,error}=navigator.onLine?await supabase.rpc(fn,args).then(r=>r,e=>({error:e})):{error:{message:'Failed to fetch'}}
    if(error&&isNetError(error)){
      if(fn==='revert_step')return toast.error('Taking a step back needs internet. Try again when connected.'),false
      enqueueAction({fn,args,camp:cid});setOffline(true);setAct(null)
      toast.success('No internet: saved on this phone. It will be sent by itself when the connection is back.');return true}
    if(error){toast.error(error.message);setErr(error.message);return false}
    setAct(null);load();if(fn==='record_donation'){celebrate();toast.success('Donation recorded. Thank you, donor!')}else if(msg)toast.success(msg);return data??true}
  const takeBack=async r=>{if(!await confirm({title:`Take ${r.full_name} back one step?`,body:r.status==='donated'?'The donation record and its blood unit are removed, and the donor goes back to Cleared to donate.':'The screening is removed and the donor goes back to Checked in.',action:'Take back'}))return
    run('revert_step',{p_reg:r.reg_id},'Step taken back')}
  const shown=overlay(rows,queue,cid),mine=queue.filter(a=>a.camp===cid),waiting=mine.filter(a=>!a.error),failed=mine.filter(a=>a.error)
  const camp=camps.find(c=>c.id===cid),by=s=>shown.filter(r=>r.status===s).length
  const donated=shown.filter(r=>r.status==='donated'),litres=(donated.reduce((a,r)=>a+(r.volume_ml||0),0)/1000).toFixed(1)
  const arrived=shown.filter(r=>!['registered','no_show'].includes(r.status)).length
  const list=shown.filter(r=>(!f||r.status===f)&&(!q||(r.full_name+' '+r.phone+' '+code('T',r.token_no,3)).toLowerCase().includes(q.toLowerCase())))
  const actions=r=>r.tmp?<span className="text-xs text-warn">Waiting to sync</span>:<>
    {['registered','no_show'].includes(r.status)&&<button className="btn px-3 py-1.5" onClick={async()=>{if(await run('set_reg_status',{p_reg:r.reg_id,p_status:'checked_in'}))autoPrint(tokenItem(r),camp,brand)}}>Check in</button>}
    {r.token_no!=null&&<PrintOne item={tokenItem(r)} camp={camp} brand={brand}/>}
    {r.status==='registered'&&<button className="btn-ghost hidden text-xs sm:inline-flex" onClick={()=>run('set_reg_status',{p_reg:r.reg_id,p_status:'no_show'})}>No-show</button>}
    {can('campday')&&r.status==='checked_in'&&<button className="btn-ghost text-xs" title="Undo check-in" aria-label="Undo check-in" onClick={()=>run('set_reg_status',{p_reg:r.reg_id,p_status:'registered'})}><Undo2 size={14}/></button>}
    {medic&&r.status==='checked_in'&&<button className="btn px-3 py-1.5" onClick={()=>setAct({type:'screen',row:r})}>Screen</button>}
    {medic&&r.status==='screened'&&<button className="btn px-3 py-1.5" onClick={()=>setAct({type:'donate',row:r})}>Record<span className="hidden sm:inline">&nbsp;donation</span></button>}
    {medic&&['screened','deferred','donated'].includes(r.status)&&<button className="btn-ghost text-xs" title="Entered by mistake? Take this donor back one step" aria-label="Take back one step" onClick={()=>takeBack(r)}><Undo2 size={14}/></button>}</>
  if(!camps.length)return <div className="card text-center text-fog-muted">No open or live camp. Set a camp to Open or Live on the Camps page.</div>
  const pick=<select className="input w-auto min-w-0 max-w-full truncate sm:max-w-sm" aria-label="Camp" value={cid} onChange={e=>{setCid(e.target.value);setDtab('main')}}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)}){isBlood(c)?'':` · ${typeName(c)}`}</option>)}</select>
  if(camp&&!isBlood(camp)){const k=kindOf(camp),main={people:'People',food:'Food served',plants:'Saplings'}[k]
    return <div><PageHeader eyebrow="Camp work" title="Camp day" description={`${typeName(camp)} · ${camp.name}${camp.venue?' · '+camp.venue:''}`} actions={pick}/>
      <Tabs id="day-tabs" value={dtab} onChange={setDtab} tabs={[['main',main],...(camp.camp_type==='Cancer awareness'?[['talks','Talks']]:[]),['team','Team'],['summary','Summary']]}/>
      <div className="card">{dtab==='main'?(k==='people'?<People camp={camp} day brand={brand}/>:k==='food'?<Food camp={camp}/>:<Saplings camp={camp}/>)
        :dtab==='talks'?<Sessions camp={camp}/>:dtab==='team'?<Team camp={camp}/>:<Summary camp={camp} onClosed={()=>{const rest=camps.filter(c=>c.id!==camp.id);setCamps(rest);setCid(rest[0]?.id||'');setDtab('main')}}/>}</div></div>}
  return <div>
    <PageHeader eyebrow="Camp work" title="Camp day" description={camp?`${camp.name} · ${camp.venue||''}`:''} actions={<>{pick}
        {camp&&<TokenPrint rows={shown.filter(r=>!r.tmp).map(tokenItem)} camp={camp} brand={brand}/>}
        {can('campday')&&<button className="btn" onClick={()=>setAct({type:'walk'})}><UserPlus size={16}/>Walk-in</button>}</>}/>
    {(offline||mine.length>0)&&<div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${offline?'border-warn/40 bg-warn/10':'border-brand/40 bg-brand/10'}`}>
      <div className="flex flex-wrap items-center gap-3">{offline?<WifiOff size={18} className="text-warn"/>:<CloudUpload size={18} className="text-brand"/>}
        <div className="min-w-0 flex-1 text-fg">{offline?'No internet. Keep working: check-ins, screenings and donations are saved on this phone.':'Back online.'}{waiting.length>0&&` ${waiting.length} change${waiting.length>1?'s':''} waiting to be sent.`}</div>
        {waiting.length>0&&!offline&&<button className="btn-quiet px-3 py-1 text-xs" disabled={syncing} onClick={sync}>{syncing?'Sending…':'Send now'}</button>}</div>
      {failed.map(a=><div key={a.id} className="mt-2 flex items-center gap-2 text-xs text-blood"><span className="flex-1">Not saved ({a.fn.replace(/_/g,' ')}): {a.error}</span><button className="btn-ghost p-1" aria-label="Discard" onClick={()=>dropAction(a.id)}><X size={13}/></button></div>)}</div>}
    {err&&<div role="alert" className="mb-4 rounded-xl border border-blood/40 bg-blood/10 px-4 py-3 text-sm text-[#FF8796]">{err}</div>}
    <div className="card mb-5">
      <div className="grid grid-cols-3 gap-4 text-center sm:grid-cols-6">{[['Registered',shown.length],['Arrived',arrived],['Cleared',by('screened')],['Donated',donated.length],['Deferred',by('deferred')],['Blood collected',litres+' L']].map(([l,n])=><div key={l}><div className="text-2xl font-semibold tabular-nums text-fg"><CountUp value={n}/></div><div className="text-xs text-fog-muted">{l}</div></div>)}</div>
      {camp?.target_donors&&<div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-rose-700 to-blood transition-all duration-700" style={{width:Math.min(100,donated.length/camp.target_donors*100)+'%'}}/></div><div className="mt-1 text-xs text-fog-muted">{donated.length} of {camp.target_donors} target donors</div></div>}
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">{BLOOD.map(b=><div key={b} className="tile py-2 text-center"><div className="font-semibold text-blood">{b}</div><div className="text-lg tabular-nums text-fg"><CountUp value={donated.filter(r=>r.blood_group===b).length}/></div></div>)}</div></div>
    <Tabs id="day-tabs" value={dtab} onChange={setDtab} tabs={[['main','Donors'],['team','Team'],['summary','Summary']]}/>
    {dtab==='team'&&camp&&<div className="card"><Team camp={camp}/></div>}
    {dtab==='summary'&&camp&&<div className="card"><Summary camp={camp} onClosed={()=>{const rest=camps.filter(c=>c.id!==camp.id);setCamps(rest);setCid(rest[0]?.id||'');setDtab('main')}}/></div>}
    {dtab==='main'&&<>
    {act?.type==='walk'&&<Walk camp={cid} run={run} close={()=>setAct(null)} onAdded={async ph=>{const {data}=await supabase.from('registrations').select('token_no,slot,status,donors!inner(full_name,blood_group,phone)').eq('camp_id',cid).eq('donors.phone',ph).maybeSingle();if(data)autoPrint(tokenItem({...data,...data.donors}),camp,brand)}}/>}
    {act?.type==='screen'&&<Screen row={act.row} run={run} close={()=>setAct(null)}/>}
    {act?.type==='donate'&&<Donate row={act.row} run={run} close={()=>setAct(null)}/>}
    <div className="mb-3 grid grid-cols-[1fr_auto] gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" aria-label="Search" placeholder="Search name, phone or token" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <select className="input w-36 sm:w-44" aria-label="Step" value={f} onChange={e=>setF(e.target.value)}><option value="">All steps</option>{Object.entries(LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    <div className="card overflow-hidden p-0">
      <div className="hidden overflow-x-auto md:block"><table className="table table-fixed">
        <colgroup><col className="w-[88px]"/><col/><col className="w-[76px]"/><col className="w-[72px]"/><col className="w-[24%]"/><col className="w-[230px]"/></colgroup>
        <thead><tr><th>Token</th><th>Donor</th><th>Group</th><th>Slot</th><th>Step</th><th className="text-right">Action</th></tr></thead>
        <tbody>{list.map(r=><tr key={r.reg_id}>
          <td><span className="code whitespace-nowrap">{code('T',r.token_no,3)}</span></td>
          <td className="truncate"><div className="truncate font-medium text-fg">{r.full_name}</div><div className="truncate text-xs text-fog-faint">{code('D',r.donor_no)} · {r.phone}</div></td>
          <td><span className="inline-grid h-8 min-w-[2.5rem] place-items-center rounded-lg bg-blood/10 px-1.5 font-display text-sm font-semibold text-blood">{r.blood_group||'-'}</span></td>
          <td className="tabular-nums text-fog-muted">{r.slot||'-'}</td>
          <td className="truncate"><span className={`font-medium ${TONE[r.status]}`}>{LABEL[r.status]}</span>{r.pending&&<CloudUpload size={13} className="ml-1 inline text-warn" aria-label="Waiting to sync"/>}{r.bag_number&&<div className="truncate text-xs text-fog-faint">{r.bag_number}{r.cert_no?` · ${code('CRT',r.cert_no,6)}`:''}</div>}</td>
          <td><div className="flex items-center justify-end gap-1.5">{actions(r)}</div></td></tr>)}
        {!list.length&&<tr><td colSpan="6" className="p-6 text-center text-fog-faint">No donors here yet.</td></tr>}</tbody></table></div>
      <ul className="divide-y divide-ink-700/80 md:hidden">{list.map(r=><li key={r.reg_id} className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blood/10 font-display text-sm font-semibold text-blood">{r.blood_group||'-'}</span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="code whitespace-nowrap">{code('T',r.token_no,3)}</span><span className="truncate font-medium text-fg">{r.full_name}</span></div>
            <div className="mt-0.5 truncate text-xs"><span className={`font-medium ${TONE[r.status]}`}>{LABEL[r.status]}</span><span className="text-fog-faint">{r.slot?` · ${r.slot}`:''}{r.bag_number?` · ${r.bag_number}`:''}</span></div></div>
          <div className="flex shrink-0 items-center gap-1">{actions(r)}</div></li>)}
        {!list.length&&<li className="p-6 text-center text-sm text-fog-faint">No donors here yet.</li>}</ul>
    </div></>}</div>
}
