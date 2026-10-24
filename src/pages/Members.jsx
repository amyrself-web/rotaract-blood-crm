import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {toast} from 'sonner'
import {Plus,Search,IdCard,Download,FileText,ChevronRight,Trash2,Wallet,Droplet,UserPlus,Receipt,KeyRound,ShieldCheck,Copy,Share2} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {useBrand} from '../context/Brand'
import {BLOOD,normPhone,fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,Tabs,useLive,undoToast,code,errText,todayIso,useConfirm} from '../components/ui'
import {rotaryYear,memberDirectoryPdf,duesPdf,csv} from '../lib/clubReports'
import {buildPdf,rs,pad} from '../lib/docpdf'
import CountUp from '../components/CountUp'
import {memberIdCards} from '../lib/cards'
import {PhotoPicker} from '../components/PhotoPicker'
import {InductionTab,NewYear} from '../components/ClubAdmin'
import {Crown} from 'lucide-react'

const genPw=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';return 'Rc-'+[...crypto.getRandomValues(new Uint32Array(10))].map(x=>a[x%a.length]).join('')}
export const POSITIONS=['President','Vice President','Secretary','Joint Secretary','Treasurer','Sergeant-at-Arms','Club Service Director','Community Service Director',
  'International Service Director','Professional Development Director','Public Relations Director','Blood Donation Chair','IT and Media','Board member','Member']
const TYPES=['Active','Prospective','Honorary','Alumni']
const empty={full_name:'',phone:'',email:'',dob:'',gender:'',blood_group:'',address:'',area:'',occupation:'',organisation:'',position:'Member',membership_type:'Active',status:'active',joined_on:todayIso(),ri_member_id:'',emergency_contact:'',notes:''}
const tone={active:'green',inactive:'amber',resigned:'neutral'}

function Stat({label,value,sub,tone}){return <div className="card py-4"><div className={`text-2xl font-semibold tabular-nums ${tone==='blood'?'text-blood':'text-fg'}`}>{typeof value==='number'?<CountUp value={value}/>:value}</div><div className="text-xs text-fog-muted">{label}</div>{sub&&<div className="mt-1 text-[11px] text-fog-faint">{sub}</div>}</div>}
const Bar=({v})=><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700"><div className={`h-full rounded-full ${v>=75?'bg-ok':v>=50?'bg-warn':'bg-blood'}`} style={{width:v+'%'}}/></div><span className="w-9 text-right text-xs tabular-nums text-fog-muted">{v}%</span></div>

