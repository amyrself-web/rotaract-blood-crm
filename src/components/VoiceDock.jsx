// Speak instead of typing, in any text box of the CRM.
// When a text box has focus, a round mic button appears at the bottom right. Tap it and speak (Tamil or English);
// the words go into that box. Tap again to stop. Works in Chrome, Edge, Android and iPhone Safari.
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {motion,AnimatePresence} from 'framer-motion'
import {Mic,Square} from 'lucide-react'
import {toast} from 'sonner'
import {canListen,listen,insertText} from '../lib/voice'
import {useLang} from '../lib/i18n'

const OK=el=>el&&(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&/^(text|search|email|tel|url|number|)$/i.test(el.type||'')))&&!el.readOnly&&!el.disabled&&!el.closest('[data-no-voice]')
const getVL=()=>{try{return localStorage.getItem('voice-lang')||''}catch{return ''}}
const setVL=v=>{try{localStorage.setItem('voice-lang',v)}catch{}}

export default function VoiceDock(){
  const {lang}=useLang(),[field,setField]=useState(null),[on,setOn]=useState(false),[heard,setHeard]=useState(''),[vl,setV]=useState(()=>getVL()||(lang==='ta'?'ta-IN':'en-IN'))
  const stop=useRef(null),target=useRef(null),blurT=useRef(null)
  useEffect(()=>{if(!getVL())setV(lang==='ta'?'ta-IN':'en-IN')},[lang])
  useEffect(()=>{if(!canListen)return
    const fi=e=>{if(OK(e.target)){clearTimeout(blurT.current);setField(e.target);if(on&&target.current!==e.target)target.current=e.target}}
    const fo=()=>{clearTimeout(blurT.current);blurT.current=setTimeout(()=>{if(!OK(document.activeElement)&&!stop.current)setField(null)},250)}
    document.addEventListener('focusin',fi);document.addEventListener('focusout',fo)
    return()=>{document.removeEventListener('focusin',fi);document.removeEventListener('focusout',fo)}},[on])
  const end=()=>{stop.current?.();stop.current=null;setOn(false);setHeard('')}
  const start=()=>{const el=field;if(!el)return;target.current=el;setOn(true);setHeard('')
    stop.current=listen({lang:vl,onPartial:setHeard,onFinal:t=>{setHeard('');const f=target.current;if(f&&f.isConnected){insertText(f,t);try{f.focus({preventScroll:true})}catch{}}},
      onEnd:()=>{stop.current=null;setOn(false);setHeard('')},onError:m=>{toast.error(m);end()}})}
  useEffect(()=>{const f=()=>stop.current?.();window.addEventListener('hashchange',f);return()=>{window.removeEventListener('hashchange',f);stop.current?.()}},[])
  if(!canListen)return null
  const show=!!field||on
  return createPortal(<AnimatePresence>{show&&<motion.div key="dock" initial={{opacity:0,y:16,scale:.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:16,scale:.9}}
    className="fixed bottom-24 right-4 z-[80] flex items-end gap-2 sm:bottom-6" data-no-voice onMouseDown={e=>e.preventDefault()}>
    {on&&<div className="max-w-[60vw] rounded-2xl border border-ink-600 bg-ink-800/95 px-3 py-2 text-sm text-fg shadow-xl backdrop-blur sm:max-w-sm" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium text-blood"><span className="h-2 w-2 animate-pulse rounded-full bg-blood"/>{vl==='ta-IN'?'கேட்கிறது… பேசுங்கள்':'Listening… speak now'}</div>
      {heard&&<div className="mt-1 line-clamp-3 text-fog">{heard}</div>}</div>}
    <div className="flex flex-col items-center gap-1.5">
      <button type="button" translate="no" className="rounded-full border border-ink-600 bg-ink-800/95 px-2 py-0.5 text-[11px] font-semibold text-fog shadow backdrop-blur hover:text-fg" title="Language you speak"
        onClick={()=>{const n=vl==='ta-IN'?'en-IN':'ta-IN';setV(n);setVL(n);if(on){end();setTimeout(start,250)}}}>{vl==='ta-IN'?'தமிழ்':'EN'}</button>
      <button type="button" onClick={()=>on?end():start()} aria-pressed={on} aria-label={on?'Stop voice typing':'Speak instead of typing'} title={on?'Stop':'Speak instead of typing'}
        className={`relative grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl transition ${on?'bg-blood':'bg-brand hover:brightness-110'}`}>
        {on&&<span className="absolute inset-0 animate-ping rounded-full bg-blood/40 motion-reduce:hidden"/>}{on?<Square size={20} fill="currentColor"/>:<Mic size={24}/>}</button></div>
  </motion.div>}</AnimatePresence>,document.body)
}
