import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {motion,AnimatePresence} from 'framer-motion'
import {Send,X,RotateCcw,Search,Play,SkipForward,CheckCircle2,Smartphone,Inbox,Zap} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {wa,fmt} from '../../lib/util'
import {Badge,Empty,useLive,useConfirm,errText} from '../ui'
import {KIND_LABEL,useWaStatus,PROVIDERS} from '../../lib/wa'

const ST={queued:['Waiting','amber'],sending:['Sending','blue'],sent:['Sent','green'],failed:['Failed','red'],cancelled:['Cancelled','neutral']}
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'}):''

// "Tap to send": shows one waiting message at a time; the button opens WhatsApp with it ready, then moves to the next
function TapToSend({rows,onClose,onDone}){
  const [i,setI]=useState(0),[sent,setSent]=useState(0),list=rows,o=list[i]
  const next=()=>setI(x=>x+1)
  const open=async()=>{window.open(wa(o.phone,o.body),'_blank');const {error}=await supabase.rpc('wa_mark_sent',{p_id:o.id});if(error)return toast.error(error.message);setSent(x=>x+1);next()}
  const skip=async()=>{await supabase.rpc('wa_cancel',{p_ids:[o.id]});next()}
  useEffect(()=>{if(!o)onDone?.()},[o])
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/80 p-4 backdrop-blur" role="dialog" aria-label="Tap to send">
    <motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} className="card w-full max-w-md">
      <div className="mb-3 flex items-center gap-2"><Smartphone size={18} className="text-brand"/><div className="flex-1 font-semibold text-fg">Tap to send</div>
        <span className="text-sm tabular-nums text-fog-muted">{Math.min(i+1,list.length)} of {list.length}</span><button className="btn-ghost" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ink-700"><motion.div className="h-full bg-ok" initial={{width:0}} animate={{width:`${list.length?i/list.length*100:100}%`}}/></div>
      <AnimatePresence mode="wait">{o?<motion.div key={o.id} initial={{x:30,opacity:0}} animate={{x:0,opacity:1}} exit={{x:-30,opacity:0}} transition={{duration:.18}}>
        <div className="font-display text-xl font-semibold text-fg">{o.name||o.phone}</div><div className="text-sm text-fog-muted">{o.phone} · {KIND_LABEL[o.kind]||o.kind}</div>
        <div className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#DCF8C6] p-3 text-sm text-[#111B21]">{o.body}</div>
        <div className="mt-4 flex gap-2"><button className="btn flex-1 bg-[#25D366] py-3 text-base text-white hover:bg-[#1EBE5A]" onClick={open}><Send size={18}/>Open WhatsApp</button>
          <button className="btn-quiet" onClick={skip}><SkipForward size={16}/>Skip</button></div>
        <p className="mt-3 text-xs text-fog-faint">WhatsApp opens with the message typed. Press send there, come back here, and the next one is ready.</p></motion.div>
      :<motion.div key="done" initial={{scale:.9,opacity:0}} animate={{scale:1,opacity:1}} className="py-6 text-center"><CheckCircle2 size={44} className="mx-auto text-ok"/>
        <div className="mt-2 font-display text-xl font-semibold text-fg">All done</div><div className="text-sm text-fog-muted">{sent} messages opened in WhatsApp.</div>
        <button className="btn mt-4" onClick={onClose}>Close</button></motion.div>}</AnimatePresence>
    </motion.div></div>
}

