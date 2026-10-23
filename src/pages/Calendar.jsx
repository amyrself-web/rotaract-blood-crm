import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {motion} from 'framer-motion'
import {ChevronLeft,ChevronRight,MapPin,Clock,ListChecks,Presentation} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {PageHeader,Drawer,Badge,useLive} from '../components/ui'
import {fmt} from '../lib/util'

const TONE={planned:'neutral',open:'blue',live:'red',completed:'green',closed:'neutral'}
const DOT={planned:'bg-fog-faint',open:'bg-brand',live:'bg-blood',completed:'bg-ok',closed:'bg-ink-500'}
const iso=d=>d.toLocaleDateString('en-CA')

export default function Calendar(){
  const {can}=useAuth(),[cur,setCur]=useState(()=>{const d=new Date();d.setDate(1);return d}),[camps,setCamps]=useState([]),[tasks,setTasks]=useState([]),[sel,setSel]=useState(null),[meets,setMeets]=useState([]),[dir,setDir]=useState(0)
  const [tick,setTick]=useState(0)
  useLive(['camps','registrations','tasks','meetings'],()=>setTick(x=>x+1))
  useEffect(()=>{supabase.from('camps').select('*, registrations(count)').is('deleted_at',null).order('camp_date').then(({data})=>setCamps(data||[]))
    if(can('meetings'))supabase.from('meetings').select('id,meeting_no,title,kind,meeting_date,start_time,status').is('deleted_at',null).neq('status','cancelled').then(({data})=>setMeets(data||[]))
    if(can('planning'))supabase.from('tasks').select('id,title,due,done,camp_id').not('due','is',null).then(({data})=>setTasks(data||[]))},[can,tick])
  const days=useMemo(()=>{const first=new Date(cur),start=new Date(first);start.setDate(1-((first.getDay()+6)%7))
    return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})},[cur])
  const by=useMemo(()=>{const m={},z=()=>({c:[],t:[],m:[]});camps.forEach(c=>{(m[c.camp_date]??=z()).c.push(c)});tasks.forEach(t=>{(m[t.due]??=z()).t.push(t)});meets.forEach(x=>{(m[x.meeting_date]??=z()).m.push(x)});return m},[camps,tasks,meets])
  const today=iso(new Date()),month=cur.toLocaleDateString('en-IN',{month:'long',year:'numeric'})
  const move=n=>{setDir(n);const d=new Date(cur);d.setMonth(d.getMonth()+n);setCur(d)}
  const upcoming=camps.filter(c=>c.camp_date>=today).slice(0,4)
  return <div>
    <PageHeader title="Calendar" description="Camps, club meetings and planning deadlines by date."
      actions={<div className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1">
        <button className="btn-ghost" aria-label="Previous month" onClick={()=>move(-1)}><ChevronLeft size={18}/></button>
        <button className="min-w-[150px] rounded-lg px-3 py-1.5 font-display text-sm font-semibold text-fg hover:bg-ink-700" onClick={()=>{const d=new Date();d.setDate(1);setDir(0);setCur(d)}}>{month}</button>
        <button className="btn-ghost" aria-label="Next month" onClick={()=>move(1)}><ChevronRight size={18}/></button></div>}/>
    <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-ink-700 text-center text-xs font-medium text-fog-faint">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} className="py-2.5">{d}</div>)}</div>
        <motion.div key={month} className="grid grid-cols-7" initial={{opacity:0,x:dir*24}} animate={{opacity:1,x:0}} transition={{duration:.22}}>
          {days.map(d=>{const k=iso(d),e=by[k],inMonth=d.getMonth()===cur.getMonth()
            return <div key={k} className={`min-h-[96px] border-b border-r border-ink-700/70 p-1.5 ${inMonth?'':'bg-ink-950/40'} [&:nth-child(7n)]:border-r-0`}>
              <div className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs ${k===today?'bg-blood font-semibold text-white':inMonth?'text-fog-muted':'text-ink-500'}`}>{d.getDate()}</div>
              {e?.c.map(c=><button key={c.id} onClick={()=>setSel(c)} className="mb-1 flex w-full items-center gap-1.5 truncate rounded-md bg-ink-700/80 px-1.5 py-1 text-left text-[11px] font-medium text-fg hover:bg-ink-600">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[c.status]}`}/><span className="truncate">{c.name}</span></button>)}
              {e?.m.map(x=><Link key={x.id} to="/meetings" className="mb-1 flex w-full items-center gap-1.5 truncate rounded-md bg-brand/15 px-1.5 py-1 text-left text-[11px] font-medium text-fg hover:bg-brand/25">
                <Presentation size={11} className="shrink-0 text-brand"/><span className="truncate">{x.start_time?x.start_time.slice(0,5)+' ':''}{x.title}</span></Link>)}
              {e?.t.length>0&&<div className="flex items-center gap-1 px-1 text-[11px] text-fog-faint"><ListChecks size={11}/>{e.t.length} task{e.t.length>1?'s':''}</div>}
            </div>})}
        </motion.div></div>
      <aside className="card h-fit"><h2 className="mb-3 font-semibold text-fg">Coming up</h2>
        {upcoming.map(c=><button key={c.id} onClick={()=>setSel(c)} className="mb-2 block w-full rounded-xl border border-ink-700 p-3 text-left transition hover:border-ink-500">
          <div className="text-sm font-semibold text-fg">{c.name}</div><div className="mt-0.5 text-xs text-fog-muted">{fmt(c.camp_date)}{c.venue&&`, ${c.venue}`}</div></button>)}
        {!upcoming.length&&<p className="text-sm text-fog-faint">No camps ahead.</p>}
        <div className="mt-4 space-y-1.5 border-t border-ink-700 pt-3 text-xs text-fog-muted">{Object.keys(DOT).map(s=><div key={s} className="flex items-center gap-2 capitalize"><span className={`h-2 w-2 rounded-full ${DOT[s]}`}/>{s}</div>)}</div></aside>
    </div>
    <Drawer open={!!sel} onClose={()=>setSel(null)} title={sel?.name} description={sel&&fmt(sel.camp_date)}
      footer={sel&&<>{can('camps')&&<Link to="/camps" className="btn-quiet">Open in Camps</Link>}{(can('campday')||can('screening'))&&<Link to="/camp-day" className="btn">Camp day</Link>}</>}>
      {sel&&<div className="space-y-4 text-sm">
        <Badge tone={TONE[sel.status]}><span className="capitalize">{sel.status}</span></Badge>
        <div className="flex items-center gap-2 text-fog"><Clock size={15} className="text-fog-faint"/>{sel.start_time?.slice(0,5)||'?'} to {sel.end_time?.slice(0,5)||'?'}</div>
        <div className="flex items-center gap-2 text-fog"><MapPin size={15} className="text-fog-faint"/>{sel.venue||'Venue not set'}</div>
        <div className="rounded-xl border border-ink-700 p-4"><div className="font-display text-2xl font-semibold text-fg">{sel.registrations?.[0]?.count??0}</div>
          <div className="text-fog-muted">registered{sel.target_donors?` of ${sel.target_donors} target`:''}</div></div>
        {tasks.filter(t=>t.camp_id===sel.id).length>0&&<div><div className="label">Tasks</div>{tasks.filter(t=>t.camp_id===sel.id).map(t=><div key={t.id} className={`flex justify-between py-1 ${t.done?'text-fog-faint line-through':'text-fog'}`}><span>{t.title}</span><span>{fmt(t.due)}</span></div>)}</div>}
      </div>}
    </Drawer>
  </div>
}
