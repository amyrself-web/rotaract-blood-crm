import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {motion} from 'framer-motion'
import {Megaphone,Pin,PinOff,Plus,Trash2,Vote,X,Lock,BarChart3} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {fmt} from '../lib/util'
import {useBrand} from '../context/Brand'
import {enqueue} from '../lib/wa'
import {WaBulk} from '../components/wa/WaSend'
import {PageHeader,Drawer,Field,Badge,Empty,useLive,undoToast,errText,Toggle} from '../components/ui'

const when=t=>new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})

export function PollBars({poll,counts,mine,onVote,disabled}){
  const total=(counts||[]).reduce((a,b)=>a+Number(b),0)
  return <div className="space-y-2">{poll.options.map((o,i)=>{const n=Number(counts?.[i]||0),pct=total?Math.round(n/total*100):0,me=mine===i+1
    return <button key={i} disabled={disabled} onClick={()=>onVote?.(i+1)} className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition ${me?'border-brand/60':'border-ink-600'} ${disabled?'cursor-default':'hover:border-brand/50'}`}>
      <motion.span initial={{width:0}} animate={{width:`${pct}%`}} className={`absolute inset-y-0 left-0 ${me?'bg-brand/25':'bg-ink-700'}`}/>
      <span className="relative flex items-center gap-2"><span className="flex-1 text-fg">{o}{me&&<span className="ml-2 text-xs text-brand">your vote</span>}</span><span className="tabular-nums text-fog-muted">{pct}% · {n}</span></span></button>})}
    <p className="text-xs text-fog-faint">{total} vote{total===1?'':'s'}</p></div>
}

export default function Notices(){
  const {brand}=useBrand(),[mem,setMem]=useState([]),[notices,setNotices]=useState(null),[polls,setPolls]=useState(null),[res,setRes]=useState({}),[nf,setNf]=useState(null),[pf,setPf]=useState(null)
  const load=async()=>{const [n,p]=await Promise.all([supabase.from('notices').select('*').is('deleted_at',null).order('pinned',{ascending:false}).order('created_at',{ascending:false}),supabase.from('polls').select('*').is('deleted_at',null).order('created_at',{ascending:false})])
    if(n.error)return toast.error(n.error.message);setNotices(n.data);setPolls(p.data||[])
    const r={};await Promise.all((p.data||[]).map(async x=>{const {data}=await supabase.rpc('poll_results',{p_poll:x.id});r[x.id]=data}));setRes(r)}
  useEffect(()=>{load();supabase.from('members').select('id,full_name,phone').is('deleted_at',null).eq('status','active').then(({data})=>setMem((data||[]).filter(m=>/^[6-9]\d{9}$/.test(m.phone||''))))},[]);useLive(['notices','polls','poll_votes'],load)
  const sendNotice=(n,manual)=>enqueue(`Notice · ${n.title}`,'notice',mem.map(m=>({phone:m.phone,name:m.full_name,member_id:m.id,ref:n.id,body:`📢 ${n.title}${n.body?`\n\n${n.body}`:''}\n\n- ${brand.club_name||''}`})),null,manual)
  const saveN=async e=>{e.preventDefault();const {id,...row}=nf;const r=id?await supabase.from('notices').update({title:row.title,body:row.body||null,pinned:row.pinned,expires_on:row.expires_on||null}).eq('id',id):await supabase.from('notices').insert({title:row.title,body:row.body||null,pinned:row.pinned,expires_on:row.expires_on||null})
    if(r.error)return toast.error(r.error.message);toast.success('Notice posted. Members see it on their page.');setNf(null);load()}
  const pin=async n=>{await supabase.from('notices').update({pinned:!n.pinned}).eq('id',n.id);load()}
  const delN=async n=>{const r=await supabase.from('notices').update({deleted_at:new Date().toISOString()}).eq('id',n.id);if(r.error)return toast.error(r.error.message);load()
    undoToast('Notice removed',async()=>{await supabase.from('notices').update({deleted_at:null}).eq('id',n.id);load()})}
  const saveP=async e=>{e.preventDefault();const options=pf.options.map(o=>o.trim()).filter(Boolean);if(options.length<2)return toast.error('Give at least two options')
    const r=await supabase.from('polls').insert({question:pf.question,options,closes_at:pf.closes_at?new Date(pf.closes_at).toISOString():null,anonymous:pf.anonymous});if(r.error)return toast.error(r.error.message);toast.success('Poll is live');setPf(null);load()}
  const closeP=async p=>{await supabase.from('polls').update({closes_at:new Date().toISOString()}).eq('id',p.id);load()}
  const delP=async p=>{await supabase.from('polls').update({deleted_at:new Date().toISOString()}).eq('id',p.id);load()}
  return <div>
    <PageHeader title="Notice board" description="Announcements and polls for club members. They appear on every member's My club page."
      actions={<><button className="btn-quiet" onClick={()=>setPf({question:'',options:['',''],closes_at:'',anonymous:true})}><Vote size={15}/>New poll</button><button className="btn" onClick={()=>setNf({title:'',body:'',pinned:false,expires_on:''})}><Plus size={16}/>New notice</button></>}/>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-semibold text-fg"><Megaphone size={17} className="text-brand"/>Notices</h2>
        {notices&&!notices.length&&<div className="card"><Empty icon={Megaphone} title="No notices">Post dues reminders, event news, dress code for the installation, anything members should know.</Empty></div>}
        {(notices||[]).map(n=><motion.article layout key={n.id} className={`card ${n.pinned?'border-brand/40':''}`}>
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{n.pinned&&<Pin size={14} className="text-brand"/>}<h3 className="font-semibold text-fg">{n.title}</h3></div>
            <div className="text-xs text-fog-faint">{when(n.created_at)}{n.expires_on?` · until ${fmt(n.expires_on)}`:''}</div></div>
            <button className="btn-ghost" aria-label={n.pinned?'Unpin':'Pin'} onClick={()=>pin(n)}>{n.pinned?<PinOff size={15}/>:<Pin size={15}/>}</button>
            <button className="btn-ghost" aria-label="Edit" onClick={()=>setNf({...n,body:n.body||'',expires_on:n.expires_on||''})}>Edit</button>
            <button className="btn-ghost text-fog-faint hover:text-blood" aria-label="Remove notice" onClick={()=>delN(n)}><Trash2 size={15}/></button></div>
          {n.body&&<p className="mt-2 whitespace-pre-line text-sm text-fog">{n.body}</p>}
          {mem.length>0&&<div className="mt-3 flex flex-wrap gap-2 border-t border-ink-700 pt-3"><WaBulk count={mem.length} label={`WhatsApp to ${mem.length} members`} size="px-3 py-1.5 text-xs" autoClass="btn-quiet" manualClass="btn-quiet" onQueue={m=>sendNotice(n,m)}/></div>}</motion.article>)}</section>
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-semibold text-fg"><BarChart3 size={17} className="text-brand"/>Polls</h2>
        {polls&&!polls.length&&<div className="card"><Empty icon={Vote} title="No polls">Ask members: which project next, which date suits, which T-shirt colour.</Empty></div>}
        {(polls||[]).map(p=>{const open=!p.closes_at||new Date(p.closes_at)>new Date(),r=res[p.id]
          return <article key={p.id} className="card"><div className="mb-3 flex items-start gap-2"><h3 className="flex-1 font-semibold text-fg">{p.question}</h3>{open?<Badge tone="green">Open</Badge>:<Badge>Closed</Badge>}</div>
            <PollBars poll={p} counts={r?.counts} disabled/>
            {r?.voters&&<p className="mt-2 text-xs text-fog-muted">{r.voters.map(v=>`${v.name}: ${p.options[v.choice-1]}`).join(' · ')}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fog-faint"><span className="flex-1">{p.anonymous?'Votes are secret':'Names are shown to the board'}{p.closes_at?` · ${open?'closes':'closed'} ${when(p.closes_at)}`:''}</span>
              {open&&<button className="btn-quiet px-2.5 py-1 text-xs" onClick={()=>closeP(p)}><Lock size={12}/>Close now</button>}<button className="btn-ghost text-fog-faint hover:text-blood" aria-label="Remove poll" onClick={()=>delP(p)}><Trash2 size={14}/></button></div></article>})}</section></div>

    <Drawer open={!!nf} onClose={()=>setNf(null)} title={nf?.id?'Edit notice':'New notice'} footer={nf&&<><button className="btn-quiet" onClick={()=>setNf(null)}>Cancel</button><button className="btn" form="notice-form">Post</button></>}>
      {nf&&<form id="notice-form" onSubmit={saveN} className="space-y-4">
        <Field label="Heading" required><input className="input" required minLength={3} value={nf.title} onChange={e=>setNf({...nf,title:e.target.value})}/></Field>
        <Field label="Message"><textarea className="input min-h-[140px]" value={nf.body} onChange={e=>setNf({...nf,body:e.target.value})}/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Show until" hint="Empty: always"><input type="date" className="input" value={nf.expires_on} onChange={e=>setNf({...nf,expires_on:e.target.value})}/></Field>
          <label className="mt-6 flex items-center gap-3 text-sm text-fog"><Toggle checked={nf.pinned} label="Pin to top" onChange={v=>setNf({...nf,pinned:v})}/>Pin to top</label></div></form>}
    </Drawer>
    <Drawer open={!!pf} onClose={()=>setPf(null)} title="New poll" footer={pf&&<><button className="btn-quiet" onClick={()=>setPf(null)}>Cancel</button><button className="btn" form="poll-form">Start poll</button></>}>
      {pf&&<form id="poll-form" onSubmit={saveP} className="space-y-4">
        <Field label="Question" required><input className="input" required minLength={5} value={pf.question} onChange={e=>setPf({...pf,question:e.target.value})}/></Field>
        <div className="space-y-2"><div className="label">Options</div>{pf.options.map((o,i)=><div key={i} className="flex gap-2"><input className="input" aria-label={`Option ${i+1}`} placeholder={`Option ${i+1}`} value={o} onChange={e=>setPf({...pf,options:pf.options.map((x,j)=>j===i?e.target.value:x)})}/>
          {pf.options.length>2&&<button type="button" className="btn-ghost" aria-label="Remove option" onClick={()=>setPf({...pf,options:pf.options.filter((_,j)=>j!==i)})}><X size={15}/></button>}</div>)}
          {pf.options.length<8&&<button type="button" className="btn-quiet px-3 py-1 text-xs" onClick={()=>setPf({...pf,options:[...pf.options,'']})}><Plus size={13}/>Add option</button>}</div>
        <Field label="Closes at" hint="Empty: stays open until you close it"><input type="datetime-local" className="input" value={pf.closes_at} onChange={e=>setPf({...pf,closes_at:e.target.value})}/></Field>
        <label className="flex items-center gap-3 text-sm text-fog"><Toggle checked={pf.anonymous} label="Secret vote" onChange={v=>setPf({...pf,anonymous:v})}/>Secret vote (the board sees only totals)</label></form>}
    </Drawer>
  </div>
}