export default function Outbox({tapId,onTapOpened}){
  const confirm=useConfirm(),status=useWaStatus()
  const [rows,setRows]=useState(null),[casts,setCasts]=useState([]),[f,setF]=useState('queued'),[q,setQ]=useState(''),[cast,setCast]=useState(''),[tap,setTap]=useState(null)
  const load=async()=>{
    let s=supabase.from('wa_outbox').select('id,kind,phone,name,body,status,error,send_after,sent_at,created_at,broadcast_id,provider,manual').order('created_at',{ascending:false}).limit(1000)
    if(cast)s=s.eq('broadcast_id',cast)
    const [o,b]=await Promise.all([s,supabase.from('wa_broadcasts').select('*').gt('total',1).order('created_at',{ascending:false}).limit(12)])
    if(o.error)return toast.error(o.error.message);setRows(o.data);setCasts(b.data||[])}
  useEffect(()=>{load()},[cast]);useLive(['wa_outbox'],load)
  const counts=useMemo(()=>Object.fromEntries(Object.keys(ST).map(k=>[k,(rows||[]).filter(r=>r.status===k).length])),[rows])
  const list=(rows||[]).filter(r=>(!f||r.status===f)&&(!q||`${r.name} ${r.phone} ${r.body}`.toLowerCase().includes(q.toLowerCase())))
  const provider=status?.provider||'manual',auto=provider!=='manual'
  // with an automatic sender, "Tap to send" only takes the messages you chose to send yourself, so nothing goes twice
  const waiting=(rows||[]).filter(r=>r.status==='queued'&&(!auto||r.manual)).sort((a,b)=>a.send_after.localeCompare(b.send_after))
  const autoWaiting=auto?(rows||[]).filter(r=>r.status==='queued'&&!r.manual).length:0
  useEffect(()=>{if(!tapId)return;supabase.from('wa_outbox').select('id,kind,phone,name,body,status,send_after').eq('broadcast_id',tapId).eq('status','queued').order('created_at')
    .then(({data})=>{onTapOpened?.();if(data?.length)setTap(data)})},[tapId])
  const toManual=async ids=>{const {data,error}=await supabase.rpc('wa_set_manual',{p_ids:ids,p_manual:true});if(error)return toast.error(error.message);load();return data}
  const cancelAll=async()=>{if(!await confirm({title:`Cancel ${list.length} waiting messages?`,body:'They will not be sent. You can send them again from the Cancelled list.',action:'Cancel messages'}))return
    const {data,error}=await supabase.rpc('wa_cancel',{p_ids:list.map(r=>r.id)});error?toast.error(error.message):toast.success(`${data} cancelled`);load()}
  const retry=async ids=>{const {data,error}=await supabase.rpc('wa_retry',{p_ids:ids});error?toast.error(error.message):toast.success(`${data} back in the queue`);load()}
  return <div className="space-y-5">
    {casts.length>0&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{casts.slice(0,6).map(b=>{const mine=(rows||[]).filter(r=>r.broadcast_id===b.id),sent=mine.filter(r=>r.status==='sent').length
      return <button key={b.id} onClick={()=>setCast(cast===b.id?'':b.id)} className={`card p-4 text-left transition hover:border-brand/40 ${cast===b.id?'border-brand/60 ring-2 ring-brand/20':''}`}>
        <div className="flex items-center gap-2"><span className="code">B-{String(b.broadcast_no).padStart(3,'0')}</span><span className="truncate text-sm font-medium text-fg">{b.title}</span></div>
        <div className="mt-1 text-xs text-fog-faint">{when(b.created_at)} · {KIND_LABEL[b.kind]||b.kind}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-ok" style={{width:`${b.total?sent/b.total*100:0}%`}}/></div>
        <div className="mt-1 text-xs tabular-nums text-fog-muted">{cast||mine.length?`${sent} of ${b.total} sent`:`${b.total} messages`}</div></button>})}</div>}

    {autoWaiting>0&&<div className="card flex flex-wrap items-center gap-4 border-brand/40 bg-brand/[.06]">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white"><Zap size={20}/></span>
      <div className="min-w-0 flex-1"><div className="font-semibold text-fg">{autoWaiting} going out from the club number</div>
        <div className="text-sm text-fog-muted">{status?.ready?`${PROVIDERS[provider]} sends these automatically${status?.next_at?`, next at ${when(status.next_at)}`:''}. Nothing to tap.`:'The club phone is not connected right now. They go out as soon as it is back, or send them yourself.'}</div></div>
      <button className="btn-quiet" onClick={async()=>{const ids=(rows||[]).filter(r=>r.status==='queued'&&!r.manual).map(r=>r.id);const n=await toManual(ids);if(n){const {data}=await supabase.from('wa_outbox').select('id,kind,phone,name,body,status,send_after').in('id',ids).eq('status','queued');if(data?.length)setTap(data)}}}><Smartphone size={15}/>Send them myself</button></div>}

    {waiting.length>0&&<div className="card flex flex-wrap items-center gap-4 border-[#25D366]/40 bg-[#25D366]/[.06]">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#25D366] text-white"><Send size={20}/></span>
      <div className="min-w-0 flex-1"><div className="font-semibold text-fg">{waiting.length} message{waiting.length>1?'s':''} waiting for you</div>
        <div className="text-sm text-fog-muted">Send them one by one from this phone or computer. Each tap opens WhatsApp with the message ready.</div></div>
      <button className="btn bg-[#25D366] text-white hover:bg-[#1EBE5A]" onClick={()=>setTap(waiting)}><Play size={15}/>Tap to send</button></div>}

    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
        {[['','All'],...Object.entries(ST).map(([k,[l]])=>[k,l])].map(([k,l])=><button key={k} onClick={()=>setF(k)} className={`chip ${f===k?'border-brand/50 bg-brand/15 text-fg':''}`}>{l}{k&&<span className="ml-1 tabular-nums text-fog-faint">{counts[k]}</span>}</button>)}
        <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, number, text" value={q} onChange={e=>setQ(e.target.value)}/></div>
        {f==='queued'&&list.length>0&&<button className="btn-quiet text-blood" onClick={cancelAll}><X size={15}/>Cancel these</button>}
        {f==='failed'&&list.length>0&&<button className="btn-quiet" onClick={()=>retry(list.map(r=>r.id))}><RotateCcw size={15}/>Try all again</button>}</div>
      {rows&&!list.length?<Empty icon={Inbox} title="Nothing here">{f==='queued'?'No messages waiting. Send a broadcast or queue a list.':'Change the filter to see other messages.'}</Empty>:
      <ul className="divide-y divide-ink-700/80">{(rows===null?[]:list.slice(0,300)).map(r=><li key={r.id} className="flex items-start gap-3 px-4 py-3 text-sm">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-fg">{r.name||r.phone}</span><span className="text-xs text-fog-faint">{r.phone}</span><Badge tone="blue">{KIND_LABEL[r.kind]||r.kind}</Badge></div>
          <div className="mt-0.5 line-clamp-2 text-fog-muted">{r.body}</div>
          <div className="mt-0.5 text-xs text-fog-faint">{r.status==='queued'&&auto&&<span className={r.manual?'text-[#25D366]':'text-brand'}>{r.manual?'You send · ':'Club number · '}</span>}{r.status==='sent'?`Sent ${when(r.sent_at)}${r.provider?` · ${PROVIDERS[r.provider]||r.provider}`:''}`:r.status==='queued'?`Sends after ${when(r.send_after)}`:when(r.created_at)}{r.error&&<span className="text-blood"> · {r.error.replace(/^retry: /,'')}</span>}</div></div>
        <Badge tone={ST[r.status][1]}>{ST[r.status][0]}</Badge>
        {r.status==='queued'&&<button className="btn-ghost text-fog-faint hover:text-blood" aria-label={`Cancel message to ${r.name||r.phone}`} onClick={async()=>{await supabase.rpc('wa_cancel',{p_ids:[r.id]});load()}}><X size={15}/></button>}
        {['failed','cancelled'].includes(r.status)&&<button className="btn-ghost text-fog-faint hover:text-fg" aria-label={`Send again to ${r.name||r.phone}`} onClick={()=>retry([r.id])}><RotateCcw size={15}/></button>}</li>)}
        {rows===null&&[0,1,2].map(i=><li key={i} className="p-3"><div className="skeleton h-10"/></li>)}</ul>}
      {list.length>300&&<p className="border-t border-ink-700 p-3 text-center text-xs text-fog-faint">Showing the latest 300 of {list.length}. Search to find others.</p>}
    </div>
    {tap&&<TapToSend rows={tap} onClose={()=>{setTap(null);load()}}/>}
  </div>
}
