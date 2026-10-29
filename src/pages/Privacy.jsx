import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {ShieldCheck,Download,Trash2,Check,X,Plus,DatabaseBackup,HardDriveDownload,History,Search} from 'lucide-react'
import {zipSync,strToU8} from 'fflate'
import Papa from 'papaparse'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {fmt,normPhone} from '../lib/util'
import {PageHeader,Tabs,Badge,Empty,Drawer,Field,useLive,useConfirm,code,errText} from '../components/ui'

const KIND={copy:'Copy of data',correct:'Correct details',erase:'Erase data',stop:'Stop messages'}
const TONE={open:'amber',done:'green',rejected:'neutral'}
const saveBlob=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
// every table worth keeping; tables this login cannot read are skipped and listed in the README
const TABLES=['settings','profiles','donors','consent_log','camps','registrations','screenings','donations','blood_units','emergency_requests','donor_events','tasks','camp_volunteers','sponsors','expenses','camp_materials',
  'members','member_dues','meetings','meeting_attendance','meeting_actions','pledges','afterlife_cases','contributions','club_expenses','message_templates','message_log','wa_broadcasts','wa_outbox','wa_optout','privacy_requests',
  'projects','project_hours','notices','polls','poll_votes','hospitals','club_assets','events','event_people','induction_steps','board_terms',
  'camp_attendance','camp_people','camp_food','camp_saplings','camp_sapling_checks','camp_sessions','meeting_changes','club_trips','trip_people','trip_expenses','email_templates','email_outbox','stock_thresholds','handovers']

