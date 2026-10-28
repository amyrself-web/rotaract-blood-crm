import {useEffect,useMemo,useState} from 'react'
import readXlsxFile from 'read-excel-file/browser'
import Papa from 'papaparse'
import {toast} from 'sonner'
import {FileSpreadsheet,FileText,Upload,CheckCircle2,AlertTriangle,Undo2,History,Search,Download,X,Users,Droplet,Receipt,Tent,UserCheck,Presentation,ClipboardCheck,Building2,HeartHandshake,PartyPopper,Info,Eye,Utensils,Sprout} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {PageHeader,Tabs,Badge,Empty,errText,useConfirm,useLive} from '../components/ui'
import {ENTITIES,entity,headerKey,prepare,templateSheets,templateCsv} from '../lib/importSpec'
import {xlsxBlob,download} from '../lib/xlsx'

const ICON={camp_people:Eye,camp_food:Utensils,camp_saplings:Sprout,donors:Droplet,members:Users,member_dues:Receipt,donor_events:HeartHandshake,camps:Tent,camp_attendance:UserCheck,meetings:Presentation,meeting_attendance:ClipboardCheck,hospitals:Building2,projects:HeartHandshake,events:PartyPopper}
const TONE={insert:'green',update:'blue',same:'neutral',skip:'amber',error:'red'}
const WORD={insert:'New',update:'Update',same:'No change',skip:'Skipped',error:'Problem'}
const REFLABEL={member_id:'Member',donor_id:'Donor',meeting_id:'Meeting',camp_id:'Camp'}
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}):''

const readFile=async f=>{
  if(/\.csv$/i.test(f.name))return await new Promise((ok,no)=>Papa.parse(f,{skipEmptyLines:'greedy',complete:r=>ok(r.data),error:no}))
  if(/\.xlsx$/i.test(f.name))return (await readXlsxFile(f))[0]?.data||[]
  throw new Error('Choose an .xlsx or .csv file. For an old .xls file, open it in Excel and save it as .xlsx first.')}

function label(e,k){return e.fields.find(f=>f.key===k)?.label||REFLABEL[k]||k}
function detail(e,r){const by=(r.by||[]).map(k=>label(e,k)).join(' + ')
  if(r.client)return r.client.join('; ')
  switch(r.action){
    case 'insert':return r.code?`Will be added as ${r.code}`:'Will be added'
    case 'update':return `${r.code?r.code+': ':''}${(r.changed||[]).map(k=>label(e,k)).join(', ')} will change${by?` (found by ${by})`:''}`
    case 'same':return `${r.code?r.code+' ':''}is already the same in the CRM`
    case 'skip':return r.reason==='exists'?`Already in the CRM${r.code?' as '+r.code:''}${r.match_name?` (${r.match_name})`:''}: same ${by}`
      :r.reason==='dup_in_file'?`Same ${by} as row ${r.dup_line+1} of this file`
      :r.reason==='many'?`Matches ${r.matches.length} different records: ${r.matches.map(m=>`${m.code||m.name} by ${(m.by||[]).map(k=>label(e,k)).join(' + ')}`).join(', ')}. Fix the row so it points at one.`
      :r.reason==='empty'?'Empty row':''
    case 'error':return r.reason==='code_not_found'?`${r.code} is not in the CRM. Leave the ID empty for new records.`
      :r.reason==='missing'?`Missing: ${(r.changed||[]).map(k=>label(e,k)).join(', ')}`:r.msg||'Could not be saved'
    default:return ''}}

