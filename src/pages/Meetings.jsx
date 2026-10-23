import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {motion} from 'framer-motion'
import {Plus,Presentation,FileText,Download,CalendarDays,MapPin,Users,CheckCircle2,Circle,Trash2,Clock,Video,QrCode,RefreshCw,Maximize2,X} from 'lucide-react'
import {createPortal} from 'react-dom'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,Tabs,useLive,undoToast,code,errText,todayIso,useConfirm} from '../components/ui'
import {rotaryYear,attendancePdf,minutesPdf,csv,iso} from '../lib/clubReports'
import CountUp from '../components/CountUp'

const KINDS=['Weekly','Monthly','Board','General body','Special','Joint','Installation']
const ST={present:['Present','bg-ok text-white'],late:['Late','bg-brand text-white'],leave:['Leave','bg-warn text-white'],absent:['Absent','bg-blood text-white']}
const empty=()=>({kind:'Weekly',title:'Weekly meeting',meeting_date:todayIso(),start_time:'19:00',end_time:'20:00',venue:'',mode:'In person',online_link:'',chaired_by:'',minutes_by:'',chief_guest:'',guests:0,guest_names:'',agenda:'',minutes:'',decisions:'',next_meeting:'',status:'scheduled'})
const statusTone={scheduled:'blue',held:'green',cancelled:'neutral'}
const periods=()=>{const ry=rotaryYear(),d=new Date(),m0=new Date(d.getFullYear(),d.getMonth(),1),m1=new Date(d.getFullYear(),d.getMonth()+1,0),l0=new Date(d.getFullYear(),d.getMonth()-1,1),l1=new Date(d.getFullYear(),d.getMonth(),0)
  return {year:{...ry,label:`Rotary year ${ry.label}`},month:{from:iso(m0),to:iso(m1),label:m0.toLocaleDateString('en-IN',{month:'long',year:'numeric'})},last:{from:iso(l0),to:iso(l1),label:l0.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}}}

