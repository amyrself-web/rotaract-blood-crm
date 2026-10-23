import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {motion} from 'framer-motion'
import {Droplet,Eye,EyeOff} from 'lucide-react'
import {useAuth,ROLES} from '../context/Auth'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import CountUp from '../components/CountUp'
import {useBrand} from '../context/Brand'
import {Logo} from '../components/Brand'

// One orchestrated moment: a drop falls and a pulse line draws across the brand panel.
function Pulse(){
  return <svg viewBox="0 0 600 120" className="w-full" aria-hidden>
    <motion.path d="M0 60 H210 L232 60 L248 18 L266 104 L282 40 L296 60 H600" fill="none" stroke="url(#pl)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:1.6,ease:'easeInOut',delay:.5}}/>
    <defs><linearGradient id="pl" x1="0" x2="1"><stop offset="0" stopColor="#4C8DFF" stopOpacity=".1"/><stop offset=".45" stopColor="#F0435A"/><stop offset="1" stopColor="#4C8DFF" stopOpacity=".1"/></linearGradient></defs>
  </svg>
}

export default function Login(){
  const {signIn,signUp,demo,user,profile}=useAuth(),{brand}=useBrand(),nav=useNavigate()
  const [mode,setMode]=useState('in'),[f,setF]=useState({name:'',email:'',password:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[show,setShow]=useState(false),[camp,setCamp]=useState(null)
  useEffect(()=>{if(user&&profile){let to='/';try{to=sessionStorage.getItem('after-login')||'/';sessionStorage.removeItem('after-login')}catch{}nav(to,{replace:true})}},[user,profile])
  useEffect(()=>{if(hasSupabase)supabase.rpc('public_camp_info').then(({data})=>setCamp(data))},[])
  const set=k=>e=>setF({...f,[k]:e.target.value})
  const submit=async e=>{e.preventDefault();setBusy(true);setMsg('')
    const r=mode==='in'?await signIn(f.email,f.password):await signUp(f.email,f.password,f.name)
    setBusy(false)
    if(r.error)setMsg(r.error.message==='Invalid login credentials'?'That email and password do not match. Check both and try again.':r.error.message)
    else if(mode==='up')setMsg('Account created. Confirm your email, then sign in.')}
  return <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
    <section className="relative hidden flex-col justify-between overflow-hidden border-r border-ink-700 bg-ink-900/60 p-12 lg:flex">
      <div className="flex items-center gap-3"><Logo size={44}/>
        <div><div className="font-display font-semibold text-fg">{brand.club_name}</div><div className="text-sm text-fog-faint">{brand.brand_name}{brand.tagline?` · ${brand.tagline}`:''}</div></div></div>
      <div>
        <motion.div initial={{y:-140,opacity:0}} animate={{y:0,opacity:1}} transition={{type:'spring',stiffness:120,damping:14,delay:.15}}
          className="mb-8 grid h-16 w-16 place-items-center rounded-[28px_28px_28px_4px] bg-blood text-white shadow-[0_20px_60px_-10px_rgba(240,67,90,.7)] [transform-origin:bottom_left]">
          <Droplet size={28} fill="currentColor"/></motion.div>
        <h1 className="max-w-md font-display text-5xl font-semibold leading-[1.05] text-fg">One bag of blood can help save three lives.</h1>
        <p className="mt-4 max-w-md text-fog-muted">Plan camps, check donors in, record every bag and keep donors coming back.</p>
        <div className="mt-8 -mx-2"><Pulse/></div>
      </div>
      {camp?<div className="flex items-end gap-10"><div><div className="text-sm text-fog-faint">Next camp</div><div className="mt-1 font-display text-lg font-semibold text-fg">{camp.name}</div><div className="text-sm text-fog-muted">{fmt(camp.date)}{camp.venue&&`, ${camp.venue}`}</div></div>
        <div><div className="font-display text-3xl font-semibold text-fg"><CountUp value={camp.registered}/></div><div className="text-sm text-fog-faint">registered</div></div></div>:<div/>}
    </section>
    <section className="flex items-center justify-center p-6">
      <motion.div className="w-full max-w-sm" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.4,delay:.1}}>
        <div className="mb-8 flex items-center gap-3 lg:hidden"><Logo size={48}/><div><div className="font-display font-semibold text-fg">{brand.club_name}</div><div className="text-xs text-fog-faint">{brand.brand_name}</div></div></div>
        <h2 className="font-display text-3xl font-semibold text-fg">{mode==='in'?'Sign in':'Create a donor account'}</h2>
        <p className="mt-2 text-sm text-fog-muted">{mode==='in'?'Club members and donors use the same sign-in.':'See your donations and download certificates.'}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode==='up'&&<div><label className="label" htmlFor="nm">Full name</label><input id="nm" className="input py-2.5" placeholder="Full name" value={f.name} onChange={set('name')} required/></div>}
          <div><label className="label" htmlFor="em">Email</label><input id="em" className="input py-2.5" type="email" autoComplete="email" placeholder="Email" value={f.email} onChange={set('email')} required/></div>
          <div><label className="label" htmlFor="pw">Password</label><div className="relative"><input id="pw" className="input py-2.5 pr-10" type={show?'text':'password'} autoComplete={mode==='in'?'current-password':'new-password'} placeholder="Password" minLength={6} value={f.password} onChange={set('password')} required/>
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-fog-faint hover:text-fg" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>
          {msg&&<p role="alert" className="rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-[#FF8796]">{msg}</p>}
          <button className="btn w-full py-2.5" disabled={busy||!hasSupabase}>{busy?'Please wait…':mode==='in'?'Sign in':'Create donor account'}</button>
        </form>
        <button type="button" className="mt-5 w-full text-sm text-fog-muted hover:text-fg" onClick={()=>{setMode(mode==='in'?'up':'in');setMsg('')}}>
          {mode==='in'?'New donor or club member? Create an account':'Have an account? Sign in'}</button>
        <a href="#/home" className="mt-2 block text-center text-sm text-fog-faint hover:text-fg">See the next camp</a>
        {!hasSupabase&&<div className="card mt-6"><p className="mb-3 text-sm text-fog-muted">Database not connected yet. Preview the CRM as a role:</p>
          <div className="flex flex-wrap gap-2">{ROLES.map(r=><button key={r} className="chip capitalize hover:border-brand" onClick={()=>demo(r)}>{r}</button>)}</div></div>}
      </motion.div></section>
  </div>
}
