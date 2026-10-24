// "Write with AI": say or type what you want, or record / upload a voice note, and Gemini writes the message.
// Works once GEMINI_API_KEY is added in Supabase (the panel shows how when it is not set up).
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {motion} from 'framer-motion'
import {toast} from 'sonner'
import {Sparkles,X,Mic,Square,Upload,Wand2,Check,RotateCcw} from 'lucide-react'
import {supabase,hasSupabase} from '../lib/supabase'
import {useLang} from '../lib/i18n'

let status=null   // {configured} once asked
const ask=async body=>{const {data,error}=await supabase.functions.invoke('ai-write',{body})
  if(error){const m=(await error.context?.json?.().catch(()=>null))?.error;throw new Error(m||(/Failed to send|fetch|not found|404/i.test(error.message)?'AI writing is not switched on yet.':error.message))}
  if(data?.error)throw new Error(data.error);return data}

// any audio the browser can play → 16 kHz mono WAV (small, and every AI model reads it)
async function toWav(blob){
  const ctx=new (window.AudioContext||window.webkitAudioContext)();const buf=await ctx.decodeAudioData(await blob.arrayBuffer());ctx.close?.()
  const rate=16000,len=Math.min(Math.ceil(buf.duration*rate),rate*180)
  const off=new OfflineAudioContext(1,len,rate),src=off.createBufferSource();src.buffer=buf;src.connect(off.destination);src.start()
  const pcm=(await off.startRendering()).getChannelData(0),out=new DataView(new ArrayBuffer(44+pcm.length*2))
  const w=(o,s)=>[...s].forEach((c,i)=>out.setUint8(o+i,c.charCodeAt(0)))
  w(0,'RIFF');out.setUint32(4,36+pcm.length*2,true);w(8,'WAVE');w(12,'fmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,1,true)
  out.setUint32(24,rate,true);out.setUint32(28,rate*2,true);out.setUint16(32,2,true);out.setUint16(34,16,true);w(36,'data');out.setUint32(40,pcm.length*2,true)
  for(let i=0;i<pcm.length;i++)out.setInt16(44+i*2,Math.max(-1,Math.min(1,pcm[i]))*0x7fff,true)
  let s='';const b=new Uint8Array(out.buffer);for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000))
  return {mime:'audio/wav',data:btoa(s),secs:Math.round(len/rate)}
}