export default function Meetings(){
  const {brand}=useBrand(),confirm=useConfirm()
  const [view,setView]=useState('meetings'),[rows,setRows]=useState(null),[members,setMembers]=useState([]),[counts,setCounts]=useState({}),[actions,setActions]=useState([])
  const [form,setForm]=useState(null),[tab,setTab]=useState('details'),[att,setAtt]=useState({}),[acts,setActs]=useState([]),[busy,setBusy]=useState(false),[meta,setMeta]=useState({}),[qr,setQr]=useState(false),[newAct,setNewAct]=useState({task:'',owner_member:'',due:''})
  const [period,setPeriod]=useState('year'),[sum,setSum]=useState(null),[pdf,setPdf]=useState(''),[kind,setKind]=useState('')
  const P=periods()[period]
  const load=async()=>{try{const [m,b,a,x]=await Promise.all([supabase.from('meetings').select('*').is('deleted_at',null).order('meeting_date',{ascending:false}),
      supabase.from('members').select('id,member_no,full_name,position,joined_on,status').is('deleted_at',null).order('member_no'),
      supabase.from('meeting_attendance').select('meeting_id,status'),supabase.from('meeting_actions').select('*').order('due',{nullsFirst:false})])
    if(m.error)throw m.error;setRows(m.data);setMembers(b.data||[]);setActions(x.data||[])
    const c={};(a.data||[]).forEach(r=>{if(['present','late'].includes(r.status))c[r.meeting_id]=(c[r.meeting_id]||0)+1});setCounts(c)}catch(e){toast.error(errText(e))}}
  const loadSum=()=>supabase.rpc('attendance_summary',{p_from:P.from,p_to:P.to}).then(({data,error})=>error?toast.error(error.message):setSum(data))
  useEffect(()=>{load()},[]);useEffect(()=>{loadSum()},[period,view])
  useLive(['meetings','meeting_attendance','meeting_actions','members'],()=>{load();loadSum();if(form?.id)loadAtt(form.id)})
  const eligible=mt=>members.filter(m=>m.status==='active'&&(!m.joined_on||m.joined_on<=mt.meeting_date))
  const open=async r=>{setTab('details');setNewAct({task:'',owner_member:'',due:''})
    if(!r){setForm(empty());setAtt({});setActs([]);return}
    setForm({...empty(),...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v??''])),start_time:r.start_time?.slice(0,5)||'',end_time:r.end_time?.slice(0,5)||'',_orig:r})
    const [a,x]=await Promise.all([loadAtt(r.id),supabase.from('meeting_actions').select('*').eq('meeting_id',r.id).order('action_no')]);setActs(x.data||[])}
  const loadAtt=async id=>{const a=await supabase.from('meeting_attendance').select('member_id,status,note,self_marked').eq('meeting_id',id)
    setAtt(Object.fromEntries((a.data||[]).map(z=>[z.member_id,z.status])));setMeta(Object.fromEntries((a.data||[]).map(z=>[z.member_id,z])))}
  const newCode=async()=>{const c=String(Math.floor(Math.random()*1e6)).padStart(6,'0');const r=await supabase.from('meetings').update({checkin_code:c}).eq('id',form.id);if(r.error)return toast.error(r.error.message);setForm({...form,checkin_code:c});toast.success('New check-in code made')}
  const set=k=>e=>setForm({...form,[k]:e.target.value})
  const save=async e=>{e?.preventDefault();setBusy(true);const {id,meeting_no,created_at,created_by,deleted_at,deleted_by,_orig,...rest}=form
    const row=Object.fromEntries(Object.entries(rest).map(([k,v])=>[k,v===''?null:v]));row.guests=Number(row.guests||0)
    const r=id?await supabase.from('meetings').update(row).eq('id',id).select().single():await supabase.from('meetings').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message)
    if(id){const prev=Object.fromEntries(Object.keys(row).map(k=>[k,_orig[k]]));undoToast('Meeting saved',async()=>{const x=await supabase.from('meetings').update(prev).eq('id',id);if(x.error)throw x.error;load()})
      setForm({...form,_orig:r.data})}
    else{toast.success(`Meeting ${code('MT',r.data.meeting_no,3)} created. Mark attendance next.`);open(r.data);setTab('attendance')}
    load()}
  const mark=async(mid,s)=>{const prev=att[mid];setAtt(a=>({...a,[mid]:s}))
    const r=await supabase.from('meeting_attendance').upsert({meeting_id:form.id,member_id:mid,status:s,noted_at:new Date().toISOString()});if(r.error){setAtt(a=>({...a,[mid]:prev}));toast.error(r.error.message)}}
  const markAll=async()=>{const list=eligible(form).filter(m=>!att[m.id]);if(!list.length)return
    const r=await supabase.from('meeting_attendance').upsert(list.map(m=>({meeting_id:form.id,member_id:m.id,status:'present'})));if(r.error)return toast.error(r.error.message)
    setAtt(a=>({...a,...Object.fromEntries(list.map(m=>[m.id,'present']))}));toast.success(`${list.length} marked present`)}
  const held=async()=>{if(form.meeting_date>todayIso())return toast.error('A future meeting cannot be marked as held')
    const r=await supabase.from('meetings').update({status:'held'}).eq('id',form.id);if(r.error)return toast.error(r.error.message);setForm({...form,status:'held'});toast.success('Marked as held');load()}
  const addAct=async e=>{e.preventDefault();const r=await supabase.from('meeting_actions').insert({meeting_id:form.id,task:newAct.task,owner_member:newAct.owner_member||null,due:newAct.due||null}).select().single()
    if(r.error)return toast.error(r.error.message);setActs([...acts,r.data]);setNewAct({task:'',owner_member:'',due:''});load()}
  const toggleAct=async(a,list,setList)=>{const r=await supabase.from('meeting_actions').update({done:!a.done}).eq('id',a.id);if(r.error)return toast.error(r.error.message);setList?.(list.map(x=>x.id===a.id?{...x,done:!a.done}:x));load()}
  const delAct=async a=>{const r=await supabase.from('meeting_actions').delete().eq('id',a.id);if(r.error)return toast.error(r.error.message);setActs(acts.filter(x=>x.id!==a.id));load()
    undoToast('Action item deleted',async()=>{const {id,...x}=a;const z=await supabase.from('meeting_actions').insert({...a});if(z.error)throw z.error;open(form._orig)})}
  const remove=async()=>{const {id,title}=form;const r=await supabase.from('meetings').update({deleted_at:new Date().toISOString()}).eq('id',id);if(r.error)return toast.error(r.error.message)
    setForm(null);load();undoToast(`${title} moved to the Recycle bin`,async()=>{const x=await supabase.from('meetings').update({deleted_at:null}).eq('id',id);if(x.error)throw x.error;load()})}
  const run=async(k,f)=>{setPdf(k);try{await f()}catch(e){toast.error(errText(e))}setPdf('')}
  const byMember=useMemo(()=>Object.fromEntries(members.map(m=>[m.id,m])),[members])
  const ry=rotaryYear(),heldYear=(rows||[]).filter(r=>r.status==='held'&&r.meeting_date>=ry.from&&r.meeting_date<=ry.to)
  const next=(rows||[]).filter(r=>r.status==='scheduled'&&r.meeting_date>=todayIso()).sort((a,b)=>a.meeting_date.localeCompare(b.meeting_date))[0]
  const openActs=actions.filter(a=>!a.done),avg=sum?.members?.length?Math.round(sum.members.reduce((a,x)=>a+(x.held?x.present/x.held*100:0),0)/sum.members.length):null
  const shown=(rows||[]).filter(r=>!kind||r.kind===kind)
  const pct=x=>x.held?Math.round(x.present/x.held*100):0

  return <div>
    <PageHeader title="Meetings" description="Weekly, monthly and board meetings with attendance, minutes and action items."
      actions={<><button className="btn-quiet" disabled={!!pdf} onClick={()=>run('att',()=>attendancePdf(brand,P))}><FileText size={15}/>{pdf==='att'?'Preparing…':'Attendance PDF'}</button>
        <button className="btn" onClick={()=>open(null)}><Plus size={16}/>New meeting</button></>}/>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card py-4"><div className="text-2xl font-semibold text-fg"><CountUp value={heldYear.length}/></div><div className="text-xs text-fog-muted">Meetings held {ry.label}</div><div className="mt-1 text-[11px] text-fog-faint">{heldYear.filter(r=>r.kind==='Weekly').length} weekly · {heldYear.filter(r=>r.kind==='Monthly').length} monthly</div></div>
      <div className="card py-4"><div className="text-2xl font-semibold text-fg">{avg==null?'-':avg+'%'}</div><div className="text-xs text-fog-muted">Average attendance ({periods()[period].label})</div></div>
      <div className="card py-4"><div className="truncate text-lg font-semibold text-fg">{next?fmt(next.meeting_date):'None'}</div><div className="text-xs text-fog-muted">Next meeting</div>{next&&<div className="mt-1 truncate text-[11px] text-fog-faint">{next.title}</div>}</div>
      <div className="card py-4"><div className={`text-2xl font-semibold ${openActs.length?'text-warn':'text-fg'}`}><CountUp value={openActs.length}/></div><div className="text-xs text-fog-muted">Open action items</div>
        <div className="mt-1 text-[11px] text-fog-faint">{openActs.filter(a=>a.due&&a.due<todayIso()).length} overdue</div></div></div>
    <Tabs id="meet-tabs" value={view} onChange={setView} tabs={[['meetings','Meetings'],['register','Attendance register'],['actions','Action items']]}/>

    {view==='meetings'&&<>
      <div className="mb-3 flex flex-wrap gap-2">{['',...KINDS].map(k=><button key={k} onClick={()=>setKind(k)} className={`chip transition ${kind===k?'border-brand/50 bg-brand/15 text-fg':''}`}>{k||'All'}</button>)}</div>
      {rows===null?<div className="space-y-3">{[0,1,2].map(i=><div key={i} className="skeleton h-20"/>)}</div>
      :!shown.length?<div className="card"><Empty icon={Presentation} title="No meetings yet" action={<button className="btn" onClick={()=>open(null)}><Plus size={16}/>New meeting</button>}>Create a meeting, mark who came, and write the minutes.</Empty></div>
      :<div className="grid gap-3 lg:grid-cols-2">{shown.map((r,i)=>{const total=eligible(r).length,pres=counts[r.id]||0,d=new Date(r.meeting_date)
        return <motion.button key={r.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i,10)*.03}} onClick={()=>open(r)} className="card group flex items-stretch gap-4 p-4 text-left transition hover:border-brand/40">
          <div className={`grid w-16 shrink-0 place-items-center rounded-xl py-2 text-center ${r.status==='held'?'bg-ok/10':r.status==='cancelled'?'bg-ink-750':'bg-brand/10'}`}>
            <div><div className="text-[11px] font-semibold uppercase text-fog-muted">{d.toLocaleDateString('en-IN',{month:'short'})}</div><div className="font-display text-2xl font-semibold leading-none text-fg">{d.getDate()}</div><div className="text-[11px] text-fog-faint">{d.toLocaleDateString('en-IN',{weekday:'short'})}</div></div></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="code">{code('MT',r.meeting_no,3)}</span><Badge tone="blue">{r.kind}</Badge><Badge tone={statusTone[r.status]}>{r.status}</Badge></div>
            <div className="mt-1 truncate font-semibold text-fg">{r.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fog-muted">{r.start_time&&<span className="inline-flex items-center gap-1"><Clock size={12}/>{r.start_time.slice(0,5)}</span>}
              <span className="inline-flex items-center gap-1">{r.mode==='Online'?<Video size={12}/>:<MapPin size={12}/>}{r.mode==='Online'?'Online':r.venue||'Venue not set'}</span>
              {r.status==='held'&&<span className="inline-flex items-center gap-1"><Users size={12}/>{pres} of {total} present{r.guests?` + ${r.guests} guests`:''}</span>}</div>
            {r.status==='held'&&total>0&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-brand to-ok" style={{width:Math.round(pres/total*100)+'%'}}/></div>}</div>
        </motion.button>})}</div>}</>}

    {view==='register'&&<div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3"><select className="input w-auto" aria-label="Period" value={period} onChange={e=>setPeriod(e.target.value)}>{Object.entries(periods()).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
        <span className="text-sm text-fog-muted">{sum?`${sum.meetings.length} meetings held`:''}</span><div className="flex-1"/>
        <button className="btn-quiet" disabled={!sum} onClick={()=>csv(sum.members.map(x=>({id:code('M',x.no,3),member:x.name,position:x.position,held:x.held,present:x.present,leave:x.leave,attendance:pct(x)+'%'})),`attendance-${P.from}.csv`)}><Download size={15}/>CSV</button>
        <button className="btn-quiet" disabled={!!pdf} onClick={()=>run('att',()=>attendancePdf(brand,P))}><FileText size={15}/>PDF</button></div>
      {!sum?<div className="p-4"><div className="skeleton h-24"/></div>:!sum.members.length?<Empty icon={Users} title="No active members">Add members on the Members page first.</Empty>:
      <div className="overflow-x-auto"><table className="table table-fixed"><colgroup><col className="w-[84px]"/><col/><col className="w-[22%]"/><col className="w-[70px]"/><col className="w-[70px]"/><col className="w-[70px]"/><col className="w-[180px]"/></colgroup>
        <thead><tr><th>ID</th><th>Member</th><th>Position</th><th className="text-center">Held</th><th className="text-center">Present</th><th className="text-center">Leave</th><th>Attendance</th></tr></thead>
        <tbody>{[...sum.members].sort((a,b)=>pct(b)-pct(a)).map(x=><tr key={x.id}><td><span className="code">{code('M',x.no,3)}</span></td><td className="truncate font-medium text-fg">{x.name}</td><td className="truncate text-fog-muted">{x.position}</td>
          <td className="text-center tabular-nums">{x.held}</td><td className="text-center tabular-nums">{x.present}</td><td className="text-center tabular-nums">{x.leave}</td>
          <td><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700"><motion.div initial={{width:0}} animate={{width:pct(x)+'%'}} transition={{duration:.6}} className={`h-full rounded-full ${pct(x)>=75?'bg-ok':pct(x)>=50?'bg-warn':'bg-blood'}`}/></div><span className="w-10 text-right text-xs font-semibold tabular-nums text-fg">{pct(x)}%</span></div></td></tr>)}</tbody></table></div>}</div>}

    {view==='actions'&&<div className="card p-0">{!actions.length?<Empty icon={CheckCircle2} title="No action items">Add action items inside a meeting.</Empty>:
      <ul className="divide-y divide-ink-700/80">{[...actions].sort((a,b)=>a.done-b.done||(a.due||'9').localeCompare(b.due||'9')).map(a=>{const mt=(rows||[]).find(r=>r.id===a.meeting_id),late=!a.done&&a.due&&a.due<todayIso()
        return <li key={a.id} className="flex items-center gap-3 px-4 py-3"><button aria-label={a.done?'Mark open':'Mark done'} onClick={()=>toggleAct(a)} className={a.done?'text-ok':'text-fog-faint hover:text-fg'}>{a.done?<CheckCircle2 size={20}/>:<Circle size={20}/>}</button>
          <div className="min-w-0 flex-1"><div className={`text-sm ${a.done?'text-fog-faint line-through':'text-fg'}`}>{a.task}</div><div className="text-xs text-fog-faint">{byMember[a.owner_member]?.full_name||'No owner'} · {mt?`${code('MT',mt.meeting_no,3)} ${mt.title}`:''}</div></div>
          {a.due&&<Badge tone={late?'red':a.done?'neutral':'amber'}>{late?'Overdue ':'Due '}{fmt(a.due)}</Badge>}</li>})}</ul>}</div>}

    <Drawer open={!!form} onClose={()=>setForm(null)} width="max-w-2xl" title={form?.id?`${code('MT',form.meeting_no,3)} · ${form.title}`:'New meeting'} description={form?.id?`${form.kind} · ${fmt(form.meeting_date)} · ${form.status}`:'Fields marked * are required.'}
      footer={form&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={remove}><Trash2 size={15}/>Recycle bin</button>}
        {form.id&&<button className="btn-quiet" disabled={!!pdf} onClick={()=>run('min',()=>minutesPdf(brand,form,att,eligible(form),acts))}><FileText size={15}/>{pdf==='min'?'Preparing…':'Minutes PDF'}</button>}
        {(tab==='details'||tab==='minutes')&&<button className="btn" form="meet-form" disabled={busy}>{busy?'Saving…':form.id?'Save':'Create meeting'}</button>}</>}>
      {form&&<>{form.id&&<Tabs id="mt-tabs" value={tab} onChange={setTab} tabs={[['details','Details'],['attendance','Attendance'],['minutes','Minutes'],['actions','Actions']]}/>}
      <form id="meet-form" onSubmit={save} className={tab==='details'?'grid gap-4 sm:grid-cols-2':'hidden'}>
        <Field label="Type" required><select className="input" value={form.kind} onChange={e=>setForm({...form,kind:e.target.value,title:form.title===`${form.kind} meeting`||!form.title?`${e.target.value} meeting`:form.title})}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></Field>
        <Field label="Status" required><select className="input" value={form.status} onChange={set('status')}><option value="scheduled">Scheduled</option><option value="held">Held</option><option value="cancelled">Cancelled</option></select></Field>
        <Field label="Title" required className="sm:col-span-2"><input className="input" required minLength={3} value={form.title} onChange={set('title')}/></Field>
        <Field label="Date" required><input type="date" className="input" required value={form.meeting_date} onChange={set('meeting_date')}/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Start"><input type="time" className="input" value={form.start_time} onChange={set('start_time')}/></Field><Field label="End"><input type="time" className="input" value={form.end_time} onChange={set('end_time')}/></Field></div>
        <Field label="Mode"><select className="input" value={form.mode} onChange={set('mode')}><option>In person</option><option>Online</option><option>Hybrid</option></select></Field>
        {form.mode!=='Online'?<Field label="Venue" required><input className="input" required value={form.venue} onChange={set('venue')}/></Field>:<Field label="Meeting link"><input className="input" type="url" value={form.online_link} onChange={set('online_link')}/></Field>}
        <Field label="Chaired by"><input className="input" list="mem-names" value={form.chaired_by} onChange={set('chaired_by')}/></Field>
        <Field label="Minutes recorded by"><input className="input" list="mem-names" value={form.minutes_by} onChange={set('minutes_by')}/></Field>
        <Field label="Chief guest"><input className="input" value={form.chief_guest} onChange={set('chief_guest')}/></Field>
        <Field label="Guests (number)"><input className="input" type="number" min="0" value={form.guests} onChange={set('guests')}/></Field>
        <Field label="Guest names" className="sm:col-span-2"><input className="input" value={form.guest_names} onChange={set('guest_names')}/></Field>
        <Field label="Agenda" className="sm:col-span-2"><textarea className="input min-h-[90px]" value={form.agenda} onChange={set('agenda')} placeholder={'1. Welcome\n2. Last meeting minutes\n3. Blood donation camp update'}/></Field>
        <Field label="Next meeting"><input type="date" className="input" value={form.next_meeting} onChange={set('next_meeting')}/></Field>
        <datalist id="mem-names">{members.map(m=><option key={m.id} value={m.full_name}/>)}</datalist>
      </form>
      {tab==='minutes'&&<div className="grid gap-4">
        <Field label="Minutes" hint="What was discussed"><textarea form="meet-form" className="input min-h-[200px]" value={form.minutes} onChange={set('minutes')}/></Field>
        <Field label="Decisions"><textarea form="meet-form" className="input min-h-[100px]" value={form.decisions} onChange={set('decisions')}/></Field></div>}
      {tab==='attendance'&&<div>
        {form.status!=='cancelled'&&<div className="tile mb-4 flex flex-wrap items-center gap-3 p-3"><QrCode size={20} className="text-brand"/>
          <div className="flex-1"><div className="text-xs text-fog-muted">Members check in themselves with this code</div><div className="font-mono text-2xl font-bold tracking-[.3em] text-fg">{form.checkin_code||'------'}</div></div>
          <button className="btn-quiet" onClick={newCode}><RefreshCw size={14}/>New code</button><button className="btn" onClick={()=>setQr(true)}><Maximize2 size={15}/>Show QR on screen</button></div>}
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm text-fog-muted">{Object.values(att).filter(s=>['present','late'].includes(s)).length} of {eligible(form).length} present</span><div className="flex-1"/>
          <button className="btn-quiet" onClick={markAll}>Mark the rest present</button>{form.status!=='held'&&<button className="btn" onClick={held}>Mark meeting as held</button>}</div>
        {!eligible(form).length?<Empty icon={Users} title="No active members">Add members on the Members page.</Empty>:
        <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">{eligible(form).map(m=><li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="code">{code('M',m.member_no,3)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-fg">{m.full_name}</span><span className="block truncate text-xs text-fog-faint">{m.position}{meta[m.id]?.self_marked&&<span className="ml-1.5 text-brand">· {att[m.id]==='leave'?'applied leave':'checked in self'}</span>}{meta[m.id]?.note&&<span className="ml-1 text-warn">· {meta[m.id].note}</span>}</span></span>
          <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${m.full_name}`}>{Object.entries(ST).map(([k,[l,c]])=><button key={k} role="radio" aria-checked={att[m.id]===k} onClick={()=>mark(m.id,k)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${att[m.id]===k?c:'bg-ink-750 text-fog-muted hover:text-fg'}`}>{l}</button>)}</div></li>)}</ul>}</div>}
      {tab==='actions'&&<div>
        <form onSubmit={addAct} className="tile mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_160px_140px_auto]">
          <input className="input" required minLength={2} placeholder="Action item" aria-label="Action item" value={newAct.task} onChange={e=>setNewAct({...newAct,task:e.target.value})}/>
          <select className="input" aria-label="Owner" value={newAct.owner_member} onChange={e=>setNewAct({...newAct,owner_member:e.target.value})}><option value="">Owner</option>{members.filter(m=>m.status==='active').map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
          <input className="input" type="date" aria-label="Due" value={newAct.due} onChange={e=>setNewAct({...newAct,due:e.target.value})}/><button className="btn"><Plus size={15}/>Add</button></form>
        <ul className="space-y-1">{acts.map(a=><li key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-750">
          <button aria-label={a.done?'Mark open':'Mark done'} onClick={()=>toggleAct(a,acts,setActs)} className={a.done?'text-ok':'text-fog-faint hover:text-fg'}>{a.done?<CheckCircle2 size={19}/>:<Circle size={19}/>}</button>
          <span className={`flex-1 text-sm ${a.done?'text-fog-faint line-through':'text-fg'}`}>{a.task}<span className="block text-xs text-fog-faint">{byMember[a.owner_member]?.full_name||'No owner'}{a.due?` · due ${fmt(a.due)}`:''}</span></span>
          <button className="btn-ghost text-blood" aria-label="Delete action" onClick={()=>delAct(a)}><Trash2 size={14}/></button></li>)}
          {!acts.length&&<li className="text-sm text-fog-faint">No action items yet.</li>}</ul></div>}
      </>}
    </Drawer>
    {qr&&form&&<QrScreen meeting={form} present={Object.values(att).filter(s=>['present','late'].includes(s)).length} total={eligible(form).length} onClose={()=>setQr(false)}/>}
  </div>
}

