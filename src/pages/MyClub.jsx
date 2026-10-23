import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {toast} from 'sonner'
import {motion,AnimatePresence} from 'framer-motion'
import {CalendarDays,Clock,MapPin,Video,CheckCircle2,Circle,ChevronDown,Phone,Pencil,Wallet,Droplet,Tent,QrCode,PartyPopper,Users,IdCard,Download} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,fmt,normPhone} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,useLive,code,errText,todayIso} from '../components/ui'
import {celebrate} from '../lib/fx'
import CountUp from '../components/CountUp'
import {useBrand} from '../context/Brand'
import {memberIdCards} from '../lib/cards'
import {PhotoPicker} from '../components/PhotoPicker'
import MyClubExtra from '../components/MyClubExtra'
import {useLang} from '../lib/i18n'

const ST={present:['Present','green'],late:['Late','blue'],leave:['On leave','amber'],absent:['Absent','red']}
const t5=t=>t?String(t).slice(0,5):''
const istToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})
const rs=n=>'Rs. '+Number(n||0).toLocaleString('en-IN')

// 6 boxes for the meeting check-in code
function CodeInput({value,onChange,onDone}){
  const refs=useRef([])
  const set=(i,v)=>{const d=v.replace(/\D/g,'');if(!d&&v!=='')return
    const arr=value.padEnd(6,' ').split('');if(d.length>1){const s=d.slice(0,6);onChange(s);refs.current[Math.min(s.length,5)]?.focus();if(s.length===6)onDone?.(s);return}
    arr[i]=d||' ';const s=arr.join('').trimEnd();onChange(s);if(d&&i<5)refs.current[i+1]?.focus();if(d&&s.replace(/ /g,'').length===6)onDone?.(s)}
  return <div className="flex justify-center gap-2" role="group" aria-label="Check-in code">{Array.from({length:6},(_,i)=>
    <input key={i} ref={el=>refs.current[i]=el} inputMode="numeric" autoComplete="one-time-code" aria-label={`Digit ${i+1}`} maxLength={6} value={(value[i]||'').trim()}
      onChange={e=>set(i,e.target.value)} onKeyDown={e=>{if(e.key==='Backspace'&&!(value[i]||'').trim()&&i>0)refs.current[i-1]?.focus()}}
      className="h-12 w-10 rounded-xl border border-ink-600 bg-ink-900 text-center font-display text-xl font-semibold text-fg outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 sm:w-12"/>)}</div>
}

export function CheckInCard({meeting,onDone}){
  const [c,setC]=useState(''),[busy,setBusy]=useState(false),[ok,setOk]=useState(null)
  const go=async(v=c)=>{if(v.replace(/\D/g,'').length!==6)return toast.error('Enter the 6-digit code shown at the meeting');setBusy(true)
    const {data,error}=await supabase.rpc('member_checkin',{p_meeting:meeting?.id||null,p_code:v.replace(/\D/g,'')});setBusy(false)
    if(error){setC('');return toast.error(error.message)}
    setOk(data);if(!data.already)celebrate();onDone?.()}
  if(ok||['present','late'].includes(meeting?.my))return <motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} className="card flex items-center gap-4 border-ok/40 bg-ok/[.06]">
    <motion.span initial={{scale:0,rotate:-40}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:260,damping:14}} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ok text-white"><CheckCircle2 size={24}/></motion.span>
    <div><div className="font-display text-lg font-semibold text-fg">You are marked {(ok?.status||meeting.my)==='late'?'late':'present'}</div><div className="text-sm text-fog-muted">{ok?.title||meeting.title}. Thank you for coming.</div></div></motion.div>
  return <div className="card relative overflow-hidden border-brand/40">
    <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/15 blur-2xl"/>
    <div className="relative flex flex-wrap items-center gap-5"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand"><span className="h-2 w-2 animate-pulse rounded-full bg-brand"/>Meeting today</div>
      <div className="mt-1 font-display text-xl font-semibold text-fg">{meeting?.title||'Check in to a meeting'}</div>
      <div className="mt-0.5 text-sm text-fog-muted">{meeting?`${t5(meeting.start)}${meeting.venue?` · ${meeting.venue}`:''}. `:''}Type the code the secretary shows, or scan the QR code with your phone camera.</div></div>
      <div className="w-full sm:w-auto"><CodeInput value={c} onChange={setC} onDone={go}/><button className="btn mt-3 w-full" disabled={busy} onClick={()=>go()}>{busy?'Checking…':'Mark my attendance'}</button></div></div></div>
}

