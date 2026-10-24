// "Speak it" button: say the whole request in one go and the form fills itself.
// e.g. "Urgent O positive, two units at GH Salem, call Ravi 98765 43210"
//      "அவசரம் ஓ பாசிட்டிவ் ரெண்டு யூனிட் GH சேலம் மருத்துவமனையில்"
import {useRef,useState} from 'react'
import {Mic,Square} from 'lucide-react'
import {toast} from 'sonner'
import {canListen,listen,understand} from '../lib/voice'
import {useLang} from '../lib/i18n'

export default function SpeakFill({onResult,label='Speak it',hint,className='btn-quiet'}){
  const {lang}=useLang(),[on,setOn]=useState(false),[heard,setHeard]=useState(''),stop=useRef(null)
  if(!canListen)return null
  const vl=(()=>{try{return localStorage.getItem('voice-lang')}catch{return null}})()||(lang==='ta'?'ta-IN':'en-IN')
  const go=()=>{if(on){stop.current?.();return}setOn(true);setHeard('');let got=''
    stop.current=listen({lang:vl,continuous:false,onPartial:setHeard,onFinal:t=>{got=(got+' '+t).trim();setHeard(got)},onError:m=>toast.error(m),
      onEnd:()=>{setOn(false);stop.current=null;if(got)onResult(understand(got));setTimeout(()=>setHeard(''),1500)}})}
  return <div className="inline-flex max-w-full flex-col gap-1">
    <button type="button" className={`${className} ${on?'!border-blood/60 !text-blood':''}`} onClick={go} aria-pressed={on} title={hint}>
      {on?<Square size={14} fill="currentColor"/>:<Mic size={15}/>}{on?'Listening…':label}</button>
    {(on||heard)&&<span className="max-w-xs truncate text-xs text-fog-muted" aria-live="polite">{heard||(vl==='ta-IN'?'பேசுங்கள்…':'Speak now…')}</span>}
  </div>
}
