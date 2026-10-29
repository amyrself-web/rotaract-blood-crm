// Token printing on camp day: print one slip the moment someone arrives (80 mm thermal printer),
// or print many tokens on A4 sheets to cut. The choice is remembered on this device.
import {useState} from 'react'
import {toast} from 'sonner'
import {Printer,X} from 'lucide-react'
import {printTokens,tokenPrefs,setTokenPrefs,tokenCode} from '../../lib/tokens'
import {errText} from '../ui'

export async function printNow(items,camp,brand,size){
  try{await printTokens(items,{camp,brand,size:size||tokenPrefs().size})}catch(e){toast.error('Could not print the token: '+errText(e))}}
// after a check-in or walk-in: prints by itself when "Print on arrival" is on
export function autoPrint(item,camp,brand){if(item&&tokenPrefs().auto)printNow([item],camp,brand)}

export function PrintOne({item,camp,brand,className='btn-ghost px-2 text-fog-faint hover:text-fg'}){
  const go=e=>{e.stopPropagation();e.preventDefault();printNow([item],camp,brand)}
  // a span, so it can sit inside a row that is itself a button
  return <span role="button" tabIndex={0} className={`inline-flex cursor-pointer items-center ${className}`} title={`Print token ${tokenCode(item.token)}`} aria-label={`Print token ${tokenCode(item.token)}`}
    onClick={go} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')go(e)}}><Printer size={14}/></span>}

// rows: every person at the camp as {token, name, line, arrived}
export default function TokenPrint({rows,camp,brand}){
  const [open,setOpen]=useState(false),[p,setP]=useState(tokenPrefs()),[who,setWho]=useState('waiting'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[busy,setBusy]=useState(false)
  const save=x=>{setTokenPrefs(x);setP(o=>({...o,...x}))}
  const pick=rows.filter(r=>r.token!=null&&(who==='all'||(who==='waiting'?!r.arrived:who==='arrived'?r.arrived:true))
    &&(who!=='range'||((from===''||r.token>=Number(from))&&(to===''||r.token<=Number(to))))).sort((a,b)=>a.token-b.token)
  const go=async()=>{if(!pick.length)return toast.error('No tokens match');setBusy(true);await printNow(pick,camp,brand,p.size);setBusy(false)}
  return <div className="relative">
    <button type="button" className="btn-quiet" onClick={()=>setOpen(o=>!o)} aria-expanded={open}><Printer size={15}/>Print tokens{p.auto&&<span className="ml-1 rounded bg-ok/15 px-1.5 text-[10px] font-semibold text-ok">AUTO</span>}</button>
    {open&&<div role="dialog" aria-label="Print tokens" className="absolute right-0 z-40 mt-2 w-[min(92vw,340px)] space-y-3 rounded-2xl border border-ink-600 bg-ink-900 p-4 shadow-2xl">
      <div className="flex items-center justify-between"><div className="font-semibold text-fg">Print tokens</div><button className="btn-ghost p-1" aria-label="Close" onClick={()=>setOpen(false)}><X size={16}/></button></div>
      <div role="radiogroup" aria-label="Paper" className="grid grid-cols-2 gap-2">{[['80mm','80 mm slip','Thermal printer, one per person'],['a4','A4 sheet','8 tokens a page, cut along the lines']].map(([k,l,h])=>
        <button key={k} type="button" role="radio" aria-checked={p.size===k} onClick={()=>save({size:k})} className={`tile px-2 py-2 text-left text-sm ${p.size===k?'border-brand/60 bg-brand/10 text-fg ring-2 ring-brand/20':'text-fog-muted'}`}><b className="block text-fg">{l}</b><span className="text-[11px] text-fog-faint">{h}</span></button>)}</div>
      <label className="flex items-start gap-2 text-sm text-fog"><input type="checkbox" className="mt-0.5" checked={!!p.auto} onChange={e=>save({auto:e.target.checked})}/><span>Print on arrival<span className="block text-xs text-fog-faint">The token prints by itself when you check someone in or add a walk-in (on this device).</span></span></label>
      <div className="border-t border-ink-700 pt-3"><div className="label">Print now</div>
        <select className="input" aria-label="Which tokens" value={who} onChange={e=>setWho(e.target.value)}><option value="waiting">Not yet arrived</option><option value="arrived">Arrived</option><option value="all">Everyone</option><option value="range">Token numbers from … to …</option></select>
        {who==='range'&&<div className="mt-2 grid grid-cols-2 gap-2"><input className="input" type="number" min="1" aria-label="From token" placeholder="From" value={from} onChange={e=>setFrom(e.target.value)}/><input className="input" type="number" min="1" aria-label="To token" placeholder="To" value={to} onChange={e=>setTo(e.target.value)}/></div>}
        <button type="button" className="btn mt-3 w-full" disabled={busy||!pick.length} onClick={go}><Printer size={15}/>{busy?'Preparing…':`Print ${pick.length} token${pick.length===1?'':'s'}`}</button></div>
    </div>}
  </div>}
