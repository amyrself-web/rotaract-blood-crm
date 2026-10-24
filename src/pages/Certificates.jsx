import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Award,Download,Search,MessageCircle,Link2,FileDown,CheckCircle2,Clock} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {PageHeader,Badge,Empty,useLive,code,errText} from '../components/ui'
import {makeCertificate,certNo,verifyUrl,fmtCode} from '../lib/certificate'
import {rotaryYear,csv} from '../lib/clubReports'
import CountUp from '../components/CountUp'
import {enqueue,certLink} from '../lib/wa'
import {Send} from 'lucide-react'
import WaSend from '../components/wa/WaSend'

// Register of every blood donation certificate: who got one, when it was downloaded or sent, and the check code.
export default function Certificates(){
  const {can,settings}=useAuth(),{brand}=useBrand(),ry=rotaryYear()
  const [rows,setRows]=useState(null),[camps,setCamps]=useState([]),[camp,setCamp]=useState(''),[q,setQ]=useState(''),[f,setF]=useState(''),[busy,setBusy]=useState(''),[bulk,setBulk]=useState(null)
  const [range,setRange]=useState({from:ry.from,to:ry.to})
  const load=()=>supabase.rpc('certificate_register',{p_from:range.from,p_to:range.to,p_camp:camp||null}).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{supabase.from('camps').select('id,name,camp_date,camp_no').is('deleted_at',null).order('camp_date',{ascending:false}).then(({data})=>setCamps(data||[]))},[])
  useEffect(()=>{load()},[camp,range.from,range.to]);useLive(['donations'],load)
  const list=useMemo(()=>(rows||[]).filter(r=>(!f||(f==='not'?!r.issued_at:f==='sent'?r.sent_at:r.downloads>0))
    &&(!q||`${certNo(r.cert_no)} ${r.name} ${code('D',r.donor_no)} ${r.phone} ${r.camp} ${r.verify_code}`.toLowerCase().includes(q.toLowerCase()))),[rows,q,f])
  const one=async r=>{await makeCertificate({name:r.name,camp:r.camp,venue:r.venue,date:fmt(r.date),bloodGroup:r.blood_group,volume:r.volume,certificate:certNo(r.cert_no),verifyCode:r.verify_code,donorNo:code('D',r.donor_no),brand})
    await supabase.rpc('log_certificate',{p_reg:r.reg_id,p_kind:'download'})}
  const download=async r=>{setBusy(r.reg_id);try{await one(r);load()}catch(e){toast.error(errText(e))}setBusy('')}
  const certText=r=>{const link=certLink(r.verify_code)
    return `Dear ${r.name.split(' ')[0]}, thank you for donating blood at ${r.camp} on ${fmt(r.date)}. 🩸\nYour certificate ${certNo(r.cert_no)}: download it here ${link}\n- ${brand.club_name||settings.club_name||''}`}
  const whatsapp=async(r,mode)=>{if(mode==='manual')await supabase.rpc('log_certificate',{p_reg:r.reg_id,p_kind:'whatsapp'});load()}
  const all=async()=>{const todo=list;if(!todo.length)return;setBulk({done:0,total:todo.length})
    for(let i=0;i<todo.length;i++){try{await one(todo[i])}catch(e){toast.error(`${todo[i].name}: ${errText(e)}`)}setBulk({done:i+1,total:todo.length})}
    setBulk(null);toast.success(`${todo.length} certificates downloaded`);load()}
  const sendAll=async()=>{const todo=list.filter(r=>r.phone&&!r.sent_at);if(!todo.length)return toast.error('Everyone in this list has already been sent their certificate')
    try{const club=brand.club_name||settings.club_name||'',x=await enqueue(`Certificates${camp?` · ${camps.find(c=>c.id===camp)?.name||''}`:''}`,'certificate',todo.map(r=>{const v={name:r.name,camp:r.camp,date:fmt(r.date),link:certLink(r.verify_code),club}
      return {phone:r.phone,name:r.name,ref:r.reg_id,vars:v,body:`Dear ${r.name.split(' ')[0]}, thank you for donating blood at ${r.camp} on ${fmt(r.date)}. 🩸\nDownload your certificate here: ${v.link}\n- ${club}`}}))
      toast.success(`${x.queued} certificates queued in WhatsApp Outbox`)}catch(e){toast.error(errText(e))}}
  const st=rows||[],issued=st.filter(r=>r.issued_at).length,sent=st.filter(r=>r.sent_at).length
  return <div>
    <PageHeader title="Certificates" description="Every blood donation certificate: who received one, downloads, WhatsApp messages and the check code."
      actions={<><button className="btn-quiet" disabled={!list.length} onClick={()=>csv(list.map(r=>({certificate:certNo(r.cert_no),check_code:fmtCode(r.verify_code),donor_id:code('D',r.donor_no),name:r.name,blood_group:r.blood_group,phone:r.phone,camp:r.camp,date:r.date,ml:r.volume,
          issued:r.issued_at?fmt(r.issued_at):'',downloads:r.downloads,whatsapp_sent:r.sent_at?fmt(r.sent_at):''})),'certificates.csv')}><Download size={15}/>CSV</button>
        <button className="btn-quiet" disabled={!list.length} onClick={sendAll}><Send size={15}/>Send all on WhatsApp</button>
        <button className="btn" disabled={!list.length||!!bulk} onClick={all}><FileDown size={15}/>{bulk?`Preparing ${bulk.done} of ${bulk.total}…`:`Download ${list.length} PDFs`}</button></>}/>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Certificates',st.length,'One for every donation'],['Given or downloaded',issued,`${st.length-issued} not yet given`],['Sent on WhatsApp',sent,'With the check link'],['Total downloads',st.reduce((a,r)=>a+r.downloads,0),'By staff and donors']].map(([l,v,s])=>
        <div key={l} className="card py-4"><div className="text-2xl font-semibold text-fg">{rows?<CountUp value={v}/>:<span className="skeleton inline-block h-7 w-10"/>}</div><div className="text-xs text-fog-muted">{l}</div><div className="mt-1 text-[11px] text-fog-faint">{s}</div></div>)}</div>
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-2 gap-2 border-b border-ink-700 p-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative col-span-2 lg:col-span-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, CRT number, donor ID, code" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="input lg:w-auto" aria-label="Camp" value={camp} onChange={e=>setCamp(e.target.value)}><option value="">All camps</option>{camps.map(c=><option key={c.id} value={c.id}>{code('C',c.camp_no,3)} {c.name}</option>)}</select>
        <select className="input lg:w-auto" aria-label="Status" value={f} onChange={e=>setF(e.target.value)}><option value="">Any status</option><option value="not">Not given yet</option><option value="dl">Downloaded</option><option value="sent">Sent on WhatsApp</option></select>
        <input type="date" className="input lg:w-auto" aria-label="From" value={range.from} onChange={e=>setRange({...range,from:e.target.value})}/>
        <input type="date" className="input lg:w-auto" aria-label="To" value={range.to} onChange={e=>setRange({...range,to:e.target.value})}/></div>
      {rows===null?<div className="space-y-2 p-4">{[0,1,2].map(i=><div key={i} className="skeleton h-10"/>)}</div>
      :!list.length?<Empty icon={Award} title={rows.length?'No certificates match':'No certificates yet'}>{rows.length?'Change the search or filters.':'A certificate is created when a donation is recorded on Camp day.'}</Empty>
      :<ul className="divide-y divide-ink-700/80">{list.map(r=><li key={r.reg_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blood/10 font-display text-sm font-semibold text-blood">{r.blood_group||'-'}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="code">{certNo(r.cert_no)}</span><span className="truncate font-medium text-fg">{r.name}</span><span className="text-xs text-fog-faint">{code('D',r.donor_no)}</span></div>
          <div className="mt-0.5 truncate text-xs text-fog-faint">{r.camp} · {fmt(r.date)} · {r.volume} ml · check code <span className="font-mono">{fmtCode(r.verify_code)}</span></div></div>
        <div className="flex flex-wrap items-center gap-1.5">{r.issued_at?<Badge tone="green"><CheckCircle2 size={12}/>Given {fmt(r.issued_at)}</Badge>:<Badge tone="amber"><Clock size={12}/>Not given</Badge>}
          {r.downloads>0&&<Badge>{r.downloads} download{r.downloads>1?'s':''}</Badge>}{r.sent_at&&<Badge tone="blue">WhatsApp {fmt(r.sent_at)}</Badge>}</div>
        <div className="flex gap-1"><button className="btn-ghost" title="Download certificate" aria-label={`Download certificate for ${r.name}`} disabled={busy===r.reg_id} onClick={()=>download(r)}><Download size={16}/></button>
          {r.consent&&r.phone&&!r.phone.startsWith('X')&&<WaSend className="btn-ghost" title={`WhatsApp ${r.name}`} kind="certificate" refId={r.reg_id} phone={r.phone} name={r.name} text={certText(r)} onSent={m=>whatsapp(r,m)}><MessageCircle size={16}/></WaSend>}
          <button className="btn-ghost" title="Copy check link" aria-label="Copy check link" onClick={()=>{navigator.clipboard?.writeText(verifyUrl(fmtCode(r.verify_code)));toast.success('Check link copied')}}><Link2 size={16}/></button></div>
      </li>)}</ul>}
    </div>
  </div>
}
