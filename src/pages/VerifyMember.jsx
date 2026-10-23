import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {motion} from 'framer-motion'
import {ShieldCheck,ShieldX,ShieldAlert,CalendarDays,Droplet,BadgeCheck} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {Logo} from '../components/Brand'
import {useBrand} from '../context/Brand'

// Opens from the QR on a member ID card. Shows only what is printed on the card, plus whether the member is still active.
export default function VerifyMember(){
  const {code}=useParams(),{brand}=useBrand(),[r,setR]=useState(null)
  useEffect(()=>{if(!hasSupabase)return setR({error:'failed'});supabase.rpc('verify_member',{p_code:code}).then(({data,error})=>setR(error?{error:'failed'}:data||{error:'not found'}))},[code])
  const today=new Date().toLocaleDateString('en-CA'),ok=r&&!r.error,valid=ok&&r.status==='active'&&r.valid_till>=today
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5">
    <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl ${valid?'bg-ok/20':r?'bg-blood/20':'bg-brand/15'}`}/>
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className="relative w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-3"><Logo size={44}/><div><div className="font-display font-semibold text-fg">{brand.club_name}</div><div className="text-xs text-fog-faint">Member ID check</div></div></div>
      <div className="card overflow-hidden p-0">
        {!r?<div className="p-8 text-center text-sm text-fog-muted" role="status">Checking the ID card…</div>
        :ok?<>
          <div className={`flex items-center gap-4 px-6 py-5 ${valid?'bg-ok/10':'bg-warn/10'}`}>
            <motion.span initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',stiffness:260,damping:14}} className={`grid h-12 w-12 place-items-center rounded-full text-white ${valid?'bg-ok':'bg-warn'}`}>{valid?<ShieldCheck size={24}/>:<ShieldAlert size={24}/>}</motion.span>
            <div><h1 className="font-display text-xl font-semibold text-fg">{valid?'Valid member ID':r.status!=='active'?`Member is ${r.status}`:'Card has expired'}</h1>
              <div className="text-sm text-fog-muted">{valid?`Valid till ${fmt(r.valid_till)}`:r.status!=='active'?'This person is no longer an active member.':'Ask the member to download a new card.'}</div></div></div>
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-700 font-display text-2xl font-semibold text-brand">{r.photo_url?<img src={r.photo_url} alt="" className="h-full w-full object-cover"/>:r.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
            <div className="min-w-0"><div className="font-display text-2xl font-semibold text-fg">{r.name}</div><div className="text-sm text-fog-muted">{r.position}</div>
              <div className="mt-1 font-mono text-xs text-fog-faint">M-{String(r.member_no).padStart(3,'0')} · {r.type}</div></div></div>
          <dl className="space-y-2 border-t border-ink-700 px-6 py-4 text-sm">
            {[[Droplet,'Blood group',r.blood_group],[CalendarDays,'Member since',r.joined_on&&fmt(r.joined_on)],[BadgeCheck,'Club',r.club||brand.club_name]].filter(x=>x[2]).map(([I,l,v])=>
              <div key={l} className="flex items-center gap-3"><I size={16} className="text-fog-faint"/><dt className="w-28 text-fog-faint">{l}</dt><dd className={`font-medium ${l==='Blood group'?'font-display text-blood':'text-fg'}`}>{v}</dd></div>)}</dl></>
        :<div className="flex items-center gap-4 bg-blood/10 px-6 py-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blood text-white"><ShieldX size={24}/></span>
          <div><h1 className="font-display text-xl font-semibold text-fg">{r.error==='failed'?'Could not check right now':'ID card not found'}</h1><p className="text-sm text-fog-muted">{r.error==='failed'?'Check your internet connection and try again.':'This QR code does not match any member of the club.'}</p></div></div>}
      </div>
      <a href="#/home" className="mt-5 block text-center text-sm text-fog-faint hover:text-fg">About the club</a>
    </motion.div></div>
}
