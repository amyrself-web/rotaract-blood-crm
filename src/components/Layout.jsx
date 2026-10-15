import {useState} from 'react'
import {NavLink,Outlet} from 'react-router-dom'
import {Droplet,LogOut,Menu} from 'lucide-react'
import {useAuth} from '../context/Auth'
import {NAV} from '../nav'
export default function Layout(){
  const {profile,signOut}=useAuth(),[open,setOpen]=useState(false)
  const items=NAV.filter(n=>n.roles.includes(profile.role))
  return <div className="min-h-screen md:flex">
    <aside className={`${open?'block':'hidden'} md:block w-full md:w-64 shrink-0 border-r border-ink-700 bg-ink-900 p-4 md:sticky md:top-0 md:h-screen`}>
      <div className="mb-5 flex items-center gap-3 px-2 py-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-blood/15 text-blood"><Droplet size={18}/></span>
        <div><div className="font-semibold leading-tight text-white">Rotaract Blood CRM</div><div className="text-xs text-slate-400">Sankari</div></div>
      </div>
      <nav className="space-y-1">{items.map(({to,label,icon:I,phase})=>
        <NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)}
          className={({isActive})=>`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive?'bg-brand/15 text-white':'text-slate-400 hover:bg-ink-800 hover:text-white'}`}>
          <I size={17}/><span className="flex-1">{label}</span>{phase>1&&<span className="text-xs text-slate-500">Phase {phase}</span>}
        </NavLink>)}</nav>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-950/90 px-5 py-3 backdrop-blur">
        <button className="btn-ghost md:hidden" aria-label="Menu" onClick={()=>setOpen(!open)}><Menu size={18}/></button>
        <div className="hidden text-sm text-slate-400 md:block">Blood donation camp management</div>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right"><div className="text-white">{profile.full_name||'User'}</div><div className="text-xs capitalize text-blood">{profile.role}</div></div>
          <button className="btn-ghost" aria-label="Sign out" onClick={signOut}><LogOut size={16}/></button>
        </div>
      </header>
      <main className="max-w-5xl p-5 md:p-8"><Outlet/></main>
    </div></div>
}
