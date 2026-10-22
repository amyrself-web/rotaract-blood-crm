import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {Users,CalendarDays,Droplets,HeartPulse,AlertTriangle,UserPlus,Upload,MessageCircle,ClipboardCheck,QrCode,ArrowRight} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,fmt} from '../lib/util'
import CountUp from '../components/CountUp'

const STAFF=['admin','coordinator'],STOCK=['admin','coordinator','medical']
const count=async(t,f)=>{let q=supabase.from(t).select('*',{count:'exact',head:true});if(f)q=f(q);const {count:n,error}=await q;return error?null:n}

function Kpi({icon:I,label,value,tone='brand',to}){
  const body=<div className="card group flex items-center gap-4">
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${tone==='blood'?'bg-blood/15 text-blood':'bg-brand/15 text-brand'}`}><I size={20}/></span>
    <div className="min-w-0"><div className="text-2xl font-semibold tabular-nums text-white">{value===undefined?<span className="skeleton inline-block h-7 w-14 align-middle"/>:value===null?'-':<CountUp value={value}/>}</div>
      <div className="truncate text-xs text-slate-400">{label}</div></div></div>
  return to?<Link to={to} className="block">{body}</Link>:body
}
function Action({to,icon:I,label}){
  return <Link to={to} className="tile group flex items-center gap-3 px-4 py-3 text-sm text-slate-200">
    <I size={17} className="text-brand transition-transform duration-200 group-hover:scale-110"/><span className="flex-1">{label}</span>
    <ArrowRight size={15} className="text-slate-500 transition-transform duration-200 group-hover:translate-x-1"/></Link>
}

export default function Dashboard(){
  const {profile}=useAuth(),role=profile.role,staff=STAFF.includes(role),stockRole=STOCK.includes(role)
  const [k,setK]=useState({}),[camp,setCamp]=useState(undefined),[stock,setStock]=useState(null),[reqs,setReqs]=useState(null),[now,setNow]=useState(Date.now())
  const today=new Date().toLocaleDateString('en-CA')
  useEffect(()=>{if(!hasSupabase)return
    (async()=>{
      const c=await supabase.from('camps').select('*, registrations(count)').gte('camp_date',today).not('status','in','(closed,completed)').order('camp_date').limit(1)
      setCamp(c.data?.[0]||null)
      if(staff||role==='medical'){
        const [donors,consent,donations,camps]=await Promise.all([count('donors'),count('donors',q=>q.eq('consent',true)),count('donations'),count('camps')])
        setK({donors,consent,donations,camps})}
      if(stockRole){
        const u=await supabase.from('blood_units').select('blood_group').eq('status','available')
        if(!u.error){const by=Object.fromEntries(BLOOD.map(g=>[g,0]));u.data.forEach(x=>{if(x.blood_group)by[x.blood_group]++});setStock(by)}
        const r=await supabase.from('emergency_requests').select('id,blood_group,units_needed,hospital,created_at').eq('status','open').order('created_at',{ascending:false}).limit(3)
        if(!r.error)setReqs(r.data)}
    })()
    const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t)},[])

  const hour=new Date().getHours(),greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'
  const reg=camp?.registrations?.[0]?.count??0,ms=camp?new Date(`${camp.camp_date}T${(camp.start_time||'09:00').slice(0,5)}`)-now:0
  const until=!camp?'':ms<=0?'Today':`${Math.floor(ms/864e5)}d ${Math.floor(ms%864e5/36e5)}h`
  const total=stock?Object.values(stock).reduce((a,b)=>a+b,0):0,max=stock?Math.max(1,...Object.values(stock)):1

  return <div>
    <div className="mb-6"><h1 className="h1 mb-1">{greet}, {profile.full_name||'friend'}</h1>
      <p className="text-sm text-slate-400">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · Sankari Rotaract Club</p></div>

    {!hasSupabase&&<div className="card mb-5 border-brand/40 text-sm text-slate-300">Preview mode: no database connected. Add your Supabase keys to turn on real sign-in (see README).</div>}

    {(staff||role==='medical')&&<div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi icon={Users} label="Donors in the CRM" value={k.donors} to={staff?'/donors':undefined}/>
      <Kpi icon={HeartPulse} label="Can be contacted" value={k.consent}/>
      <Kpi icon={Droplets} label="Donations recorded" value={k.donations} tone="blood"/>
      <Kpi icon={CalendarDays} label="Camps" value={k.camps} to={staff?'/camps':undefined}/></div>}

    <div className="mb-5 grid gap-5 lg:grid-cols-5">
      <section className="card relative overflow-hidden lg:col-span-3">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl"/>
        <div className="relative">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Next camp</div>
          {camp===undefined?<div className="space-y-2"><div className="skeleton h-6 w-2/3"/><div className="skeleton h-4 w-1/2"/><div className="skeleton h-2 w-full"/></div>
          :!camp?<div className="text-slate-400">No upcoming camp. {staff&&<Link to="/camps" className="text-brand hover:underline">Create one</Link>}</div>
          :<>
            <div className="flex flex-wrap items-start justify-between gap-3"><div>
              <div className="text-xl font-semibold text-white">{camp.name}</div>
              <div className="mt-1 text-sm text-slate-400">{fmt(camp.camp_date)}{camp.start_time&&`, ${camp.start_time.slice(0,5)}`}{camp.venue&&` · ${camp.venue}`}</div></div>
              <div className="rounded-lg bg-ink-900/70 px-3 py-2 text-center"><div className="text-lg font-semibold text-white">{until}</div><div className="text-[11px] uppercase tracking-wider text-slate-500">{camp.status==='live'?'Live now':ms<=0?'Camp day':'To go'}</div></div></div>
            <div className="mt-5 flex items-baseline justify-between text-sm"><span className="text-slate-300"><span className="text-lg font-semibold tabular-nums text-white"><CountUp value={reg}/></span> registered</span>
              {camp.target_donors&&<span className="text-slate-500">target {camp.target_donors}</span>}</div>
            {camp.target_donors&&<div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full origin-left animate-grow rounded-full bg-gradient-to-r from-blue-700 to-brand" style={{width:Math.min(100,reg/camp.target_donors*100)+'%'}}/></div>}
            <div className="mt-5 flex flex-wrap gap-2">
              {role!=='donor'&&<Link to="/camp-day" className="btn"><ClipboardCheck size={16}/>Open camp day</Link>}
              {staff&&<Link to="/camps" className="btn-ghost inline-flex items-center gap-2 border border-ink-600 px-3 text-sm"><QrCode size={16}/>QR and link</Link>}</div></>}
        </div></section>

      {stockRole&&<section className="card lg:col-span-2">
        <div className="mb-4 flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Blood stock available</div>
          <Link to="/stock" className="text-xs text-brand hover:underline">Details</Link></div>
        {!stock?<div className="skeleton h-28 w-full"/>:<>
          <div className="flex h-28 items-end gap-2">{BLOOD.map((g,i)=><div key={g} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs tabular-nums text-slate-300">{stock[g]}</span>
            <div className="w-full origin-bottom animate-growY rounded-t bg-gradient-to-t from-rose-800 to-blood" style={{height:Math.max(4,stock[g]/max*80)+'px',animationDelay:i*50+'ms'}}/>
            <span className="text-[11px] font-semibold text-blood">{g}</span></div>)}</div>
          <div className="mt-3 text-sm text-slate-400"><span className="font-semibold tabular-nums text-white"><CountUp value={total}/></span> units ready to issue</div></>}
      </section>}
    </div>

    {stockRole&&reqs&&reqs.length>0&&<section className="card mb-5 border-blood/40">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><AlertTriangle size={16} className="text-blood"/>Open emergency requests</div>
      {reqs.map(r=><div key={r.id} className="flex items-center justify-between border-t border-ink-700 py-2 text-sm first:border-0">
        <span><span className="font-semibold text-blood">{r.blood_group}</span> x {r.units_needed} · {r.hospital}</span><span className="text-slate-500">{fmt(r.created_at)}</span></div>)}
      <Link to="/stock" className="mt-2 inline-block text-sm text-brand hover:underline">Find donors</Link></section>}

    <section className="card">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Quick actions</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff&&<Action to="/donors" icon={UserPlus} label="Add a donor"/>}
        {staff&&<Action to="/camps" icon={CalendarDays} label="Create or open a camp"/>}
        {staff&&<Action to="/import" icon={Upload} label="Import donors from Excel"/>}
        {staff&&<Action to="/messages" icon={MessageCircle} label="Birthdays and reminders"/>}
        {role!=='donor'&&<Action to="/camp-day" icon={ClipboardCheck} label="Camp day check-in"/>}
        {stockRole&&<Action to="/stock" icon={Droplets} label="Blood stock and emergencies"/>}
      </div></section>
  </div>
}