function Requests(){
  const confirm=useConfirm(),[rows,setRows]=useState(null),[f,setF]=useState('open'),[add,setAdd]=useState(null),[donors,setDonors]=useState([]),[q,setQ]=useState('')
  const load=()=>supabase.from('privacy_requests').select('*').order('created_at',{ascending:false}).then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[]);useLive(['privacy_requests'],load)
  useEffect(()=>{if(!add||q.length<2)return setDonors([]);const t=setTimeout(()=>supabase.from('donors').select('id,full_name,phone,donor_no').is('deleted_at',null).or(`full_name.ilike.%${q}%,phone.ilike.%${normPhone(q)||q}%`).limit(8).then(({data})=>setDonors(data||[])),250);return()=>clearTimeout(t)},[q,add])
  const close=async(r,status,outcome)=>{const {error}=await supabase.from('privacy_requests').update({status,outcome,closed_at:new Date().toISOString()}).eq('id',r.id);error?toast.error(error.message):load()}
  const copy=async r=>{if(!r.donor_id)return toast.error('This request is not linked to a donor');const {data,error}=await supabase.rpc('donor_data',{p_donor:r.donor_id});if(error)return toast.error(errText(error))
    saveBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`donor-data-${code('D',data.donor.donor_no)}.json`);if(r.kind==='copy'&&r.status==='open')close(r,'done','Copy given to the donor')}
  const erase=async r=>{if(!await confirm({title:`Erase ${r.name}'s personal details?`,body:'Name, phone, email, date of birth and area are removed for good, also from the audit log. Donation counts stay without the name. This cannot be undone.',action:'Erase for good'}))return
    const {error}=await supabase.rpc('erase_donor',{p_donor:r.donor_id,p_request:r.id});error?toast.error(errText(error)):toast.success('Personal details erased');load()}
  const stop=async r=>{const {error}=await supabase.from('donors').update({consent:false}).eq('id',r.donor_id);if(error)return toast.error(error.message);close(r,'done','Messages stopped')}
  const save=async e=>{e.preventDefault();const {error}=await supabase.from('privacy_requests').insert({donor_id:add.donor?.id||null,name:add.donor?.full_name||add.name,phone:add.donor?.phone||normPhone(add.phone)||null,kind:add.kind,details:add.details||null})
    if(error)return toast.error(error.message);toast.success('Request recorded');setAdd(null);load()}
  const list=(rows||[]).filter(r=>!f||r.status===f)
  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-2">{[['open','Open'],['done','Done'],['rejected','Rejected'],['','All']].map(([k,l])=><button key={k} onClick={()=>setF(k)} className={`chip ${f===k?'border-brand/50 bg-brand/15 text-fg':''}`}>{l}</button>)}
      <button className="btn ml-auto" onClick={()=>{setQ('');setAdd({kind:'erase',name:'',phone:'',details:''})}}><Plus size={15}/>Record a request</button></div>
    {rows&&!list.length?<div className="card"><Empty icon={ShieldCheck} title="No requests">When a donor asks for a copy of their data, a correction, to stop messages or to be erased, it shows here. Donors can ask from their portal too.</Empty></div>:
    <ul className="space-y-3">{list.map(r=><li key={r.id} className="card flex flex-wrap items-start gap-3 p-4">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="code">PR-{String(r.request_no).padStart(3,'0')}</span><span className="font-medium text-fg">{r.name}</span><Badge tone={r.kind==='erase'?'red':'blue'}>{KIND[r.kind]}</Badge><Badge tone={TONE[r.status]}>{r.status}</Badge></div>
        <div className="mt-0.5 text-xs text-fog-faint">{r.phone||''} · asked {fmt(r.created_at)}{r.closed_at?` · closed ${fmt(r.closed_at)}`:''}</div>
        {r.details&&<p className="mt-1 text-sm text-fog">{r.details}</p>}{r.outcome&&<p className="mt-1 text-sm text-ok">{r.outcome}</p>}</div>
      {r.status==='open'&&<div className="flex flex-wrap gap-2">
        {r.donor_id&&<button className="btn-quiet" onClick={()=>copy(r)}><Download size={15}/>Copy of data</button>}
        {r.kind==='stop'&&r.donor_id&&<button className="btn-quiet" onClick={()=>stop(r)}><Check size={15}/>Stop messages</button>}
        {r.kind==='erase'&&r.donor_id&&<button className="btn-danger" onClick={()=>erase(r)}><Trash2 size={15}/>Erase</button>}
        {r.kind==='correct'&&<button className="btn-quiet" onClick={()=>close(r,'done','Details corrected')}><Check size={15}/>Corrected</button>}
        <button className="btn-ghost" aria-label="Reject" onClick={()=>{const why=prompt('Reason for rejecting');if(why)close(r,'rejected',why)}}><X size={15}/></button></div>}</li>)}</ul>}
    <Drawer open={!!add} onClose={()=>setAdd(null)} title="Record a request" description="For requests that come by phone, letter or in person."
      footer={add&&<><button className="btn-quiet" onClick={()=>setAdd(null)}>Cancel</button><button className="btn" form="pr-form">Save</button></>}>
      {add&&<form id="pr-form" onSubmit={save} className="space-y-4">
        <Field label="What do they ask for" required><select className="input" value={add.kind} onChange={e=>setAdd({...add,kind:e.target.value})}>{Object.entries(KIND).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
        {add.donor?<div className="tile flex items-center gap-3 p-3"><div className="flex-1"><b className="text-fg">{add.donor.full_name}</b><div className="text-xs text-fog-faint">{code('D',add.donor.donor_no)} · {add.donor.phone}</div></div><button type="button" className="btn-ghost" onClick={()=>setAdd({...add,donor:null})}><X size={15}/></button></div>
        :<><Field label="Find the donor"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Name or mobile" value={q} onChange={e=>setQ(e.target.value)}/></div></Field>
          {donors.map(d=><button type="button" key={d.id} className="tile block w-full p-2 text-left text-sm" onClick={()=>setAdd({...add,donor:d})}>{d.full_name} <span className="text-fog-faint">{d.phone}</span></button>)}
          <Field label="Or their name" required={!add.donor}><input className="input" required value={add.name} onChange={e=>setAdd({...add,name:e.target.value})}/></Field>
          <Field label="Mobile"><input className="input" value={add.phone} onChange={e=>setAdd({...add,phone:e.target.value})}/></Field></>}
        <Field label="Details"><textarea className="input min-h-[80px]" value={add.details} onChange={e=>setAdd({...add,details:e.target.value})}/></Field></form>}
    </Drawer>
  </div>
}

