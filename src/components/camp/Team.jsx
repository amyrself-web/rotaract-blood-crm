// Who from the club worked at a camp: members (present / late / leave / absent, duty) and volunteers from the planning list.
import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {CheckCheck} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useLive,errText,code,todayIso} from '../ui'

const ATT=[['present','Present'],['late','Late'],['leave','Leave'],['absent','Absent']]

function Members({camp}){
  const [members,setMembers]=useState(null),[att,setAtt]=useState({}),[q,setQ]=useState('')
  const load=async()=>{const [m,a]=await Promise.all([supabase.from('members').select('id,member_no,full_name,position,status').is('deleted_at',null).order('member_no'),
      supabase.from('camp_attendance').select('*').eq('camp_id',camp.id)])
    if(m.error)return toast.error(m.error.message);if(a.error)return toast.error(a.error.message)
    setMembers((m.data||[]).filter(x=>x.status!=='inactive'||(a.data||[]).some(r=>r.member_id===x.id)));setAtt(Object.fromEntries((a.data||[]).map(r=>[r.member_id,r])))}
  useEffect(()=>{load()},[camp.id])
  useLive(['camp_attendance'],load)
  const lateGuess=()=>{if(!camp.start_time||camp.camp_date!==todayIso())return null;const [h,m]=camp.start_time.split(':').map(Number),n=new Date();const g=Math.max(0,n.getHours()*60+n.getMinutes()-(h*60+m));return g>240?null:g}
  const save=async(mid,patch)=>{const cur=att[mid]||{camp_id:camp.id,member_id:mid,status:'present',late_minutes:null,duty:null}
    const row={...cur,...patch};if(row.status!=='late')row.late_minutes=null;else if(patch.status==='late'&&row.late_minutes==null)row.late_minutes=lateGuess()
    setAtt(a=>({...a,[mid]:row}));const {noted_at,...up}=row
    const {error}=await supabase.from('camp_attendance').upsert(up);if(error){toast.error(errText(error));load()}}
  const clear=async mid=>{const {error}=await supabase.from('camp_attendance').delete().eq('camp_id',camp.id).eq('member_id',mid);if(error)return toast.error(error.message);setAtt(a=>{const n={...a};delete n[mid];return n})}
  const allPresent=async()=>{const rows=(members||[]).filter(m=>!att[m.id]).map(m=>({camp_id:camp.id,member_id:m.id,status:'present'}))
    if(!rows.length)return toast('Everyone is already marked');const {error}=await supabase.from('camp_attendance').insert(rows);if(error)return toast.error(errText(error));toast.success(`${rows.length} marked present`);load()}
  if(!members)return <div className="skeleton h-40"/>
  const vals=Object.values(att),cnt=s=>vals.filter(r=>r.status===s).length
  const list=members.filter(m=>!q||`${m.full_name} ${m.member_no}`.toLowerCase().includes(q.toLowerCase()))
  return <div className="space-y-4">
    <div className="grid grid-cols-5 gap-2 text-center">{[['Present',cnt('present')+cnt('late'),'text-ok'],['Late',cnt('late'),'text-brand'],['Leave',cnt('leave'),'text-warn'],['Absent',cnt('absent'),'text-blood'],['Not marked',members.length-vals.length,'text-fog-faint']].map(([l,n,c])=>
      <div key={l} className="rounded-xl bg-ink-800 p-2"><div className={`font-display text-xl font-semibold ${c}`}>{n}</div><div className="text-[11px] text-fog-faint">{l}</div></div>)}</div>
    <div className="flex gap-2"><input className="input" placeholder={`Search ${members.length} members`} value={q} onChange={e=>setQ(e.target.value)}/>
      <button className="btn-quiet shrink-0" onClick={allPresent}><CheckCheck size={15}/>Mark the rest present</button></div>
    <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">{list.map(m=>{const r=att[m.id]
      return <div key={m.id} className="flex flex-wrap items-center gap-2 p-3">
        <div className="min-w-[140px] flex-1"><div className="text-sm font-medium text-fg">{m.full_name}</div><div className="text-xs text-fog-faint">{code('M',m.member_no)}{m.position?` · ${m.position}`:''}</div></div>
        <div className="flex overflow-hidden rounded-lg border border-ink-600">{ATT.map(([k,l])=><button key={k} type="button" aria-pressed={r?.status===k} onClick={()=>save(m.id,{status:k})}
          className={`px-2.5 py-1.5 text-xs ${r?.status===k?{present:'bg-ok text-white',late:'bg-brand text-white',leave:'bg-warn text-white',absent:'bg-blood text-white'}[k]:'text-fog-muted hover:bg-ink-700'}`}>{l}</button>)}</div>
        {r?.status==='late'&&<label className="flex items-center gap-1 text-xs text-fog-muted"><input aria-label="Minutes late" className="input w-16 py-1 text-xs" type="number" min="0" max="600" value={r.late_minutes??''} onChange={e=>setAtt(a=>({...a,[m.id]:{...r,late_minutes:e.target.value===''?null:Number(e.target.value)}}))} onBlur={e=>save(m.id,{late_minutes:e.target.value===''?null:Number(e.target.value)})}/>min</label>}
        {r&&<input aria-label="Duty" className="input w-32 py-1 text-xs" placeholder="Duty (optional)" defaultValue={r.duty||''} onBlur={e=>{const v=e.target.value.trim()||null;if(v!==(r.duty||null))save(m.id,{duty:v})}}/>}
        {r&&<button className="btn-ghost text-xs" title="Clear mark" onClick={()=>clear(m.id)}>×</button>}
      </div>})}
      {!list.length&&<div className="p-6 text-center text-sm text-fog-faint">No members found.</div>}</div>
    <p className="text-xs text-fog-faint">Late members count as present; the minutes late show in the attendance report.</p>
  </div>
}


function Volunteers({camp}){
  const [rows,setRows]=useState(null)
  const load=()=>supabase.from('camp_volunteers').select('*').eq('camp_id',camp.id).order('name').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[camp.id]);useLive(['camp_volunteers'],load)
  const tick=async(v,attended)=>{setRows(rs=>rs.map(r=>r.id===v.id?{...r,attended}:r));const {error}=await supabase.from('camp_volunteers').update({attended}).eq('id',v.id);if(error){toast.error(errText(error));load()}}
  if(!rows)return null
  if(!rows.length)return <p className="text-xs text-fog-faint">No outside volunteers listed for this camp. Add them in Camp planning → Volunteers.</p>
  return <div><div className="label">Volunteers ({rows.filter(r=>r.attended).length} of {rows.length} here)</div>
    <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">{rows.map(v=><label key={v.id} className="flex cursor-pointer items-center gap-3 p-2.5 text-sm">
      <input type="checkbox" checked={!!v.attended} onChange={e=>tick(v,e.target.checked)} aria-label={`${v.name} is here`}/>
      <span className="code">{code('V',v.volunteer_no,3)}</span><span className="flex-1 text-fg">{v.name}</span><span className="text-xs text-fog-faint">{[v.desk,v.shift].filter(Boolean).join(' · ')}</span></label>)}</div></div>}

export default function Team({camp}){
  return <div className="space-y-5"><Members camp={camp}/><Volunteers camp={camp}/></div>}
