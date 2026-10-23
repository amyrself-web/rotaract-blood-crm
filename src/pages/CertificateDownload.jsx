import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import {motion} from 'framer-motion'
import {Award,Download,ShieldX,Droplet,CalendarDays,MapPin} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {Logo} from '../components/Brand'
import {useBrand} from '../context/Brand'
import {makeCertificate,certNo} from '../lib/certificate'
import {celebrate} from '../lib/fx'

// Opened from the thank-you WhatsApp message: the donor downloads their own certificate without signing in.
// The 12-character code in the link is known only to the donor, so it works like a private link.
export default function CertificateDownload(){
  const {code}=useParams(),{brand}=useBrand(),[r,setR]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{if(!hasSupabase)return setR({error:'failed'});supabase.rpc('certificate_by_code',{p_code:code}).then(({data,error})=>setR(error?{error:'failed'}:data||{error:'not found'}))},[code])
  const get=async()=>{setBusy(true);try{await makeCertificate({name:r.name,camp:r.camp,venue:r.venue,date:fmt(r.date),bloodGroup:r.blood_group,volume:r.volume,certificate:r.cert_no?certNo(r.cert_no):'',verifyCode:r.verify_code,donorNo:`D-${String(r.donor_no).padStart(4,'0')}`,brand});celebrate()}finally{setBusy(false)}}
  return <div className="relative grid min-h-screen place-items-center overflow-hidden p-5">
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-blood/20 blur-3xl"/>
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className="relative w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-3"><Logo size={44}/><div className="font-display font-semibold text-fg">{brand.club_name}</div></div>
      <div className="card overflow-hidden p-0">
        {!r?<div className="p-8 text-center text-sm text-fog-muted" role="status">Finding your certificate…</div>
        :r.error?<div className="flex items-center gap-4 bg-blood/10 px-6 py-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blood text-white"><ShieldX size={24}/></span>
          <div><h1 className="font-display text-xl font-semibold text-fg">{r.error==='failed'?'Could not load right now':'Certificate not found'}</h1><p className="text-sm text-fog-muted">{r.error==='failed'?'Check your internet connection and try again.':'Check that you opened the full link from the message.'}</p></div></div>
        :<><div className="bg-gradient-to-br from-blood/20 to-transparent px-6 py-6 text-center"><motion.div initial={{scale:0,rotate:-20}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:220,damping:14}} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blood text-white"><Award size={30}/></motion.div>
            <h1 className="mt-3 font-display text-2xl font-semibold text-fg">Thank you, {r.name.split(' ')[0]}</h1><p className="text-sm text-fog-muted">Your gift can save up to three lives.</p></div>
          <dl className="space-y-2 px-6 py-4 text-sm">{[[Droplet,'Blood group',r.blood_group],[CalendarDays,'Date',fmt(r.date)],[MapPin,'Camp',r.camp]].filter(x=>x[2]).map(([I,l,v])=>
            <div key={l} className="flex items-center gap-3"><I size={16} className="text-fog-faint"/><dt className="w-24 text-fog-faint">{l}</dt><dd className={`font-medium ${l==='Blood group'?'font-display text-blood':'text-fg'}`}>{v}</dd></div>)}</dl>
          <div className="border-t border-ink-700 p-4"><button className="btn w-full py-3" disabled={busy} onClick={get}><Download size={17}/>{busy?'Preparing…':'Download my certificate'}</button></div></>}
      </div>
      <a href="#/home" className="mt-5 block text-center text-sm text-fog-faint hover:text-fg">See the next camp</a>
    </motion.div></div>
}
