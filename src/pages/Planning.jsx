import {useEffect,useState} from 'react'
import {Send,Trash2} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {normPhone,fmt,wa} from '../lib/util'
const DESKS=['Registration','Screening','Donation','Refreshment','Certificate','Crowd control']
const CATS=['Refreshments','Printing','Banners','Transport','Sound system','Certificates','Other']
const CHECK=['Permission letter obtained','Partner blood bank confirmed','Doctors and nurses confirmed','Poster and banners printed','Registration QR shared','Refreshments arranged','Volunteers briefed','Certificates printed','Sound system and seating arranged','Medical equipment checked']
const inr=n=>'Rs. '+Number(n||0).toLocaleString('en-IN'),sum=(a,k)=>a.reduce((s,x)=>s+Number(x[k]||0),0)
const TABS=[['tasks','Checklist'],['camp_volunteers','Volunteers'],['money','Money']]
export default function Planning(){
  const today=new Date().toLocaleDateString('en-CA')
  const [camps,setCamps]=useState([]),[cid,setCid]=useState(''),[tab,setTab]=useState('tasks'),[d,setD]=useState({tasks:[],camp_volunteers:[],sponsors:[],expenses:[]}),[f,setF]=useState({}),[err,setErr]=useState('')
  useEffect(()=>{supabase.from('camps').select('*').order('camp_date',{ascending:false}).then(({data})=>{setCamps(data||[]);if(data?.length)setCid((data.filter(c=>c.camp_date>=today).pop()||data[0]).id)})},[])
  const load=async()=>{if(!cid)return;const o={};for(const t of ['tasks','camp_volunteers','sponsors','expenses']){const r=await supabase.from(t).select('*').eq('camp_id',cid).order('created_at');if(r.error)return setErr(r.error.message);o[t]=r.data}setD(o)}
  useEffect(()=>{load()},[cid])
  const run=async p=>{setErr('');const {error}=await p;error?setErr(error.message):load()}
  const add=(t,row)=>{run(supabase.from(t).insert(Array.isArray(row)?row.map(x=>({...x,camp_id:cid})):{...row,camp_id:cid}));setF({})}
  const upd=(t,id,p)=>{setD(o=>({...o,[t]:o[t].map(x=>x.id===id?{...x,...p}:x)}));run(supabase.from(t).update(p).eq('id',id))},del=(t,id)=>run(supabase.from(t).delete().eq('id',id))
  const camp=camps.find(c=>c.id===cid),set=k=>e=>setF({...f,[k]:e.target.value}),v=k=>f[k]||''
  const spent=sum(d.expenses,'amount'),got=sum(d.sponsors.filter(s=>s.received),'amount')
  const Del=({t,id})=><button className="btn-ghost ml-auto" aria-label="Delete" onClick={()=>del(t,id)}><Trash2 size={15}/></button>
  return <div><h1 className="h1">Camp planning</h1>{err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="mb-4 flex flex-wrap gap-2"><select className="input w-auto" value={cid} onChange={e=>setCid(e.target.value)}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select>
      {TABS.map(([k,l])=><button key={k} onClick={()=>{setTab(k);setF({})}} className={`rounded-lg px-3 py-1.5 text-sm ${tab===k?'bg-brand text-white':'border border-ink-600 text-slate-300 hover:border-brand'}`}>{l}</button>)}</div>
    {!camps.length&&<div className="card text-center text-slate-500">Create a camp first.</div>}
    {camps.length>0&&tab==='tasks'&&<div className="card"><div className="mb-3 flex items-center justify-between"><span className="text-sm text-slate-400">{d.tasks.filter(t=>t.done).length} of {d.tasks.length} done</span>
        {!d.tasks.length&&<button className="btn" onClick={()=>add('tasks',CHECK.map(title=>({title})))}>Add standard checklist</button>}</div>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('tasks',{title:f.title,assignee:f.assignee||null,due:f.due||null})}}>
        <input className="input w-64" placeholder="New task" required value={v('title')} onChange={set('title')}/><input className="input w-40" placeholder="Assigned to" value={v('assignee')} onChange={set('assignee')}/>
        <input type="date" className="input w-auto" value={v('due')} onChange={set('due')}/><button className="btn">Add</button></form>
      {d.tasks.map(t=><div key={t.id} className="flex items-center gap-3 border-t border-ink-700 py-2 text-sm"><input type="checkbox" checked={t.done} onChange={e=>upd('tasks',t.id,{done:e.target.checked})}/>
        <span className={t.done?'text-slate-500 line-through':'text-white'}>{t.title}</span><span className="text-slate-500">{t.assignee} {t.due&&fmt(t.due)}</span><Del t="tasks" id={t.id}/></div>)}</div>}
    {camps.length>0&&tab==='camp_volunteers'&&<div className="card"><form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('camp_volunteers',{name:f.name,phone:normPhone(f.phone)||null,desk:f.desk||null,shift:f.shift||null})}}>
        <input className="input w-44" placeholder="Name" required value={v('name')} onChange={set('name')}/><input className="input w-36" placeholder="Mobile" value={v('phone')} onChange={set('phone')}/>
        <select className="input w-auto" value={v('desk')} onChange={set('desk')}><option value="">Desk</option>{DESKS.map(x=><option key={x}>{x}</option>)}</select>
        <input className="input w-36" placeholder="Shift, e.g. 8 to 12" value={v('shift')} onChange={set('shift')}/><button className="btn">Add</button></form>
      {d.camp_volunteers.map(x=><div key={x.id} className="flex flex-wrap items-center gap-3 border-t border-ink-700 py-2 text-sm"><input type="checkbox" title="Present" checked={x.attended} onChange={e=>upd('camp_volunteers',x.id,{attended:e.target.checked})}/>
        <span className="text-white">{x.name}</span><span className="text-slate-400">{x.desk} {x.shift}</span>
        {x.phone&&<a className="btn px-3 py-1" target="_blank" rel="noreferrer" href={wa(x.phone,`Hello ${x.name}, your duty for ${camp.name} on ${fmt(camp.camp_date)}: ${x.desk||'to be told'}${x.shift?', shift '+x.shift:''}${camp.venue?', venue '+camp.venue:''}. Thank you for volunteering. Sankari Rotaract Club`)}><Send size={14}/>Duty slip</a>}<Del t="camp_volunteers" id={x.id}/></div>)}
      {!d.camp_volunteers.length&&<p className="text-sm text-slate-500">No volunteers added yet. Tick the box when a volunteer arrives.</p>}</div>}
    {camps.length>0&&tab==='money'&&<div className="space-y-4"><div className="card grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
        <div><input className="input text-center" type="number" min="0" placeholder="Budget" key={cid} defaultValue={camp?.budget??''} onBlur={async e=>{const b=e.target.value===''?null:Number(e.target.value);const {error}=await supabase.from('camps').update({budget:b}).eq('id',cid);error?setErr(error.message):setCamps(cs=>cs.map(c=>c.id===cid?{...c,budget:b}:c))}}/><div className="mt-1 text-xs text-slate-400">Budget (Rs.)</div></div>
        {[['Sponsorship received',inr(got)],['Expenses',inr(spent)],['Balance',inr(got-spent)]].map(([l,n])=><div key={l}><div className="text-xl font-semibold text-white">{n}</div><div className="text-xs text-slate-400">{l}</div></div>)}</div>
      <div className="card"><h2 className="mb-2 font-semibold text-white">Sponsors</h2><form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('sponsors',{name:f.sname,amount:Number(f.samt||0)})}}>
          <input className="input w-52" placeholder="Sponsor name" required value={v('sname')} onChange={set('sname')}/><input className="input w-32" type="number" min="0" placeholder="Amount" value={v('samt')} onChange={set('samt')}/><button className="btn">Add</button></form>
        {d.sponsors.map(s=><div key={s.id} className="flex items-center gap-3 border-t border-ink-700 py-2 text-sm"><input type="checkbox" title="Received" checked={s.received} onChange={e=>upd('sponsors',s.id,{received:e.target.checked})}/><span className="text-white">{s.name}</span><span className="text-slate-400">{inr(s.amount)}{s.received?' received':' pledged'}</span><Del t="sponsors" id={s.id}/></div>)}</div>
      <div className="card"><h2 className="mb-2 font-semibold text-white">Expenses</h2><form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('expenses',{category:f.cat||'Other',description:f.desc||null,amount:Number(f.eamt||0)})}}>
          <select className="input w-auto" value={v('cat')} onChange={set('cat')}>{CATS.map(x=><option key={x}>{x}</option>)}</select><input className="input w-48" placeholder="Details" value={v('desc')} onChange={set('desc')}/>
          <input className="input w-32" type="number" min="0" required placeholder="Amount" value={v('eamt')} onChange={set('eamt')}/><button className="btn">Add</button></form>
        {d.expenses.map(x=><div key={x.id} className="flex items-center gap-3 border-t border-ink-700 py-2 text-sm"><span className="text-white">{x.category}</span><span className="text-slate-400">{x.description}</span><span className="text-slate-300">{inr(x.amount)}</span><Del t="expenses" id={x.id}/></div>)}</div></div>}
  </div>
}
