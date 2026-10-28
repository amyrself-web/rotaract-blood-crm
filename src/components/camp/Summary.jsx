// A camp in numbers, its report, and closing the day.
import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {FileText,Flag} from 'lucide-react'
import {useBrand} from '../../context/Brand'
import {useAuth} from '../../context/Auth'
import {supabase} from '../../lib/supabase'
import {useLive,useConfirm,errText} from '../ui'
import {loadSummary,campReportPdf} from '../../lib/campReport'
import {kindOf,words} from '../../lib/campTypes'
import {rs} from '../../lib/docpdf'

const Tile=({l,v})=><div className="rounded-xl bg-ink-800 p-3 text-center"><div className="font-display text-2xl font-semibold text-fg">{v}</div><div className="text-xs text-fog-faint">{l}</div></div>
export function tilesOf(s){if(!s)return [];const k=kindOf(s.camp)
  if(k==='blood'){const b=s.blood;return [['Registered',b.registered],['Came',b.arrived],['Donated',b.donated],['Deferred',b.deferred],['Blood collected',`${b.litres} L`]]}
  if(k==='food'){const f=s.food;return [['People served',f.people],['Packets',f.packets],['Places',f.points]]}
  if(k==='plants'){const p=s.plants;return [['Saplings planted',p.planted],['Batches',p.batches],['Surviving',p.checked?`${Math.round(p.alive/p.checked*100)}%`:'–']]}
  const p=s.people,eye=s.camp.camp_type==='Eye checking'
  return [['Registered',p.registered],['Seen',p.attended],...(eye?[['Spectacles given',p.actions?.['Spectacles given']||0],['Surgery referrals',p.actions?.['Surgery referral']||0]]:[['Normal',p.normal],['Suspicious',p.suspicious]]),['Referred',p.referred],['Follow-up pending',p.follow_pending]]}

export default function Summary({camp,onClosed}){
  const {brand}=useBrand(),{can}=useAuth(),confirm=useConfirm(),[s,setS]=useState(null),[busy,setBusy]=useState('')
  const load=()=>loadSummary(camp.id).then(setS,e=>toast.error(errText(e)))
  useEffect(()=>{load()},[camp.id]);useLive(['camps','registrations','camp_people','camp_food','camp_saplings','camp_sessions','camp_attendance','camp_volunteers','sponsors','expenses'],load)
  const pdf=async()=>{setBusy('pdf');try{await campReportPdf(brand,s||await loadSummary(camp.id))}catch(e){toast.error(errText(e))}setBusy('')}
  const close=async()=>{const k=kindOf(camp),waiting=k==='blood'?'registered donors who did not come':'registered people who did not come'
    if(!await confirm({title:`Close ${camp.name}?`,body:`The camp is marked Completed and ${waiting} are marked as not came. You can still edit records afterwards.`,action:'Close the day',danger:false}))return
    setBusy('close');const {data,error}=await supabase.rpc('close_camp_day',{p_camp:camp.id});setBusy('');if(error)return toast.error(errText(error))
    toast.success(`Camp closed${data.marked_no_show?` · ${data.marked_no_show} marked as not came`:''}`);setS(data);onClosed?.()}
  if(!s)return <div className="skeleton h-32"/>
  const done=['completed','closed'].includes(s.camp.status)
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{tilesOf(s).map(([l,v])=><Tile key={l} l={l} v={v}/>)}</div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Tile l="Members present" v={s.team.members_present}/><Tile l="Volunteers present" v={`${s.team.volunteers_present}/${s.team.volunteers}`}/>
      <Tile l="Sponsorship received" v={rs(s.money.sponsors)}/><Tile l="Expenses" v={rs(s.money.expenses)}/></div>
    <p className="text-sm text-fog-muted">{s.camp.beneficiaries??0} {words(s.camp).helped} so far.</p>
    <div className="flex flex-wrap gap-2"><button className="btn-quiet" disabled={!!busy} onClick={pdf}><FileText size={15}/>{busy==='pdf'?'Preparing…':'Camp report PDF'}</button>
      {!done&&(can('camps')||can('campday'))&&<button className="btn" disabled={!!busy} onClick={close}><Flag size={15}/>{busy==='close'?'Closing…':'Close the day'}</button>}</div>
  </div>}
