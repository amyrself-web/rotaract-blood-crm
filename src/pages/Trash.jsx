import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {RotateCcw,Trash2,ArchiveRestore} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {PageHeader,Tabs,Empty,useConfirm,useLive,code} from '../components/ui'
import {fmt} from '../lib/util'

const KINDS=[['donors','Donors','donors',r=>r.full_name,r=>`${code('D',r.donor_no)} · ${r.phone}`],
  ['camps','Camps','camps',r=>r.name,r=>`${code('C',r.camp_no,3)} · ${fmt(r.camp_date)}`],
  ['emergency_requests','Emergency requests','emergency',r=>`${r.blood_group} x ${r.units_needed} at ${r.hospital}`,r=>code('ER',r.req_no,3)],
  ['members','Members','members',r=>r.full_name,r=>`${code('M',r.member_no,3)} · ${r.position}`],
  ['meetings','Meetings','meetings',r=>r.title,r=>`${code('MT',r.meeting_no,3)} · ${fmt(r.meeting_date)}`],
  ['afterlife_cases','Eye and body donations','afterlife',r=>r.deceased_name,r=>`${code('ED',r.case_no,4)} · ${fmt(r.died_on)}`],
  ['pledges','Pledges','afterlife',r=>r.full_name,r=>`${code('PL',r.pledge_no,4)} · ${fmt(r.pledged_on)}`],
  ['club_trips','Club trips','funds',r=>r.title,r=>`${code('TR',r.trip_no,3)} · ${fmt(r.start_date)}`]]

export default function Trash(){
  const {can}=useAuth(),confirm=useConfirm(),kinds=KINDS.filter(k=>can(k[2]))
  const [tab,setTab]=useState(kinds[0]?.[0]),[rows,setRows]=useState(null)
  const kind=kinds.find(k=>k[0]===tab)
  const load=()=>kind&&supabase.from(tab).select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false}).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{setRows(null);load()},[tab])
  useLive([tab||'donors'],load)
  const restore=async r=>{const {error}=await supabase.from(tab).update({deleted_at:null,deleted_by:null}).eq('id',r.id);if(error)return toast.error(error.message);toast.success(`${kind[3](r)} restored`);load()}
  const purge=async r=>{if(!await confirm({title:`Delete ${kind[3](r)} for good?`,body:tab==='donors'?'Their registrations and donation history are deleted too. This cannot be undone.':tab==='camps'?'All registrations, screenings, donations and planning for this camp are deleted. This cannot be undone.':'This cannot be undone.',action:'Delete for good'}))return
    const {error}=await supabase.from(tab).delete().eq('id',r.id);if(error)return toast.error(error.message);toast.success('Deleted for good');load()}
  return <div>
    <PageHeader title="Recycle bin" description="Deleted records wait here. Restore anything deleted by mistake."/>
    {kinds.length>1&&<Tabs id="trash-tabs" value={tab} onChange={setTab} tabs={kinds.map(k=>[k[0],k[1]])}/>}
    <div className="card overflow-hidden p-0">
      {rows===null?<div className="space-y-2 p-4">{[0,1].map(i=><div key={i} className="skeleton h-10"/>)}</div>
      :!rows.length?<Empty icon={ArchiveRestore} title="Nothing here">Deleted {kind?.[1].toLowerCase()} show up here.</Empty>
      :<table className="table"><thead><tr><th>{kind[1].replace(/s$/,'')}</th><th>Deleted</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
        <td><div className="font-medium text-fg">{kind[3](r)}</div><div className="text-xs text-fog-faint">{kind[4](r)}</div></td>
        <td className="text-fog-muted">{new Date(r.deleted_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
        <td className="text-right"><div className="flex justify-end gap-2"><button className="btn-quiet py-1.5 text-xs" onClick={()=>restore(r)}><RotateCcw size={13}/>Restore</button>
          <button className="btn-ghost hover:text-blood" title="Delete for good" onClick={()=>purge(r)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>}
    </div></div>
}
