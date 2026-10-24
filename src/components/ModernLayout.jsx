import {t as tr,useLang} from '../lib/i18n'
import {useEffect,useMemo,useRef,useState} from 'react'
import {Link,NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom'
import {motion} from 'framer-motion'
import {Search,Bell,ChevronDown,LayoutGrid,X,LogOut,UserRound} from 'lucide-react'
import {useAuth} from '../context/Auth'
import {NAV,allowed} from '../nav'
import {ROLE_LABEL} from '../lib/access'
import {spring,usePresence,HeroCtx} from './ui'
import {BrandMark,ThemeToggle} from './Brand'
import {useNotifications,Palette,Popover,UiSwitch} from './Layout'
import LangToggle from './LangToggle'
import VoiceCommand from './VoiceCommand'

// Modern layout: navy header band with a top menu, the page title inside the band,
// content on a sheet that rises over it, and a bottom tab bar on phones.
const TAB_ORDER=['/','/donors','/camp-day','/stock','/camps','/calendar','/messages','/reports']
const SHORT={'/':'Home','/donors':'Donors','/camp-day':'Camp day','/stock':'Stock','/camps':'Camps','/calendar':'Calendar','/messages':'WhatsApp','/reports':'Reports'}
const toneCls={red:'text-blood bg-blood/10',amber:'text-warn bg-warn/10',blue:'text-brand bg-brand/10'}

function Pulse(){
  return <svg aria-hidden className="pointer-events-none absolute bottom-10 left-0 hidden h-14 w-full opacity-[.16] md:block" viewBox="0 0 1200 60" preserveAspectRatio="none">
    <motion.path d="M0 30 H960 L980 30 L992 6 L1008 54 L1022 16 L1034 30 H1200" fill="none" stroke="#F0435A" strokeWidth="2" vectorEffect="non-scaling-stroke"
      initial={{pathLength:0}} animate={{pathLength:[0,1,1]}} transition={{duration:3.2,repeat:Infinity,ease:'easeInOut',times:[0,.6,1]}}/></svg>
}

function GroupMenu({group,active,open,setOpen}){
  const t=useRef()
  const enter=()=>{clearTimeout(t.current);setOpen(group.group)},leave=()=>{t.current=setTimeout(()=>setOpen(o=>o===group.group?null:o),140)}
  return <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
    <button className="navpill" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(open?null:group.group)}>
      {active&&<motion.span layoutId="mnav" transition={spring} className="absolute inset-0 rounded-full bg-white/[.13] ring-1 ring-white/15"/>}
      <span className={`relative ${active?'text-white':''}`}>{tr(group.group)}</span>
      <ChevronDown size={14} className={`relative transition-transform duration-200 ${open?'rotate-180':''}`}/></button>
    {open&&<motion.div role="menu" initial={{opacity:0,y:-6,scale:.98}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.16}}
      className="unhero text-fog absolute left-1/2 top-full z-40 mt-3 w-[500px] -translate-x-1/2 rounded-shell border border-ink-600 bg-ink-900 p-2 shadow-2xl">
      <div className="grid grid-cols-2 gap-1">{group.items.map(({to,label,desc,icon:I})=>
        <NavLink key={to} to={to} end={to==='/'} role="menuitem" onClick={()=>setOpen(null)}
          className={({isActive})=>`group flex items-start gap-3 rounded-xl p-2.5 transition-colors ${isActive?'bg-brand/10':'hover:bg-ink-750'}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/5 text-brand ring-1 ring-brand/20 transition-transform group-hover:scale-105"><I size={17}/></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{tr(label)}</span><span className="block truncate text-xs text-fog-faint">{desc}</span></span>
        </NavLink>)}</div></motion.div>}
  </div>
}

function MoreSheet({open,onClose,groups}){
  const {signOut}=useAuth(),nav=useNavigate(),mounted=usePresence(open)
  useEffect(()=>{if(!open)return;const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[open,onClose])
  if(!mounted)return null
  return <div className={`fixed inset-0 z-50 ${open?'':'pointer-events-none'}`}>
    <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" initial={{opacity:0}} animate={{opacity:open?1:0}} onClick={onClose}/>
    <motion.div role="dialog" aria-label="All pages" className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[28px] border-t border-ink-600 bg-ink-900 px-4 pb-8 pt-3 md:inset-x-auto md:left-1/2 md:top-20 md:bottom-auto md:w-[560px] md:-translate-x-1/2 md:rounded-[24px] md:border"
      initial={{y:'100%'}} animate={{y:open?0:'100%'}} transition={spring}>
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-600 md:hidden"/>
      <div className="mb-2 flex items-center justify-between"><div className="font-display text-lg font-semibold text-fg">All pages</div><button className="btn-ghost" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      {groups.map(g=><div key={g.group} className="mt-4"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fog-faint">{tr(g.group)}</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{g.items.map(({to,label,icon:I})=>
          <NavLink key={to} to={to} end={to==='/'} onClick={onClose} className={({isActive})=>`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-medium transition ${isActive?'border-brand/40 bg-brand/10 text-fg':'border-ink-700 bg-ink-800 text-fog-muted hover:text-fg'}`}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 text-brand"><I size={19}/></span><span className="leading-tight">{tr(label)}</span></NavLink>)}</div></div>)}
      <div className="mt-6 grid gap-1 border-t border-ink-700 pt-3">
        <button onClick={()=>{nav('/profile');onClose()}} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><UserRound size={15}/>My profile</button>
        <UiSwitch onDone={onClose}/><div className="mt-3"><LangToggle/></div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><LogOut size={15}/>Sign out</button></div>
    </motion.div></div>
}

export default function ModernLayout(){
  useLang()
  const {profile,signOut,can}=useAuth(),loc=useLocation(),nav=useNavigate()
  const [slot,setSlot]=useState(null),[pal,setPal]=useState(false),[bell,setBell]=useState(false),[me,setMe]=useState(false),[menu,setMenu]=useState(null),[more,setMore]=useState(false)
  const notes=useNotifications()
  const groups=useMemo(()=>NAV.map(g=>({...g,items:g.items.filter(i=>allowed(i,can))})).filter(g=>g.items.length),[can])
  const flat=groups.flatMap(g=>g.items.map(i=>({...i,group:g.group})))
  const cur=flat.find(i=>i.to===loc.pathname),group=cur?.group==='Overview'?undefined:cur?.group
  const tabs=TAB_ORDER.map(t=>flat.find(i=>i.to===t)).filter(Boolean).slice(0,4)
  useEffect(()=>{setMenu(null);setMore(false);window.scrollTo({top:0})},[loc.pathname])
  useEffect(()=>{const k=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPal(p=>!p)}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[])
  const initial=(profile.full_name||profile.email||'U').trim()[0].toUpperCase()
  const title=cur?.label||(loc.pathname==='/profile'?'My profile':'')
  const overview=groups.find(g=>g.group==='Overview'),rest=groups.filter(g=>g.group!=='Overview')

  return <div className="min-h-screen">
    <div className="hero hero-bg relative text-fog">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0"/><Pulse/>
      <header className="relative z-30 mx-auto flex h-16 max-w-[1240px] items-center gap-2 px-4 md:px-8">
        <Link to="/" className="mr-2 min-w-0 shrink-0 lg:max-w-[190px]" aria-label="Home"><BrandMark size={36}/></Link>
        {flat.length>1&&<nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 rounded-full bg-white/[.06] p-1 ring-1 ring-white/10 lg:flex">
          {overview?.items.map(({to,label})=><NavLink key={to} to={to} end={to==='/'} className="navpill">{({isActive})=><>
            {isActive&&<motion.span layoutId="mnav" transition={spring} className="absolute inset-0 rounded-full bg-white/[.13] ring-1 ring-white/15"/>}
            <span className={`relative ${isActive?'text-white':''}`}>{tr(label)}</span></>}</NavLink>)}
          {rest.map(g=><GroupMenu key={g.group} group={g} active={cur?.group===g.group} open={menu===g.group} setOpen={setMenu}/>)}
        </nav>}
        <div className="flex-1"/>
        <button onClick={()=>setPal(true)} className="hidden items-center gap-2 rounded-full bg-white/[.06] px-3.5 py-1.5 text-sm text-white/60 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white sm:flex">
          <Search size={15}/><span className="text-left lg:w-16 xl:w-32">Search</span><kbd className="hidden whitespace-nowrap rounded border border-white/15 px-1.5 text-[11px] xl:inline">Ctrl K</kbd></button>
        <button className="btn-ghost sm:hidden" aria-label="Search" onClick={()=>setPal(true)}><Search size={18}/></button>
        <VoiceCommand/><LangToggle className="hidden sm:inline-flex"/><ThemeToggle/>
        <div className="relative"><button className="btn-ghost relative" aria-label={`Notifications, ${notes.length}`} onClick={()=>setBell(!bell)}><Bell size={18}/>
            {notes.length>0&&<span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-blood px-1 text-[10px] font-bold text-white ring-2 ring-[#0B1730]">{notes.length}</span>}</button>
          <Popover open={bell} onClose={()=>setBell(false)} className="w-80"><div className="px-2 py-1.5 text-sm font-semibold text-fg">Needs attention</div>
            {notes.map((n,k)=><button key={k} onClick={()=>{nav(n.to);setBell(false)}} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-fog hover:bg-ink-750">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneCls[n.tone]}`}><n.icon size={15}/></span>{n.text}</button>)}
            {!notes.length&&<div className="px-2 py-4 text-sm text-fog-faint">All clear for today.</div>}</Popover></div>
        <div className="relative"><button onClick={()=>setMe(!me)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-white/10 2xl:pr-3" aria-label="Account menu">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blood to-brand text-sm font-semibold text-white ring-2 ring-white/20">{initial}</span>
            <span className="hidden whitespace-nowrap text-left leading-tight 2xl:block"><span className="block text-sm font-medium text-white">{profile.full_name||'User'}</span>
              <span className="block text-[11px] text-white/55">{profile.designation||ROLE_LABEL[profile.role]}</span></span></button>
          <Popover open={me} onClose={()=>setMe(false)} className="w-60">
            <div className="border-b border-ink-700 px-2 pb-2 pt-1"><div className="truncate text-sm font-medium text-fg">{profile.full_name||'User'}</div><div className="truncate text-xs text-fog-faint">{profile.email}</div></div>
            <button onClick={()=>{nav('/profile');setMe(false)}} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><UserRound size={15}/>My profile</button>
            <UiSwitch onDone={()=>setMe(false)}/><div className="px-3 py-2"><LangToggle/></div>
            <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fog hover:bg-ink-750"><LogOut size={15}/>Sign out</button></Popover></div>
        {flat.length>1&&<button className="btn-ghost hidden md:inline-flex lg:hidden" aria-label="All pages" onClick={()=>setMore(true)}><LayoutGrid size={18}/></button>}
      </header>
      <div className="relative z-10 mx-auto max-w-[1240px] px-4 pb-14 pt-4 md:px-8 md:pb-16 md:pt-7">
        <div ref={setSlot} className="peer"/>
        <div className="hidden peer-empty:block">{group&&<div className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-brand-soft">{tr(group)}</div>}
          <h1 className="font-display text-[28px] font-semibold leading-tight text-fg md:text-[34px]">{title}</h1></div>
      </div>
    </div>

    <main className="sheet unhero -mt-8 min-h-[60vh] text-fog">
      <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
        <HeroCtx.Provider value={slot?{slot,group}:null}>
          <motion.div key={loc.pathname} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.32,ease:[.2,.7,.2,1]}}><Outlet/></motion.div>
        </HeroCtx.Provider></div>
    </main>

    {flat.length>1&&<nav aria-label="Quick pages" className="tabbar"><div className="mx-auto flex max-w-md items-stretch justify-around px-2">
      {tabs.map(({to,label,icon:I})=><NavLink key={to} to={to} end={to==='/'} className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium">{({isActive})=><>
        {isActive&&<motion.span layoutId="tabdot" transition={spring} className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-blood to-brand"/>}
        <motion.span animate={{scale:isActive?1.12:1,y:isActive?-1:0}} transition={spring} className={isActive?'text-brand':'text-fog-faint'}><I size={21}/></motion.span>
        <span className={isActive?'text-fg':'text-fog-faint'}>{tr(SHORT[to]||label)}</span></>}</NavLink>)}
      <button onClick={()=>setMore(true)} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-fog-faint"><LayoutGrid size={21}/>More</button>
    </div></nav>}

    <MoreSheet open={more} onClose={()=>setMore(false)} groups={groups}/>
    <Palette open={pal} setOpen={setPal}/>
  </div>
}
