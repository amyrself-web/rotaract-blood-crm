// A WhatsApp send button with two ways to send:
//  1. From the club number: the linked club phone sends it automatically (only offered when it is connected)
//  2. Open WhatsApp: opens WhatsApp on this device with the message typed; you press send
// Without the Messages permission the button simply opens WhatsApp. When the club phone is offline, that option is shown greyed out.
import {useEffect,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {createPortal} from 'react-dom'
import {toast} from 'sonner'
import {Zap,Smartphone,Check} from 'lucide-react'
import {wa} from '../../lib/util'
import {enqueue,useWaReady,getSendMode,setSendMode} from '../../lib/wa'
import {errText} from '../ui'

const at=t=>new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})

export async function sendAuto({phone,text,name,kind='direct',refId,donorId,memberId,title}){
  const r=await enqueue(title||`${name||phone}`,kind,[{phone,name:name||'',body:text,ref:refId?String(refId):'',donor_id:donorId||'',member_id:memberId||''}])
  if(!r.queued){toast.error('Not sent: this number replied STOP, or this message was already sent to them.');return false}
  const later=new Date(r.send_after)-Date.now()>60000
  toast.success(later?`Queued. Quiet hours now, so the club phone sends it at ${at(r.send_after)}.`:'Sending from the club number. It goes out in a few seconds.')
  return true
}

export default function WaSend({phone,text,name,kind='direct',refId,donorId,memberId,onSent,className='btn-ghost',title='Send on WhatsApp',children,disabled}){
  const st=useWaReady(),ready=!!st?.ready,menu=!!st&&'ready' in st,btn=useRef(null),[pos,setPos]=useState(null),[busy,setBusy]=useState(false)
  const manual=()=>{window.open(wa(phone,text),'_blank');setPos(null);setSendMode('manual');onSent?.('manual')}
  const auto=async()=>{setPos(null);setBusy(true);setSendMode('auto')
    try{if(await sendAuto({phone,text,name,kind,refId,donorId,memberId}))onSent?.('auto')}catch(e){toast.error(errText(e))}setBusy(false)}
  const click=e=>{e.stopPropagation();if(!menu)return manual()
    const r=btn.current.getBoundingClientRect(),w=290,left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8)),below=r.bottom+170<window.innerHeight
    setPos(below?{left,top:r.bottom+6,w}:{left,bottom:window.innerHeight-r.top+6,w})}
  useEffect(()=>{if(!pos)return;const close=()=>setPos(null),key=e=>e.key==='Escape'&&close()
    window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',key)
    return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',key)}},[pos])
  const pref=getSendMode()||'auto'
  const Opt=({k,icon:I,label,hint,onClick,tone,off})=><button role="menuitem" disabled={off} onClick={onClick} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition enabled:hover:bg-ink-700/70 enabled:focus:bg-ink-700/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}><I size={16}/></span>
    <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm font-medium text-fg">{label}{pref===k&&<Check size={13} className="text-brand" aria-label="last used"/>}</span><span className="block text-xs leading-snug text-fog-muted">{hint}</span></span></button>
  return <>
    <button ref={btn} type="button" className={className} title={title} aria-label={title} aria-haspopup={menu?'menu':undefined} aria-expanded={!!pos} disabled={disabled||busy||!phone} onClick={click}>{children}</button>
    {pos&&createPortal(<div className="fixed inset-0 z-[70]" onClick={()=>setPos(null)}>
      <div role="menu" aria-label="How to send" onClick={e=>e.stopPropagation()} className="fixed rounded-2xl border border-ink-600 bg-ink-800 p-1.5 shadow-2xl" style={{left:pos.left,top:pos.top,bottom:pos.bottom,width:pos.w}}>
        <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-fog-faint">Send to {name||phone}</div>
        {[['auto',Zap,'From the club number',ready?`Sent automatically by ${st?.phone?`+${st.phone.replace(/^(\d{2})(\d{10})$/,'$1 $2')}`:'the club phone'}. Nothing to tap.`:'Club phone is not connected right now (WhatsApp and alerts → Connect).',auto,'bg-brand/15 text-brand',!ready],
          ['manual',Smartphone,'Open WhatsApp','Opens WhatsApp here with the message typed. You press send.',manual,'bg-[#25D366]/15 text-[#25D366]',false]]
          .sort((a,b)=>ready?(b[0]===pref)-(a[0]===pref):(a[0]==='auto')-(b[0]==='auto')).map(([k,i,l,h,f,t,o])=><Opt key={k} k={k} icon={i} label={l} hint={h} onClick={f} tone={t} off={o}/>)}
      </div></div>,document.body)}
  </>
}

// Sending to many people at once, with the same two ways.
// onQueue(manual) queues the messages (enqueue(..., manual)) and returns its result.
// "Tap to send" then opens the Outbox with WhatsApp ready for each person in turn.
export function WaBulk({count,label='Send all',onQueue,size='',autoClass='btn',manualClass}){
  const st=useWaReady(),ready=!!st?.ready,nav=useNavigate(),[busy,setBusy]=useState('')
  if(!st)return null   // this login cannot send messages
  const go=async manual=>{if(!count)return;setBusy(manual?'m':'a');setSendMode(manual?'manual':'auto')
    try{const r=await onQueue(manual);if(!r)return
      if(!r.queued)toast.error('Nothing to send: everyone here already got it, or replied STOP.')
      else if(manual&&r.broadcast_id)nav(`/messages?tap=${r.broadcast_id}`)
      else toast.success(`${r.queued} ${manual?'messages ready in the Outbox: use Tap to send':'messages going out from the club number'}${r.skipped?` (${r.skipped} skipped: already sent or replied STOP)`:''}`)}
    catch(e){toast.error(errText(e))}finally{setBusy('')}}
  return <>
    {ready&&<button type="button" className={`${autoClass} ${size}`} disabled={!count||!!busy} title="The club phone sends them automatically" onClick={()=>go(false)}><Zap size={15}/>{busy==='a'?'Queuing…':`${label} from club number`}</button>}
    <button type="button" className={`${manualClass||(ready?'btn-quiet':autoClass)} ${size}`} disabled={!count||!!busy} title="Opens WhatsApp for each person; you press send" onClick={()=>go(true)}><Smartphone size={15}/>{busy==='m'?'Preparing…':ready?'Tap to send myself':`${label}: tap to send`}</button>
  </>
}
