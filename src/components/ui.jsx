import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {motion} from 'framer-motion'
import {X,AlertTriangle} from 'lucide-react'
import {toast} from 'sonner'
import {supabase} from '../lib/supabase'

export const spring={type:'spring',stiffness:420,damping:36}
// Keeps an overlay mounted while it animates out, then unmounts it. Avoids exit animations that never finish.
export function usePresence(open,ms=280){const [m,setM]=useState(open);const last=useRef(null)
  useEffect(()=>{if(open){setM(true);return}const t=setTimeout(()=>setM(false),ms);return()=>clearTimeout(t)},[open,ms]);return m}

export function PageHeader({title,description,actions,children}){
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0"><h1 className="font-display text-[26px] font-semibold leading-tight text-fg">{title}</h1>
      {description&&<p className="mt-1 max-w-2xl text-sm text-fog-muted">{description}</p>}{children}</div>
    {actions&&<div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
}

export function Field({label,hint,children,className='',required}){
  return <label className={`block ${className}`}><span className="label">{label}{required&&<span aria-hidden="true" className="ml-0.5 text-blood">*</span>}</span>{children}{hint&&<span className="mt-1 block text-xs text-fog-faint">{hint}</span>}</label>
}

// Re-runs onChange whenever any of the tables change for anyone (Supabase Realtime), and when the tab comes back into view.
export function useLive(tables,onChange){
  const cb=useRef(onChange);cb.current=onChange
  useEffect(()=>{let t;const fire=()=>{clearTimeout(t);t=setTimeout(()=>cb.current?.(),350)}
    const ch=supabase.channel('live-'+tables.join('-')+'-'+Math.random().toString(36).slice(2))
    tables.forEach(table=>ch.on('postgres_changes',{event:'*',schema:'public',table},fire))
    ch.subscribe()
    const vis=()=>document.visibilityState==='visible'&&fire()
    document.addEventListener('visibilitychange',vis);window.addEventListener('focus',vis)
    return()=>{clearTimeout(t);supabase.removeChannel(ch);document.removeEventListener('visibilitychange',vis);window.removeEventListener('focus',vis)}},[tables.join(',')])
}
export const undoToast=(msg,undo,description)=>toast.success(msg,{description,duration:7000,action:{label:'Undo',onClick:async()=>{try{await undo();toast('Change undone')}catch(e){toast.error(errText(e))}}}})
export const code=(p,n,w=4)=>n==null?'':`${p}-${String(n).padStart(w,'0')}`
export const PHONE_PATTERN='[6-9][0-9]{9}'
export const adultMax=()=>{const d=new Date();d.setFullYear(d.getFullYear()-18);return d.toLocaleDateString('en-CA')}
export const adultMin=()=>{const d=new Date();d.setFullYear(d.getFullYear()-66);d.setDate(d.getDate()+1);return d.toLocaleDateString('en-CA')}
export const todayIso=()=>new Date().toLocaleDateString('en-CA')

export function Empty({icon:I,title,children,action}){
  return <div className="flex flex-col items-center px-6 py-14 text-center">
    {I&&<span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink-700 text-fog-muted"><I size={22}/></span>}
    <div className="font-display font-semibold text-fg">{title}</div>
    {children&&<p className="mt-1 max-w-sm text-sm text-fog-muted">{children}</p>}{action&&<div className="mt-4">{action}</div>}
  </div>
}

export function Badge({tone='neutral',children}){
  const t={neutral:'border-ink-600 bg-ink-750 text-fog-muted',blue:'border-brand/30 bg-brand/10 text-brand-soft',red:'border-blood/35 bg-blood/10 text-[#FF8796]',
    green:'border-ok/30 bg-ok/10 text-ok',amber:'border-warn/30 bg-warn/10 text-warn'}[tone]
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>
}

export function Tabs({tabs,value,onChange,id='tabs'}){
  return <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1" role="tablist">
    {tabs.map(([k,l])=><button key={k} role="tab" aria-selected={value===k} onClick={()=>onChange(k)}
      className={`relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${value===k?'text-fg':'text-fog-muted hover:text-fg'}`}>
      {value===k&&<motion.span layoutId={id+'-pill'} transition={spring} className="absolute inset-0 rounded-lg bg-ink-700 ring-1 ring-ink-500"/>}
      <span className="relative">{l}</span></button>)}
  </div>
}

// Slide-over panel for create and edit forms
export function Drawer({open,onClose,title,description,children,footer,width='max-w-lg'}){
  const mounted=usePresence(open)
  useEffect(()=>{if(!open)return;const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[open,onClose])
  if(!mounted)return null
  return createPortal(<div className={`fixed inset-0 z-50 ${open?'':'pointer-events-none'}`}>
    <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{opacity:0}} animate={{opacity:open?1:0}} transition={{duration:.2}} onClick={onClose}/>
    <motion.aside role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open} className={`absolute right-0 top-0 flex h-full w-full ${width} flex-col border-l border-ink-600 bg-ink-900 shadow-2xl`}
      initial={{x:'100%'}} animate={{x:open?0:'100%'}} transition={spring}>
      <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-6 py-5">
        <div><h2 className="font-display text-lg font-semibold text-fg">{title}</h2>{description&&<p className="mt-0.5 text-sm text-fog-muted">{description}</p>}</div>
        <button className="btn-ghost -mr-2" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer&&<div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-700 px-6 py-4">{footer}</div>}
    </motion.aside></div>,document.body)
}

// Promise-based confirm dialog: const ok = await confirm({title,body,action})
const ConfirmCtx=createContext(async()=>false)
export const useConfirm=()=>useContext(ConfirmCtx)
export function ConfirmProvider({children}){
  const [state,setState]=useState(null),[shown,setShown]=useState(null),res=useRef()
  const confirm=useCallback(opts=>new Promise(r=>{res.current=r;setShown(opts);setState(opts)}),[])
  const done=v=>{res.current?.(v);setState(null)}
  const mounted=usePresence(!!state,200)
  useEffect(()=>{if(!state)return;const k=e=>e.key==='Escape'&&done(false);window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[state])
  return <ConfirmCtx.Provider value={confirm}>{children}
    {mounted&&shown&&createPortal(<div className={`fixed inset-0 z-[60] grid place-items-center p-4 ${state?'':'pointer-events-none'}`}>
      <motion.div className="absolute inset-0 bg-black/60" initial={{opacity:0}} animate={{opacity:state?1:0}} transition={{duration:.15}} onClick={()=>done(false)}/>
      <motion.div role="alertdialog" aria-modal="true" aria-hidden={!state} className="relative w-full max-w-sm rounded-shell border border-ink-600 bg-ink-900 p-6 shadow-2xl"
        initial={{opacity:0,scale:.94,y:8}} animate={state?{opacity:1,scale:1,y:0}:{opacity:0,scale:.96,y:0}} transition={spring}>
        <div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${shown.danger===false?'bg-brand/15 text-brand':'bg-blood/15 text-blood'}`}><AlertTriangle size={18}/></span>
          <div><h2 className="font-display font-semibold text-fg">{shown.title}</h2>{shown.body&&<p className="mt-1 text-sm text-fog-muted">{shown.body}</p>}</div></div>
        <div className="mt-6 flex justify-end gap-2"><button className="btn-quiet" onClick={()=>done(false)}>Cancel</button>
          <button autoFocus className={shown.danger===false?'btn':'btn-danger'} onClick={()=>done(true)}>{shown.action||'Confirm'}</button></div>
      </motion.div></div>,document.body)}
  </ConfirmCtx.Provider>
}

export function Toggle({checked,onChange,label,disabled}){
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={()=>onChange(!checked)}
    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked?'bg-brand':'bg-ink-600'}`}>
    <motion.span layout transition={spring} className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ${checked?'right-1':'left-1'}`}/>
  </button>
}

export const errText=e=>e?.message||String(e||'Something went wrong')