export default function Members(){
  const {can}=useAuth(),{brand}=useBrand(),confirm=useConfirm(),ry=rotaryYear()
  const [rows,setRows]=useState(null),[dues,setDues]=useState([]),[att,setAtt]=useState({}),[q,setQ]=useState(''),[st,setSt]=useState('active'),[type,setType]=useState('')
  const [newYear,setNewYear]=useState(false),[form,setForm]=useState(null),[tab,setTab]=useState('details'),[busy,setBusy]=useState(false),[prof,setProf]=useState(null),[pay,setPay]=useState(null),[pdf,setPdf]=useState(''),[login,setLogin]=useState(null),[loginInfo,setLoginInfo]=useState(null)
  const load=async()=>{try{
    const [m,d,a]=await Promise.all([supabase.from('members').select('*').is('deleted_at',null).order('member_no'),supabase.from('member_dues').select('member_id,amount,paid_on').gte('paid_on',ry.from).lte('paid_on',ry.to),
      supabase.rpc('attendance_summary',{p_from:ry.from,p_to:ry.to})])
    if(m.error)throw m.error;setRows(m.data);setDues(d.data||[]);setAtt(Object.fromEntries((a.data?.members||[]).map(x=>[x.id,x])))}catch(e){toast.error(errText(e))}}
  useEffect(()=>{load()},[])
  useLive(['members','member_dues','meeting_attendance','meetings'],load)
  const pct=id=>{const x=att[id];return x?.held?Math.round(x.present/x.held*100):null}
  const paid=useMemo(()=>{const o={};dues.forEach(d=>o[d.member_id]=(o[d.member_id]||0)+Number(d.amount));return o},[dues])
  const list=(rows||[]).filter(r=>(!st||r.status===st)&&(!type||r.membership_type===type)&&(!q||`${code('M',r.member_no,3)} ${r.full_name} ${r.phone||''} ${r.email||''} ${r.position}`.toLowerCase().includes(q.toLowerCase())))
  const active=(rows||[]).filter(r=>r.status==='active'),pcts=active.map(r=>pct(r.id)).filter(v=>v!=null)
  const loadProfile=id=>supabase.rpc('member_profile',{p_member:id}).then(({data})=>setProf(data))
  const open=r=>{setTab('details');setProf(null);setPay(null);setLogin(null);setLoginInfo(null);if(r?.profile_id)supabase.from('profiles').select('email,role,active').eq('id',r.profile_id).maybeSingle().then(({data})=>setLoginInfo(data||{}));setForm(r?{...empty,...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v??''])),_orig:r}:{...empty});if(r)loadProfile(r.id)}
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e.preventDefault();const phone=form.phone?normPhone(form.phone):''
    if(phone&&!/^[6-9]\d{9}$/.test(phone))return toast.error('Mobile number must be 10 digits and start with 6, 7, 8 or 9')
    setBusy(true);const {id,member_no,created_at,deleted_at,deleted_by,_orig,...rest}=form
    const row=Object.fromEntries(Object.entries({...rest,phone}).map(([k,v])=>[k,v===''?null:v]))
    const r=id?await supabase.from('members').update(row).eq('id',id).select().single():await supabase.from('members').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message)
    if(id){const prev=Object.fromEntries(Object.keys(row).map(k=>[k,_orig[k]]));undoToast('Member updated',async()=>{const x=await supabase.from('members').update(prev).eq('id',id);if(x.error)throw x.error;load()})}
    else toast.success(`Member added as ${code('M',r.data.member_no,3)}`)
    setForm(null);load()}
  const remove=async()=>{const {id,full_name}=form;const r=await supabase.from('members').update({deleted_at:new Date().toISOString()}).eq('id',id);if(r.error)return toast.error(r.error.message)
    setForm(null);load();undoToast(`${full_name} moved to the Recycle bin`,async()=>{const x=await supabase.from('members').update({deleted_at:null}).eq('id',id);if(x.error)throw x.error;load()})}
  const addPay=async e=>{e.preventDefault();const r=await supabase.from('member_dues').insert({member_id:form.id,period:pay.period,amount:Number(pay.amount),paid_on:pay.paid_on,mode:pay.mode,reference:pay.reference||null}).select().single()
    if(r.error)return toast.error(r.error.message);toast.success(`Receipt ${code('RC',r.data.receipt_no,4)} saved`);setPay(null);loadProfile(form.id);load()}
  const delPay=async d=>{if(!await confirm({title:`Delete receipt ${code('RC',d.receipt_no,4)}?`,body:`${rs(d.amount)} for ${d.period}. You can undo this from the Audit log.`,action:'Delete'}))return
    const r=await supabase.from('member_dues').delete().eq('id',d.id);if(r.error)return toast.error(r.error.message);loadProfile(form.id);load()}
  const receipt=d=>buildPdf({title:'Receipt',heading:`Membership dues, ${d.period}`,subtitle:`Received ${rs(d.amount)} from ${form.full_name} by ${d.mode}`,docNo:pad('RC',d.receipt_no,4),brand,footer:'Membership dues receipt',filename:`receipt-${pad('RC',d.receipt_no,4)}.pdf`,blocks:[
    {type:'boxes',boxes:[{title:'RECEIVED FROM',rows:[['Member',form.full_name],['Member ID',pad('M',form.member_no)],['Position',form.position]]},{title:'PAYMENT',rows:[['Date',fmt(d.paid_on)],['Mode',d.mode],['Reference',d.reference||'-']]}]},
    {type:'table',heading:'Details',columns:['#','Description','Amount'],rows:[[1,`Membership dues for ${d.period}`,rs(d.amount)]],opts:{columnStyles:{0:{cellWidth:10},2:{halign:'right'}},foot:[['','Total received',rs(d.amount)]]}},
    {type:'signatures',items:[['','Member'],['','Treasurer']]}]})
  const linkDonor=async()=>{if(!form.phone)return toast.error('Add the member\'s mobile number first')
    let {data:d}=await supabase.from('donors').select('id,donor_no').eq('phone',normPhone(form.phone)).maybeSingle()
    if(!d){if(!form.blood_group||!form.dob||!form.gender)return toast.error('Add blood group, gender and date of birth to create a donor record')
      const r=await supabase.from('donors').insert({full_name:form.full_name,phone:normPhone(form.phone),email:form.email||null,blood_group:form.blood_group,gender:form.gender,dob:form.dob,area:form.area||null,consent:true,consent_at:new Date().toISOString(),source:'member'}).select('id,donor_no').single()
      if(r.error)return toast.error(r.error.message);d=r.data}
    const r=await supabase.from('members').update({donor_id:d.id}).eq('id',form.id);if(r.error)return toast.error(r.error.message)
    toast.success(`Linked to donor ${code('D',d.donor_no)}`);setForm({...form,donor_id:d.id});loadProfile(form.id);load()}
  const run=async(k,f)=>{setPdf(k);try{await f()}catch(e){toast.error(errText(e))}setPdf('')}
  const exportCsv=()=>csv(list.map(r=>({id:code('M',r.member_no,3),name:r.full_name,position:r.position,type:r.membership_type,status:r.status,phone:r.phone,email:r.email,blood_group:r.blood_group,dob:r.dob,joined_on:r.joined_on,occupation:r.occupation,organisation:r.organisation,area:r.area,ri_member_id:r.ri_member_id,
    [`attendance_${ry.label}`]:pct(r.id)??'',[`dues_${ry.label}`]:paid[r.id]||0})),'members.csv')

  return <div>
    <PageHeader title="Members" description={rows?`${active.length} active members · Rotary year ${ry.label}`:'Loading members'}
      actions={<><button className="btn-quiet" onClick={exportCsv} disabled={!list.length}><Download size={15}/>CSV</button>
        <button className="btn-quiet" disabled={!!pdf} onClick={()=>run('dir',()=>memberDirectoryPdf(brand))}><FileText size={15}/>{pdf==='dir'?'Preparing…':'Directory PDF'}</button>
        <button className="btn-quiet" disabled={!!pdf} onClick={()=>run('dues',()=>duesPdf(brand,ry))}><Wallet size={15}/>{pdf==='dues'?'Preparing…':'Dues report'}</button>
        <button className="btn-quiet" disabled={!!pdf||!active.length} onClick={()=>run('ids',()=>memberIdCards(active,brand,'sheet'))}><IdCard size={15}/>{pdf==='ids'?'Preparing…':'ID cards'}</button>
        <button className="btn-quiet" onClick={()=>setNewYear(true)}><Crown size={15}/>New Rotary year</button>
        <button className="btn" onClick={()=>open(null)}><Plus size={16}/>Add member</button></>}/>
    <NewYear open={newYear} onClose={()=>setNewYear(false)} members={rows||[]} positions={POSITIONS} onDone={load}/>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Active members" value={active.length} sub={`${(rows||[]).filter(r=>r.membership_type==='Prospective').length} prospective`}/>
      <Stat label={`Average attendance ${ry.label}`} value={pcts.length?Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length)+'%':'-'}/>
      <Stat label={`Dues collected ${ry.label}`} value={rs(dues.reduce((a,d)=>a+Number(d.amount),0))} sub={`${active.filter(r=>!paid[r.id]).length} active members not paid`}/>
      <Stat label="Members who give blood" value={(rows||[]).filter(r=>r.donor_id).length} tone="blood"/></div>
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-2 gap-2 border-b border-ink-700 p-3 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative col-span-2 lg:col-span-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, mobile, ID or position" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="input lg:w-auto" aria-label="Status" value={st} onChange={e=>setSt(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="resigned">Resigned</option></select>
        <select className="input lg:w-auto" aria-label="Type" value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
      <div className="hidden overflow-x-auto md:block"><table className="table table-fixed">
        <colgroup><col className="w-[84px]"/><col/><col className="w-[19%]"/><col className="w-[70px]"/><col className="w-[110px]"/><col className="w-[140px]"/><col className="w-[110px]"/><col className="w-[40px]"/></colgroup>
        <thead><tr><th>ID</th><th>Member</th><th>Position</th><th>Group</th><th>Joined</th><th>Attendance</th><th className="text-right">Dues {ry.label}</th><th/></tr></thead>
        <tbody>{rows===null?[0,1,2].map(i=><tr key={i}><td colSpan="8"><div className="skeleton h-8"/></td></tr>):list.map(r=><tr key={r.id} className="cursor-pointer" onClick={()=>open(r)}>
          <td><span className="code">{code('M',r.member_no,3)}</span></td>
          <td className="truncate"><div className="flex items-center gap-2"><span className="truncate font-medium text-fg">{r.full_name}</span>{r.status!=='active'&&<Badge tone={tone[r.status]}>{r.status}</Badge>}{r.membership_type!=='Active'&&<Badge tone="blue">{r.membership_type}</Badge>}</div><div className="truncate text-xs text-fog-faint">{r.phone||r.email||'-'}</div></td>
          <td className="truncate text-fog-muted">{r.position}</td>
          <td><span className="font-display font-semibold text-blood">{r.blood_group||'-'}</span>{r.profile_id&&<KeyRound size={12} className="ml-1 inline text-brand" aria-label="Has login"/>}{r.donor_id&&<Droplet size={12} className="ml-1 inline text-blood" fill="currentColor" aria-label="Linked donor"/>}</td>
          <td className="whitespace-nowrap tabular-nums text-fog-muted">{fmt(r.joined_on)}</td>
          <td>{pct(r.id)==null?<span className="text-xs text-fog-faint">No meetings</span>:<Bar v={pct(r.id)}/>}</td>
          <td className="text-right tabular-nums">{paid[r.id]?<span className="text-ok">{rs(paid[r.id])}</span>:<span className="text-fog-faint">Not paid</span>}</td>
          <td><ChevronRight size={16} className="text-fog-faint"/></td></tr>)}</tbody></table></div>
      <ul className="divide-y divide-ink-700/80 md:hidden">{(rows||[]).length?list.map(r=><li key={r.id}><button onClick={()=>open(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 font-display text-sm font-semibold text-brand">{r.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-fg">{r.full_name}</span><span className="mt-0.5 flex items-center gap-2 text-xs text-fog-faint"><span className="code">{code('M',r.member_no,3)}</span><span className="truncate">{r.position}</span></span></span>
        {pct(r.id)!=null&&<span className="text-xs tabular-nums text-fog-muted">{pct(r.id)}%</span>}<ChevronRight size={16} className="text-fog-faint"/></button></li>):null}</ul>
      {rows&&!list.length&&<Empty icon={IdCard} title={rows.length?'No members match':'No members yet'} action={!rows.length&&<button className="btn" onClick={()=>open(null)}><Plus size={16}/>Add member</button>}>
        {rows.length?'Change the search or filters.':'Add your club members to track attendance, dues and their blood donations.'}</Empty>}
    </div>

    <Drawer open={!!form} onClose={()=>setForm(null)} width="max-w-2xl" title={form?.id?`${form.full_name} · ${code('M',form.member_no,3)}`:'Add member'} description={form?.id?`${form.position} · joined ${fmt(form.joined_on)}`:'Fields marked * are required.'}
      footer={form&&tab==='details'&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Move to Recycle bin</button>}
        <button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="member-form" disabled={busy}>{busy?'Saving…':form.id?'Save changes':'Add member'}</button></>}>
      {form&&<>{form.id&&<Tabs id="mem-tabs" value={tab} onChange={setTab} tabs={[['details','Details'],['dues','Dues'],['attendance','Attendance'],['blood','Blood donations'],['card','ID card'],['induction','Induction'],['login','Login']]}/>}
      {tab==='induction'&&form.id&&<InductionTab member={{...form._orig,...form}} onChange={()=>{load();setForm(f=>({...f,membership_type:'Active'}))}}/>}
      {tab==='card'&&<div className="space-y-4">
        <PhotoPicker member={form} onSaved={url=>{setForm({...form,photo_url:url});load()}}/>
        <div className="tile flex flex-wrap items-center gap-3 p-4"><IdCard size={20} className="text-brand"/><div className="flex-1"><div className="font-medium text-fg">Member ID card</div><div className="text-xs text-fog-muted">Card size with photo, blood group and a QR code. Anyone who scans it sees only the name, member ID, position and whether the card is valid (till 30 June).</div></div>
          <button className="btn-quiet" disabled={!!pdf} onClick={()=>run('id1',()=>memberIdCards([{...form._orig,photo_url:form.photo_url||null}],brand,'card'))}><Download size={15}/>{pdf==='id1'?'Preparing…':'Card size'}</button>
          <button className="btn-quiet" disabled={!!pdf} onClick={()=>run('id2',()=>memberIdCards([{...form._orig,photo_url:form.photo_url||null}],brand,'sheet'))}><FileText size={15}/>A4 with cut marks</button></div></div>}
      {tab==='details'&&<form id="member-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2"><input className="input" required minLength={2} value={form.full_name} onChange={set('full_name')}/></Field>
        <Field label="Mobile" required hint="10 digits"><input className="input" required inputMode="numeric" value={form.phone} onChange={set('phone')}/></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')}/></Field>
        <Field label="Position" required><select className="input" required value={form.position} onChange={set('position')}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Field>
        <Field label="Membership type" required><select className="input" value={form.membership_type} onChange={set('membership_type')}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Date of birth"><input type="date" className="input" max={todayIso()} value={form.dob} onChange={set('dob')}/></Field>
        <Field label="Gender"><select className="input" value={form.gender} onChange={set('gender')}><option value="">Not stated</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Blood group"><select className="input" value={form.blood_group} onChange={set('blood_group')}><option value="">Not known</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Joined on" required><input type="date" required className="input" max={todayIso()} value={form.joined_on} onChange={set('joined_on')}/></Field>
        <Field label="Occupation"><select className="input" value={form.occupation} onChange={set('occupation')}><option value="">Choose</option><option>Student</option><option>Working professional</option><option>Business</option><option>Other</option></select></Field>
        <Field label="College or company"><input className="input" value={form.organisation} onChange={set('organisation')}/></Field>
        <Field label="Area or town"><input className="input" value={form.area} onChange={set('area')}/></Field>
        <Field label="RI / club member ID"><input className="input" value={form.ri_member_id} onChange={set('ri_member_id')}/></Field>
        <Field label="Address" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={form.address} onChange={set('address')}/></Field>
        <Field label="Emergency contact" hint="Name and phone number"><input className="input" value={form.emergency_contact} onChange={set('emergency_contact')}/></Field>
        <Field label="Status" required><select className="input" value={form.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option><option value="resigned">Resigned</option></select></Field>
        {form.status!=='active'&&<Field label="Left on"><input type="date" className="input" max={todayIso()} value={form.left_on||''} onChange={set('left_on')}/></Field>}
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={form.notes} onChange={set('notes')}/></Field>
      </form>}
      {tab==='dues'&&<div>
        {!pay?<button className="btn mb-4" onClick={()=>setPay({period:ry.label,amount:'',paid_on:todayIso(),mode:'UPI',reference:''})}><Receipt size={15}/>Record payment</button>
        :<form onSubmit={addPay} className="tile mb-4 grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Period" required hint="For example 2026-27 or Oct 2026"><input className="input" required value={pay.period} onChange={e=>setPay({...pay,period:e.target.value})}/></Field>
          <Field label="Amount (Rs.)" required><input className="input" required type="number" min="1" step="any" value={pay.amount} onChange={e=>setPay({...pay,amount:e.target.value})}/></Field>
          <Field label="Paid on" required><input className="input" required type="date" max={todayIso()} value={pay.paid_on} onChange={e=>setPay({...pay,paid_on:e.target.value})}/></Field>
          <Field label="Mode" required><select className="input" value={pay.mode} onChange={e=>setPay({...pay,mode:e.target.value})}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Cheque</option></select></Field>
          <Field label="Reference" hint="UPI or cheque number" className="sm:col-span-2"><input className="input" value={pay.reference} onChange={e=>setPay({...pay,reference:e.target.value})}/></Field>
          <div className="flex gap-2 sm:col-span-2"><button className="btn">Save payment</button><button type="button" className="btn-quiet" onClick={()=>setPay(null)}>Cancel</button></div></form>}
        {!prof?<div className="skeleton h-20"/>:!prof.dues.length?<p className="text-sm text-fog-faint">No payments recorded.</p>:
        <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{prof.dues.map(d=><li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <span className="code">{code('RC',d.receipt_no,4)}</span><span className="flex-1"><span className="text-fg">{d.period}</span><span className="block text-xs text-fog-faint">{fmt(d.paid_on)} · {d.mode}{d.reference?` · ${d.reference}`:''}</span></span>
          <span className="font-semibold tabular-nums text-fg">{rs(d.amount)}</span>
          <button className="btn-ghost" title="Download receipt" aria-label="Download receipt" onClick={()=>receipt(d)}><FileText size={15}/></button>
          <button className="btn-ghost text-blood" title="Delete" aria-label="Delete receipt" onClick={()=>delPay(d)}><Trash2 size={15}/></button></li>)}</ul>}</div>}
      {tab==='attendance'&&(!prof?<div className="skeleton h-20"/>:<div>
        {(()=>{const h=prof.meetings.length,p=prof.meetings.filter(m=>['present','late'].includes(m.status)).length;return <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          {[['Meetings since joining',h],['Attended',p],['Attendance',h?Math.round(p/h*100)+'%':'-']].map(([l,v])=><div key={l} className="tile py-3"><div className="text-xl font-semibold text-fg">{v}</div><div className="text-xs text-fog-muted">{l}</div></div>)}</div>})()}
        {prof.actions.length>0&&<><h3 className="mb-2 text-sm font-semibold text-fg">Action items</h3><ul className="mb-4 space-y-1 text-sm">{prof.actions.map((a,i)=><li key={i} className="flex items-center gap-2"><Badge tone={a.done?'green':'amber'}>{a.done?'Done':'Open'}</Badge><span className="flex-1 text-fog">{a.task}</span><span className="text-xs text-fog-faint">{code('MT',a.meeting_no,3)}{a.due?` · due ${fmt(a.due)}`:''}</span></li>)}</ul></>}
        <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{prof.meetings.map((m,i)=><li key={i} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="code">{code('MT',m.no,3)}</span><span className="flex-1 truncate text-fg">{m.title}<span className="block text-xs text-fog-faint">{fmt(m.date)} · {m.kind}</span></span>
          <Badge tone={{present:'green',late:'blue',leave:'amber',absent:'red'}[m.status]}>{{present:'Present',late:'Late',leave:'Leave',absent:'Absent'}[m.status]}</Badge></li>)}
          {!prof.meetings.length&&<li className="p-4 text-sm text-fog-faint">No meetings held since this member joined.</li>}</ul></div>)}
      {tab==='login'&&<div className="space-y-4">
        {form.profile_id?<div className="tile flex items-center gap-4 p-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-ok/15 text-ok"><ShieldCheck size={22}/></span>
          <div className="min-w-0 flex-1"><div className="font-semibold text-fg">Has a login</div><div className="truncate text-sm text-fog-muted">{loginInfo?.email||form.email||'-'}{loginInfo?.role&&loginInfo.role!=='member'?` · team account (${loginInfo.role})`:''}</div></div></div>
        :<div className="tile p-4 text-sm text-fog-muted">No login yet. Create one below, or ask the member to sign up with their own email and use <b className="text-fg">Link my member record</b> with this mobile number and date of birth{form.dob?'':' (add the date of birth first)'}.</div>}
        {!login?<button className="btn" onClick={()=>setLogin({email:form.email||'',password:genPw()})}><KeyRound size={15}/>{form.profile_id?'Reset password':'Create login'}</button>
        :<form onSubmit={async e=>{e.preventDefault();setBusy(true);const {data,error}=await supabase.functions.invoke('admin-users',{body:{action:form.profile_id?'reset_member_password':'create_member_login',member_id:form.id,email:login.email,password:login.password}});setBusy(false)
            const msg=error?(await error.context?.json?.().catch(()=>null))?.error||error.message:data?.error;if(msg)return toast.error(msg)
            toast.success(form.profile_id?'Password changed':'Login created. Share the details with the member.');setLogin({...login,done:true});if(!form.profile_id){setForm({...form,profile_id:data.id,email:login.email});load()}}} className="tile grid gap-3 p-4">
          {!form.profile_id&&<Field label="Email" required><input className="input" type="email" required value={login.email} disabled={login.done} onChange={e=>setLogin({...login,email:e.target.value})}/></Field>}
          <Field label={form.profile_id?'New password':'Password'} required hint="At least 8 characters. The member can change it later from My profile."><input className="input font-mono" required minLength={8} value={login.password} disabled={login.done} onChange={e=>setLogin({...login,password:e.target.value})}/></Field>
          {!login.done?<div className="flex gap-2"><button className="btn" disabled={busy}>{busy?'Saving…':form.profile_id?'Change password':'Create login'}</button><button type="button" className="btn-quiet" onClick={()=>setLogin(null)}>Cancel</button></div>
          :(()=>{const txt=`Hi ${form.full_name.split(' ')[0]}, your ${brand.club_name} member login is ready.\nLink: ${location.origin}${location.pathname}\nEmail: ${form.email||login.email}\nPassword: ${login.password}\nPlease change your password after signing in.`
            return <div className="flex flex-wrap gap-2"><button type="button" className="btn-quiet" onClick={()=>{navigator.clipboard?.writeText(txt);toast.success('Copied')}}><Copy size={15}/>Copy details</button>
              {form.phone&&<a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/91${form.phone}?text=${encodeURIComponent(txt)}`}><Share2 size={15}/>Send on WhatsApp</a>}</div>})()}
        </form>}</div>}
      {tab==='blood'&&(!prof?<div className="skeleton h-20"/>:form.donor_id?<div className="tile flex items-center gap-4 p-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blood/10 text-blood"><Droplet size={22} fill="currentColor"/></span>
          <div className="flex-1"><div className="font-semibold text-fg">Donor {code('D',prof.donor_no)}</div><div className="text-sm text-fog-muted">{prof.donations} donation{prof.donations===1?'':'s'} recorded</div></div>
          {can('donors')&&<Link className="btn-quiet" to={`/donors?q=${encodeURIComponent(form.phone)}&history=1`}>Full history</Link>}</div>
        :<Empty icon={Droplet} title="Not linked to a donor record" action={can('donors')&&<button className="btn" onClick={linkDonor}><UserPlus size={15}/>Link or create donor record</button>}>
          Link this member to the donor list using their mobile number. Their camp donations then show here.</Empty>)}
      </>}
    </Drawer>
  </div>
}
