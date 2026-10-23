import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {motion} from 'framer-motion'
import {Plus,FolderHeart,Clock,Users,IndianRupee,FileText,Check,Trash2,Trophy,CalendarDays,MapPin,Handshake} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Tabs,Badge,Empty,useLive,undoToast,code,errText,todayIso,useConfirm} from '../components/ui'
import {rotaryYear,projectsPdf,hoursPdf} from '../lib/clubReports'
import {rs} from '../lib/docpdf'
import CountUp from '../components/CountUp'

export const AVENUES=[['Club service','#7C5CFF'],['Community service','#0EA5A4'],['Professional development','#2F6FED'],['International service','#D97706'],['Blood donation','#E11D48'],['Public image','#DB2777'],['Other','#64748B']]
const COLOR=Object.fromEntries(AVENUES)
const ST={planned:['Planned','blue'],ongoing:['Ongoing','amber'],completed:['Completed','green'],cancelled:['Cancelled','neutral']}
const empty=()=>({title:'',avenue:'Community service',status:'planned',start_date:todayIso(),end_date:'',venue:'',partner:'',lead_member:'',beneficiaries:'',budget:'',spent:'',description:'',outcome:'',photo_links:''})

function Hours({project,members,onChange}){
  const confirm=useConfirm(),[rows,setRows]=useState(null),[f,setF]=useState({member_id:'',work_date:todayIso(),hours:'2',role:''})
  const load=()=>supabase.from('project_hours').select('*').eq('project_id',project.id).order('work_date',{ascending:false}).then(({data})=>setRows(data||[]))
  useEffect(()=>{load()},[project.id])
  const add=async e=>{e.preventDefault();const r=await supabase.from('project_hours').insert({...f,hours:Number(f.hours),project_id:project.id,role:f.role||null});if(r.error)return toast.error(r.error.message);setF({...f,member_id:''});load();onChange()}
  const addAll=async()=>{const ids=members.filter(m=>m.status==='active').map(m=>m.id);if(!await confirm({title:`Add ${f.hours} hours for ${ids.length} active members?`,body:'Use this when the whole club took part. Remove anyone who did not come.',action:'Add hours',danger:false}))return
    const r=await supabase.from('project_hours').insert(ids.map(id=>({member_id:id,project_id:project.id,work_date:f.work_date,hours:Number(f.hours),role:f.role||null})));if(r.error)return toast.error(r.error.message);load();onChange()}
  const del=async h=>{const r=await supabase.from('project_hours').delete().eq('id',h.id);if(r.error)return toast.error(r.error.message);load();onChange()
    undoToast('Hours removed',async()=>{const x=await supabase.from('project_hours').insert(h);if(x.error)throw x.error;load();onChange()})}
  const name=id=>members.find(m=>m.id===id)?.full_name||'-',total=(rows||[]).filter(h=>h.approved).reduce((a,h)=>a+Number(h.hours),0)
  return <div className="space-y-4">
    <form onSubmit={add} className="tile grid gap-2 p-3 sm:grid-cols-[1fr_130px_80px_1fr_auto] sm:items-end">
      <Field label="Member"><select className="input" required value={f.member_id} onChange={e=>setF({...f,member_id:e.target.value})}><option value="">Choose</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
      <Field label="Date"><input type="date" className="input" required max={todayIso()} value={f.work_date} onChange={e=>setF({...f,work_date:e.target.value})}/></Field>
      <Field label="Hours"><input type="number" className="input" required min="0.5" max="24" step="0.5" value={f.hours} onChange={e=>setF({...f,hours:e.target.value})}/></Field>
      <Field label="Role"><input className="input" placeholder="Volunteer" value={f.role} onChange={e=>setF({...f,role:e.target.value})}/></Field>
      <button className="btn"><Plus size={15}/>Add</button></form>
    <div className="flex items-center gap-2 text-sm"><span className="flex-1 text-fog-muted"><b className="text-fg">{total}</b> approved hours by {new Set((rows||[]).map(h=>h.member_id)).size} members</span><button className="btn-quiet px-3 py-1 text-xs" onClick={addAll}><Users size={13}/>Everyone took part</button></div>
    <ul className="divide-y divide-ink-700/80">{(rows||[]).map(h=><li key={h.id} className="flex items-center gap-3 py-2 text-sm"><span className="flex-1 text-fg">{name(h.member_id)}<span className="block text-xs text-fog-faint">{fmt(h.work_date)}{h.role?` · ${h.role}`:''}{h.self_logged?' · logged by member':''}</span></span>
      {!h.approved&&<Badge tone="amber">Waiting</Badge>}<span className="w-12 text-right font-semibold tabular-nums text-fg">{Number(h.hours)} h</span>
      <button className="btn-ghost text-fog-faint hover:text-blood" aria-label="Remove hours" onClick={()=>del(h)}><Trash2 size={14}/></button></li>)}</ul></div>
}

