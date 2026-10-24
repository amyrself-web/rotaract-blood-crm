// Mic next to Search: say where to go or who to find ("open camps", "donors", "find Ravi Kumar", "முகாம்கள்").
import {useRef,useState} from 'react'
import {Mic} from 'lucide-react'
import {toast} from 'sonner'
import {canListen,listen} from '../lib/voice'
import {useLang} from '../lib/i18n'

export default function VoiceCommand({className=''}){
  const {lang}=useLang(),[on,setOn]=useState(false),[heard,setHeard]=useState(''),stop=useRef(null)
  if(!canListen)return null
  const vl=(()=>{try{return localStorage.getItem('voice-lang')}catch{return null}})()||(lang==='ta'?'ta-IN':'en-IN')
  const go=()=>{if(on){stop.current?.();return}setOn(true);setHeard('');let got=''
    stop.current=listen({lang:vl,continuous:false,onPartial:setHeard,onFinal:t=>{got=t;setHeard(t)},onError:m=>toast.error(m),
      onEnd:()=>{setOn(false);stop.current=null;if(got)window.dispatchEvent(new CustomEvent('crm-palette',{detail:got}));setTimeout(()=>setHeard(''),800)}})}
  return <div className={`relative ${className}`}>
    <button type="button" onClick={go} aria-pressed={on} title={on?'Listening…':'Say a page or a donor name'} aria-label="Voice command"
      className={`grid h-9 w-9 place-items-center rounded-full transition ${on?'bg-blood text-white':'text-fog-muted hover:bg-white/10 hover:text-fg'}`}>
      <Mic size={17} className={on?'animate-pulse':''}/></button>
    {on&&<div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-ink-600 bg-ink-800 p-3 text-sm shadow-xl" aria-live="polite">
      <div className="text-xs font-medium text-blood">{vl==='ta-IN'?'பேசுங்கள்: "கொடையாளர்கள்", "முகாம்கள்"…':'Say: "donors", "open camps", "find Ravi"…'}</div>
      <div className="mt-1 min-h-[1.25rem] text-fg">{heard||'…'}</div></div>}
  </div>
}
