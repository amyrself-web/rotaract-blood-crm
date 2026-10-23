import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Send,Trash2,Pencil,ClipboardList} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {normPhone,fmt,wa} from '../lib/util'
import {PageHeader,Drawer,Field,Tabs,Badge,Empty,useLive,undoToast,code} from '../components/ui'

const DESKS=['Registration','Screening','Donation','Refreshment','Certificate','Crowd control']
const CATS=['Refreshments','Printing','Banners','Transport','Sound system','Certificates','Other']
const CHECK=['Permission letter obtained','Partner blood bank confirmed','Doctors and nurses confirmed','Poster and banners printed','Registration QR shared','Refreshments arranged','Volunteers briefed','Certificates printed','Sound system and seating arranged','Medical equipment checked']
const inr=n=>'Rs. '+Number(n||0).toLocaleString('en-IN'),sum=(a,k)=>a.reduce((s,x)=>s+Number(x[k]||0),0)
const NAME={tasks:'task',camp_volunteers:'volunteer',sponsors:'sponsor',expenses:'expense'}

function Editor({item,close,save,remove}){
  const [f,setF]=useState(item.row),set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}),t=item.table
  return <Drawer open onClose={close} title={`Edit ${NAME[t]}`}
    footer={<><button className="btn-quiet mr-auto text-blood" onClick={()=>remove(t,item.row)}><Trash2 size={15}/>Delete</button><button className="btn-quiet" onClick={close}>Cancel</button>
      <button className="btn" form="plan-edit">Save changes</button></>}>
    <form id="plan-edit" onSubmit={e=>{e.preventDefault();save(t,f,item.row)}} className="space-y-4">
      {t==='tasks'&&<><Field label="Task" required><input className="input" required value={f.title} onChange={set('title')}/></Field><Field label="Assigned to" required><input required className="input" value={f.assignee||''} onChange={set('assignee')}/></Field>
        <Field label="Due" required><input required type="date" className="input" value={f.due||''} onChange={set('due')}/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.done} onChange={set('done')}/>Done</label></>}
      {t==='camp_volunteers'&&<><Field label="Name" required><input className="input" required value={f.name} onChange={set('name')}/></Field><Field label="Mobile" required><input required className="input" value={f.phone||''} onChange={set('phone')}/></Field>
        <Field label="Desk" required><select required className="input" value={f.desk||''} onChange={set('desk')}><option value="">Not set</option>{DESKS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Shift" required><input required className="input" value={f.shift||''} onChange={set('shift')}/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.attended} onChange={set('attended')}/>Present at the camp</label></>}
      {t==='sponsors'&&<><Field label="Sponsor" required><input className="input" required value={f.name} onChange={set('name')}/></Field><Field label="Amount (Rs.)" required><input required type="number" min="0" className="input" value={f.amount} onChange={set('amount')}/></Field>
        <Field label="Notes"><input className="input" value={f.notes||''} onChange={set('notes')}/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.received} onChange={set('received')}/>Money received</label></>}
      {t==='expenses'&&<><Field label="Category" required><select required className="input" value={f.category} onChange={set('category')}>{CATS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Details" required><input required className="input" value={f.description||''} onChange={set('description')}/></Field><Field label="Amount (Rs.)" required><input required type="number" min="0" className="input" value={f.amount} onChange={set('amount')}/></Field>
        <Field label="Spent on" required><input required type="date" className="input" value={f.spent_on||''} onChange={set('spent_on')}/></Field></>}
    </form></Drawer>
}

export default function Planning(){
  const {settings}=useAuth(),today=new Date().toLocaleDateString('en-CA')
  const [camps,setCamps]=useState(null),[cid,setCid]=useState(''),[tab,setTab]=useState('tasks'),[d,setD]=useState({tasks:[],camp_volunteers:[],sponsors:[],expenses:[]}),[f,setF]=useState({}),[edit,setEdit]=useState(null)
  useEffect(()=>{supabase.from('camps').select('*').is('deleted_at',null).order('camp_date',{ascending:false}).then(({data})=>{setCamps(data||[]);if(data?.length)setCid((data.filter(c=>c.camp_date>=today).pop()||data[0]).id)})},[])
  const load=async()=>{if(!cid)return;const o={};for(const t of ['tasks','camp_volunteers','sponsors','expenses']){const r=await supabase.from(t).select('*').eq('camp_id',cid).order('created_at');if(r.error)return toast.error(r.error.message);o[t]=r.data}setD(o)}
  useEffect(()=>{load()},[cid])
  useLive(['tasks','camp_volunteers','sponsors','expenses'],load)
  const run=async(p,msg)=>{const {error}=await p;if(error){toast.error(error.message);return false}if(msg)toast.success(msg);load();return true}
  const add=(t,row,msg)=>{run(supabase.from(t).insert(Array.isArray(row)?row.map(x=>({...x,camp_id:cid})):{...row,camp_id:cid}),msg);setF({})}
  const upd=(t,id,p)=>{setD(o=>({...o,[t]:o[t].map(x=>x.id===id?{...x,...p}:x)}));run(supabase.from(t).update(p).eq('id',id))}
  const save=async(t,row,orig)=>{const {id,camp_id,created_at,...p}=row;const clean=Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v===''?null:v]))
    if((t==='tasks'&&!clean.title?.trim())||(t!=='tasks'&&t!=='expenses'&&!clean.name?.trim()))return toast.error('Fill in the required fields')
    if('amount' in clean&&(clean.amount===null||Number(clean.amount)<0))return toast.error('Enter an amount of 0 or more')
    if(t==='camp_volunteers'&&clean.phone){clean.phone=normPhone(clean.phone);if(!/^[6-9]\d{9}$/.test(clean.phone))return toast.error('Enter a valid 10-digit mobile number')}
    const prev=Object.fromEntries(Object.keys(clean).map(k=>[k,orig[k]]))
    if(await run(supabase.from(t).update(clean).eq('id',id))){setEdit(null);undoToast('Saved',async()=>{const r=await supabase.from(t).update(prev).eq('id',id);if(r.error)throw r.error;load()})}}
  const remove=async(t,row)=>{if(await run(supabase.from(t).delete().eq('id',row.id))){setEdit(null)
    undoToast(`${NAME[t][0].toUpperCase()+NAME[t].slice(1)} deleted`,async()=>{const r=await supabase.from(t).insert(row);if(r.error)throw r.error;load()})}}
  const camp=camps?.find(c=>c.id===cid),set=k=>e=>setF({...f,[k]:e.target.value}),v=k=>f[k]||''
  const spent=sum(d.expenses,'amount'),got=sum(d.sponsors.filter(s=>s.received),'amount'),done=d.tasks.filter(t=>t.done).length
  const EditBtn=({t,row})=><button className="btn-ghost ml-auto" aria-label={`Edit ${NAME[t]}`} onClick={()=>setEdit({table:t,row})}><Pencil size={15}/></button>
  if(camps&&!camps.length)return <div><PageHeader title="Camp planning"/><div className="card"><Empty icon={ClipboardList} title="Create a camp first">Planning is kept per camp.</Empty></div></div>
  return <div>
    <PageHeader title="Camp planning" description="Checklist, volunteers and money for one camp."
      actions={camps&&<select aria-label="Camp" className="input w-auto" value={cid} onChange={e=>setCid(e.target.value)}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select>}/>
    <Tabs id="plan-tabs" value={tab} onChange={k=>{setTab(k);setF({})}} tabs={[['tasks',`Checklist ${done}/${d.tasks.length}`],['camp_volunteers',`Volunteers ${d.camp_volunteers.length}`],['money','Money']]}/>
    {tab==='tasks'&&<div className="card"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex-1"><div className="text-sm text-fog-muted">{done} of {d.tasks.length} done</div>
        <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-ok transition-all duration-500" style={{width:(d.tasks.length?done/d.tasks.length*100:0)+'%'}}/></div></div>
        {!d.tasks.length&&<button className="btn" onClick={()=>add('tasks',CHECK.map(title=>({title})),'Checklist added')}>Add standard checklist</button>}</div>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('tasks',{title:f.title,assignee:f.assignee||null,due:f.due||null})}}>
        <input className="input w-64" placeholder="New task" required value={v('title')} onChange={set('title')}/><input className="input w-40" placeholder="Assigned to" required value={v('assignee')} onChange={set('assignee')}/>
        <input type="date" className="input w-auto" aria-label="Due date" required value={v('due')} onChange={set('due')}/><button className="btn">Add</button></form>
      {d.tasks.map(t=><div key={t.id} className="flex items-center gap-3 border-t border-ink-700 py-2.5 text-sm"><input type="checkbox" aria-label={t.title} checked={t.done} onChange={e=>upd('tasks',t.id,{done:e.target.checked})}/>
        <span className={t.done?'text-fog-faint line-through':'text-fg'}>{t.title}</span><span className="text-fog-faint">{t.assignee}</span>
        {t.due&&<Badge tone={!t.done&&t.due<=today?'amber':'neutral'}>{fmt(t.due)}</Badge>}<EditBtn t="tasks" row={t}/></div>)}</div>}
    {tab==='camp_volunteers'&&<div className="card"><form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('camp_volunteers',{name:f.name,phone:normPhone(f.phone)||null,desk:f.desk||null,shift:f.shift||null})}}>
        <input className="input w-44" placeholder="Name" required value={v('name')} onChange={set('name')}/><input className="input w-36" placeholder="Mobile" required pattern="[6-9][0-9]{9}" title="10-digit mobile" value={v('phone')} onChange={set('phone')}/>
        <select className="input w-auto" aria-label="Desk" required value={v('desk')} onChange={set('desk')}><option value="">Desk</option>{DESKS.map(x=><option key={x}>{x}</option>)}</select>
        <input className="input w-36" placeholder="Shift, e.g. 8 to 12" required value={v('shift')} onChange={set('shift')}/><button className="btn">Add</button></form>
      {d.camp_volunteers.map(x=><div key={x.id} className="flex flex-wrap items-center gap-3 border-t border-ink-700 py-2.5 text-sm"><input type="checkbox" title="Present" checked={x.attended} onChange={e=>upd('camp_volunteers',x.id,{attended:e.target.checked})}/>
        <span className="code">{code('V',x.volunteer_no,3)}</span><span className="font-medium text-fg">{x.name}</span>{x.desk&&<Badge tone="blue">{x.desk}</Badge>}<span className="text-fog-faint">{x.shift}</span>
        {x.phone&&<a className="btn-quiet px-3 py-1 text-xs" target="_blank" rel="noreferrer" href={wa(x.phone,`Hello ${x.name}, your duty for ${camp?.name} on ${fmt(camp?.camp_date)}: ${x.desk||'to be told'}${x.shift?', shift '+x.shift:''}${camp?.venue?', venue '+camp.venue:''}. Thank you for volunteering. ${settings.club_name}`)}><Send size={13}/>Duty slip</a>}
        <EditBtn t="camp_volunteers" row={x}/></div>)}
      {!d.camp_volunteers.length&&<p className="text-sm text-fog-faint">No volunteers added yet. Tick the box when a volunteer arrives.</p>}</div>}
    {tab==='money'&&<div className="space-y-4"><div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><input className="input" type="number" min="0" placeholder="Budget" key={cid} defaultValue={camp?.budget??''} onBlur={async e=>{const b=e.target.value===''?null:Number(e.target.value);const {error}=await supabase.from('camps').update({budget:b}).eq('id',cid);error?toast.error(error.message):setCamps(cs=>cs.map(c=>c.id===cid?{...c,budget:b}:c))}}/><div className="mt-1 text-xs text-fog-faint">Budget (Rs.)</div></div>
        {[['Sponsorship received',inr(got)],['Expenses',inr(spent)],['Balance',inr(got-spent)]].map(([l,n])=><div key={l}><div className={`font-display text-xl font-semibold ${l==='Balance'&&got-spent<0?'text-blood':'text-fg'}`}>{n}</div><div className="text-xs text-fog-faint">{l}</div></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
      <div className="card"><h2 className="mb-3 font-semibold text-fg">Sponsors</h2><form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('sponsors',{name:f.sname,amount:Number(f.samt||0)})}}>
          <input className="input flex-1" placeholder="Sponsor name" required value={v('sname')} onChange={set('sname')}/><input className="input w-28" type="number" min="0" placeholder="Amount" required min="1" value={v('samt')} onChange={set('samt')}/><button className="btn">Add</button></form>
        {d.sponsors.map(s=><div key={s.id} className="flex items-center gap-3 border-t border-ink-700 py-2.5 text-sm"><input type="checkbox" title="Received" checked={s.received} onChange={e=>upd('sponsors',s.id,{received:e.target.checked})}/><span className="code">{code('SP',s.sponsor_no)}</span><span className="text-fg">{s.name}</span>
          <span className="text-fog-muted">{inr(s.amount)}{s.received?' received':' pledged'}</span><EditBtn t="sponsors" row={s}/></div>)}</div>
      <div className="card"><h2 className="mb-3 font-semibold text-fg">Expenses</h2><form className="mb-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();add('expenses',{category:f.cat||'Other',description:f.desc||null,amount:Number(f.eamt||0)})}}>
          <select className="input w-auto" aria-label="Category" value={v('cat')} onChange={set('cat')}>{CATS.map(x=><option key={x}>{x}</option>)}</select><input className="input flex-1" placeholder="Details" required value={v('desc')} onChange={set('desc')}/>
          <input className="input w-28" type="number" min="0" required placeholder="Amount" value={v('eamt')} onChange={set('eamt')}/><button className="btn">Add</button></form>
        {d.expenses.map(x=><div key={x.id} className="flex items-center gap-3 border-t border-ink-700 py-2.5 text-sm"><span className="code">{code('EX',x.expense_no)}</span><span className="text-fg">{x.category}</span><span className="truncate text-fog-muted">{x.description}</span><span className="text-fog">{inr(x.amount)}</span><EditBtn t="expenses" row={x}/></div>)}</div></div></div>}
    {edit&&<Editor item={edit} close={()=>setEdit(null)} save={save} remove={remove}/>}
  </div>
}
