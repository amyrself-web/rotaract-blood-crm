import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
export default function Verify(){
  const {code}=useParams(),[r,setR]=useState(null)
  useEffect(()=>{if(hasSupabase)supabase.rpc('verify_certificate',{p_code:code}).then(({data})=>setR(data||{error:'not found'}))},[code])
  return <div className="grid min-h-screen place-items-center bg-ink-950 p-5"><div className="card w-full max-w-sm animate-scaleIn text-center">
    {!r?<span className="text-slate-400">Checking…</span>:r.error?<><h1 className="text-lg font-semibold text-blood">Certificate not found</h1><p className="mt-2 text-sm text-slate-400">This code does not match any donation we have on record.</p></>
    :<><h1 className="text-lg font-semibold text-white">Valid certificate</h1><p className="mt-2 text-slate-300">{r.name} donated blood at {r.camp} on {fmt(r.date)}.</p><p className="mt-1 text-xs text-slate-500">Sankari Rotaract Club</p></>}</div></div>
}
