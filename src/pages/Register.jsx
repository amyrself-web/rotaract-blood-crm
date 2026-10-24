import {useEffect,useMemo,useState} from 'react'
import {useParams} from 'react-router-dom'
import {motion} from 'framer-motion'
import {CalendarDays,MapPin,CheckCircle2} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {BLOOD,normPhone,fmt,slots} from '../lib/util'
import {Logo} from '../components/Brand'
import {useBrand} from '../context/Brand'
import {Field,adultMax,adultMin,PHONE_PATTERN} from '../components/ui'
import {useLang} from '../lib/i18n'
import LangToggle from '../components/LangToggle'
import {usePulse} from '../lib/pulse'

export default function Register(){
  const {campId}=useParams(),{brand}=useBrand()
  const {t}=useLang();const [camp,setCamp]=useState(undefined),[taken,setTaken]=useState({}),[f,setF]=useState({name:'',phone:'',group:'',dob:'',area:'',slot:'',consent:false}),[msg,setMsg]=useState(''),[done,setDone]=useState(null),[busy,setBusy]=useState(false)
  const loadSlots=()=>supabase.rpc('camp_slots',{p_camp:campId}).then(({data})=>setTaken(Object.fromEntries((data||[]).map(x=>[x.slot,x]))))
  const loadCamp=()=>supabase.from('camps').select('*').eq('id',campId).maybeSingle().then(({data})=>setCamp(data))
  usePulse(()=>{loadCamp();loadSlots()})
  useEffect(()=>{if(!hasSupabase)return;loadCamp();loadSlots()
    const t=setInterval(loadSlots,20000);return()=>clearInterval(t)},[campId])
  const list=useMemo(()=>camp?slots(camp.start_time,camp.end_time):[],[camp])
  const left=s=>camp?.slot_capacity?camp.slot_capacity-(taken[s]?.taken||0):null
  const set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value})
  const submit=async e=>{e.preventDefault();setMsg('')
    if(f.name.trim().length<2)return setMsg(t('Enter your full name'))
    if(!/^[6-9]\d{9}$/.test(normPhone(f.phone)))return setMsg(t('Enter a valid 10-digit mobile number'))
    setBusy(true)
    const {data,error}=await supabase.rpc('register_for_camp',{p_camp:campId,p_name:f.name,p_phone:normPhone(f.phone),p_group:f.group||null,p_dob:f.dob||null,p_area:f.area||null,p_slot:f.slot||null,p_consent:f.consent})
    setBusy(false);if(error){setMsg(error.message);loadSlots();return}setDone({token:/^\d+$/.test(data||'')?Number(data):null})}
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5">
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-80 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl"/>
    <LangToggle className="absolute right-4 top-4 z-10"/><motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className="relative w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center"><Logo size={52}/><h1 className="mt-3 font-display text-xl font-semibold text-fg">{brand.club_name}</h1><p className="text-sm text-fog-muted">{t('Blood donation camp registration')}</p></div>
      {camp===undefined?<div className="card space-y-3"><div className="skeleton h-5 w-2/3"/><div className="skeleton h-10"/><div className="skeleton h-10"/></div>
      :!camp||camp.status!=='open'||camp.deleted_at?<div className="card text-center text-fog">{t('Registration for this camp is not open. Please check with the club.')}</div>
      :done?<motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} className="card text-center">
          <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',stiffness:260,damping:14}} className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-ok text-white"><CheckCircle2 size={28}/></motion.div>
          <h2 className="font-display text-xl font-semibold text-fg">{t('You are registered')}</h2>
          {done.token&&<div className="mx-auto mt-4 w-fit rounded-2xl border border-ink-600 px-6 py-3"><div className="text-xs text-fog-faint">{t('Your token number')}</div><div className="font-display text-4xl font-semibold text-blood">T-{String(done.token).padStart(3,'0')}</div></div>}
          <p className="mt-4 text-fog">{camp.name}<br/>{fmt(camp.camp_date)}{f.slot&&` at ${f.slot}`}{camp.venue&&`, ${camp.venue}`}</p>
          <p className="mt-3 text-sm text-fog-muted">{t('Show this token at the desk and bring a photo ID. Eat well and drink water before you come.')}</p></motion.div>
      :<form onSubmit={submit} className="card space-y-4">
        <div className="rounded-xl bg-ink-750 p-3 text-sm"><div className="font-display font-semibold text-fg">{camp.name}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-fog-muted"><span className="flex items-center gap-1.5"><CalendarDays size={14}/>{fmt(camp.camp_date)}{camp.start_time&&`, ${camp.start_time.slice(0,5)} to ${(camp.end_time||'').slice(0,5)}`}</span>{camp.venue&&<span className="flex items-center gap-1.5"><MapPin size={14}/>{camp.venue}</span>}</div></div>
        <Field label={t('Full name')} required><input className="input" autoComplete="name" required minLength={2} value={f.name} onChange={set('name')}/></Field>
        <Field label={t('Mobile number')} required hint={t('10 digits, used for camp reminders.')}><input className="input" type="tel" inputMode="numeric" autoComplete="tel" required pattern={PHONE_PATTERN} maxLength={10} title="10-digit mobile number" value={f.phone} onChange={e=>setF({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)})}/></Field>
        <Field label={t('Date of birth')} required hint={t('Donors must be 18 to 65 years old.')}><input type="date" required min={adultMin()} max={adultMax()} className="input" value={f.dob} onChange={set('dob')}/></Field>
        <Field label={t('Blood group')} hint={t('Leave as not known if you are unsure; it is tested at the camp.')}><select className="input" value={f.group} onChange={set('group')}><option value="">{t('Not known')}</option>{BLOOD.map(b=><option key={b}>{b}</option>)}</select></Field>
        <Field label={t('Area or town')}><input className="input" value={f.area} onChange={set('area')}/></Field>
        {list.length>0&&<div><span className="label">{t('Time slot')}<span className="ml-0.5 text-blood">*</span></span><div className="grid grid-cols-3 gap-2">{list.map(s=>{const l=left(s),full=l!==null&&l<=0
          return <button type="button" key={s} disabled={full} onClick={()=>setF({...f,slot:s})} aria-pressed={f.slot===s}
            className={`rounded-xl border px-2 py-2 text-sm transition ${f.slot===s?'border-brand bg-brand/15 text-fg ring-1 ring-brand/40':'border-ink-600 text-fog hover:border-ink-500'} disabled:cursor-not-allowed disabled:opacity-40`}>
            <div className="font-semibold">{s}</div><div className="text-[11px] text-fog-faint">{full?t('Full'):l!==null?`${l} ${t('left')}`:t('Open')}</div></button>})}</div></div>}
        <label className="flex gap-2.5 text-sm text-fog"><input type="checkbox" className="mt-1" required checked={f.consent} onChange={set('consent')}/><span>{t('I agree to be contacted about this camp and future blood donation drives, and to my details being stored for this purpose.')}</span></label>
        {msg&&<p role="alert" className="rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">{msg}</p>}
        <button className="btn w-full py-2.5" disabled={busy||(list.length>0&&!f.slot)}>{busy?t('Registering…'):list.length>0&&!f.slot?t('Choose a time slot'):t('Register')}</button></form>}
    </motion.div></div>
}
