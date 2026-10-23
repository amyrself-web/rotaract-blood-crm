import {useState} from 'react'
import {toast} from 'sonner'
import {ShieldCheck,Download,BellOff,Trash2,PencilLine} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useConfirm,errText} from './ui'

const save=(obj,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}

// Donor portal: see and take away your data, stop messages, ask for a correction or for your data to be erased
export default function MyData(){
  const confirm=useConfirm(),[busy,setBusy]=useState('')
  const ask=async(kind,title,body,details)=>{if(!await confirm({title,body,action:'Send request',danger:kind==='erase'}))return
    setBusy(kind);const {data,error}=await supabase.rpc('request_my_privacy',{p_kind:kind,p_details:details||null});setBusy('')
    error?toast.error(error.message):toast.success(kind==='stop'?'Done. You will not get messages from the club.':`Request ${data} sent. The club will contact you.`)}
  const copy=async()=>{setBusy('copy');const {data,error}=await supabase.rpc('donor_data',{p_donor:null});setBusy('');if(error)return toast.error(errText(error));save(data,'my-donor-data.json')}
  return <details className="card mt-5 p-0"><summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm font-medium text-fg"><ShieldCheck size={18} className="text-brand"/>My data and privacy</summary>
    <div className="grid gap-2 border-t border-ink-700 p-4 sm:grid-cols-2">
      <button className="tile flex items-center gap-3 p-3 text-left text-sm hover:border-brand/40" disabled={!!busy} onClick={copy}><Download size={17} className="text-brand"/><span><b className="block text-fg">Download my data</b><span className="text-fog-muted">Everything the club holds about you</span></span></button>
      <button className="tile flex items-center gap-3 p-3 text-left text-sm hover:border-brand/40" disabled={!!busy} onClick={()=>ask('stop','Stop all messages?','You will not get camp invites, reminders or wishes. You can still come to camps.')}><BellOff size={17} className="text-warn"/><span><b className="block text-fg">Stop messages</b><span className="text-fog-muted">No more WhatsApp or SMS from us</span></span></button>
      <button className="tile flex items-center gap-3 p-3 text-left text-sm hover:border-brand/40" disabled={!!busy} onClick={()=>{const d=prompt('What should be corrected?');if(d)ask('correct','Ask for a correction?',d,d)}}><PencilLine size={17} className="text-brand"/><span><b className="block text-fg">Correct my details</b><span className="text-fog-muted">Name, date of birth, blood group</span></span></button>
      <button className="tile flex items-center gap-3 p-3 text-left text-sm hover:border-blood/40" disabled={!!busy} onClick={()=>ask('erase','Erase your data?','The club will remove your name, phone and other details. Your past donations stay in the totals without your name. This cannot be undone.')}><Trash2 size={17} className="text-blood"/><span><b className="block text-fg">Erase my data</b><span className="text-fog-muted">Remove my personal details</span></span></button>
    </div></details>
}
