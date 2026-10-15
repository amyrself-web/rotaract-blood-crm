import {useEffect,useState} from 'react'
import {Plus,QrCode} from 'lucide-react'
import QRCode from 'qrcode'
import {supabase} from '../lib/supabase'
import {fmt} from '../lib/util'
const STATUS=['planned','open','live','completed','closed']
const empty={name:'',camp_date:'',start_time:'09:00',end_time:'16:00',venue:'',target_donors:''}
const link=id=>`${location.origin}${location.pathname}#/register/${id}`
export default function Camps(){
  const [rows,setRows]=useState([]),[form,setForm]=useState(null),[err,setErr]=useState(''),[qr,setQr]=useState(null)
  const load=()=>supabase.from('camps').select('*, registrations(count)').order('camp_date',{ascending:false}).then(({data,error})=>error?setErr(error.message):setRows(data))
  useEffect(()=>{load()},[])
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e.preventDefault();setErr('')
    const {error}=await supabase.from('camps').insert({...form,target_donors:form.target_donors||null})
    if(error)return setErr(error.message);setForm(null);load()}
  const setStatus=async(id,status)=>{const {error}=await supabase.from('camps').update({status}).eq('id',id);error?setErr(error.message):load()}
  const showQr=async c=>setQr({c,url:link(c.id),img:await QRCode.toDataURL(link(c.id),{width:260,margin:1,color:{dark:'#0B1220',light:'#ffffff'}})})
  return <div>
    <div className="mb-5 flex items-center justify-between"><h1 className="h1 mb-0">Camps</h1><button className="btn" onClick={()=>setForm(empty)}><Plus size={16}/>New camp</button></div>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    {form&&<form onSubmit={save} className="card mb-5 grid gap-3 sm:grid-cols-2">
      <input className="input sm:col-span-2" placeholder="Camp name" required value={form.name} onChange={set('name')}/>
      <label className="text-sm text-slate-400">Date<input type="date" required className="input mt-1" value={form.camp_date} onChange={set('camp_date')}/></label>
      <input className="input self-end" placeholder="Venue" value={form.venue} onChange={set('venue')}/>
      <label className="text-sm text-slate-400">Start<input type="time" className="input mt-1" value={form.start_time} onChange={set('start_time')}/></label>
      <label className="text-sm text-slate-400">End<input type="time" className="input mt-1" value={form.end_time} onChange={set('end_time')}/></label>
      <input className="input" type="number" min="1" placeholder="Target donors" value={form.target_donors} onChange={set('target_donors')}/>
      <div className="flex gap-2"><button className="btn">Create camp</button><button type="button" className="btn-ghost" onClick={()=>setForm(null)}>Cancel</button></div>
    </form>}
    {qr&&<div className="card mb-5 flex flex-wrap items-center gap-5"><img src={qr.img} alt="Registration QR code" className="h-40 w-40 rounded-lg"/>
      <div className="min-w-0"><div className="font-semibold text-white">{qr.c.name}</div><p className="mt-1 text-sm text-slate-400">Print this QR on the poster. Donors scan it to register.</p>
        <p className="mt-2 break-all text-xs text-slate-500">{qr.url}</p>
        <div className="mt-3 flex gap-2"><button className="btn" onClick={()=>navigator.clipboard.writeText(qr.url)}>Copy link</button><a className="btn-ghost" download={`${qr.c.name}-qr.png`} href={qr.img}>Download QR</a><button className="btn-ghost" onClick={()=>setQr(null)}>Close</button></div></div></div>}
    <div className="space-y-3">{rows.map(c=><div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
      <div><div className="font-semibold text-white">{c.name}</div><div className="text-sm text-slate-400">{fmt(c.camp_date)} · {c.venue||'Venue not set'}</div>
        <div className="mt-1 text-sm">{c.registrations?.[0]?.count??0} registered{c.target_donors?` of ${c.target_donors} target`:''}</div></div>
      <div className="flex items-center gap-2">
        <select className="input w-auto py-1 capitalize" value={c.status} onChange={e=>setStatus(c.id,e.target.value)}>{STATUS.map(s=><option key={s}>{s}</option>)}</select>
        {c.status==='open'?<button className="btn" onClick={()=>showQr(c)}><QrCode size={16}/>QR and link</button>:<span className="text-xs text-slate-500">Set to open to share</span>}</div></div>)}
      {!rows.length&&<div className="card text-center text-slate-500">No camps yet. Create your first camp.</div>}</div></div>
}