function Preview({e,res,raw,map,onlyProblems}){
  const [f,setF]=useState(onlyProblems?'error':''),[q,setQ]=useState(''),[n,setN]=useState(100)
  const firstCols=e.fields.filter(x=>map[x.key]!==''&&map[x.key]!=null).slice(0,3)
  const list=res.rows.filter(r=>r.reason!=='empty'&&(!f||r.action===f)&&(!q||JSON.stringify(raw[r.line-1]||[]).toLowerCase().includes(q.toLowerCase())))
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">{['','insert','update','same','skip','error'].map(k=>{const c=k?res.rows.filter(r=>r.action===k&&r.reason!=='empty').length:res.rows.filter(r=>r.reason!=='empty').length
      return (k===''||c>0)&&<button key={k||'all'} onClick={()=>setF(k)} className={`chip ${f===k?'border-brand/50 bg-brand/15 text-fg':''}`}>{k?WORD[k]:'All'} · {c}</button>})}
      <label className="relative ml-auto"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input w-56 py-1.5 pl-8 text-sm" placeholder="Search rows" value={q} onChange={x=>setQ(x.target.value)}/></label></div>
    <div className="overflow-x-auto rounded-xl border border-ink-700"><table className="table min-w-[760px]">
      <thead><tr><th className="w-16">Row</th>{firstCols.map(c=><th key={c.key}>{c.label}</th>)}<th className="w-28">Result</th><th>Details</th></tr></thead>
      <tbody>{list.slice(0,n).map(r=><tr key={r.line}><td className="tabular-nums text-fog-faint">{r.line+1}</td>
        {firstCols.map(c=><td key={c.key} className="max-w-[180px] truncate">{String(raw[r.line-1]?.[map[c.key]]??'')}</td>)}
        <td><Badge tone={TONE[r.action]}>{WORD[r.action]}</Badge></td><td className="text-sm text-fog-muted">{detail(e,r)}</td></tr>)}</tbody></table>
      {!list.length&&<div className="p-6 text-center text-sm text-fog-faint">Nothing here.</div>}</div>
    {list.length>n&&<button className="btn-quiet" onClick={()=>setN(n+500)}>Show more ({list.length-n} left)</button>}
  </div>}

function report(e,res,raw,hdr){return Papa.unparse(res.rows.filter(r=>r.reason!=='empty').map(r=>({Row:r.line+1,Result:WORD[r.action],Details:detail(e,r),
  ...Object.fromEntries(hdr.map((h,i)=>[h||`Column ${i+1}`,raw[r.line-1]?.[i] instanceof Date?raw[r.line-1][i].toISOString().slice(0,10):raw[r.line-1]?.[i]??'']))})))}

