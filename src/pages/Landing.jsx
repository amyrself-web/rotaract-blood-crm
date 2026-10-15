import {useEffect,useState} from 'react'
import {Droplet} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
export default function Landing(){
  const [c,setC]=useState(undefined),[now,setNow]=useState(Date.now())
  useEffect(()=>{if(hasSupabase)supabase.rpc('public_camp_info').then(({data})=>setC(data));const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[])
  const ms=c?new Date(`${c.date}T${(c.start_time||'09:00').slice(0,5)}`)-now:0,days=Math.floor(ms/864e5),hrs=Math.floor(ms%864e5/36e5)
  return <div className="grid min-h-screen place-items-center bg-gradient-to-b from-ink-900 to-ink-950 p-5"><div className="w-full max-w-lg text-center">
    <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blood/15 text-blood"><Droplet size={26}/></span>
    <h1 className="text-3xl font-semibold text-white">Sankari Rotaract Club</h1><p className="mt-1 text-slate-400">Blood donation camp</p>
    {c===undefined?<div className="card mt-6 text-slate-400">Loading…</div>:!c?<div className="card mt-6">No camp is scheduled right now. Please check back soon.</div>
    :<div className="card mt-6 text-left"><div className="text-xl font-semibold text-white">{c.name}</div>
      <div className="mt-1 text-slate-300">{fmt(c.date)}{c.start_time&&`, ${c.start_time.slice(0,5)}`}{c.end_time&&` to ${c.end_time.slice(0,5)}`}</div>{c.venue&&<div className="text-slate-400">{c.venue}</div>}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-semibold text-white">{c.status==='live'?'Live':ms>0?`${days}d ${hrs}h`:'Today'}</div><div className="text-xs text-slate-400">{c.status==='live'?'Camp is on':'To go'}</div></div>
        <div><div className="text-2xl font-semibold text-white">{c.registered}</div><div className="text-xs text-slate-400">Registered</div></div>
        <div><div className="text-2xl font-semibold text-blood">{c.donated}</div><div className="text-xs text-slate-400">Donated{c.target?` of ${c.target}`:''}</div></div></div>
      {c.status==='open'&&<a className="btn mt-5 w-full" href={`#/register/${c.id}`}>Register to donate</a>}</div>}
    <a className="mt-6 inline-block text-sm text-slate-500 hover:text-white" href="#/login">Team and donor login</a></div></div>
}