function Consent(){
  const [rows,setRows]=useState(null)
  useEffect(()=>{supabase.from('consent_log').select('consent,source,created_at,donors(full_name,donor_no)').order('created_at',{ascending:false}).limit(200).then(({data,error})=>error?toast.error(error.message):setRows(data))},[])
  return <div className="card overflow-hidden p-0"><table className="table"><thead><tr><th>When</th><th>Donor</th><th>Contact allowed</th><th>Changed by</th></tr></thead>
    <tbody>{(rows||[]).map((r,i)=><tr key={i}><td className="whitespace-nowrap text-fog-muted">{new Date(r.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})}</td>
      <td className="text-fg">{r.donors?.full_name||'-'} <span className="code">{code('D',r.donors?.donor_no)}</span></td><td>{r.consent?<Badge tone="green">Yes</Badge>:<Badge tone="red">No</Badge>}</td><td className="text-fog-muted">{r.source}</td></tr>)}</tbody></table>
    {rows&&!rows.length&&<Empty icon={History} title="No changes yet"/>}</div>
}

function Backup(){
  const {settings}=useAuth(),[busy,setBusy]=useState(null),[last,setLast]=useState(settings.last_backup_at)
  const run=async()=>{setBusy({done:0,total:TABLES.length,rows:0});const files={},skipped=[];let rows=0
    try{for(let i=0;i<TABLES.length;i++){const t=TABLES[i];let all=[],from=0,ok=true
        for(;;){const {data,error}=await supabase.from(t).select('*').range(from,from+999);if(error){ok=false;break}all=all.concat(data);if(data.length<1000)break;from+=1000}
        if(!ok){skipped.push(t)}else{files[`${t}.csv`]=strToU8('﻿'+Papa.unparse(all.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v!==null&&typeof v==='object'?JSON.stringify(v):v])))));files[`json/${t}.json`]=strToU8(JSON.stringify(all));rows+=all.length}
        setBusy({done:i+1,total:TABLES.length,rows})}
      const stamp=new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')
      files['README.txt']=strToU8(`Backup of ${settings.club_name||'the club'} CRM, made ${new Date().toLocaleString('en-IN')}.\nOne CSV per table (opens in Excel) and the same data as JSON.\n${rows} rows in ${Object.keys(files).length/2|0} tables.\n${skipped.length?`Not included (no permission or not set up): ${skipped.join(', ')}\n`:''}Keep this file somewhere safe: it has donors' personal details.`)
      saveBlob(new Blob([zipSync(files,{level:6})],{type:'application/zip'}),`crm-backup-${stamp}.zip`)
      await supabase.rpc('mark_backup');setLast(new Date().toISOString());toast.success(`Backup saved: ${rows} rows`)}catch(e){toast.error(errText(e))}setBusy(null)}
  const days=last?Math.floor((Date.now()-new Date(last))/864e5):null
  return <div className="card"><div className="flex flex-wrap items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><DatabaseBackup size={22}/></span>
    <div className="min-w-0 flex-1"><div className="font-semibold text-fg">Full backup</div><div className="text-sm text-fog-muted">Every table as Excel-ready CSV, in one ZIP file. {last?`Last backup ${days===0?'today':`${days} days ago`}.`:'No backup made yet.'} Make one at least once a month and keep it on a drive or pen drive.</div></div>
    <button className="btn" disabled={!!busy} onClick={run}><HardDriveDownload size={16}/>{busy?`Reading ${busy.done} of ${busy.total} tables…`:'Download backup'}</button></div>
    {busy&&<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full bg-brand transition-all" style={{width:`${busy.done/busy.total*100}%`}}/></div>}
    {days!=null&&days>30&&<p className="mt-3 text-sm text-warn">It has been more than a month since the last backup.</p>}</div>
}

export default function Privacy(){
  const [tab,setTab]=useState('requests')
  return <div><PageHeader eyebrow="Admin" title="Privacy and backup" description="Donor data requests, consent history and full backups."/>
    <Tabs id="privacy-tabs" value={tab} onChange={setTab} tabs={[['requests','Data requests'],['consent','Consent history'],['backup','Backup']]}/>
    {tab==='requests'&&<Requests/>}{tab==='consent'&&<Consent/>}{tab==='backup'&&<Backup/>}
  </div>
}
