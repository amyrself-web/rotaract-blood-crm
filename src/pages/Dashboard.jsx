import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {Users,CalendarDays,Droplets,HeartPulse,AlertTriangle,UserPlus,Upload,MessageCircle,ClipboardCheck,QrCode,ArrowRight,HandHeart,TreePine,IdCard,Presentation,Wallet,Cake,PartyPopper,ImagePlus,Send,Clock} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD,fmt} from '../lib/util'
import CountUp from '../components/CountUp'
import {useLive,PageHeader} from '../components/ui'
import {useBrand} from '../context/Brand'
import {Trophy} from 'lucide-react'
import {typeName,kindOf,words} from '../lib/campTypes'
import {useWaReady,sinceText} from '../lib/wa'
import {YEAR_NAME} from '../lib/year'

function TopDonors(){
  const [rows,setRows]=useState(null)
  useEffect(()=>{supabase.rpc('donor_leaderboard',{p_limit:8}).then(({data})=>setRows(data||[]))},[])
  if(!rows?.length)return null
  const max=rows[0].total
  return <section className="card mt-5"><h2 className="mb-4 flex items-center gap-2 font-semibold text-fg"><Trophy size={17} className="text-warn"/>Top donors</h2>
    <ol className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">{rows.map((d,i)=><li key={d.id} className="flex items-center gap-3"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i===0?'bg-warn text-white':i<3?'bg-brand/20 text-brand':'bg-ink-700 text-fog-muted'}`}>{i+1}</span>
      <div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-sm"><span className="truncate text-fg">{d.name} <span className="font-display text-xs font-semibold text-blood">{d.blood_group}</span></span><b className="tabular-nums text-fg">{d.total}</b></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-blood to-warn" style={{width:`${d.total/max*100}%`}}/></div></div></li>)}</ol></section>
}

const count=async(t,f)=>{let q=supabase.from(t).select('*',{count:'exact',head:true});if(f)q=f(q);const {count:n,error}=await q;return error?null:n}

