// "What's happening": upcoming camps, events and service projects, one at a time, on the sign-in page.
import {useEffect,useRef,useState} from 'react'
import {motion,AnimatePresence,useReducedMotion} from 'framer-motion'
import {Droplet,CalendarDays,HeartHandshake,MapPin,Users,ArrowRight,ChevronLeft,ChevronRight} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {usePulse} from '../lib/pulse'

const TYPE={camp:['Blood camp',Droplet,'text-blood bg-blood/15'],event:['Event',CalendarDays,'text-brand bg-brand/15'],project:['Service project',HeartHandshake,'text-ok bg-ok/15']}
const PHASE={live:['Happening now','bg-blood text-white'],upcoming:['Coming up','bg-brand/15 text-brand'],ongoing:['Ongoing','bg-warn/15 text-warn'],done:['Done','bg-ok/15 text-ok']}
const CTA={camp:'Register to donate',event:'Register'}
const MS=5500

export default function Showcase({compact=false}){
  const [items,setItems]=useState(null),[i,setI]=useState(0),[hold,setHold]=useState(false),reduce=useReducedMotion(),box=useRef(null)
  const load=()=>hasSupabase?supabase.rpc('public_showcase').then(({data,error})=>{if(!error)setItems(Array.isArray(data)?data:[])},()=>setItems(x=>x||[])):setItems([])
  useEffect(()=>{load()},[]);usePulse(load)
  const n=items?.length||0,go=d=>setI(x=>(x+d+n)%n)
  useEffect(()=>{if(n<2||hold)return;const t=setTimeout(()=>go(1),MS);return()=>clearTimeout(t)},[i,n,hold])
  if(!n)return null
  const it=items[i%n],[tl,TI,tc]=TYPE[it.type]||TYPE.event,[pl,pc]=PHASE[it.phase]||PHASE.upcoming
  const key=e=>{if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)}
  return <section ref={box} aria-roledescription="carousel" aria-label="What's happening at the club" tabIndex={0} onKeyDown={key}
    onMouseEnter={()=>setHold(true)} onMouseLeave={()=>setHold(false)} onFocus={()=>setHold(true)} onBlur={e=>!box.current?.contains(e.relatedTarget)&&setHold(false)}
    className={`relative outline-none ${compact?'':'max-w-lg'}`}>
    <div className="mb-3 flex items-center gap-2"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blood opacity-60 motion-reduce:hidden"/><span className="relative inline-flex h-2 w-2 rounded-full bg-blood"/></span>
      <span className="text-xs font-semibold uppercase tracking-[.14em] text-fog-faint">What's happening</span>
      {n>1&&<span className="ml-auto text-xs tabular-nums text-fog-faint" aria-live="polite">{i%n+1} / {n}</span>}</div>
    <div className={`relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/70 backdrop-blur ${compact?'min-h-[120px] p-4':'min-h-[208px] p-5'}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.article key={it.type+it.id} aria-roledescription="slide" aria-label={`${i%n+1} of ${n}: ${it.title}`}
          initial={reduce?{opacity:0}:{opacity:0,x:24}} animate={{opacity:1,x:0}} exit={reduce?{opacity:0}:{opacity:0,x:-24}} transition={{duration:.28,ease:'easeOut'}}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tc}`}><TI size={13}/>{tl}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pc}`}>{pl}</span>
            {it.tag&&it.type!=='camp'&&<span className="text-xs text-fog-faint">{it.tag}</span>}</div>
          <h3 className={`mt-3 font-display font-semibold leading-tight text-fg ${compact?'text-lg':'text-2xl'}`}>{it.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog-muted">
            {it.date&&<span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-fog-faint"/>{fmt(it.date)}</span>}
            {it.venue&&<span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-fog-faint"/>{it.venue}</span>}
            {it.people>0&&<span className="inline-flex items-center gap-1.5"><Users size={14} className="text-fog-faint"/><b className="font-semibold tabular-nums text-fg">{it.people}</b> {it.people_label}</span>}</div>
          {it.about&&!compact&&<p className="mt-3 line-clamp-3 text-sm leading-relaxed text-fog">{it.about}</p>}
          {it.link&&<a href={it.link} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">{CTA[it.type]||'Open'}<ArrowRight size={15}/></a>}
        </motion.article></AnimatePresence>
      {n>1&&!hold&&!reduce&&<motion.div key={'bar'+i} className="absolute bottom-0 left-0 h-0.5 bg-brand/70" initial={{width:0}} animate={{width:'100%'}} transition={{duration:MS/1000,ease:'linear'}}/>}
    </div>
    {n>1&&<div className="mt-3 flex items-center gap-2">
      <button type="button" className="btn-ghost p-1.5" aria-label="Previous" onClick={()=>go(-1)}><ChevronLeft size={16}/></button>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">{items.map((x,k)=><button key={k} type="button" aria-label={`Show ${x.title}`} aria-current={k===i%n}
        onClick={()=>setI(k)} className={`h-1.5 rounded-full transition-all ${k===i%n?'w-6 bg-brand':'w-1.5 bg-ink-600 hover:bg-fog-faint'}`}/>)}</div>
      <button type="button" className="btn-ghost p-1.5" aria-label="Next" onClick={()=>go(1)}><ChevronRight size={16}/></button></div>}
  </section>
}