export default function MyClub(){
  const {profile,refresh}=useAuth()
  const {brand}=useBrand(),[card,setCard]=useState(null),[dl,setDl]=useState(false)
  const {t}=useLang();const [d,setD]=useState(undefined),[open,setOpen]=useState(null),[leave,setLeave]=useState(null),[edit,setEdit]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.rpc('my_club').then(({data,error})=>error?toast.error(error.message):setD(data))
  useEffect(()=>{load()},[]);useLive(['meetings','meeting_attendance','meeting_actions','member_dues','members'],load)
  if(d===undefined)return <div className="space-y-4">{[0,1,2].map(i=><div key={i} className="skeleton h-28"/>)}</div>
  if(d===null)return <ClaimMember onDone={()=>{refresh();load()}}/>
  const m=d.me,a=d.attendance,pct=a.held?Math.round(a.present/a.held*100):null,today=istToday()
  const todays=d.upcoming.filter(x=>x.date===today),later=d.upcoming.filter(x=>x.date!==today),openActs=d.actions.filter(x=>!x.done)
  const paidYear=d.dues.filter(x=>x.paid_on>=d.year.from&&x.paid_on<=d.year.to).reduce((s,x)=>s+Number(x.amount),0)
  const openCard=()=>supabase.rpc('my_member').then(({data,error})=>error||!data?.id?toast.error(error?.message||'Member record not found'):setCard(data))
  const getCard=async()=>{setDl(true);try{await memberIdCards([card],brand,'card')}catch(e){toast.error(errText(e))}setDl(false)}
  const act=async x=>{const {error}=await supabase.rpc('member_action_done',{p_action:x.id,p_done:!x.done});if(error)return toast.error(error.message);if(!x.done)toast.success('Nice work. Marked done.');load()}
  const applyLeave=async e=>{e.preventDefault();const {error}=await supabase.rpc('member_leave',{p_meeting:leave.id,p_reason:leave.reason});if(error)return toast.error(error.message);toast.success('Leave applied. The secretary can see it.');setLeave(null);load()}
  const save=async e=>{e.preventDefault();if(edit.phone&&!/^[6-9]\d{9}$/.test(normPhone(edit.phone)))return toast.error('Mobile number must be 10 digits');setBusy(true)
    const {error}=await supabase.rpc('update_my_member',{p:{...edit,phone:normPhone(edit.phone)}});setBusy(false);if(error)return toast.error(error.message);toast.success('Your details are updated');setEdit(null);load()}
  const Meet=({x,up})=>{const dt=new Date(x.date),isOpen=open===x.id
    return <li className="rounded-2xl border border-ink-700 bg-ink-800/60 transition hover:border-ink-600">
      <button className="flex w-full items-center gap-4 p-3 text-left" onClick={()=>setOpen(isOpen?null:x.id)} aria-expanded={isOpen}>
        <div className={`grid w-14 shrink-0 place-items-center rounded-xl py-1.5 text-center ${up?'bg-brand/10':'bg-ink-750'}`}><div className="text-[10px] font-semibold uppercase text-fog-muted">{dt.toLocaleDateString('en-IN',{month:'short'})}</div><div className="font-display text-xl font-semibold leading-none text-fg">{dt.getDate()}</div></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium text-fg">{x.title}</span><Badge tone="blue">{x.kind}</Badge></div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fog-muted">{x.start&&<span><Clock size={11} className="mr-1 inline"/>{t5(x.start)}</span>}{(x.venue||x.mode==='Online')&&<span>{x.mode==='Online'?<Video size={11} className="mr-1 inline"/>:<MapPin size={11} className="mr-1 inline"/>}{x.mode==='Online'?'Online':x.venue}</span>}{!up&&<span><Users size={11} className="mr-1 inline"/>{x.present} came</span>}</div></div>
        {x.my&&<Badge tone={ST[x.my][1]}>{ST[x.my][0]}</Badge>}<ChevronDown size={16} className={`shrink-0 text-fog-faint transition-transform ${isOpen?'rotate-180':''}`}/></button>
      <AnimatePresence initial={false}>{isOpen&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
        <div className="space-y-3 border-t border-ink-700 px-4 py-3 text-sm">
          {up?<><div><div className="label">Agenda</div><p className="whitespace-pre-line text-fog">{x.agenda||'Agenda not shared yet.'}</p></div>
            {x.chief_guest&&<p className="text-fog-muted">Chief guest: <span className="text-fg">{x.chief_guest}</span></p>}{x.link&&<a className="text-brand hover:underline" href={x.link} target="_blank" rel="noreferrer">Join online</a>}
            {x.my==='leave'?<p className="text-warn">Leave applied: {x.note}. Changed your mind? Just check in on the day.</p>
              :!x.my&&(leave?.id===x.id?<form onSubmit={applyLeave} className="flex flex-wrap gap-2"><input className="input flex-1" autoFocus required minLength={3} placeholder="Reason for leave" aria-label="Reason for leave" value={leave.reason} onChange={e=>setLeave({...leave,reason:e.target.value})}/><button className="btn">Send</button><button type="button" className="btn-quiet" onClick={()=>setLeave(null)}>Cancel</button></form>
              :<button className="btn-quiet" onClick={()=>setLeave({id:x.id,reason:''})}>{t('Apply for leave')}</button>)}</>
          :<><div><div className="label">Minutes</div><p className="whitespace-pre-line text-fog">{x.minutes||'Minutes not shared yet.'}</p></div>{x.decisions&&<div><div className="label">Decisions</div><p className="whitespace-pre-line text-fog">{x.decisions}</p></div>}</>}
        </div></motion.div>}</AnimatePresence></li>}

  return <div>
    <PageHeader eyebrow={`${code('M',m.member_no,3)} · ${m.position}`} title={`${t('Hello')}, ${m.full_name.split(' ')[0]}`} description={`${m.membership_type} member since ${fmt(m.joined_on)}`}
      actions={<><button className="btn-quiet" onClick={openCard}><IdCard size={15}/>{t('My ID card')}</button><button className="btn-quiet" onClick={()=>setEdit({phone:m.phone||'',email:m.email||'',dob:m.dob||'',gender:m.gender||'',blood_group:m.blood_group||'',address:m.address||'',area:m.area||'',occupation:m.occupation||'',organisation:m.organisation||'',emergency_contact:m.emergency_contact||''})}><Pencil size={15}/>{t('Edit my details')}</button></>}/>
    <div className="mb-5 space-y-3">{todays.map(x=><CheckInCard key={x.id} meeting={x} onDone={load}/>)}</div>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card py-4"><div className={`text-2xl font-semibold ${pct==null?'text-fg':pct>=75?'text-ok':pct>=50?'text-warn':'text-blood'}`}>{pct==null?'-':<><CountUp value={pct}/>%</>}</div><div className="text-xs text-fog-muted">{t('My attendance this year')}</div><div className="mt-1 text-[11px] text-fog-faint">{a.present} of {a.held} meetings{a.leave?` · ${a.leave} leave`:''}</div></div>
      <div className="card py-4"><div className="text-2xl font-semibold text-fg"><CountUp value={openActs.length}/></div><div className="text-xs text-fog-muted">{t('My open action items')}</div></div>
      <div className="card py-4"><div className={`text-2xl font-semibold ${paidYear?'text-ok':'text-fg'}`}>{paidYear?rs(paidYear):'Not paid'}</div><div className="text-xs text-fog-muted">{t('Dues this year')}</div></div>
      <div className="card py-4"><div className="text-2xl font-semibold text-blood">{d.donations==null?'-':<CountUp value={d.donations}/>}</div><div className="text-xs text-fog-muted">{t('My blood donations')}</div>{m.donor_no&&<div className="mt-1 text-[11px] text-fog-faint">Donor {code('D',m.donor_no)}</div>}</div></div>
    {!todays.length&&<details className="card mb-5 p-0"><summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm font-medium text-fg"><QrCode size={18} className="text-brand"/>Have a check-in code? Mark attendance here<ChevronDown size={16} className="ml-auto text-fog-faint"/></summary><div className="border-t border-ink-700 p-4"><CheckInCard onDone={load}/></div></details>}

    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <MyClubExtra/>
        <section className="card"><h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><CalendarDays size={17} className="text-brand"/>{t('Upcoming meetings')}</h2>
          {later.length?<ul className="space-y-2">{later.map(x=><Meet key={x.id} x={x} up/>)}</ul>:<p className="text-sm text-fog-faint">No meetings scheduled yet.</p>}</section>
        <section className="card"><h2 className="mb-3 font-semibold text-fg">{t('Recent meetings and minutes')}</h2>
          {d.recent.length?<ul className="space-y-2">{d.recent.map(x=><Meet key={x.id} x={x}/>)}</ul>:<p className="text-sm text-fog-faint">No meetings held yet.</p>}</section></div>
      <div className="space-y-5">
        <section className="card"><h2 className="mb-3 font-semibold text-fg">{t('My action items')}</h2>
          {d.actions.length?<ul className="space-y-1">{d.actions.map(x=><li key={x.id}><button onClick={()=>act(x)} className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-ink-750">
            <span className={`mt-0.5 ${x.done?'text-ok':'text-fog-faint'}`}>{x.done?<CheckCircle2 size={19}/>:<Circle size={19}/>}</span>
            <span className="min-w-0 flex-1"><span className={`block text-sm ${x.done?'text-fog-faint line-through':'text-fg'}`}>{x.task}</span><span className="block text-xs text-fog-faint">{code('MT',x.meeting_no,3)} {x.meeting}{x.due?` · due ${fmt(x.due)}`:''}</span></span>
            {!x.done&&x.due&&x.due<today&&<Badge tone="red">Overdue</Badge>}</button></li>)}</ul>:<p className="text-sm text-fog-faint">Nothing assigned to you.</p>}</section>
        <section className="card"><h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Wallet size={17} className="text-brand"/>{t('My dues')}</h2>
          {d.dues.length?<ul className="divide-y divide-ink-700 text-sm">{d.dues.map(x=><li key={x.receipt_no} className="flex items-center gap-3 py-2"><span className="code">{code('RC',x.receipt_no,4)}</span><span className="flex-1 text-fg">{x.period}<span className="block text-xs text-fog-faint">{fmt(x.paid_on)} · {x.mode}</span></span><span className="font-semibold tabular-nums text-fg">{rs(x.amount)}</span></li>)}</ul>
          :<p className="text-sm text-fog-faint">No payments recorded yet. Pay the treasurer and they will add it here.</p>}</section>
        {d.camps.length>0&&<section className="card"><h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Tent size={17} className="text-blood"/>{t('Blood camps coming up')}</h2>
          <ul className="space-y-2 text-sm">{d.camps.map(c=><li key={c.id} className="flex items-center gap-3"><Droplet size={15} className="shrink-0 text-blood"/><span className="flex-1 text-fg">{c.name}<span className="block text-xs text-fog-faint">{fmt(c.date)}{c.venue?` · ${c.venue}`:''}</span></span>
            {c.status==='open'&&<Link className="btn-quiet px-3 py-1 text-xs" to={`/register/${c.id}`}>Register</Link>}</li>)}</ul></section>}
        <section className="card"><h2 className="mb-3 font-semibold text-fg">{t('Club team')}</h2><ul className="space-y-2 text-sm">{d.team.filter(x=>x.position!=='Member').map((x,i)=><li key={i} className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{x.name.split(' ').map(s=>s[0]).slice(0,2).join('')}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-fg">{x.name}</span><span className="block truncate text-xs text-fog-faint">{x.position}</span></span>
          {x.phone&&<a className="btn-ghost" href={`tel:${x.phone}`} aria-label={`Call ${x.name}`}><Phone size={15}/></a>}</li>)}</ul>
          <p className="mt-3 text-xs text-fog-faint">{d.team.length} active members in the club.</p></section></div></div>

    <Drawer open={!!card} onClose={()=>setCard(null)} title={t('My ID card')} description="Add your photo, then download the card. Show it at club events; the QR code proves you are a member."
      footer={card&&<><button className="btn-quiet" onClick={()=>setCard(null)}>Close</button><button className="btn" disabled={dl} onClick={getCard}><Download size={15}/>{dl?'Preparing…':'Download ID card'}</button></>}>
      {card&&<div className="space-y-4"><PhotoPicker self member={card} onSaved={u=>setCard({...card,photo_url:u||null})}/>
        <p className="text-sm text-fog-muted">The card shows your name, member ID {code('M',card.member_no,3)}, position, blood group and photo. It is valid till 30 June of this Rotary year; download it again after that.</p></div>}
    </Drawer>
    <Drawer open={!!edit} onClose={()=>setEdit(null)} title="My details" description="Position and membership type are changed by the secretary."
      footer={edit&&<><button className="btn-quiet" onClick={()=>setEdit(null)}>Cancel</button><button className="btn" form="me-form" disabled={busy}>{busy?'Saving…':'Save'}</button></>}>
      {edit&&<form id="me-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile" required><input className="input" required inputMode="numeric" value={edit.phone} onChange={e=>setEdit({...edit,phone:e.target.value})}/></Field>
        <Field label="Email"><input className="input" type="email" value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field>
        <Field label="Date of birth"><input type="date" className="input" max={todayIso()} value={edit.dob} onChange={e=>setEdit({...edit,dob:e.target.value})}/></Field>
        <Field label="Gender"><select className="input" value={edit.gender} onChange={e=>setEdit({...edit,gender:e.target.value})}><option value="">Not given</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
        <Field label="Blood group"><select className="input" value={edit.blood_group} onChange={e=>setEdit({...edit,blood_group:e.target.value})}><option value="">Not known</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label="Area or town"><input className="input" value={edit.area} onChange={e=>setEdit({...edit,area:e.target.value})}/></Field>
        <Field label="Occupation"><select className="input" value={edit.occupation} onChange={e=>setEdit({...edit,occupation:e.target.value})}><option value="">Choose</option><option>Student</option><option>Working professional</option><option>Business</option><option>Other</option></select></Field>
        <Field label="College or company"><input className="input" value={edit.organisation} onChange={e=>setEdit({...edit,organisation:e.target.value})}/></Field>
        <Field label="Address" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={edit.address} onChange={e=>setEdit({...edit,address:e.target.value})}/></Field>
        <Field label="Emergency contact" hint="Name and phone number" className="sm:col-span-2"><input className="input" value={edit.emergency_contact} onChange={e=>setEdit({...edit,emergency_contact:e.target.value})}/></Field>
      </form>}
    </Drawer>
  </div>
}

export function ClaimMember({onDone,compact}){
  const [f,setF]=useState({phone:'',dob:''}),[busy,setBusy]=useState(false),[err,setErr]=useState('')
  const go=async e=>{e.preventDefault();setBusy(true);setErr('');const {data,error}=await supabase.rpc('claim_member',{p_phone:normPhone(f.phone),p_dob:f.dob});setBusy(false)
    if(error)return setErr(error.message);celebrate();toast.success(`Welcome ${data.name}. Your login is linked to member ${code('M',data.member_no,3)}.`);onDone?.()}
  const form=<form onSubmit={go} className="card space-y-3">
    {compact&&<h2 className="flex items-center gap-2 font-semibold text-fg"><PartyPopper size={17} className="text-brand"/>Club member? Link your member record</h2>}
    <p className="text-sm text-fog-muted">Enter the mobile number and date of birth the club secretary has for you.</p>
    <Field label="Mobile number" required><input className="input" required inputMode="numeric" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field>
    <Field label="Date of birth" required><input type="date" className="input" required max={todayIso()} value={f.dob} onChange={e=>setF({...f,dob:e.target.value})}/></Field>
    {err&&<p role="alert" className="text-sm text-blood">{err}</p>}<button className="btn w-full" disabled={busy}>{busy?'Checking…':'Link my member record'}</button></form>
  return compact?form:<div className="mx-auto max-w-md"><PageHeader title="Link your member record" description="Do this once to see your meetings, attendance and dues."/>{form}</div>
}