export default function AiWrite({kind='whatsapp',club,current,onText,className='chip'}){
  const {lang}=useLang(),[open,setOpen]=useState(false),[st,setSt]=useState(status),[f,setF]=useState({instruction:'',lang:lang==='ta'?'ta':'en'}),[audio,setAudio]=useState(null)
  const [rec,setRec]=useState(null),[busy,setBusy]=useState(false),[out,setOut]=useState(''),file=useRef(null)
  useEffect(()=>{if(!open||st||!hasSupabase)return;ask({action:'status'}).then(d=>{status=d;setSt(d)},()=>{status={configured:false};setSt(status)})},[open])
  const startRec=async()=>{try{const s=await navigator.mediaDevices.getUserMedia({audio:true}),mr=new MediaRecorder(s),chunks=[]
      mr.ondataavailable=e=>chunks.push(e.data);mr.onstop=async()=>{s.getTracks().forEach(t=>t.stop());setRec(null)
        try{setAudio({...(await toWav(new Blob(chunks,{type:mr.mimeType}))),name:'Recorded now'})}catch{toast.error('Could not read the recording')}}
      mr.start();setRec(mr);setTimeout(()=>mr.state==='recording'&&mr.stop(),180000)}
    catch{toast.error('Allow the microphone for this site, then try again.')}}
  const pickFile=async e=>{const x=e.target.files?.[0];e.target.value='';if(!x)return;if(x.size>25e6)return toast.error('Voice note is too big')
    try{setAudio({...(await toWav(x)),name:x.name})}catch{toast.error('Could not open that audio file. WhatsApp voice notes (.opus, .ogg), .mp3, .m4a and .wav work.')}}
  const write=async()=>{if(!f.instruction.trim()&&!audio)return toast.error('Say or type what the message should be about, or add a voice note')
    setBusy(true);setOut('');try{const d=await ask({action:'write',kind,club,current,instruction:f.instruction,lang:f.lang,audio:audio&&{mime:audio.mime,data:audio.data}});setOut(d.text)}
    catch(e){toast.error(e.message)}setBusy(false)}
  const use=()=>{onText(out);setOpen(false);setOut('');setAudio(null);setF(x=>({...x,instruction:''}));toast.success('Message added. Check it before sending.')}
  return <>
    <button type="button" className={className} onClick={()=>setOpen(true)}><Sparkles size={14} className="text-brand"/>Write with AI</button>
    {open&&createPortal(<div className="fixed inset-0 z-[75] grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm" onClick={()=>!busy&&setOpen(false)}>
      <motion.div role="dialog" aria-label="Write with AI" initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} onClick={e=>e.stopPropagation()}
        className="card max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 text-brand"><Sparkles size={18}/></span>
          <div className="flex-1"><div className="font-semibold text-fg">Write with AI</div><div className="text-xs text-fog-muted">Say it, type it, or send a voice note. The AI writes the message.</div></div>
          <button className="btn-ghost" aria-label="Close" onClick={()=>setOpen(false)}><X size={18}/></button></div>
        {st&&!st.configured?<div className="space-y-3 text-sm text-fog">
          <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-warn">AI writing is not switched on yet. It is free; an admin does this once:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Open <a className="text-brand underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>, sign in with a Google account and press <b>Create API key</b>. Copy it.</li>
            <li>In Supabase open <b>Edge Functions → Secrets</b> and add <code className="code">GEMINI_API_KEY</code> with that key.</li>
            <li>Come back here and try again.</li></ol>
          <p className="text-xs text-fog-faint">Until then, the mic button and "Speak the message" still work without AI.</p></div>
        :<div className="space-y-4">
          <div><label className="label" htmlFor="ai-ask">What should it say?</label>
            <textarea id="ai-ask" className="input min-h-[96px]" placeholder={'e.g. Invite O+ donors to Sunday camp at Rotary Hall, 9 am. Mention breakfast.\nஅல்லது தமிழில் சொல்லுங்கள்…'} value={f.instruction} onChange={e=>setF({...f,instruction:e.target.value})}/>
            <p className="mt-1 text-xs text-fog-faint">Tap the round mic at the bottom right to speak instead of typing.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {rec?<button type="button" className="btn-quiet !border-blood/60 !text-blood" onClick={()=>rec.stop()}><Square size={14} fill="currentColor"/>Stop recording</button>
              :<button type="button" className="btn-quiet" onClick={startRec}><Mic size={15}/>Record a voice note</button>}
            <button type="button" className="btn-quiet" onClick={()=>file.current?.click()}><Upload size={15}/>Upload voice note</button>
            <input ref={file} type="file" accept="audio/*,.opus,.ogg,.m4a,.mp3,.wav,.aac" className="hidden" onChange={pickFile}/>
            {audio&&<span className="chip">{audio.name} · {audio.secs}s<button aria-label="Remove voice note" onClick={()=>setAudio(null)}><X size={12}/></button></span>}</div>
          <div><div className="label">Language</div><div className="flex flex-wrap gap-1.5" role="radiogroup">{[['ta','தமிழ்'],['en','English'],['both','தமிழ் + English']].map(([k,l])=>
            <button key={k} type="button" role="radio" aria-checked={f.lang===k} translate="no" onClick={()=>setF({...f,lang:k})} className={`chip ${f.lang===k?'border-brand/60 bg-brand/15 text-fg':''}`}>{l}</button>)}</div></div>
          <button type="button" className="btn w-full py-2.5" disabled={busy||!!rec||!st} onClick={write}><Wand2 size={16}/>{busy?'Writing…':out?'Write again':'Write it'}</button>
          {out&&<div className="rounded-2xl border border-ink-600 bg-ink-800/70 p-3">
            <div className="mb-1 text-xs text-fog-faint">AI draft. Read it before you send.</div>
            <textarea className="input min-h-[140px]" value={out} onChange={e=>setOut(e.target.value)}/>
            <div className="mt-2 flex gap-2"><button type="button" className="btn flex-1" onClick={use}><Check size={15}/>Use this</button><button type="button" className="btn-quiet" onClick={write} disabled={busy}><RotateCcw size={15}/>Again</button></div></div>}
        </div>}
      </motion.div></div>,document.body)}
  </>
}
