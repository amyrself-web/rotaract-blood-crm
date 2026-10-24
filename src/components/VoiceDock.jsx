// Speak instead of typing, in any text box of the CRM.
// When a text box has focus, a small mic appears inside its right end. Tap it and speak (Tamil or English);
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
  // follow the box on screen (scrolling, drawers sliding in) while the mic is shown
  const [box,setBox]=useState(null),show=!!field||on
  useEffect(()=>{if(!show)return;let raf;const tick=()=>{const el=(on&&target.current)||field;if(el?.isConnected){const r=el.getBoundingClientRect();setBox(b=>b&&b.top===r.top&&b.left===r.left&&b.width===r.width&&b.height===r.height?b:{top:r.top,left:r.left,width:r.width,height:r.height,area:el.tagName==='TEXTAREA'})}raf=requestAnimationFrame(tick)};tick();return()=>cancelAnimationFrame(raf)},[show,field,on])
  if(!canListen||!show||!box||box.width<90)return null
  const sz=box.height<34&&!box.area?24:30,micTop=box.area?box.top+box.height-sz-6:box.top+(box.height-sz)/2,micLeft=box.left+box.width-sz-6
  const above=box.top>110
  // the mic sits inside the right end of the box, so it never covers buttons; what it hears shows just above the box
  return createPortal(<div data-no-voice onMouseDown={e=>e.preventDefault()}>
    <button type="button" onClick={()=>on?end():start()} aria-pressed={on} aria-label={on?'Stop voice typing':'Speak instead of typing'} title={on?'Stop':'Speak instead of typing'}
      style={{top:micTop,left:micLeft,width:sz,height:sz}}
      className={`fixed z-[85] grid place-items-center rounded-full text-white shadow-lg transition ${on?'bg-blood':'bg-brand/90 hover:bg-brand'}`}>
      {on&&<span className="absolute inset-0 animate-ping rounded-full bg-blood/40 motion-reduce:hidden"/>}{on?<Square size={sz*.45} fill="currentColor"/>:<Mic size={sz*.55}/>}</button>
    <AnimatePresence>{on&&<motion.div key="heard" initial={{opacity:0,y:above?6:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
      style={{left:Math.max(8,Math.min(box.left+box.width-320,window.innerWidth-328)),...(above?{bottom:window.innerHeight-box.top+6}:{top:box.top+box.height+6})}}
      className="fixed z-[85] w-80 max-w-[calc(100vw-16px)] rounded-2xl border border-ink-600 bg-ink-800/95 px-3 py-2 text-sm text-fg shadow-xl backdrop-blur" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium text-blood"><span className="h-2 w-2 animate-pulse rounded-full bg-blood"/><span className="flex-1">{vl==='ta-IN'?'கேட்கிறது… பேசுங்கள்':'Listening… speak now'}</span>
        <button type="button" translate="no" className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px] font-semibold text-fog hover:text-fg" title="Language you speak"
          onClick={()=>{const n=vl==='ta-IN'?'en-IN':'ta-IN';setV(n);setVL(n);end();setTimeout(start,250)}}>{vl==='ta-IN'?'தமிழ் → EN':'EN → தமிழ்'}</button></div>
      {heard&&<div className="mt-1 line-clamp-3 text-fog">{heard}</div>}</motion.div>}</AnimatePresence>
  </div>,document.body)
}
