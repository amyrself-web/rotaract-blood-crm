import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
export default function Verify(){
  const {code}=useParams(),[r,setR]=useState(null)
  useEffect(()=>{if(hasSupabase)supabase.rpc('verify_certificate',{p_code:code}).then(({data})=>setR(data||{error:'not found'}))},[code])
  return <div className="grid min-h-screen place-items-center bg-ink-950 p-5"><div className="card w-full max-w-sm text-center">
    {!r?<span className="text-fog-muted">Checking…</span>:r.error?<><h1 className="text-lg font-semibold text-blood">Certificate not found</h1><p className="mt-2 text-sm text-fog-muted">This code does not match any donation we have on record.</p></>
    :<><h1 className="text-lg font-semibold text-white">Valid certificate</h1><p className="mt-2 text-fog">{r.name} donated blood at {r.camp} on {fmt(r.date)}.</p><p className="mt-1 text-xs text-fog-faint">Sankari Rotaract Club</p></>}</div></div>
}
