import {useEffect,useState} from 'react'
import {Droplet} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import CountUp from '../components/CountUp'
import {useBrand} from '../context/Brand'
import {Logo} from '../components/Brand'
export default function Landing(){
  const {brand}=useBrand(),[c,setC]=useState(undefined),[now,setNow]=useState(Date.now())
  useEffect(()=>{if(hasSupabase)supabase.rpc('public_camp_info').then(({data})=>setC(data));const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[])
  const ms=c?new Date(`${c.date}T${(c.start_time||'09:00').slice(0,5)}`)-now:0,days=Math.floor(ms/864e5),hrs=Math.floor(ms%864e5/36e5)
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5"><div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl"/><div className="relative w-full max-w-lg text-center">
    <div className="mb-4 flex justify-center"><Logo size={60}/></div>
    <h1 className="text-3xl font-semibold text-fg">{brand.club_name}</h1><p className="mt-1 text-fog-muted">Blood donation camp</p>
    {c===undefined?<div className="card mt-6 text-fog-muted">Loading…</div>:!c?<div className="card mt-6">No camp is scheduled right now. Please check back soon.</div>
    :<div className="card mt-6 text-left"><div className="text-xl font-semibold text-fg">{c.name}</div>
      <div className="mt-1 text-fog">{fmt(c.date)}{c.start_time&&`, ${c.start_time.slice(0,5)}`}{c.end_time&&` to ${c.end_time.slice(0,5)}`}</div>{c.venue&&<div className="text-fog-muted">{c.venue}</div>}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-semibold text-fg">{c.status==='live'?'Live':ms>0?`${days}d ${hrs}h`:'Today'}</div><div className="text-xs text-fog-muted">{c.status==='live'?'Camp is on':'To go'}</div></div>
        <div><div className="text-2xl font-semibold tabular-nums text-fg"><CountUp value={c.registered}/></div><div className="text-xs text-fog-muted">Registered</div></div>
        <div><div className="text-2xl font-semibold tabular-nums text-blood"><CountUp value={c.donated}/></div><div className="text-xs text-fog-muted">Donated{c.target?` of ${c.target}`:''}</div></div></div>
      {c.status==='open'&&<a className="btn mt-5 w-full" href={`#/register/${c.id}`}>Register to donate</a>}</div>}
    <a className="mt-6 inline-block text-sm text-fog-faint hover:text-fg" href="#/login">Team and donor login</a></div></div>
}
