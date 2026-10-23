import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Megaphone,Pin,Vote,Clock,Plus,CheckCircle2,Circle,GraduationCap} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {Field,Badge,useLive,todayIso} from './ui'
import {PollBars} from '../pages/Notices'
import {celebrate} from '../lib/fx'

export const STEPS=[['meetings','Attended two club meetings'],['orientation','Orientation session'],['form','Membership form filled'],['fee','Membership fee paid'],['project','Took part in a project'],['inducted','Inducted']]

// notices, polls, service hours and induction progress on a member's own page
export default function MyClubExtra(){
  const [d,setD]=useState(null),[log,setLog]=useState(null)
  const load=()=>supabase.rpc('my_club_extra').then(({data,error})=>!error&&setD(data))
  useEffect(()=>{load()},[]);useLive(['notices','polls','poll_votes','project_hours','projects','induction_steps'],load)
  if(!d)return null
  const vote=async(p,c)=>{const {error}=await supabase.rpc('vote_poll',{p_poll:p.id,p_choice:c});if(error)return toast.error(error.message);toast.success('Vote saved');load()}
  const save=async e=>{e.preventDefault();const {error}=await supabase.rpc('log_my_hours',{p_project:log.project||null,p_date:log.date,p_hours:Number(log.hours),p_role:log.role||null,p_notes:log.notes||null})
    if(error)return toast.error(error.message);toast.success('Hours sent to the secretary for approval');setLog(null);load()}
  const done=new Set((d.induction||[]).map(s=>s.step))
  return <div className="space-y-5">
    {d.induction&&<section className="card border-brand/40"><h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><GraduationCap size={18} className="text-brand"/>Your path to induction</h2>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-brand to-ok" style={{width:`${done.size/STEPS.length*100}%`}}/></div>
      <ul className="grid gap-1.5 sm:grid-cols-2">{STEPS.map(([k,l])=><li key={k} className="flex items-center gap-2 text-sm">{done.has(k)?<CheckCircle2 size={17} className="text-ok"/>:<Circle size={17} className="text-fog-faint"/>}<span className={done.has(k)?'text-fg':'text-fog-muted'}>{l}</span></li>)}</ul></section>}
    {d.notices.length>0&&<section className="card"><h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Megaphone size={17} className="text-brand"/>Notice board</h2>
      <ul className="space-y-3">{d.notices.slice(0,5).map(n=><li key={n.id} className={`rounded-xl p-3 ${n.pinned?'bg-brand/10':'bg-ink-800/60'}`}><div className="flex items-center gap-2 font-medium text-fg">{n.pinned&&<Pin size={13} className="text-brand"/>}{n.title}<span className="ml-auto text-xs font-normal text-fog-faint">{fmt(n.at)}</span></div>
        {n.body&&<p className="mt-1 whitespace-pre-line text-sm text-fog-muted">{n.body}</p>}</li>)}</ul></section>}
    {d.polls.length>0&&<section className="card"><h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Vote size={17} className="text-brand"/>Have your say</h2>
      <div className="space-y-5">{d.polls.slice(0,3).map(p=><div key={p.id}><div className="mb-2 flex items-start gap-2"><div className="flex-1 font-medium text-fg">{p.question}</div>{!p.open&&<Badge>Closed</Badge>}</div>
        <PollBars poll={p} counts={p.mine||!p.open?p.counts:null} mine={p.mine} disabled={!p.open} onVote={c=>{vote(p,c);if(!p.mine)celebrate()}}/>{p.open&&!p.mine&&<p className="text-xs text-fog-faint">Tap an option to vote. Results show after you vote.</p>}</div>)}</div></section>}
    <section className="card"><div className="mb-3 flex items-center gap-2"><Clock size={17} className="text-brand"/><h2 className="flex-1 font-semibold text-fg">My service hours</h2>{!log&&<button className="btn-quiet px-3 py-1 text-xs" onClick={()=>setLog({project:'',date:todayIso(),hours:'2',role:'',notes:''})}><Plus size={13}/>Log hours</button>}</div>
      <div className="flex gap-6"><div><div className="text-2xl font-semibold tabular-nums text-fg">{Number(d.hours.approved)}</div><div className="text-xs text-fog-muted">hours this year</div></div>{Number(d.hours.pending)>0&&<div><div className="text-2xl font-semibold tabular-nums text-warn">{Number(d.hours.pending)}</div><div className="text-xs text-fog-muted">waiting for approval</div></div>}</div>
      {log&&<form onSubmit={save} className="tile mt-3 grid gap-3 p-3 sm:grid-cols-2">
        <Field label="Project"><select className="input" value={log.project} onChange={e=>setLog({...log,project:e.target.value})}><option value="">Other club work</option>{d.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
        <Field label="Date"><input type="date" className="input" required max={todayIso()} value={log.date} onChange={e=>setLog({...log,date:e.target.value})}/></Field>
        <Field label="Hours"><input type="number" className="input" required min="0.5" max="24" step="0.5" value={log.hours} onChange={e=>setLog({...log,hours:e.target.value})}/></Field>
        <Field label="What you did"><input className="input" value={log.role} onChange={e=>setLog({...log,role:e.target.value})}/></Field>
        <div className="flex gap-2 sm:col-span-2"><button className="btn">Send</button><button type="button" className="btn-quiet" onClick={()=>setLog(null)}>Cancel</button></div></form>}
      {d.hours.recent.length>0&&<ul className="mt-3 divide-y divide-ink-700/80 text-sm">{d.hours.recent.map((h,i)=><li key={i} className="flex items-center gap-2 py-1.5"><span className="flex-1 text-fog">{h.project||h.role||'Club work'}<span className="block text-xs text-fog-faint">{fmt(h.date)}</span></span>{!h.approved&&<Badge tone="amber">Waiting</Badge>}<b className="tabular-nums text-fg">{Number(h.hours)} h</b></li>)}</ul>}</section>
  </div>
}
