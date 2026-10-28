import {useEffect,useState} from 'react'
import {motion} from 'framer-motion'
import {Droplet,HeartPulse,Users,Tent,Eye,HandHeart,Clock,FolderHeart,Share2,CalendarDays,MapPin} from 'lucide-react'
import {toast} from 'sonner'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {Logo} from '../components/Brand'
import {useBrand} from '../context/Brand'
import CountUp from '../components/CountUp'
import LangToggle from '../components/LangToggle'
import {useLang} from '../lib/i18n'
import {usePulse} from '../lib/pulse'

const GROUPS=['A+','A-','B+','B-','AB+','AB-','O+','O-']

// Public page: what the club has done, in numbers. No names.
export default function Impact(){
  const {brand}=useBrand(),{t}=useLang(),[d,setD]=useState(null)
  const load=()=>hasSupabase&&supabase.rpc('public_impact').then(({data})=>data&&setD(data))
  useEffect(()=>{load()},[]);usePulse(load)
  const share=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:brand.club_name,url});else{await navigator.clipboard.writeText(url);toast.success(t('Link copied'))}}catch{}}
  const big=d?[[Droplet,t('Units of blood collected'),d.units,'from-blood to-rose-700'],[HeartPulse,t('Lives touched'),d.units*3,'from-rose-500 to-pink-600']]:[]
  const small=d?[[Users,t('Registered donors'),d.donors],[Tent,t('Blood camps held'),d.camps],[Eye,t('Eye donations'),d.eye],[HandHeart,t('Pledges'),d.pledges],
    [FolderHeart,t('Service projects done'),d.projects],[Users,t('People helped'),d.helped],...(d.eye_screened?[[Eye,t('Eye check-ups'),d.eye_screened]]:[]),...(d.spectacles?[[Eye,t('Spectacles given'),d.spectacles]]:[]),...(d.cancer_screened?[[HeartPulse,t('Cancer screenings'),d.cancer_screened]]:[]),...(d.meals?[[HandHeart,t('Meals served'),d.meals]]:[]),...(d.saplings?[[FolderHeart,t('Saplings planted'),d.saplings]]:[]),[Clock,t('Volunteer hours'),Math.round(d.hours)],[Users,t('Active members'),d.members]]:[]
  const maxG=d?.by_group?Math.max(1,...Object.values(d.by_group)):1,maxM=d?.by_month?.length?Math.max(...d.by_month.map(x=>x.n)):1
  return <div className="relative min-h-screen overflow-hidden px-5 py-10">
    <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl"/>
    <LangToggle className="absolute right-4 top-4 z-10"/>
    <div className="relative mx-auto max-w-4xl">
      <div className="mb-8 flex flex-col items-center text-center"><Logo size={60}/><h1 className="mt-3 font-display text-3xl font-semibold text-fg">{d?.club||brand.club_name}</h1>
        <p className="mt-1 text-fog-muted">{t('Our impact')}</p><button className="btn-quiet mt-3 px-3 py-1.5 text-xs" onClick={share}><Share2 size={13}/>{t('Share')}</button></div>
      {!d?<div className="grid gap-4 sm:grid-cols-2">{[0,1,2,3].map(i=><div key={i} className="skeleton h-32"/>)}</div>:<>
        <div className="grid gap-4 sm:grid-cols-2">{big.map(([I,l,v,g],i)=><motion.div key={l} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*.1}} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${g} p-6 text-white shadow-xl`}>
          <I size={26} className="opacity-80"/><div className="mt-3 font-display text-5xl font-bold tabular-nums"><CountUp value={v}/></div><div className="mt-1 text-sm text-white/85">{l}</div>
          <I size={140} className="absolute -bottom-6 -right-6 opacity-10"/></motion.div>)}</div>
        <p className="mt-3 text-center text-xs text-fog-faint">{t('Every unit can save up to three lives.')}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{small.map(([I,l,v],i)=><motion.div key={l} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.2+i*.05}} className="card p-4">
          <I size={18} className="text-brand"/><div className="mt-2 font-display text-2xl font-semibold tabular-nums text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-muted">{l}</div></motion.div>)}</div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="card"><h2 className="mb-4 font-semibold text-fg">{t('Blood collected, by group')}</h2><div className="flex h-40 items-end gap-2">{GROUPS.map((g,i)=>{const n=d.by_group?.[g]||0
            return <div key={g} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-xs tabular-nums text-fog-muted">{n}</span><motion.div initial={{height:0}} animate={{height:`${Math.max(2,n/maxG*75)}%`}} transition={{delay:.3+i*.05,type:'spring',stiffness:120,damping:18}} className="w-full min-h-[3px] rounded-t-md bg-gradient-to-t from-rose-700 to-blood"/><span className="font-display text-xs font-semibold text-blood">{g}</span></div>})}</div></section>
          <section className="card"><h2 className="mb-4 font-semibold text-fg">{t('Last 12 months')}</h2>{d.by_month?.length?<div className="flex h-40 items-end gap-2">{d.by_month.map((x,i)=><div key={x.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-xs tabular-nums text-fog-muted">{x.n}</span>
            <motion.div initial={{height:0}} animate={{height:`${Math.max(2,x.n/maxM*75)}%`}} transition={{delay:.3+i*.05}} className="w-full min-h-[3px] rounded-t-md bg-gradient-to-t from-brand/60 to-brand"/><span className="text-[10px] text-fog-faint">{new Date(x.m+'-01').toLocaleDateString('en-IN',{month:'short'})}</span></div>)}</div>:<p className="text-sm text-fog-faint">-</p>}</section></div>
        {d.next_camp&&<div className="card mt-6 flex flex-wrap items-center gap-4 border-blood/40"><Droplet className="text-blood"/><div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wider text-blood">{t('Next camp')}</div><div className="font-display text-lg font-semibold text-fg">{d.next_camp.name}</div>
          <div className="text-sm text-fog-muted"><CalendarDays size={13} className="mr-1 inline"/>{fmt(d.next_camp.date)}{d.next_camp.venue&&<><MapPin size={13} className="ml-3 mr-1 inline"/>{d.next_camp.venue}</>}</div></div><a className="btn" href={`#/register/${d.next_camp.id}`}>{t('Register to donate')}</a></div>}</>}
    </div></div>
}
