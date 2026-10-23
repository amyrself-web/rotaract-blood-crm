import {useEffect,useState} from 'react'
import Papa from 'papaparse'
import {supabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {reportPdf,receiptPdf} from '../lib/report'
import {useBrand} from '../context/Brand'
import {useAuth} from '../context/Auth'
import {useLive,PageHeader} from '../components/ui'
import {toast} from 'sonner'
import {Clock,FileText,FolderHeart,Receipt,Send} from 'lucide-react'
import CountUp from '../components/CountUp'
import {afterlifePdf,attendancePdf,districtPdf,duesPdf,hoursPdf,iso,memberDirectoryPdf,projectsPdf,rotaryYear} from '../lib/clubReports'
import {IdCard,Wallet,Presentation,Eye} from 'lucide-react'

function ClubReports({brand,can}){
  const ry=rotaryYear(),d=new Date()
  const opts={year:{...ry,label:ry.label},month:{from:iso(new Date(d.getFullYear(),d.getMonth(),1)),to:iso(new Date(d.getFullYear(),d.getMonth()+1,0)),label:d.toLocaleDateString('en-IN',{month:'short',year:'numeric'}).replace(' ','-')},custom:null}
  const [mon,setMon]=useState(()=>{const x=new Date(d.getFullYear(),d.getMonth()-(d.getDate()<10?1:0),1);return iso(x).slice(0,7)}),[k,setK]=useState('year'),[c,setC]=useState({from:ry.from,to:iso(d)}),[busy,setBusy]=useState('')
  const P=k==='custom'?{...c,label:`${c.from}_to_${c.to}`}:opts[k]
  const go=async(id,f)=>{setBusy(id);try{await f()}catch(e){toast.error(e.message||String(e))}setBusy('')}
  const items=[['members',IdCard,'Member directory','Every member with position, contact and blood group',()=>memberDirectoryPdf(brand)],
    ['members',Wallet,'Dues collection','Receipts in the period and who has not paid',()=>duesPdf(brand,P)],
    ['meetings',Presentation,'Attendance register','Attendance % per member and every meeting held',()=>attendancePdf(brand,P)],
    ['afterlife',Eye,'Eye and body donation','Donations after death and new pledges',()=>afterlifePdf(brand,P)],
    ['members',FolderHeart,'Service projects','Every project with people helped, hours and money',()=>projectsPdf(brand,P)],
    ['members',Clock,'Volunteer hours','Approved service hours per member',()=>hoursPdf(brand,P)]].filter(x=>can(x[0]))
  if(!items.length)return null
  return <div className="card mt-5"><div className="mb-4 flex flex-wrap items-end gap-3"><div className="flex-1"><h2 className="font-semibold text-fg">Club reports</h2><p className="text-sm text-fog-muted">A4 PDF reports for members, meetings and eye donation.</p></div>
    <select className="input w-auto" aria-label="Period" value={k} onChange={e=>setK(e.target.value)}><option value="year">Rotary year {ry.label}</option><option value="month">This month</option><option value="custom">Choose dates</option></select>
    {k==='custom'&&<><input type="date" className="input w-auto" aria-label="From" value={c.from} onChange={e=>setC({...c,from:e.target.value})}/><input type="date" className="input w-auto" aria-label="To" value={c.to} onChange={e=>setC({...c,to:e.target.value})}/></>}</div>
    {(can('reports')||can('members'))&&<div className="tile mb-3 flex flex-wrap items-center gap-3 border-brand/40 bg-brand/[.06] p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white"><Send size={18}/></span>
      <div className="min-w-0 flex-1"><div className="font-semibold text-fg">Monthly report for the district</div><div className="text-xs text-fog-muted">Members, meetings and attendance, projects, camps, eye donation and money for one month, ready to send to the DRR.</div></div>
      <input type="month" className="input w-auto" aria-label="Month" value={mon} onChange={e=>setMon(e.target.value)}/><button className="btn" disabled={!!busy} onClick={()=>go('district',()=>districtPdf(brand,mon+'-01'))}><FileText size={15}/>{busy==='district'?'Preparing…':'Make report'}</button></div>}
    <div className="grid gap-3 sm:grid-cols-2">{items.map(([,I,t,dsc,f])=><button key={t} disabled={!!busy} onClick={()=>go(t,f)} className="tile group flex items-center gap-3 p-4 text-left transition hover:border-brand/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform group-hover:scale-110"><I size={19}/></span>
      <span className="min-w-0 flex-1"><span className="block font-medium text-fg">{busy===t?'Preparing…':t}</span><span className="block text-xs text-fog-muted">{dsc}</span></span><FileText size={16} className="text-fog-faint"/></button>)}</div></div>
}
const safe=v=>typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v  // stops spreadsheet formula injection
const dl=(name,rows)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([Papa.unparse(rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,safe(v)]))))],{type:'text/csv'}));a.download=name;a.click()}
export default function Reports(){
  const {brand}=useBrand(),{profile,can}=useAuth()
  const [camps,setCamps]=useState([]),[cid,setCid]=useState(''),[r,setR]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState('')
  useEffect(()=>{supabase.from('camps').select('id,name,camp_date').order('camp_date',{ascending:false}).then(({data})=>{setCamps(data||[]);if(data?.length)setCid(data[0].id)})},[])
  const load=()=>cid&&supabase.rpc('camp_report_full',{p_camp:cid}).then(({data,error})=>error?setErr(error.message):(setErr(''),setR(data)))
  useEffect(()=>{load()},[cid])
  useLive(['registrations','donations','sponsors','expenses','camp_volunteers','tasks'],load)
  const make=async(k,f)=>{setBusy(k);try{await f()}catch(e){toast.error(e.message||String(e))}finally{setBusy('')}}
  const donors=async()=>{let out=[],from=0;for(;;){const {data,error}=await supabase.from('donors').select('donor_no,full_name,phone,email,blood_group,gender,dob,area,last_donation,consent,source').is('deleted_at',null).order('donor_no').range(from,from+999);if(error)return setErr(error.message);out=out.concat(data);if(data.length<1000)break;from+=1000}dl('donors.csv',out)}
  const regs=async()=>{const {data,error}=await supabase.rpc('camp_board',{p_camp:cid});error?setErr(error.message):dl('camp-registrants.csv',data.map(({reg_id,...x})=>x))}
  const tiles=r&&[['Registered',r.registered],['Arrived',r.arrived],['Donated',r.donated],['Deferred',r.deferred],['No-show',r.no_show],['First-time',r.first_time],['Blood collected',(r.volume_ml/1000).toFixed(1)+' L'],['Volunteers',`${r.volunteers_present}/${r.volunteers}`]]
  return <div><PageHeader eyebrow="Admin" title="Reports" description="Camp report as A4 PDF, 80 mm receipt, and CSV exports"/>{err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="mb-4 flex flex-wrap gap-2"><select className="input w-auto" value={cid} onChange={e=>setCid(e.target.value)}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select>
      {r&&<><button className="btn" disabled={!!busy} onClick={()=>make('a4',()=>reportPdf(r,fmt,brand,profile.full_name))}><FileText size={16}/>{busy==='a4'?'Preparing…':'Download report (PDF)'}</button>
        <button className="btn-quiet" disabled={!!busy} onClick={()=>make('rc',()=>receiptPdf(r,fmt,brand))}><Receipt size={16}/>Print receipt (80 mm)</button></>}</div>
    {r&&<><div className="card mb-5"><div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">{tiles.map(([l,n])=><div key={l}><div className="text-2xl font-semibold tabular-nums text-fg"><CountUp value={n}/></div><div className="text-xs text-fog-muted">{l}</div></div>)}</div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><div key={g} className="tile py-2 text-center"><div className="font-semibold text-blood">{g}</div><div className="text-lg tabular-nums text-fg"><CountUp value={r.by_group[g]||0}/></div></div>)}</div>
      {r.by_group.Unknown>0&&<p className="mt-2 text-xs text-fog-faint">{r.by_group.Unknown} donation(s) with blood group not recorded.</p>}</div>
      <div className="card mb-5"><h2 className="mb-2 font-semibold text-fg">Money</h2><div className="text-sm text-fog">Sponsorship received Rs. {Number(r.sponsors_received).toLocaleString('en-IN')} · Expenses Rs. {Number(r.expenses).toLocaleString('en-IN')} · Balance Rs. {Number(r.sponsors_received-r.expenses).toLocaleString('en-IN')}</div></div></>}
    <div className="card"><h2 className="mb-1 font-semibold text-fg">Export to Excel (CSV)</h2><p className="mb-3 text-sm text-fog-muted">These files hold donors' personal details. Share them only with club office bearers.</p>
      <div className="flex flex-wrap gap-2"><button className="btn" onClick={donors}>All donors</button><button className="btn" disabled={!cid} onClick={regs}>Registrants of this camp</button></div></div><ClubReports brand={brand} can={can}/></div>
}