function Kpi({icon:I,label,value,tone='brand',to,sub}){
  const body=<div className="card group flex items-center gap-4">
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${tone==='blood'?'bg-blood/15 text-blood':tone==='green'?'bg-ok/15 text-ok':tone==='warn'?'bg-warn/15 text-warn':'bg-brand/15 text-brand'}`}><I size={20}/></span>
    <div className="min-w-0"><div className="text-2xl font-semibold tabular-nums text-fg">{value===undefined?<span className="skeleton inline-block h-7 w-14 align-middle"/>:value===null?'-':<CountUp value={value}/>}</div>
      <div className="truncate text-xs text-fog-muted">{label}</div>{sub&&<div className="truncate text-[11px] text-fog-faint">{sub}</div>}</div></div>
  return to?<Link to={to} className="block">{body}</Link>:body
}
// the numbers that matter for the next camp, by camp type
function campNums(c,x,reg){const k=kindOf(c)
  if(k==='blood')return [[x?.registered??reg,'registered'],[x?.arrived??0,'came'],[x?.donated??0,'donated']]
  if(k==='food')return [[x?.fed??0,'people fed'],[x?.packets??0,'packets'],[x?.food_points??0,'places']]
  if(k==='plants')return [[x?.planted??0,'saplings planted'],[x?.alive??0,'alive'],[x?.members_present??0,'members']]
  return [[x?.seen??0,words(c).helped],[x?.registered??0,'registered'],[x?.referred??0,'referred']]}

function Action({to,icon:I,label}){
  return <Link to={to} className="tile group flex items-center gap-3 px-4 py-3 text-sm text-fog">
    <I size={17} className="text-brand transition-transform duration-200 group-hover:scale-110"/><span className="flex-1">{label}</span>
    <ArrowRight size={15} className="text-fog-faint transition-transform duration-200 group-hover:translate-x-1"/></Link>
}

export default function Dashboard(){
  const {profile,can}=useAuth(),{brand}=useBrand(),role=profile.role,staff=can('donors')||can('camps'),stockRole=can('stock')
  const [k,setK]=useState({}),[camp,setCamp]=useState(undefined),[stock,setStock]=useState(null),[reqs,setReqs]=useState(null),[now,setNow]=useState(Date.now())
  const today=new Date().toLocaleDateString('en-CA')
  const [tick,setTick]=useState(0),[n,setN]=useState({}),[cn,setCn]=useState(null),wa=useWaReady()
  useLive(['donors','camps','registrations','donations','blood_units','emergency_requests','camp_people','camp_food','camp_saplings','members','meetings','member_dues','wa_outbox'],()=>setTick(x=>x+1))
  useEffect(()=>{if(!hasSupabase)return
    (async()=>{
      const c=await supabase.from('camps').select('*, registrations(count)').gte('camp_date',today).not('status','in','(closed,completed)').order('camp_date').limit(1)
      setCamp(c.data?.[0]||null)
      const d=await supabase.rpc('dashboard_numbers')
      if(!d.error)setN(d.data||{})
      else if(staff||can('screening')){   // database not yet on v25
        const [donors,consent,donations,camps]=await Promise.all([count('donors',q=>q.is('deleted_at',null)),count('donors',q=>q.eq('consent',true).is('deleted_at',null)),count('donations'),count('camps',q=>q.is('deleted_at',null))])
        setK({donors,consent,donations,camps})}
      if(c.data?.[0])supabase.rpc('camp_numbers').then(({data})=>setCn((data||[]).find(x=>x.camp_id===c.data[0].id)||null))
      if(stockRole){
        const u=await supabase.from('blood_units').select('blood_group').eq('status','available')
        if(!u.error){const by=Object.fromEntries(BLOOD.map(g=>[g,0]));u.data.forEach(x=>{if(x.blood_group)by[x.blood_group]++});setStock(by)}
        if(can('emergency')){const r=await supabase.from('emergency_requests').select('id,blood_group,units_needed,hospital,created_at').eq('status','open').order('created_at',{ascending:false}).limit(3)
        if(!r.error)setReqs(r.data)}}
    })()
    const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t)},[tick])

  const hour=new Date().getHours(),greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'
  const reg=camp?.registrations?.[0]?.count??0,ms=camp?new Date(`${camp.camp_date}T${(camp.start_time||'09:00').slice(0,5)}`)-now:0
  const until=!camp?'':ms<=0?'Today':`${Math.floor(ms/864e5)}d ${Math.floor(ms%864e5/36e5)}h`
  const total=stock?Object.values(stock).reduce((a,b)=>a+b,0):0,max=stock?Math.max(1,...Object.values(stock)):1

  return <div>
    <PageHeader eyebrow={new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} title={`${greet}, ${profile.full_name||'friend'}`} description={`${brand.club_name} · here is what needs attention today`}/>

    {!hasSupabase&&<div className="card mb-5 border-brand/40 text-sm text-fog">Preview mode: no database connected. Add your Supabase keys to turn on real sign-in (see README).</div>}

    {n.donors!==undefined||n.members!==undefined?<div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {n.donors!==undefined&&<>
        <Kpi icon={Users} label="Donors in the CRM" value={n.donors} sub={`${n.consent} can be contacted · ${n.eligible} can donate now`} to={staff?'/donors':undefined}/>
        <Kpi icon={Droplets} label={`Blood donations this ${YEAR_NAME}`} value={n.donations_year} sub={`${n.donations} in all`} tone="blood"/>
        <Kpi icon={CalendarDays} label="Camps coming up" value={n.camps_upcoming} sub={`${n.camps_done_year} done this ${YEAR_NAME}`} to={staff?'/camps':undefined}/>
        <Kpi icon={HandHeart} label="People helped at camps" value={(n.screened||0)+(n.fed||0)} sub={`${n.screened} screened · ${n.fed} fed${n.follow_pending?` · ${n.follow_pending} follow-ups due`:''}`} tone="green"/></>}
      {n.members!==undefined&&<>
        <Kpi icon={IdCard} label="Active members" value={n.members} sub={n.members_new_year?`${n.members_new_year} joined this ${YEAR_NAME}`:undefined} to="/members"/>
        <Kpi icon={Presentation} label={`Meetings held this ${YEAR_NAME}`} value={n.meetings_year} sub={n.meetings_week?.length?`${n.meetings_week.length} in the next 7 days`:'None in the next 7 days'} to="/meetings"/></>}
      {n.dues_paid_year!==undefined&&<Kpi icon={Wallet} label={`Members paid this ${YEAR_NAME}`} value={n.dues_paid_year} sub={`Rs. ${Number(n.dues_amount_year||0).toLocaleString('en-IN')} collected`} tone="warn" to="/members"/>}
      {n.planted!==undefined&&<Kpi icon={TreePine} label="Saplings planted" value={n.planted} tone="green"/>}
    </div>
    :(staff||can('screening'))&&<div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi icon={Users} label="Donors in the CRM" value={k.donors} to={staff?'/donors':undefined}/>
      <Kpi icon={HeartPulse} label="Can be contacted" value={k.consent}/>
      <Kpi icon={Droplets} label="Donations recorded" value={k.donations} tone="blood"/>
      <Kpi icon={CalendarDays} label="Camps" value={k.camps} to={staff?'/camps':undefined}/></div>}

    <div className="mb-5 grid gap-5 lg:grid-cols-5">
      <section className="card relative overflow-hidden lg:col-span-3">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl"/>
        <div className="relative">
          <div className="mb-3 font-display text-sm font-semibold text-fg">Next camp</div>
          {camp===undefined?<div className="space-y-2"><div className="skeleton h-6 w-2/3"/><div className="skeleton h-4 w-1/2"/><div className="skeleton h-2 w-full"/></div>
          :!camp?<div className="text-fog-muted">No upcoming camp. {staff&&<Link to="/camps" className="text-brand hover:underline">Create one</Link>}</div>
          :<>
            <div className="flex flex-wrap items-start justify-between gap-3"><div>
              <div className="text-xl font-semibold text-fg">{camp.name}</div>
              <div className="mt-1 text-sm text-fog-muted">{fmt(camp.camp_date)}{camp.start_time&&`, ${camp.start_time.slice(0,5)}`}{camp.venue&&` · ${camp.venue}`}</div></div>
              <div className="rounded-lg bg-ink-900/70 px-3 py-2 text-center"><div className="text-lg font-semibold text-fg">{until}</div><div className="text-xs text-fog-faint">{camp.status==='live'?'Live now':ms<=0?'Camp day':'To go'}</div></div></div>
            <div className="mt-1 text-xs font-medium text-brand">{typeName(camp)}</div>
            <div className="mt-4 flex flex-wrap gap-2">{campNums(camp,cn,reg).map(([v,l])=><div key={l} className="min-w-[92px] flex-1 rounded-xl bg-ink-900/60 px-3 py-2"><div className="text-lg font-semibold tabular-nums text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-faint">{l}</div></div>)}</div>
            {(camp.target_donors||camp.target_people)>0&&<><div className="mt-3 flex justify-between text-xs text-fog-faint"><span>{campNums(camp,cn,reg)[0][1]}</span><span>target {camp.target_donors||camp.target_people}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full origin-left animate-grow rounded-full bg-gradient-to-r from-brand-deep to-brand" style={{width:Math.min(100,campNums(camp,cn,reg)[0][0]/(camp.target_donors||camp.target_people)*100)+'%'}}/></div></>}
            <div className="mt-5 flex flex-wrap gap-2">
              {(can('campday')||can('screening'))&&<Link to="/camp-day" className="btn"><ClipboardCheck size={16}/>Open camp day</Link>}
              {staff&&<Link to="/camps" className="btn-ghost inline-flex items-center gap-2 border border-ink-600 px-3 text-sm"><QrCode size={16}/>QR and link</Link>}</div></>}
        </div></section>

      {stockRole&&<section className="card lg:col-span-2">
        <div className="mb-4 flex items-center justify-between"><div className="font-display text-sm font-semibold text-fg">Blood stock available</div>
          <Link to="/stock" className="text-xs text-brand hover:underline">Details</Link></div>
        {!stock?<div className="skeleton h-28 w-full"/>:<>
          <div className="flex h-28 items-end gap-2">{BLOOD.map((g,i)=><div key={g} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs tabular-nums text-fog">{stock[g]}</span>
            <div className="w-full origin-bottom animate-growY rounded-t bg-gradient-to-t from-rose-800 to-blood" style={{height:Math.max(4,stock[g]/max*80)+'px',animationDelay:i*50+'ms'}}/>
            <span className="text-[11px] font-semibold text-blood">{g}</span></div>)}</div>
          <div className="mt-3 text-sm text-fog-muted"><span className="font-semibold tabular-nums text-fg"><CountUp value={total}/></span> units ready to issue</div></>}
      </section>}
    </div>

    {can('emergency')&&reqs&&reqs.length>0&&<section className="card mb-5 border-blood/40">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><AlertTriangle size={16} className="text-blood"/>Open emergency requests</div>
      {reqs.map(r=><div key={r.id} className="flex items-center justify-between border-t border-ink-700 py-2 text-sm first:border-0">
        <span><span className="font-semibold text-blood">{r.blood_group}</span> x {r.units_needed} · {r.hospital}</span><span className="text-fog-faint">{fmt(r.created_at)}</span></div>)}
      <Link to="/stock" className="mt-2 inline-block text-sm text-brand hover:underline">Find donors</Link></section>}

    {(n.meetings_week||n.member_birthdays||n.donor_birthdays!==undefined||(can('messages')&&wa))&&<div className="mb-5 grid gap-5 lg:grid-cols-2">
      {(n.meetings_week||n.member_birthdays||n.donor_birthdays!==undefined)&&<section className="card">
        <div className="mb-3 font-display text-sm font-semibold text-fg">This week</div>
        <ul className="space-y-2 text-sm">
          {(n.meetings_week||[]).map(m=><li key={m.id}><Link to="/meetings" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-ink-800"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Presentation size={16}/></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-fg">{m.title}</span><span className="text-xs text-fog-faint">{fmt(m.date)}{m.time?`, ${String(m.time).slice(0,5)}`:''}{m.venue?` · ${m.venue}`:''}{m.audience==='board'?' · board':''}</span></span></Link></li>)}
          {(n.events_next||[]).map(e=><li key={e.id}><Link to="/events" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-ink-800"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warn/10 text-warn"><PartyPopper size={16}/></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-fg">{e.title}</span><span className="text-xs text-fog-faint">{fmt(e.date)}{e.venue?` · ${e.venue}`:''}</span></span></Link></li>)}
          {(n.member_birthdays?.length>0||n.donor_birthdays>0)&&<li className="flex items-center gap-3 px-1 py-1"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blood/10 text-blood"><Cake size={16}/></span>
            <span className="min-w-0 flex-1 text-fg">Birthdays today: {[...(n.member_birthdays||[]),...(n.donor_birthdays?[`${n.donor_birthdays} donor${n.donor_birthdays>1?'s':''}`]:[])].join(', ')}</span></li>}
          {!(n.meetings_week?.length||n.events_next?.length||n.member_birthdays?.length||n.donor_birthdays)&&<li className="text-fog-faint">No meetings, events or birthdays in the next 7 days.</li>}
        </ul></section>}
      {can('messages')&&wa&&<section className={`card ${wa.provider==='qr'&&wa.status!=='connected'?'border-blood/40':''}`}>
        <div className="mb-3 flex items-center justify-between"><div className="font-display text-sm font-semibold text-fg">WhatsApp</div><Link to="/messages" className="text-xs text-brand hover:underline">Open</Link></div>
        {wa.provider==='qr'&&<div className={`mb-3 flex items-center gap-2 text-sm ${wa.status==='connected'?'text-ok':'text-blood'}`}><span className={`h-2.5 w-2.5 rounded-full ${wa.status==='connected'?'bg-ok':'bg-blood'}`}/>
          {wa.status==='connected'?`Club phone connected${wa.worker_version?` · sender ${wa.worker_version}`:''}`:wa.status==='offline'?`Sender stopped · last seen ${sinceText(wa.last_seen)}`:'Club phone not connected'}</div>}
        <div className="grid grid-cols-3 gap-2 text-center">{[[wa.sent_today,'sent today',Send],[wa.queued,'waiting',Clock],[wa.failed_today,'failed today',AlertTriangle]].map(([v,l,I])=><div key={l} className="rounded-xl bg-ink-900/60 px-2 py-3">
          <I size={15} className={`mx-auto ${l==='failed today'&&v?'text-blood':'text-fog-faint'}`}/><div className="mt-1 text-lg font-semibold tabular-nums text-fg">{v??0}</div><div className="text-[11px] text-fog-faint">{l}</div></div>)}</div>
        {wa.quiet_now&&wa.queued>0&&<p className="mt-3 text-xs text-warn">Quiet hours now: waiting messages go at {new Date(wa.quiet_ends).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}.</p>}
      </section>}
    </div>}

    <section className="card">
      <div className="mb-3 font-display text-sm font-semibold text-fg">Quick actions</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {can('donors')&&<Action to="/donors" icon={UserPlus} label="Add a donor"/>}
        {can('camps')&&<Action to="/camps" icon={CalendarDays} label="Create or open a camp"/>}
        {can('import')&&<Action to="/import" icon={Upload} label="Bulk import from Excel"/>}
        {can('messages')&&<Action to="/messages" icon={MessageCircle} label="Birthdays and reminders"/>}
        {(can('campday')||can('screening'))&&<Action to="/camp-day" icon={ClipboardCheck} label="Camp day check-in"/>}
        {stockRole&&<Action to="/stock" icon={Droplets} label="Blood stock and emergencies"/>}
        {can('meetings')&&<Action to="/meetings" icon={Presentation} label="Meetings and attendance"/>}
        {(can('messages')||can('camps'))&&<Action to="/posts" icon={ImagePlus} label="Make a post for WhatsApp / Instagram"/>}
        {can('members')&&<Action to="/members" icon={IdCard} label="Members and dues"/>}
      </div></section>
    {can('donors')&&<TopDonors/>}
  </div>
}
