import {useEffect,useMemo,useRef,useState} from 'react'
import {NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom'
import {motion} from 'framer-motion'
import {AlertTriangle,BellRing,Bell,Cake,Mail,ChevronsLeft,Clock,DatabaseBackup,Droplet,Eye,LayoutTemplate,ListChecks,LogOut,Menu,MessageCircle,Presentation,Search,ShieldCheck,UserRound,X} from 'lucide-react'
import {useAuth} from '../context/Auth'
import {NAV,ALL_NAV,allowed} from '../nav'
import {supabase} from '../lib/supabase'
import {ROLE_LABEL} from '../lib/access'
import {spring,usePresence,useLive} from './ui'
import {BrandMark,ThemeToggle} from './Brand'
import LangToggle from './LangToggle'
import VoiceCommand from './VoiceCommand'
import {useBrand} from '../context/Brand'
import ModernLayout from './ModernLayout'
import {tr} from '../lib/i18n'

function Sidebar({collapsed,setCollapsed,mobile,closeMobile}){
  const {can}=useAuth()
  return <div className="flex h-full flex-col gap-6 p-3">
    <div className="flex items-center justify-between pt-2"><BrandMark collapsed={collapsed&&!mobile}/>
      {mobile?<button className="btn-ghost" aria-label="Close menu" onClick={closeMobile}><X size={18}/></button>
      :!collapsed&&<button className="btn-ghost" aria-label="Collapse menu" onClick={()=>setCollapsed(true)}><ChevronsLeft size={17}/></button>}</div>
    <nav className="flex-1 space-y-5 overflow-y-auto">{NAV.map(g=>{const items=g.items.filter(i=>allowed(i,can));if(!items.length)return null
      return <div key={g.group}>{!(collapsed&&!mobile)&&<div className="mb-1.5 px-3 text-xs font-medium text-fog-faint">{g.group}</div>}
        <div className="space-y-0.5">{items.map(({to,label,icon:I})=>
          <NavLink key={to} to={to} end={to==='/'} onClick={closeMobile} title={collapsed&&!mobile?label:undefined}
            className={({isActive})=>`relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${isActive?'text-fg':'text-fog-muted hover:bg-ink-800 hover:text-fg'} ${collapsed&&!mobile?'justify-center':''}`}>
            {({isActive})=><>{isActive&&<motion.span layoutId={mobile?'nav-m':'nav'} transition={spring} className="absolute inset-0 rounded-[10px] bg-gradient-to-r from-brand/20 to-brand/5 ring-1 ring-brand/25">
                <span className="absolute -left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blood shadow-[0_0_10px_rgba(240,67,90,.9)]"/></motion.span>}
              <I size={18} className="relative shrink-0"/>{!(collapsed&&!mobile)&&<span className="relative truncate">{label}</span>}</>}
          </NavLink>)}</div></div>})}</nav>
    {collapsed&&!mobile&&<button className="btn-ghost mx-auto rotate-180" aria-label="Expand menu" onClick={()=>setCollapsed(false)}><ChevronsLeft size={17}/></button>}
  </div>
}

export function useNotifications(){
  const {can}=useAuth(),[items,setItems]=useState([]),[tick,setTick]=useState(0)
  useLive(['app_alerts','email_outbox','emergency_requests','blood_units','tasks','donors','meetings','meeting_actions','afterlife_cases','wa_outbox','privacy_requests'],()=>setTick(x=>x+1))
  useEffect(()=>{let live=true;(async()=>{
    const out=[],today=new Date().toLocaleDateString('en-CA'),soon=new Date(Date.now()+3*864e5).toLocaleDateString('en-CA')
    {const r=await supabase.rpc('my_alerts');(Array.isArray(r.data)?r.data:[]).forEach(a=>out.push({icon:a.kind==='emergency'?AlertTriangle:BellRing,tone:a.kind==='over_subscription'?'amber':'red',text:a.title,sub:a.body,
      to:a.link||'/',done:()=>supabase.rpc('resolve_alert',{p_id:a.id}).then(()=>setTick(x=>x+1))}))}
    if(can('emergency')){const r=await supabase.from('emergency_requests').select('id,blood_group,units_needed,hospital').eq('status','open').limit(5)
      r.data?.forEach(x=>out.push({icon:AlertTriangle,tone:'red',text:`${x.blood_group} x ${x.units_needed} needed at ${x.hospital}`,to:'/stock'}))}
    if(can('stock')){const r=await supabase.from('blood_units').select('id',{count:'exact',head:true}).in('status',['collected','in_transit','testing','available']).lte('expiry_date',soon)
      if(r.count)out.push({icon:Clock,tone:'amber',text:`${r.count} blood unit${r.count>1?'s':''} expire within 3 days`,to:'/stock'})}
    if(can('messages')){const r=await supabase.from('donors').select('dob').is('deleted_at',null).eq('consent',true).not('dob','is',null)
      const n=(r.data||[]).filter(d=>d.dob.slice(5)===today.slice(5)).length
      if(n)out.push({icon:Cake,tone:'blue',text:`${n} donor birthday${n>1?'s':''} today`,to:'/messages'})
      const e=await supabase.from('email_outbox').select('id',{count:'exact',head:true}).eq('status','failed').gte('created_at',new Date(Date.now()-864e5).toISOString())
      if(e.count)out.push({icon:Mail,tone:'amber',text:`${e.count} email${e.count>1?'s':''} failed today`,to:'/messages?tab=email'})}
    if(can('members')){const r=await supabase.from('members').select('dob').is('deleted_at',null).eq('status','active').not('dob','is',null)
      const n=(r.data||[]).filter(d=>d.dob.slice(5)===today.slice(5)).length
      if(n)out.push({icon:Cake,tone:'blue',text:`${n} member birthday${n>1?'s':''} today`,to:'/members'})}
    if(can('planning')){const r=await supabase.from('tasks').select('id',{count:'exact',head:true}).eq('done',false).lte('due',today)
      if(r.count)out.push({icon:ListChecks,tone:'amber',text:`${r.count} camp task${r.count>1?'s are':' is'} due`,to:'/planning'})}
    if(can('meetings')){const m=await supabase.from('meetings').select('title,start_time').is('deleted_at',null).eq('status','scheduled').eq('meeting_date',today).limit(2)
      m.data?.forEach(x=>out.push({icon:Presentation,tone:'blue',text:`Meeting today${x.start_time?` at ${x.start_time.slice(0,5)}`:''}: ${x.title}`,to:'/meetings'}))
      const a=await supabase.from('meeting_actions').select('id',{count:'exact',head:true}).eq('done',false).lt('due',today)
      if(a.count)out.push({icon:ListChecks,tone:'amber',text:`${a.count} meeting action item${a.count>1?'s are':' is'} overdue`,to:'/meetings'})}
    if(can('afterlife')){const c=await supabase.from('afterlife_cases').select('id',{count:'exact',head:true}).is('deleted_at',null).in('status',['informed','team sent'])
      if(c.count)out.push({icon:Eye,tone:'red',text:`${c.count} eye/body donation case${c.count>1?'s':''} in progress`,to:'/afterlife'})}
    if(can('messages')){const w=await supabase.from('wa_outbox').select('id',{count:'exact',head:true}).eq('status','queued')
      if(w.count)out.push({icon:MessageCircle,tone:'blue',text:`${w.count} WhatsApp message${w.count>1?'s':''} waiting to be sent`,to:'/messages'})
      const f=await supabase.from('wa_outbox').select('id',{count:'exact',head:true}).eq('status','failed').gte('created_at',new Date(Date.now()-864e5).toISOString())
      if(f.count)out.push({icon:AlertTriangle,tone:'amber',text:`${f.count} WhatsApp message${f.count>1?'s':''} failed today`,to:'/messages'})}
    if(can('settings')){const r=await supabase.from('privacy_requests').select('id',{count:'exact',head:true}).eq('status','open')
      if(r.count)out.push({icon:ShieldCheck,tone:'amber',text:`${r.count} donor data request${r.count>1?'s':''} to answer`,to:'/privacy'})
      const s=await supabase.from('settings').select('last_backup_at').eq('id',1).maybeSingle()
      if(!s.error&&(!s.data?.last_backup_at||Date.now()-new Date(s.data.last_backup_at)>30*864e5))out.push({icon:DatabaseBackup,tone:'amber',text:'Time for the monthly backup',to:'/privacy'})}
    if(live)setItems(out)})();return()=>{live=false}},[can,tick])
  return items
}

const cleanCommand=s=>s.replace(/^(please\s+)?(open|go to|goto|show( me)?|find|search( for)?|take me to)\s+/i,'').replace(/\s+(page|screen|tab)$/i,'')
  .replace(/\s*(பக்கத்தை|பக்கம்)?\s*(திற|திறக்கவும்|காட்டு|காட்டவும்|போ|தேடு)$/,'').replace(/^the\s+/i,'').replace(/[.?!]$/,'').trim()
export function Palette({open,setOpen}){
  const {can}=useAuth(),nav=useNavigate(),[q,setQ]=useState(''),[i,setI]=useState(0),[donors,setDonors]=useState([]),ref=useRef()
  const ql=q.toLowerCase().trim(),[auto,setAuto]=useState(false)
  const pages=ALL_NAV.filter(n=>allowed(n,can)).filter(n=>!ql||n.label.toLowerCase().includes(ql)||tr(n.label).includes(q.trim())||ql.includes(n.label.toLowerCase())||q.includes(tr(n.label))).map(n=>({label:n.label,hint:'Page',icon:n.icon,go:()=>nav(n.to)}))
  useEffect(()=>{if(!open){setQ('');setDonors([]);setAuto(false);return}setTimeout(()=>ref.current?.focus(),30)},[open])
  // a spoken command ("open donors", "முகாம்கள் திற", "find Ravi") opens this box with the words; one clear match is opened straight away
  useEffect(()=>{const f=e=>{setOpen(true);setTimeout(()=>{setQ(cleanCommand(e.detail||''));setAuto(true)},60)};window.addEventListener('crm-palette',f);return()=>window.removeEventListener('crm-palette',f)},[setOpen])
  useEffect(()=>{if(!can('donors')||q.trim().length<2){setDonors([]);return}
    const t=setTimeout(async()=>{const s=q.replace(/[%,()]/g,'');const id=/^d-?0*(\d+)$/i.exec(s.trim());let qq=supabase.from('donors').select('id,full_name,phone,blood_group,donor_no').is('deleted_at',null)
      qq=id?qq.eq('donor_no',Number(id[1])):qq.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);const {data}=await qq.limit(6)
      setDonors((data||[]).map(d=>({label:d.full_name,hint:`D-${String(d.donor_no).padStart(4,'0')} ${d.blood_group||''}`,icon:UserRound,go:()=>nav('/donors?q='+encodeURIComponent(d.phone))})))},200);return()=>clearTimeout(t)},[q,can,nav])
  const all=[...pages,...donors];useEffect(()=>setI(0),[q])
  const pick=x=>{x?.go();setOpen(false)}
  useEffect(()=>{if(!auto||!open)return;const t=setTimeout(()=>{setAuto(false);if(all.length===1)pick(all[0])},700);return()=>clearTimeout(t)},[auto,all.length,open])
  const mounted=usePresence(open,200);if(!mounted)return null
  return <div className={`fixed inset-0 z-50 grid place-items-start justify-center px-4 pt-[12vh] ${open?'':'pointer-events-none'}`}>
    <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{opacity:0}} animate={{opacity:open?1:0}} transition={{duration:.15}} onClick={()=>setOpen(false)}/>
    <motion.div role="dialog" aria-label="Search" className="relative w-full max-w-lg overflow-hidden rounded-shell border border-ink-600 bg-ink-900 shadow-2xl"
      initial={{opacity:0,y:-12,scale:.98}} animate={open?{opacity:1,y:0,scale:1}:{opacity:0,y:-8,scale:.98}} transition={spring}>
      <div className="flex items-center gap-3 border-b border-ink-700 px-4"><Search size={18} className="text-fog-faint"/>
        <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="Go to a page, find a donor by name, mobile or ID (D-0012)"
          onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setI(x=>Math.min(x+1,all.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setI(x=>Math.max(x-1,0))}if(e.key==='Enter')pick(all[i]);if(e.key==='Escape')setOpen(false)}}
          className="h-14 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fog-faint"/></div>
      <ul className="max-h-80 overflow-y-auto p-2">{all.map((x,k)=><li key={k}><button onMouseEnter={()=>setI(k)} onClick={()=>pick(x)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${k===i?'bg-ink-700 text-fg':'text-fog-muted'}`}>
        <x.icon size={16}/><span className="flex-1 truncate">{x.label}</span><span className="text-xs text-fog-faint">{x.hint}</span></button></li>)}
        {!all.length&&<li className="px-3 py-6 text-center text-sm text-fog-faint">Nothing matches "{q}"</li>}</ul>
    </motion.div></div>
}

export function Popover({open,onClose,children,className=''}){
  useEffect(()=>{if(!open)return;const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[open,onClose])
  const mounted=usePresence(open,160);if(!mounted)return null
  return <>{open&&<div className="fixed inset-0 z-30" onClick={onClose}/>}
    <motion.div className={`unhero text-fog absolute right-0 top-full z-40 mt-2 rounded-panel border border-ink-600 bg-ink-900 p-2 shadow-2xl ${open?'':'pointer-events-none'} ${className}`}
      initial={{opacity:0,y:-6,scale:.98}} animate={open?{opacity:1,y:0,scale:1}:{opacity:0,y:-4,scale:.98}} transition={{duration:.15}}>{children}</motion.div></>
}

export function UiSwitch({onDone}){const {ui,setUi}=useBrand()
  return <button onClick={()=>{setUi(ui==='modern'?'classic':'modern');onDone?.()}} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><LayoutTemplate size={15}/>{ui==='modern'?'Use classic side menu':'Use modern layout'}</button>}
export default function Layout(){const {ui}=useBrand();return ui==='modern'?<ModernLayout/>:<ClassicLayout/>}
function ClassicLayout(){
  const {profile,signOut}=useAuth(),loc=useLocation(),nav=useNavigate()
  const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem('nav-collapsed')==='1'}catch{return false}})
  const [mobile,setMobile]=useState(false),[pal,setPal]=useState(false),[bell,setBell]=useState(false),[me,setMe]=useState(false)
  const notes=useNotifications(),mobMounted=usePresence(mobile)
  useEffect(()=>{try{localStorage.setItem('nav-collapsed',collapsed?'1':'0')}catch{}},[collapsed])
  useEffect(()=>{const k=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPal(p=>!p)}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[])
  const title=useMemo(()=>ALL_NAV.find(n=>n.to===loc.pathname)?.label||(loc.pathname==='/profile'?'My profile':''),[loc.pathname])
  const initial=(profile.full_name||profile.email||'U').trim()[0].toUpperCase()
  const tone={red:'text-blood bg-blood/10',amber:'text-warn bg-warn/10',blue:'text-brand bg-brand/10'}
  return <div className="min-h-screen md:flex">
    <aside className={`sticky top-0 hidden h-screen shrink-0 border-r border-ink-700/80 bg-ink-900/70 backdrop-blur md:block ${collapsed?'w-[76px]':'w-[252px]'} transition-[width] duration-300`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}/></aside>
    {mobMounted&&<div className={`fixed inset-0 z-50 md:hidden ${mobile?'':'pointer-events-none'}`}>
      <motion.div className="absolute inset-0 bg-black/60" initial={{opacity:0}} animate={{opacity:mobile?1:0}} onClick={()=>setMobile(false)}/>
      <motion.aside className="absolute left-0 top-0 h-full w-72 border-r border-ink-600 bg-ink-900" initial={{x:'-100%'}} animate={{x:mobile?0:'-100%'}} transition={spring}>
        <Sidebar mobile closeMobile={()=>setMobile(false)}/></motion.aside></div>}

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-700/80 bg-ink-950/75 px-4 backdrop-blur-xl md:px-8">
        <motion.div key={loc.pathname} aria-hidden className="pointer-events-none absolute -bottom-px left-0 h-[2px] bg-gradient-to-r from-blood via-brand to-blood"
          initial={{width:'0%',opacity:1}} animate={{width:'100%',opacity:[1,1,0]}} transition={{duration:.9,times:[0,.75,1],ease:'easeOut'}}/>
        <button className="btn-ghost md:hidden" aria-label="Open menu" onClick={()=>setMobile(true)}><Menu size={19}/></button>
        <div className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-fg">{title}</div>
        <button onClick={()=>setPal(true)} className="hidden items-center gap-2 rounded-[10px] border border-ink-600 bg-ink-900/80 px-3 py-1.5 text-sm text-fog-faint transition hover:border-ink-500 hover:text-fog-muted sm:flex">
          <Search size={15}/><span className="w-40 text-left">Search</span><kbd className="rounded border border-ink-600 px-1.5 text-[11px]">Ctrl K</kbd></button>
        <button className="btn-ghost sm:hidden" aria-label="Search" onClick={()=>setPal(true)}><Search size={18}/></button>
        <VoiceCommand/><LangToggle className="hidden sm:inline-flex"/><ThemeToggle/>
        <div className="relative"><button className="btn-ghost relative" aria-label={`Notifications, ${notes.length}`} onClick={()=>setBell(!bell)}><Bell size={18}/>
            {notes.length>0&&<span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-blood px-1 text-[10px] font-bold text-white">{notes.length}</span>}</button>
          <Popover open={bell} onClose={()=>setBell(false)} className="w-80"><div className="px-2 py-1.5 text-sm font-semibold text-fg">Needs attention</div>
            {notes.map((n,k)=><button key={k} onClick={()=>{n.done?.();nav(n.to);setBell(false)}} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-fog hover:bg-ink-750">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone[n.tone]}`}><n.icon size={15}/></span><span className="min-w-0"><span className="block">{n.text}</span>{n.sub&&<span className="line-clamp-2 block text-xs text-fog-faint">{n.sub}</span>}</span></button>)}
            {!notes.length&&<div className="px-2 py-4 text-sm text-fog-faint">All clear for today.</div>}</Popover></div>
        <div className="relative"><button onClick={()=>setMe(!me)} className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-2 transition hover:bg-ink-800" aria-label="Account menu">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-sm font-semibold text-white">{initial}</span>
            <span className="hidden text-left leading-tight lg:block"><span className="block text-sm font-medium text-fg">{profile.full_name||'User'}</span>
              <span className="block text-xs text-fog-faint">{profile.designation||ROLE_LABEL[profile.role]}</span></span></button>
          <Popover open={me} onClose={()=>setMe(false)} className="w-56">
            <div className="border-b border-ink-700 px-2 pb-2 pt-1"><div className="truncate text-sm font-medium text-fg">{profile.full_name||'User'}</div><div className="truncate text-xs text-fog-faint">{profile.email}</div></div>
            <button onClick={()=>{nav('/profile');setMe(false)}} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><UserRound size={15}/>My profile</button>
            <UiSwitch onDone={()=>setMe(false)}/>
            <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><LogOut size={15}/>Sign out</button></Popover></div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-6 md:px-8 md:py-8">
        <motion.div key={loc.pathname} initial={{opacity:0,y:8,filter:'blur(4px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} transition={{duration:.25,ease:[.2,.7,.2,1]}}>
          <Outlet/></motion.div></main>
    </div>
    <Palette open={pal} setOpen={setPal}/>
  </div>
}
