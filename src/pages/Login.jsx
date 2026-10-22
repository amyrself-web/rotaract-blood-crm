import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Droplet} from 'lucide-react'
import {useAuth,ROLES} from '../context/Auth'
import {hasSupabase} from '../lib/supabase'
export default function Login(){
  const {signIn,signUp,demo,user,profile}=useAuth(),nav=useNavigate()
  const [mode,setMode]=useState('in'),[f,setF]=useState({name:'',email:'',password:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{if(user&&profile)nav('/',{replace:true})},[user,profile])
  const set=k=>e=>setF({...f,[k]:e.target.value})
  const submit=async e=>{e.preventDefault();setBusy(true);setMsg('')
    const r=mode==='in'?await signIn(f.email,f.password):await signUp(f.email,f.password,f.name)
    setBusy(false)
    if(r.error)setMsg(r.error.message);else if(mode==='up')setMsg('Account created. Confirm your email, then sign in.')}
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5"><div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl animate-glow"/>
    <div className="relative w-full max-w-sm animate-scaleIn">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-blood/15 text-blood shadow-[0_0_30px_-6px_rgba(225,29,72,.7)]"><Droplet className="animate-drop"/></span>
        <h1 className="text-2xl font-semibold text-white">Rotaract Blood CRM</h1>
        <p className="mt-1 text-sm text-slate-400">Sankari Rotaract Club blood donation camp</p>
      </div>
      <form onSubmit={submit} className="card space-y-3">
        {mode==='up'&&<input className="input" placeholder="Full name" value={f.name} onChange={set('name')} required/>}
        <input className="input" type="email" placeholder="Email" value={f.email} onChange={set('email')} required/>
        <input className="input" type="password" placeholder="Password" minLength={6} value={f.password} onChange={set('password')} required/>
        {msg&&<p className="text-sm text-blood">{msg}</p>}
        <button className="btn w-full" disabled={busy||!hasSupabase}>{mode==='in'?'Sign in':'Create donor account'}</button>
        <button type="button" className="w-full text-sm text-slate-400 hover:text-white" onClick={()=>setMode(mode==='in'?'up':'in')}>
          {mode==='in'?'New donor? Create an account':'Have an account? Sign in'}</button>
      </form>
      {!hasSupabase&&<div className="card mt-4">
        <p className="mb-3 text-sm text-slate-400">Database not connected yet. Preview the CRM as a role:</p>
        <div className="flex flex-wrap gap-2">{ROLES.map(r=><button key={r} className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm capitalize hover:border-brand" onClick={()=>demo(r)}>{r}</button>)}</div>
      </div>}
    </div></div>
}
