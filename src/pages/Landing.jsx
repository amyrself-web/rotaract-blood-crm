import {useEffect,useState} from 'react'
import {Droplet} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import CountUp from '../components/CountUp'
export default function Landing(){
  const [c,setC]=useState(undefined),[now,setNow]=useState(Date.now())
  useEffect(()=>{if(hasSupabase)supabase.rpc('public_camp_info').then(({data})=>setC(data));const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[])
  const ms=c?new Date(`${c.date}T${(c.start_time||'09:00').slice(0,5)}`)-now:0,days=Math.floor(ms/864e5),hrs=Math.floor(ms%864e5/36e5)
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5"><div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl animate-glow"/><div className="relative w-full max-w-lg animate-scaleIn text-center">
    <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blood/15 text-blood shadow-[0_0_30px_-6px_rgba(225,29,72,.7)]"><Droplet size={26} className="animate-drop"/></span>
    <h1 className="text-3xl font-semibold text-white">Sankari Rotaract Club</h1><p className="mt-1 text-slate-400">Blood donation camp</p>
    {c===undefined?<div className="card mt-6 text-slate-400">Loading…</div>:!c?<div className="card mt-6">No camp is scheduled right now. Please check back soon.</div>
    :<div className="card mt-6 text-left"><div className="text-xl font-semibold text-white">{c.name}</div>
      <div className="mt-1 text-slate-300">{fmt(c.date)}{c.start_time&&`, ${c.start_time.slice(0,5)}`}{c.end_time&&` to ${c.end_time.slice(0,5)}`}</div>{c.venue&&<div className="text-slate-400">{c.venue}</div>}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-semibold text-white">{c.status==='live'?'Live':ms>0?`${days}d ${hrs}h`:'Today'}</div><div className="text-xs text-slate-400">{c.status==='live'?'Camp is on':'To go'}</div></div>
        <div><div className="text-2xl font-semibold tabular-nums text-white"><CountUp value={c.registered}/></div><div className="text-xs text-slate-400">Registered</div></div>
        <div><div className="text-2xl font-semibold tabular-nums text-blood"><CountUp value={c.donated}/></div><div className="text-xs text-slate-400">Donated{c.target?` of ${c.target}`:''}</div></div></div>
      {c.status==='open'&&<a className="btn mt-5 w-full" href={`#/register/${c.id}`}>Register to donate</a>}</div>}
    <a className="mt-6 inline-block text-sm text-slate-500 hover:text-white" href="#/login">Team and donor login</a></div></div>
}