function Volunteers({members}){
  const {brand}=useBrand(),ry=rotaryYear(),[rows,setRows]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('project_hours').select('*,projects(title)').gte('work_date',ry.from).lte('work_date',ry.to).order('work_date',{ascending:false}).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[]);useLive(['project_hours'],load)
  const pending=(rows||[]).filter(h=>!h.approved)
  const board=useMemo(()=>members.map(m=>({...m,hours:(rows||[]).filter(h=>h.member_id===m.id&&h.approved).reduce((a,h)=>a+Number(h.hours),0)})).filter(m=>m.hours>0).sort((a,b)=>b.hours-a.hours),[rows,members])
  const decide=async(h,ok)=>{const r=ok?await supabase.from('project_hours').update({approved:true}).eq('id',h.id):await supabase.from('project_hours').delete().eq('id',h.id);if(r.error)return toast.error(r.error.message);load()}
  const max=board[0]?.hours||1,name=id=>members.find(m=>m.id===id)?.full_name||'-'
  return <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
    <section className="card"><div className="mb-4 flex items-center gap-2"><Trophy size={18} className="text-warn"/><h3 className="flex-1 font-semibold text-fg">Service hours {ry.label}</h3>
      <button className="btn-quiet" disabled={busy} onClick={async()=>{setBusy(true);try{await hoursPdf(brand,ry)}catch(e){toast.error(errText(e))}setBusy(false)}}><FileText size={15}/>PDF</button></div>
      {!board.length?<Empty icon={Clock} title="No hours yet">Add hours on a project, or members log their own from My club.</Empty>:
      <ol className="space-y-2.5">{board.map((m,i)=><li key={m.id} className="flex items-center gap-3">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i===0?'bg-warn text-white':i<3?'bg-brand/20 text-brand':'bg-ink-700 text-fog-muted'}`}>{i+1}</span>
        <div className="min-w-0 flex-1"><div className="flex justify-between text-sm"><span className="truncate text-fg">{m.full_name}</span><b className="tabular-nums text-fg">{m.hours} h</b></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700"><motion.div initial={{width:0}} animate={{width:`${m.hours/max*100}%`}} transition={{delay:i*.04}} className="h-full rounded-full bg-gradient-to-r from-brand to-ok"/></div></div></li>)}</ol>}</section>
    <section className="card"><h3 className="mb-3 font-semibold text-fg">Logged by members, to approve</h3>
      {!pending.length?<p className="text-sm text-fog-faint">Nothing waiting.</p>:<ul className="divide-y divide-ink-700/80">{pending.map(h=><li key={h.id} className="flex items-center gap-2 py-2 text-sm">
        <span className="min-w-0 flex-1"><span className="text-fg">{name(h.member_id)}</span> · <b>{Number(h.hours)} h</b><span className="block truncate text-xs text-fog-faint">{fmt(h.work_date)} · {h.projects?.title||'No project'}{h.role?` · ${h.role}`:''}{h.notes?` · ${h.notes}`:''}</span></span>
        <button className="btn px-2.5 py-1 text-xs" onClick={()=>decide(h,true)}><Check size={13}/>Approve</button><button className="btn-ghost text-fog-faint hover:text-blood" aria-label="Reject" onClick={()=>decide(h,false)}><Trash2 size={14}/></button></li>)}</ul>}</section>
  </div>
}

export default function Projects(){
  const {brand}=useBrand(),ry=rotaryYear()
  const [tab,setTab]=useState('projects'),[rows,setRows]=useState(null),[hours,setHours]=useState([]),[members,setMembers]=useState([]),[f,setF]=useState(''),[av,setAv]=useState(''),[form,setForm]=useState(null),[dtab,setDtab]=useState('details'),[busy,setBusy]=useState(false)
  const load=async()=>{const [p,h]=await Promise.all([supabase.from('projects').select('*').is('deleted_at',null).order('start_date',{ascending:false,nullsFirst:false}),supabase.from('project_hours').select('project_id,hours,member_id').eq('approved',true)])
    if(p.error)return toast.error(p.error.message);setRows(p.data);setHours(h.data||[])}
  useEffect(()=>{load();supabase.from('members').select('id,full_name,status,position').is('deleted_at',null).order('full_name').then(({data})=>setMembers(data||[]))},[])
  useLive(['projects','project_hours'],load)
  const hrs=id=>hours.filter(h=>h.project_id===id).reduce((a,h)=>a+Number(h.hours),0)
  const list=(rows||[]).filter(p=>(!f||p.status===f)&&(!av||p.avenue===av))
  const inYear=(rows||[]).filter(p=>p.start_date>=ry.from&&p.start_date<=ry.to)
  const open=p=>{setDtab('details');setForm(p?{...empty(),...Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v??''])),_orig:p}:empty())}
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true);const {id,project_no,created_at,created_by,deleted_at,deleted_by,_orig,...rest}=form
    const row=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v===''?null:v]))
    const r=id?await supabase.from('projects').update(row).eq('id',id).select().single():await supabase.from('projects').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message);toast.success(id?'Project saved':`Project ${code('P',r.data.project_no,3)} added`);if(!id){setForm({...form,...Object.fromEntries(Object.entries(r.data).map(([k,v])=>[k,v??''])),_orig:r.data});setDtab('hours')}else setForm(null);load()}
  const remove=async()=>{const r=await supabase.from('projects').update({deleted_at:new Date().toISOString()}).eq('id',form.id);if(r.error)return toast.error(r.error.message);const id=form.id;setForm(null);load()
    undoToast('Project moved to the Recycle bin',async()=>{const x=await supabase.from('projects').update({deleted_at:null}).eq('id',id);if(x.error)throw x.error;load()})}
  return <div>
    <PageHeader title="Service projects" description={rows?`${inYear.length} project${inYear.length===1?'':'s'} in ${ry.label} · ${inYear.reduce((a,p)=>a+(p.beneficiaries||0),0)} people helped`:'Loading'}
      actions={<><button className="btn-quiet" onClick={()=>projectsPdf(brand,ry).catch(e=>toast.error(errText(e)))}><FileText size={15}/>Projects report</button><button className="btn" onClick={()=>open(null)}><Plus size={16}/>New project</button></>}/>
    <Tabs id="proj-tabs" value={tab} onChange={setTab} tabs={[['projects','Projects'],['hours','Volunteer hours']]}/>
    {tab==='hours'?<Volunteers members={members}/>:<>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Projects this year',inYear.length,FolderHeart],['Completed',inYear.filter(p=>p.status==='completed').length,Check],['People helped',inYear.reduce((a,p)=>a+(p.beneficiaries||0),0),Users],['Service hours',hours.reduce((a,h)=>a+Number(h.hours),0),Clock]].map(([l,v,I])=>
        <div key={l} className="card flex items-center gap-3 py-4"><I size={20} className="text-brand"/><div><div className="text-2xl font-semibold tabular-nums text-fg"><CountUp value={v}/></div><div className="text-xs text-fog-muted">{l}</div></div></div>)}</div>
      <div className="mb-4 flex flex-wrap gap-2">{[['','All'],...Object.entries(ST).map(([k,[l]])=>[k,l])].map(([k,l])=><button key={k} onClick={()=>setF(k)} className={`chip ${f===k?'border-brand/50 bg-brand/15 text-fg':''}`}>{l}</button>)}
        <select className="input ml-auto w-auto" aria-label="Avenue" value={av} onChange={e=>setAv(e.target.value)}><option value="">All avenues</option>{AVENUES.map(([a])=><option key={a}>{a}</option>)}</select></div>
      {rows&&!list.length?<div className="card"><Empty icon={FolderHeart} title={rows.length?'No projects match':'No projects yet'} action={!rows.length&&<button className="btn" onClick={()=>open(null)}><Plus size={16}/>New project</button>}>Record every service project: tree planting, school visits, health camps, awareness drives. They go into the monthly report for the district.</Empty></div>:
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(rows===null?[0,1,2]:list).map((p,i)=>rows===null?<div key={i} className="skeleton h-40"/>:
        <motion.button key={p.id} layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i,9)*.03}} onClick={()=>open(p)} className="card relative overflow-hidden p-0 text-left transition hover:-translate-y-0.5 hover:border-ink-500">
          <div className="h-1.5" style={{background:COLOR[p.avenue]}}/>
          <div className="p-4"><div className="flex items-center gap-2"><span className="code">{code('P',p.project_no,3)}</span><span className="text-xs font-semibold" style={{color:COLOR[p.avenue]}}>{p.avenue}</span><span className="ml-auto"><Badge tone={ST[p.status][1]}>{ST[p.status][0]}</Badge></span></div>
            <div className="mt-2 font-display text-lg font-semibold leading-snug text-fg">{p.title}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fog-muted">{p.start_date&&<span><CalendarDays size={12} className="mr-1 inline"/>{fmt(p.start_date)}</span>}{p.venue&&<span><MapPin size={12} className="mr-1 inline"/>{p.venue}</span>}{p.partner&&<span><Handshake size={12} className="mr-1 inline"/>{p.partner}</span>}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-700 pt-3 text-center text-xs text-fog-muted"><div><b className="block text-base text-fg">{p.beneficiaries??'-'}</b>helped</div><div><b className="block text-base text-fg">{hrs(p.id)||'-'}</b>hours</div><div><b className="block text-base text-fg">{p.spent?rs(p.spent):'-'}</b>spent</div></div></div>
        </motion.button>)}</div>}</>}

    <Drawer open={!!form} onClose={()=>setForm(null)} width="max-w-2xl" title={form?.id?`${code('P',form.project_no,3)} · ${form.title}`:'New project'} description="Fields marked * are required."
      footer={form&&dtab==='details'&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Recycle bin</button>}<button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="project-form" disabled={busy}>{busy?'Saving…':form.id?'Save changes':'Add project'}</button></>}>
      {form&&<>{form.id&&<Tabs id="pd-tabs" value={dtab} onChange={setDtab} tabs={[['details','Details'],['hours','Volunteers and hours']]}/>}
        {dtab==='details'&&<form id="project-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" required className="sm:col-span-2"><input className="input" required minLength={3} value={form.title} onChange={set('title')}/></Field>
          <Field label="Avenue" required><select className="input" value={form.avenue} onChange={set('avenue')}>{AVENUES.map(([a])=><option key={a}>{a}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={set('status')}>{Object.entries(ST).map(([k,[l]])=><option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Start date"><input type="date" className="input" value={form.start_date} onChange={set('start_date')}/></Field>
          <Field label="End date"><input type="date" className="input" min={form.start_date||undefined} value={form.end_date} onChange={set('end_date')}/></Field>
          <Field label="Venue"><input className="input" value={form.venue} onChange={set('venue')}/></Field>
          <Field label="Partner" hint="School, NGO, hospital, Rotary club"><input className="input" value={form.partner} onChange={set('partner')}/></Field>
          <Field label="Project lead"><select className="input" value={form.lead_member} onChange={set('lead_member')}><option value="">Choose</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
          <Field label="People helped"><input type="number" min="0" className="input" value={form.beneficiaries} onChange={set('beneficiaries')}/></Field>
          <Field label="Budget (Rs.)"><input type="number" min="0" className="input" value={form.budget} onChange={set('budget')}/></Field>
          <Field label="Spent (Rs.)"><input type="number" min="0" className="input" value={form.spent} onChange={set('spent')}/></Field>
          <Field label="What is the project" className="sm:col-span-2"><textarea className="input min-h-[70px]" value={form.description} onChange={set('description')}/></Field>
          <Field label="What came out of it" hint="Goes into the reports" className="sm:col-span-2"><textarea className="input min-h-[70px]" value={form.outcome} onChange={set('outcome')}/></Field>
          <Field label="Photo album link" hint="Google Photos or Drive folder" className="sm:col-span-2"><input className="input" type="url" placeholder="https://" value={form.photo_links} onChange={set('photo_links')}/></Field>
        </form>}
        {dtab==='hours'&&form.id&&<Hours project={form} members={members} onChange={load}/>}</>}
    </Drawer>
  </div>
}
