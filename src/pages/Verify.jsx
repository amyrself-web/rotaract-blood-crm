import {useEffect,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {motion} from 'framer-motion'
import {ShieldCheck,ShieldX,Search,CalendarDays,MapPin,Droplet,Hash} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {certNo,fmtCode} from '../lib/certificate'
import {Logo} from '../components/Brand'
import {useBrand} from '../context/Brand'

// Opens from the QR on a certificate. Shows a short pulse while it checks, then the result.
function Checking(){
  return <div className="flex flex-col items-center py-6" role="status" aria-live="polite">
    <svg viewBox="0 0 240 60" className="w-56" aria-hidden><motion.path d="M0 30 H80 L92 30 L100 8 L112 52 L122 18 L130 30 H240" fill="none" stroke="#F0435A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      initial={{pathLength:0}} animate={{pathLength:[0,1,1],opacity:[1,1,0]}} transition={{duration:1.4,repeat:Infinity,ease:'easeInOut'}}/></svg>
    <div className="mt-3 text-sm text-fog-muted">Checking the certificate…</div></div>
}
export default function Verify(){
  const {code}=useParams(),nav=useNavigate(),{brand}=useBrand()
  const [r,setR]=useState(code?null:{idle:true}),[q,setQ]=useState(code||'')
  useEffect(()=>{if(!code){setR({idle:true});return}setR(null);setQ(code)
    if(!hasSupabase)return setR({error:'offline'})
    const started=Date.now()
    supabase.rpc('verify_certificate',{p_code:code}).then(({data,error})=>{
      const out=error?{error:'failed',message:error.message}:data||{error:'not found'}
      setTimeout(()=>setR(out),Math.max(0,900-(Date.now()-started)))})},[code])
  const check=e=>{e.preventDefault();const c=q.trim();if(c)nav('/verify/'+encodeURIComponent(c))}
  const ok=r&&!r.idle&&!r.error
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5">
    <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700 ${ok?'bg-ok/20':r?.error?'bg-blood/20':'bg-brand/15'}`}/>
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className="relative w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-3"><Logo size={44}/><div><div className="font-display font-semibold text-fg">{brand.club_name}</div><div className="text-xs text-fog-faint">Certificate check</div></div></div>
      <div className="card overflow-hidden p-0">
        {!r?<Checking/>
        :r.idle?<div className="p-6"><h1 className="font-display text-xl font-semibold text-fg">Check a certificate</h1><p className="mt-1 text-sm text-fog-muted">Scan the QR code, or type the 12-character check code printed under it, for example 7KQ2-MX9P-4A1C.</p></div>
        :ok?<>
          <div className="flex items-center gap-4 bg-ok/10 px-6 py-5">
            <motion.span initial={{scale:0,rotate:-30}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:260,damping:14}} className="grid h-12 w-12 place-items-center rounded-full bg-ok text-white"><ShieldCheck size={24}/></motion.span>
            <div><h1 className="font-display text-xl font-semibold text-fg">Valid certificate</h1><div className="text-sm text-fog-muted">{r.cert_no?certNo(r.cert_no):''} · check code {fmtCode(r.code)}</div></div></div>
          <dl className="space-y-3 px-6 py-5 text-sm">
            <div><dt className="text-fog-faint">Donor</dt><dd className="font-display text-2xl font-semibold text-fg">{r.name}</dd></div>
            {[[Droplet,'Blood group',r.blood_group],[CalendarDays,'Date',fmt(r.date)],[Hash,'Camp',r.camp],[MapPin,'Venue',r.venue]].filter(x=>x[2]).map(([I,l,v])=>
              <div key={l} className="flex items-center gap-3"><I size={16} className="text-fog-faint"/><dt className="w-24 text-fog-faint">{l}</dt><dd className={`font-medium ${l==='Blood group'?'font-display text-blood':'text-fg'}`}>{v}</dd></div>)}
          </dl>
          <p className="border-t border-ink-700 px-6 py-4 text-xs text-fog-faint">Issued by {r.club||brand.club_name}. Only the first name and initial are shown to protect privacy.</p></>
        :<div className="flex items-center gap-4 bg-blood/10 px-6 py-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blood text-white"><ShieldX size={24}/></span>
            <div><h1 className="font-display text-xl font-semibold text-fg">{r.error==='failed'?'Could not check right now':r.error==='need code'?'Check code needed':'Certificate not found'}</h1>
              <p className="text-sm text-fog-muted">{r.error==='failed'?'Check your internet connection and try again.':r.error==='need code'?'A certificate number alone is not enough. Type the 12-character check code printed under the QR code.':`No certificate matches "${code}". Check the code and try again.`}</p></div></div>}
        <form onSubmit={check} className="flex gap-2 border-t border-ink-700 p-4"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/>
          <input className="input pl-9 uppercase" aria-label="Check code" placeholder="XXXX-XXXX-XXXX" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="btn">Check</button></form>
      </div>
      <a href="#/home" className="mt-5 block text-center text-sm text-fog-faint hover:text-fg">See the next camp</a>
    </motion.div></div>
}
