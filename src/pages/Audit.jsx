import {Fragment,useEffect,useState} from 'react'
import {motion} from 'framer-motion'
import {History,ChevronDown} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {PageHeader,Badge,Empty} from '../components/ui'

const NAMES={profiles:'User',donors:'Donor',camps:'Camp',registrations:'Registration',screenings:'Screening',donations:'Donation',blood_units:'Blood unit',
  handovers:'Handover',emergency_requests:'Emergency request',tasks:'Task',camp_volunteers:'Volunteer',sponsors:'Sponsor',expenses:'Expense',settings:'Settings',
  message_templates:'Message template',stock_thresholds:'Stock minimum'}
const TONE={insert:'green',update:'blue',delete:'red'},VERB={insert:'Added',update:'Changed',delete:'Deleted'}
const PAGE=50
const label=c=>c?.full_name||c?.name||c?.title||c?.bag_number||c?.bank_name||c?.hospital||c?.category||c?.email||''
const val=v=>v===null||v===undefined?'empty':typeof v==='object'?JSON.stringify(v):String(v)

export default function Audit(){
  const [rows,setRows]=useState(null),[t,setT]=useState(''),[a,setA]=useState(''),[who,setWho]=useState(''),[from,setFrom]=useState(''),[page,setPage]=useState(0),[open,setOpen]=useState(null),[more,setMore]=useState(false)
  useEffect(()=>{setRows(null);let q=supabase.from('audit_logs').select('*').order('at',{ascending:false}).range(page*PAGE,page*PAGE+PAGE)
    if(t)q=q.eq('table_name',t);if(a)q=q.eq('action',a);if(who)q=q.ilike('actor_name',`%${who}%`);if(from)q=q.gte('at',from)
    q.then(({data,error})=>{if(error)return setRows([]);setMore(data.length>PAGE);setRows(data.slice(0,PAGE))})},[t,a,who,from,page])
  useEffect(()=>setPage(0),[t,a,who,from])
  return <div>
    <PageHeader title="Audit log" description="Every add, change and delete, with who did it and when. Health readings are recorded as changed without their values."/>
    <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-4">
      <select className="input" value={t} onChange={e=>setT(e.target.value)}><option value="">All records</option>{Object.entries(NAMES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <select className="input" value={a} onChange={e=>setA(e.target.value)}><option value="">All actions</option><option value="insert">Added</option><option value="update">Changed</option><option value="delete">Deleted</option></select>
      <input className="input" placeholder="Person" value={who} onChange={e=>setWho(e.target.value)}/>
      <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} title="From date"/></div>
    <div className="card overflow-hidden p-0">
      {rows===null?<div className="space-y-2 p-4">{[0,1,2,3].map(i=><div key={i} className="skeleton h-10"/>)}</div>
      :!rows.length?<Empty icon={History} title="No changes recorded">Changes show up here as soon as anyone edits data.</Empty>
      :<table className="table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th><th/></tr></thead>
        <tbody>{rows.map(r=><Fragment key={r.id}>
          <tr className="cursor-pointer" onClick={()=>setOpen(open===r.id?null:r.id)}>
            <td className="whitespace-nowrap text-fog-muted">{new Date(r.at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
            <td className="text-white">{r.actor_name||(r.actor?'Unknown user':'System')}</td>
            <td><Badge tone={TONE[r.action]}>{VERB[r.action]}</Badge> <span className="ml-1 text-fog">{NAMES[r.table_name]||r.table_name}</span></td>
            <td className="max-w-[260px] truncate text-fog-muted">{r.action==='update'?Object.keys(r.changes||{}).join(', '):label(r.changes)}</td>
            <td className="w-8"><ChevronDown size={16} className={`text-fog-faint transition-transform ${open===r.id?'rotate-180':''}`}/></td></tr>
          {open===r.id&&<tr><td colSpan="5" className="bg-ink-900/60 p-0"><motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} className="overflow-hidden">
            <dl className="grid gap-x-6 gap-y-1.5 px-6 py-4 text-sm sm:grid-cols-[180px_1fr]">{Object.entries(r.changes||{}).map(([k,v])=><Fragment key={k}>
              <dt className="text-fog-faint">{k.replaceAll('_',' ')}</dt>
              <dd className="break-all text-fog">{v&&typeof v==='object'&&'from' in v?<><span className="text-fog-faint line-through">{val(v.from)}</span> <span className="text-fog-faint">to</span> {val(v.to)}</>:val(v)}</dd></Fragment>)}</dl>
          </motion.div></td></tr>}</Fragment>)}</tbody></table>}
    </div>
    {rows&&(page>0||more)&&<div className="mt-4 flex justify-end gap-2"><button className="btn-quiet" disabled={!page} onClick={()=>setPage(page-1)}>Newer</button><button className="btn-quiet" disabled={!more} onClick={()=>setPage(page+1)}>Older</button></div>}
  </div>
}