// Full-screen QR for the projector or a phone held up at the meeting
function QrScreen({meeting,present,total,onClose}){
  const [src,setSrc]=useState('')
  const url=`${location.origin}${location.pathname}#/checkin/${meeting.id}?c=${meeting.checkin_code}`
  useEffect(()=>{import('qrcode').then(Q=>Q.toDataURL(url,{margin:1,width:520,color:{dark:'#0B1324',light:'#ffffff'}})).then(setSrc)},[url])
  useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[onClose])
  return createPortal(<motion.div initial={{opacity:0}} animate={{opacity:1}} className="fixed inset-0 z-[70] grid place-items-center bg-[#081224]/95 p-6 text-center backdrop-blur" role="dialog" aria-label="Check-in QR">
    <button className="btn-ghost absolute right-4 top-4 text-white/70" aria-label="Close" onClick={onClose}><X size={22}/></button>
    <div><div className="text-sm font-semibold uppercase tracking-[.2em] text-brand-soft">Scan to mark attendance</div>
      <h2 className="mt-2 font-display text-3xl font-semibold text-white">{meeting.title}</h2>
      <motion.div initial={{scale:.9}} animate={{scale:1}} transition={{type:'spring',stiffness:200,damping:18}} className="mx-auto mt-6 w-fit rounded-3xl bg-white p-4 shadow-[0_30px_80px_-20px_rgba(76,141,255,.6)]">{src?<img src={src} alt="Check-in QR code" className="h-[min(60vh,420px)] w-[min(60vh,420px)]"/>:<div className="h-[320px] w-[320px]"/>}</motion.div>
      <div className="mt-6 text-white/60">or open the CRM and type the code</div>
      <div className="mt-1 font-mono text-5xl font-bold tracking-[.35em] text-white">{meeting.checkin_code}</div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-ok"/><b className="tabular-nums">{present}</b> of {total} checked in</div></div>
  </motion.div>,document.body)
}
