import {useEffect,useState} from 'react'
import {motion} from 'framer-motion'
import {CalendarDays,MapPin,Droplet,Eye,Ribbon,UtensilsCrossed,TreePine,HandHeart,ArrowRight} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import CountUp from '../components/CountUp'
import {useBrand} from '../context/Brand'
import {Logo} from '../components/Brand'
import {useLang} from '../lib/i18n'
import LangToggle from '../components/LangToggle'
import {usePulse} from '../lib/pulse'
import CampPhotos from '../components/CampPhotos'

const ICON={'Blood donation':Droplet,'Eye checking':Eye,'Cancer awareness':Ribbon,'Food donation':UtensilsCrossed,'Environment (plantation)':TreePine}
const TONE={'Blood donation':'text-blood bg-blood/10','Eye checking':'text-brand bg-brand/10','Cancer awareness':'text-pink-400 bg-pink-500/10','Food donation':'text-warn bg-warn/10','Environment (plantation)':'text-ok bg-ok/10'}
const tName=c=>c.type==='Others'?(c.type_other||'Community camp'):c.type
const t5=x=>x?String(x).slice(0,5):''
// the numbers a visitor cares about, by camp type
const upNums=c=>c.type==='Blood donation'?[[c.registered,'Registered'],[c.donated,c.target?`Donated of ${c.target}`:'Donated']]:c.online?[[c.registered,c.target?`Registered of ${c.target}`:'Registered']]:c.target?[[c.target,'Expected']]:[]
const doneNums=c=>c.type==='Blood donation'?[[c.donated,'units of blood'],[c.donated*3,'lives touched']]:c.type==='Food donation'?[[c.fed||c.helped||0,'people fed']]
  :c.type==='Environment (plantation)'?[[c.planted||c.helped||0,'saplings planted']]:c.type==='Cancer awareness'?[[Math.max(c.seen,c.heard,c.helped||0),'people reached']]:[[c.seen||c.helped||0,'people helped']]

export default function Landing(){
  const {brand}=useBrand(),{t}=useLang(),[d,setD]=useState(undefined),[now,setNow]=useState(Date.now())
  const load=()=>hasSupabase&&supabase.rpc('public_camps').then(({data,error})=>setD(error?null:data));usePulse(load)
  useEffect(()=>{load();const i=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(i)},[])
  const up=d?.upcoming||[],next=up[0],rest=up.slice(1),recent=d?.recent||[]
  const ms=next?new Date(`${next.date}T${t5(next.start_time)||'09:00'}`)-now:0,days=Math.floor(ms/864e5),hrs=Math.floor(ms%864e5/36e5)
  const I=next?ICON[next.type]||HandHeart:HandHeart
  return <div className="relative min-h-screen overflow-hidden px-5 py-10">
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl"/><LangToggle className="absolute right-4 top-4 z-10"/>
    <div className="relative mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col items-center text-center"><Logo size={60}/><h1 className="mt-3 font-display text-3xl font-semibold text-fg">{brand.club_name}</h1><p className="mt-1 text-fog-muted">{t('Camps and service')}</p></div>
      {d===undefined?<div className="card space-y-3"><div className="skeleton h-6 w-2/3"/><div className="skeleton h-4 w-1/2"/><div className="skeleton h-20"/></div>
      :!next?<div className="card text-center text-fog">{t('No camp is scheduled right now. Please check back soon.')}</div>
      :<motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="card overflow-hidden p-0">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[next.type]||'bg-ink-700 text-fog'}`}><I size={13}/>{t(tName(next))}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-fog-faint">{t('Next camp')}</span></div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-fg">{next.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog-muted"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14}/>{fmt(next.date)}{next.start_time&&`, ${t5(next.start_time)}${next.end_time?` – ${t5(next.end_time)}`:''}`}</span>{next.venue&&<span className="inline-flex items-center gap-1.5"><MapPin size={14}/>{next.venue}</span>}</div>
          {next.partner&&<div className="mt-1 text-xs text-fog-faint">{t('With')} {next.partner}</div>}
          {next.about&&<p className="mt-3 text-sm text-fog">{next.about}</p>}
          {next.cancer_types?.length>0&&<div className="mt-3 flex flex-wrap gap-1.5">{next.cancer_types.map(x=><span key={x} className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] text-fog-muted">{x}</span>)}</div>}
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-ink-900/60 p-3"><div className="font-display text-2xl font-semibold text-fg">{next.status==='live'?t('Live'):ms>0?`${days}d ${hrs}h`:t('Today')}</div><div className="text-xs text-fog-muted">{next.status==='live'?t('Camp is on'):t('To go')}</div></div>
            {upNums(next).map(([v,l])=><div key={l} className="rounded-xl bg-ink-900/60 p-3"><div className="font-display text-2xl font-semibold tabular-nums text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-muted">{t(l)}</div></div>)}</div>
          {next.status==='open'&&next.online&&<a className="btn mt-5 w-full" href={`#/register/${next.id}`}>{next.type==='Blood donation'?t('Register to donate'):t('Register now')}</a>}</div>
        {next.photos&&<div className="border-t border-ink-700 p-4"><CampPhotos links={next.photos} compact/></div>}
      </motion.section>}

      {rest.length>0&&<section className="mt-6"><h3 className="mb-3 text-sm font-semibold text-fg">{t('More camps coming up')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">{rest.map(c=>{const J=ICON[c.type]||HandHeart
          return <div key={c.id} className="card p-4"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-lg ${TONE[c.type]||'bg-ink-700 text-fog'}`}><J size={15}/></span><span className="text-xs text-fog-faint">{t(tName(c))}</span></div>
            <div className="mt-2 font-semibold text-fg">{c.name}</div><div className="text-xs text-fog-muted">{fmt(c.date)}{c.venue?` · ${c.venue}`:''}</div>
            {c.status==='open'&&c.online&&<a className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline" href={`#/register/${c.id}`}>{t('Register')}<ArrowRight size={14}/></a>}</div>})}</div></section>}

      {recent.length>0&&<section className="mt-8"><h3 className="mb-3 text-sm font-semibold text-fg">{t('Recent camps')}</h3>
        <div className="space-y-3">{recent.slice(0,6).map(c=>{const J=ICON[c.type]||HandHeart
          return <div key={c.id} className="card p-4"><div className="flex flex-wrap items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TONE[c.type]||'bg-ink-700 text-fog'}`}><J size={16}/></span>
            <div className="min-w-0 flex-1"><div className="truncate font-semibold text-fg">{c.name}</div><div className="text-xs text-fog-muted">{t(tName(c))} · {fmt(c.date)}{c.venue?` · ${c.venue}`:''}</div></div>
            <div className="flex gap-4">{doneNums(c).map(([v,l])=><div key={l} className="text-right"><div className="font-display text-lg font-semibold tabular-nums text-fg">{v}</div><div className="text-[11px] text-fog-faint">{t(l)}</div></div>)}</div></div>
            {c.photos&&<div className="mt-3"><CampPhotos links={c.photos} compact max={8}/></div>}</div>})}</div></section>}

      <div className="mt-8 flex flex-wrap justify-center gap-5 text-sm"><a className="text-brand hover:underline" href="#/impact">{t('See our impact')}</a><a className="text-fog-faint hover:text-fg" href="#/login">{t('Team and donor login')}</a></div>
    </div></div>
}
