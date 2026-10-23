import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {motion} from 'framer-motion'
import {CalendarDays,Clock,MapPin,Ticket,CheckCircle2,XCircle} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {fmt,normPhone} from '../lib/util'
import {Logo} from '../components/Brand'
import {useBrand} from '../context/Brand'
import {Field} from '../components/ui'
import {celebrate} from '../lib/fx'
import {useLang} from '../lib/i18n'
import LangToggle from '../components/LangToggle'

// Public page from the event's QR code or link
export default function EventRegister(){
  const {id}=useParams(),{brand}=useBrand(),{t}=useLang(),[e,setE]=useState(undefined),[f,setF]=useState({name:'',phone:'',org:''}),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[done,setDone]=useState(null)
  useEffect(()=>{supabase.rpc('event_public',{p_event:id}).then(({data})=>setE(data||null))},[id])
  const go=async ev=>{ev.preventDefault();setBusy(true);setErr('');const {data,error}=await supabase.rpc('register_event',{p_event:id,p_name:f.name,p_phone:normPhone(f.phone),p_org:f.org||null});setBusy(false)
    if(error)return setErr(error.message);setDone(data);if(!data.already)celebrate()}
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5">
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl"/>
    <LangToggle className="absolute right-4 top-4 z-10"/><motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className="relative w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-3"><Logo size={44}/><div className="font-display font-semibold text-fg">{brand.club_name}</div></div>
      <div className="card overflow-hidden p-0">
        {e===undefined?<div className="p-8 text-center text-sm text-fog-muted">{t('Loading…')}</div>:!e?<div className="flex items-center gap-3 p-6"><XCircle className="text-blood"/><span className="text-fg">{t('Event not found')}</span></div>:<>
        <div className="bg-gradient-to-br from-brand/25 to-transparent px-6 py-5"><div className="text-xs font-semibold uppercase tracking-wider text-brand">{e.kind}</div><h1 className="mt-1 font-display text-2xl font-semibold text-fg">{e.title}</h1>
          <div className="mt-3 space-y-1 text-sm text-fog-muted"><div><CalendarDays size={14} className="mr-2 inline"/>{fmt(e.date)}</div>{e.start&&<div><Clock size={14} className="mr-2 inline"/>{String(e.start).slice(0,5)}{e.end?` – ${String(e.end).slice(0,5)}`:''}</div>}{e.venue&&<div><MapPin size={14} className="mr-2 inline"/>{e.venue}</div>}{e.fee>0&&<div><Ticket size={14} className="mr-2 inline"/>{t('Entry fee')} Rs. {Number(e.fee)}</div>}</div>
          {e.description&&<p className="mt-3 whitespace-pre-line text-sm text-fog">{e.description}</p>}</div>
        {done?<div className="p-6 text-center"><CheckCircle2 size={44} className="mx-auto text-ok"/><div className="mt-2 font-display text-xl font-semibold text-fg">{done.already?t('You are already registered'):t('You are registered')}</div>
          <div className="mt-1 text-sm text-fog-muted">{t('Your pass number')}</div><div className="font-mono text-3xl font-bold tracking-wider text-fg">E-{String(done.pass_no).padStart(3,'0')}</div><p className="mt-2 text-xs text-fog-faint">{t('Show this number at the entrance.')}</p></div>
        :!e.open||e.full?<div className="p-6 text-sm text-fog-muted">{e.full?t('Sorry, this event is full.'):t('Registration is closed.')}</div>
        :<form onSubmit={go} className="space-y-3 p-6"><Field label={t('Your name')} required><input className="input" required minLength={2} value={f.name} onChange={x=>setF({...f,name:x.target.value})}/></Field>
          <Field label={t('Mobile number')} required><input className="input" required inputMode="numeric" value={f.phone} onChange={x=>setF({...f,phone:x.target.value})}/></Field>
          <Field label={t('College or organisation')}><input className="input" value={f.org} onChange={x=>setF({...f,org:x.target.value})}/></Field>
          {err&&<p role="alert" className="text-sm text-blood">{err}</p>}<button className="btn w-full py-3" disabled={busy}>{busy?t('Registering…'):t('Register')}</button></form>}</>}
      </div></motion.div></div>
}