function NewImport({can,onDone}){
  const confirm=useConfirm()
  const allowed=ENTITIES.filter(x=>x.perm.some(p=>can(p)))
  const [ek,setEk]=useState(allowed[0]?.key),e=entity(ek)
  const [file,setFile]=useState(null),[hdr,setHdr]=useState([]),[raw,setRaw]=useState([]),[map,setMap]=useState({}),[mode,setMode]=useState('add')
  const [prev,setPrev]=useState(null),[done,setDone]=useState(null),[busy,setBusy]=useState(''),[err,setErr]=useState('')
  const reset=()=>{setPrev(null);setDone(null);setErr('')}
  useEffect(()=>{setFile(null);setHdr([]);setRaw([]);setMap({});reset()},[ek])
  useEffect(()=>{setPrev(null)},[map,mode])
  const tpl=kind=>{if(kind==='xlsx')download(xlsxBlob(templateSheets(e)),`${e.label} - import template.xlsx`)
    else download(new Blob(['﻿'+Papa.unparse(templateCsv(e))],{type:'text/csv'}),`${e.label} - import template.csv`)}
  const onFile=async x=>{const f=x.target.files[0];x.target.value='';if(!f)return;reset()
    try{const data=(await readFile(f)).filter(r=>r&&r.some(c=>c!=null&&String(c).trim()!==''))
      if(data.length<2)return setErr('The file has no data rows under the column names.')
      if(data.length>5001)return setErr(`The file has ${data.length-1} rows. Import up to 5000 at a time: split the file.`)
      const h=data[0].map(v=>String(v??'')),m={}
      h.forEach((v,i)=>{const k=headerKey(v,e);if(k&&m[k]==null)m[k]=i});e.fields.forEach(f=>{if(m[f.key]==null)m[f.key]=''})
      setFile(f.name);setHdr(h);setRaw(data.slice(1));setMap(m)}
    catch(y){setErr('Could not read this file: '+(y.message||y))}}
  const missingReq=mode==='update'?[]:e?.fields.filter(f=>f.req&&(map[f.key]===''||map[f.key]==null)&&!(e.key==='member_dues'&&f.key==='paid_on'))||[]
  const unused=hdr.map((h,i)=>[h,i]).filter(([h,i])=>h&&!Object.values(map).includes(i))
  const go=async dry=>{setErr('');if(dry)setDone(null);const {rows,errs}=prepare(e,raw,map)
    const send=rows.map((o,i)=>errs[i]?{}:o)
    setBusy(dry?'check':'apply')
    const {data,error}=await supabase.rpc('import_run',{p_entity:e.key,p_file:file,p_mode:mode,p_rows:send,p_dry:dry});setBusy('')
    if(error)return setErr(errText(error))
    data.rows=data.rows.map((r,i)=>errs[i]?{...r,action:'error',client:errs[i],reason:null}:r)
    const c={insert:0,update:0,same:0,skip:0,error:0};data.rows.forEach(r=>{if(r.reason!=='empty')c[r.action]++});data.counts=c
    if(dry)setPrev(data);else{setDone(data);setPrev(null);onDone?.();toast.success(`${e.label}: ${c.insert} added, ${c.update} updated`)}}
  const apply=async()=>{const c=prev.counts
    if(c.error+c.skip>0&&!await confirm({title:`Import ${c.insert+c.update} rows?`,body:`${c.skip} skipped and ${c.error} rows with problems will not be imported. You can download the report, fix those rows and import them later.`,action:'Import',danger:false}))return
    go(false)}
  if(!allowed.length)return <div className="card"><Empty icon={Upload} title="Nothing you can import">Ask an admin for permission on the Users page.</Empty></div>
  return <div className="space-y-5">
    <section className="card"><h2 className="mb-3 font-semibold text-fg">1. What are you importing?</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{allowed.map(x=>{const I=ICON[x.key]||FileSpreadsheet;return <button key={x.key} onClick={()=>setEk(x.key)} aria-pressed={ek===x.key}
        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${ek===x.key?'border-brand bg-brand/10':'border-ink-700 hover:bg-ink-750'}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><I size={17}/></span><span><span className="block font-medium text-fg">{x.label}</span><span className="block text-xs text-fog-muted">{x.desc}</span></span></button>})}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-ink-800 p-3"><span className="text-sm text-fog-muted">Template for {e.label}:</span>
        <button className="btn-quiet py-1.5 text-sm" onClick={()=>tpl('xlsx')}><FileSpreadsheet size={15}/>Excel (.xlsx)</button><button className="btn-quiet py-1.5 text-sm" onClick={()=>tpl('csv')}><FileText size={15}/>CSV</button>
        <span className="flex basis-full items-start gap-1.5 text-xs text-fog-faint"><Info size={13} className="mt-0.5 shrink-0"/>Columns: {e.fields.map(f=>f.label+(f.req?' *':'')).join(', ')}. Already in the CRM when: {e.unique}.</span></div></section>

    <section className="card space-y-4"><h2 className="font-semibold text-fg">2. Choose the file and how to treat records already in the CRM</h2>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-500 p-4 hover:bg-ink-750"><Upload size={20} className="text-brand"/>
        <span className="flex-1"><span className="block text-sm font-medium text-fg">{file||'Choose an .xlsx or .csv file'}</span><span className="text-xs text-fog-faint">{file?`${raw.length} rows`:'First row = column names. Nothing is saved until you confirm.'}</span></span>
        <input type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Import file" onChange={onFile}/></label>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Import mode">{[['add','Add new only','Rows already in the CRM are skipped. Nothing existing is changed.'],['update','Add new and update existing','Rows already in the CRM get the filled-in cells. Empty cells change nothing.']].map(([k,l,d])=>
        <button key={k} role="radio" aria-checked={mode===k} onClick={()=>setMode(k)} className={`rounded-xl border p-3 text-left ${mode===k?'border-brand bg-brand/10':'border-ink-700 hover:bg-ink-750'}`}><div className="font-medium text-fg">{l}</div><div className="text-xs text-fog-muted">{d}</div></button>)}</div>
      {err&&<div className="flex items-start gap-2 rounded-xl border border-blood/30 bg-blood/10 p-3 text-sm text-[#FF8796]"><AlertTriangle size={16} className="mt-0.5 shrink-0"/>{err}</div>}</section>

    {raw.length>0&&<section className="card space-y-3"><h2 className="font-semibold text-fg">3. Match your columns to the CRM</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{e.fields.map(f=><label key={f.key} className="text-sm text-fog-muted">{f.label}{f.req&&<span className="text-blood"> *</span>}
        <select aria-label={`Column for ${f.label}`} className={`input mt-1 ${map[f.key]===''&&f.req?'border-blood/60':''}`} value={map[f.key]??''} onChange={x=>setMap({...map,[f.key]:x.target.value===''?'':+x.target.value})}>
          <option value="">Not in my file</option>{hdr.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div>
      {unused.length>0&&<p className="text-xs text-fog-faint">Not used: {unused.map(([h])=>h).join(', ')}</p>}
      <div className="flex flex-wrap items-center gap-3"><button className="btn" disabled={!!busy||missingReq.length>0} onClick={()=>go(true)}><CheckCircle2 size={16}/>{busy==='check'?'Checking every row…':'Check the file (nothing is saved)'}</button>
        {missingReq.length>0&&<span className="text-sm text-blood">Choose a column for: {missingReq.map(f=>f.label).join(', ')}</span>}</div></section>}

    {prev&&<section className="card space-y-4"><div className="flex flex-wrap items-center gap-3"><h2 className="flex-1 font-semibold text-fg">4. Check and confirm</h2>
        <button className="btn-quiet py-1.5 text-sm" onClick={()=>download(new Blob(['﻿'+report(e,prev,raw,hdr)],{type:'text/csv'}),`${e.label} - check report.csv`)}><Download size={15}/>Report</button></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{['insert','update','same','skip','error'].map(k=><div key={k} className="tile py-3 text-center"><div className={`text-xl font-semibold ${k==='error'&&prev.counts[k]?'text-blood':k==='insert'?'text-ok':'text-fg'}`}>{prev.counts[k]}</div><div className="text-xs text-fog-muted">{WORD[k]}</div></div>)}</div>
      <Preview e={e} res={prev} raw={raw} map={map} onlyProblems={prev.counts.error>0}/>
      <div className="flex flex-wrap items-center gap-3 border-t border-ink-700 pt-4"><button className="btn" disabled={!!busy||prev.counts.insert+prev.counts.update===0} onClick={apply}><Upload size={16}/>{busy==='apply'?'Importing…':`Confirm: add ${prev.counts.insert}${mode==='update'?`, update ${prev.counts.update}`:''}`}</button>
        <span className="text-xs text-fog-faint">You can undo the whole import afterwards from History.</span></div></section>}

    {done&&<section className="card space-y-3 border-ok/40"><div className="flex items-center gap-3"><CheckCircle2 size={28} className="text-ok"/><div className="flex-1"><h2 className="font-semibold text-fg">Imported</h2>
        <p className="text-sm text-fog-muted">{done.counts.insert} added, {done.counts.update} updated, {done.counts.same+done.counts.skip} skipped, {done.counts.error} with problems.</p></div>
        <button className="btn-quiet py-1.5 text-sm" onClick={()=>download(new Blob(['﻿'+report(e,done,raw,hdr)],{type:'text/csv'}),`${e.label} - import report.csv`)}><Download size={15}/>Report</button></div>
      {done.batch&&<p className="text-sm text-fog-muted">Made a mistake? Open <b>History</b> and press <b>Undo</b> on this import: every row it added is removed and every change is put back.</p>}
      <Preview e={e} res={done} raw={raw} map={map} onlyProblems={false}/></section>}
  </div>}

function Batches(){
  const confirm=useConfirm(),[rows,setRows]=useState(null),[open,setOpen]=useState(null),[rv,setRv]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('import_batches').select('*').order('created_at',{ascending:false}).limit(100).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[]);useLive(['import_batches'],load)
  const preview=async b=>{setOpen(b.id);setRv(null);const {data,error}=await supabase.rpc('import_revert',{p_batch:b.id,p_dry:true});if(error){toast.error(errText(error));setOpen(null);return}setRv(data)}
  const undo=async b=>{if(!await confirm({title:`Undo import #${b.batch_no}?`,body:`${rv.removed} added records are removed and ${rv.restored} changed records get their old values back.${rv.kept?` ${rv.kept} were changed again after the import and stay as they are.`:''}`,action:'Undo import'}))return
    setBusy(true);const {data,error}=await supabase.rpc('import_revert',{p_batch:b.id,p_dry:false});setBusy(false);if(error)return toast.error(errText(error))
    toast.success(`Undone: ${data.removed} removed, ${data.restored} put back${data.kept?`, ${data.kept} left as they are`:''}`);setOpen(null);setRv(null);load()}
  const WHY={edited:'changed again after the import, left as it is',in_use:'now used elsewhere (for example a camp registration), left as it is',error:'could not be changed'}
  if(rows===null)return <div className="skeleton h-40"/>
  if(!rows.length)return <div className="card"><Empty icon={History} title="No imports yet">Every import you confirm shows here, and can be undone.</Empty></div>
  return <div className="space-y-3">{rows.map(b=>{const e=entity(b.entity)
    return <article key={b.id} className="card">
      <div className="flex flex-wrap items-center gap-3"><span className="code">#{b.batch_no}</span><div className="min-w-0 flex-1"><div className="font-medium text-fg">{e?.label||b.entity} <span className="text-fog-faint">· {b.file_name}</span></div>
        <div className="text-xs text-fog-faint">{when(b.created_at)}{b.created_by_name?` · ${b.created_by_name}`:''} · {b.inserted} added, {b.updated} updated, {b.skipped} skipped{b.failed?`, ${b.failed} problems`:''}</div></div>
        <Badge tone={b.status==='applied'?'green':b.status==='reverted'?'neutral':'amber'}>{b.status==='applied'?'Imported':b.status==='reverted'?'Undone':'Partly undone'}</Badge>
        {b.status==='applied'&&open!==b.id&&<button className="btn-quiet py-1.5 text-sm" onClick={()=>preview(b)}><Undo2 size={15}/>Undo…</button>}
        {open===b.id&&<button className="btn-ghost" aria-label="Close" onClick={()=>{setOpen(null);setRv(null)}}><X size={16}/></button>}</div>
      {b.revert_report&&<p className="mt-2 text-xs text-fog-muted">Undone {when(b.reverted_at)}: {b.revert_report.removed} removed, {b.revert_report.restored} put back{b.revert_report.kept?`, ${b.revert_report.kept} left as they were changed later`:''}.</p>}
      {open===b.id&&(!rv?<div className="skeleton mt-3 h-20"/>:<div className="mt-4 space-y-3 border-t border-ink-700 pt-4">
        <p className="text-sm text-fog">Undo will remove <b>{rv.removed}</b> added records and put back <b>{rv.restored}</b> changed records.{rv.gone?` ${rv.gone} were already deleted.`:''}</p>
        {rv.kept>0&&<div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn"><div className="mb-1 font-medium">{rv.kept} will stay as they are:</div>
          <ul className="space-y-0.5">{rv.rows.filter(r=>r.reason).slice(0,30).map((r,i)=><li key={i}>Row {r.line+1}: {r.code||r.name||''} — {WHY[r.reason]}{r.fields?.length||r.kept_fields?.length?` (${(r.kept_fields||r.fields).map(k=>label(e,k)).join(', ')})`:''}</li>)}</ul></div>}
        <button className="btn-danger" disabled={busy} onClick={()=>undo(b)}><Undo2 size={15}/>{busy?'Undoing…':'Undo this import'}</button></div>)}
    </article>})}</div>}

export default function Import(){
  const {can}=useAuth(),[tab,setTab]=useState('new')
  return <div><PageHeader eyebrow="Data" title="Bulk import" description="Excel or CSV for every part of the CRM. Check first, then confirm. Every import can be undone."/>
    <Tabs id="import-tabs" value={tab} onChange={setTab} tabs={[['new','New import'],['history','History']]}/>
    {tab==='new'?<NewImport can={can} onDone={()=>{}}/>:<Batches/>}
  </div>}
