import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {CheckCircle2,Circle,GraduationCap,Award,History,Crown} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {Field,Drawer,useConfirm,code,errText,todayIso} from './ui'
import {STEPS} from './MyClubExtra'
import {makeCertificate} from '../lib/certificate'
import {memberCardUrl} from '../lib/cards'
import {rotaryYear} from '../lib/clubReports'
import {celebrate} from '../lib/fx'

export function InductionTab({member,onChange}){
  const {brand}=useBrand(),[steps,setSteps]=useState(null),[date,setDate]=useState(todayIso()),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('induction_steps').select('*').eq('member_id',member.id).then(({data})=>setSteps(data||[]))
  useEffect(()=>{load()},[member.id])
  const has=k=>steps?.find(s=>s.step===k)
  const toggle=async k=>{const r=has(k)?await supabase.from('induction_steps').delete().eq('member_id',member.id).eq('step',k):await supabase.from('induction_steps').insert({member_id:member.id,step:k});if(r.error)return toast.error(r.error.message);load()}
  const induct=async()=>{setBusy(true);const {error}=await supabase.rpc('induct_member',{p_member:member.id,p_date:date});setBusy(false);if(error)return toast.error(error.message);celebrate();toast.success(`${member.full_name} is now an active member`);load();onChange?.()}
  const cert=async()=>{setBusy(true);try{const on=has('inducted')?.done_on||member.joined_on
    await makeCertificate({name:member.full_name,date:fmt(on),venue:brand.club_name,donorNo:code('M',member.member_no,3),certificate:code('M',member.member_no,3),verifyCode:member.card_code,brand,
      v:{label:'CERTIFICATE OF INDUCTION',headline:'Welcome to the club',intro:'This is to certify that',body:`was formally inducted as a member of <b style="color:#0B1324">${brand.club_name||'the club'}</b> on ${fmt(on)}, pledging to serve the community through fellowship and service.`,
        qrUrl:memberCardUrl(member.card_code),qrCaption:'Scan to check membership',sealText:'FELLOWSHIP  ·  SERVICE  ·  LEADERSHIP  ·',idLabel:'Member ID',venueLabel:'Club',file:`induction-${code('M',member.member_no,3)}.pdf`}})}catch(e){toast.error(errText(e))}setBusy(false)}
  if(!steps)return <div className="skeleton h-40"/>
  const doneN=STEPS.filter(([k])=>has(k)).length
  return <div className="space-y-4">
    <div className="flex items-center gap-3"><GraduationCap size={20} className="text-brand"/><div className="flex-1"><div className="font-semibold text-fg">Induction checklist</div><div className="text-xs text-fog-muted">{doneN} of {STEPS.length} done · the member sees this on their page</div></div></div>
    <div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-brand to-ok transition-all" style={{width:`${doneN/STEPS.length*100}%`}}/></div>
    <ul className="space-y-1">{STEPS.filter(([k])=>k!=='inducted').map(([k,l])=><li key={k}><button onClick={()=>toggle(k)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-ink-750">
      {has(k)?<CheckCircle2 size={19} className="text-ok"/>:<Circle size={19} className="text-fog-faint"/>}<span className={`flex-1 ${has(k)?'text-fg':'text-fog-muted'}`}>{l}</span>{has(k)&&<span className="text-xs text-fog-faint">{fmt(has(k).done_on)}</span>}</button></li>)}</ul>
    {has('inducted')?<div className="tile flex flex-wrap items-center gap-3 p-4"><Award size={20} className="text-ok"/><div className="flex-1 text-sm text-fg">Inducted on {fmt(has('inducted').done_on)}</div>
      <button className="btn-quiet" disabled={busy} onClick={cert}><Award size={15}/>{busy?'Preparing…':'Induction certificate'}</button></div>
    :<div className="tile flex flex-wrap items-end gap-3 p-4"><Field label="Induction date"><input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)}/></Field>
      <button className="btn" disabled={busy} onClick={induct}><GraduationCap size={15}/>Induct as active member</button></div>}
  </div>
}

export function NewYear({open,onClose,members,positions,onDone}){
  const confirm=useConfirm(),cur=rotaryYear(),next=`${Number(cur.label.slice(0,4))+1}-${String(Number(cur.label.slice(0,4))+2).slice(2)}`
  const [year,setYear]=useState(next),[board,setBoard]=useState({}),[hist,setHist]=useState([]),[busy,setBusy]=useState(false)
  useEffect(()=>{if(!open)return;setBoard(Object.fromEntries(positions.filter(p=>p!=='Member').map(p=>[p,members.find(m=>m.position===p&&m.status==='active')?.id||''])))
    supabase.from('board_terms').select('*').order('rotary_year',{ascending:false}).then(({data})=>setHist(data||[]))},[open])
  const go=async()=>{const items=Object.entries(board).filter(([,id])=>id).map(([position,member_id])=>({position,member_id}))
    if(!await confirm({title:`Start Rotary year ${year}?`,body:`The current board is saved in history, everyone becomes Member, and the ${items.length} people you chose take their new positions.`,action:'Start new year',danger:false}))return
    setBusy(true);const {data,error}=await supabase.rpc('start_rotary_year',{p_year:year,p_board:items});setBusy(false);if(error)return toast.error(errText(error))
    celebrate();toast.success(`New board of ${data} set for ${year}`);onDone?.();onClose()}
  const years=[...new Set(hist.map(h=>h.rotary_year))]
  return <Drawer open={open} onClose={onClose} width="max-w-2xl" title="New Rotary year" description="Hand over to the new board on 1 July. The outgoing board is kept in the club's history."
    footer={<><button className="btn-quiet" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={go}><Crown size={15}/>{busy?'Saving…':`Start ${year}`}</button></>}>
    <div className="space-y-5"><Field label="Rotary year"><input className="input w-40" pattern="\d{4}-\d{2}" value={year} onChange={e=>setYear(e.target.value)}/></Field>
      <div className="grid gap-3 sm:grid-cols-2">{Object.keys(board).map(p=><Field key={p} label={p}><select className="input" value={board[p]} onChange={e=>setBoard({...board,[p]:e.target.value})}><option value="">Nobody</option>
        {members.filter(m=>m.status==='active').map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>)}</div>
      {years.length>0&&<section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><History size={15}/>Past boards</h3>
        <div className="space-y-3">{years.map(y=><div key={y} className="tile p-3"><div className="mb-1 font-medium text-fg">{y}</div><div className="grid gap-x-4 text-sm sm:grid-cols-2">{hist.filter(h=>h.rotary_year===y).map(h=><div key={h.id} className="flex justify-between gap-2"><span className="text-fog-muted">{h.position}</span><span className="text-fg">{h.member_name}</span></div>)}</div></div>)}</div></section>}</div>
  </Drawer>
}
