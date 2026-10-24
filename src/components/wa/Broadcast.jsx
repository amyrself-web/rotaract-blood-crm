import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {Megaphone,Users,IdCard,ClipboardPaste,Send,CalendarClock,Smile,Zap,Smartphone} from 'lucide-react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../../context/Auth'
import {BLOOD,nextEligible,normPhone,fmt} from '../../lib/util'
import {Field,errText} from '../ui'
import {enqueue,fill,siteUrl,useWaStatus,getSendMode,setSendMode} from '../../lib/wa'
import {celebrate} from '../../lib/fx'
import SpeakFill from '../SpeakFill'
import AiWrite from '../AiWrite'

async function all(table,cols,f){let out=[],from=0;for(;;){let q=supabase.from(table).select(cols).is('deleted_at',null).order('id').range(from,from+999);if(f)q=f(q)
  const {data,error}=await q;if(error)throw error;out=out.concat(data);if(data.length<1000)return out;from+=1000}}

const STARTERS=[
  ['Camp invite','Hello {name}! {club} is holding a blood donation camp: {camp} on {date} at {venue}. One donation can save three lives. Register here: {link}'],
  ['Urgent need','Hello {name}, {bloodgroup} blood is urgently needed. If you are able to donate in the next few days, please reply to this message. - {club}'],
  ['Thank you','Dear {name}, thank you for being a blood donor with {club}. Because of donors like you, patients in our town get blood on time.'],
  ['Club news','Hello {name}, news from {club}: ']]

export default function Broadcast({onQueued}){
  const {settings}=useAuth(),status=useWaStatus(30000),club=settings.club_name||''
  const [src,setSrc]=useState('donors'),[donors,setDonors]=useState(null),[members,setMembers]=useState(null),[camps,setCamps]=useState([]),[regs,setRegs]=useState([])
  const [f,setF]=useState({groups:[],area:'',gender:'',eligible:false,camp:'',campStatus:'',memberType:'',paste:''})
  const [msg,setMsg]=useState({title:'',body:STARTERS[0][1],camp:'',when:''}),[busy,setBusy]=useState(false)
  useEffect(()=>{all('donors','id,full_name,phone,blood_group,gender,area,last_donation,consent').then(setDonors).catch(e=>toast.error(errText(e)))
    all('members','id,full_name,phone,status,membership_type,blood_group,position').then(setMembers).catch(()=>setMembers([]))
    supabase.from('camps').select('id,name,camp_date,venue,status').is('deleted_at',null).order('camp_date',{ascending:false}).then(({data})=>{setCamps(data||[]);const up=(data||[]).find(c=>c.status==='open');if(up)setMsg(m=>({...m,camp:up.id}))})},[])
  useEffect(()=>{setRegs([]);if(f.camp)supabase.from('registrations').select('donor_id,status').eq('camp_id',f.camp).then(({data})=>setRegs(data||[]))},[f.camp])
  const camp=camps.find(c=>c.id===msg.camp)
  const people=useMemo(()=>{
    if(src==='paste')return [...new Set(f.paste.split(/[\n,;]+/).map(normPhone).filter(p=>/^[6-9]\d{9}$/.test(p)))].map(p=>({phone:p,name:''}))
    if(src==='members')return (members||[]).filter(m=>m.phone&&(f.memberType?m.membership_type===f.memberType:m.status==='active')).map(m=>({phone:m.phone,name:m.full_name,member_id:m.id,bloodgroup:m.blood_group||''}))
    const inCamp=f.camp?new Map(regs.map(r=>[r.donor_id,r.status])):null
    return (donors||[]).filter(d=>d.consent&&d.phone&&(!f.groups.length||f.groups.includes(d.blood_group))&&(!f.gender||d.gender===f.gender)
      &&(!f.area||(d.area||'').toLowerCase().includes(f.area.toLowerCase()))&&(!f.eligible||!d.last_donation||nextEligible(d.last_donation,d.gender)<=new Date())
      &&(!inCamp||(f.campStatus==='none'?!inCamp.has(d.id):inCamp.has(d.id)&&(!f.campStatus||inCamp.get(d.id)===f.campStatus))))
      .map(d=>({phone:d.phone,name:d.full_name,donor_id:d.id,bloodgroup:d.blood_group||'',area:d.area||''}))
  },[src,donors,members,regs,f])
  const vars=p=>({name:p.name||'Friend',club,bloodgroup:p.bloodgroup||'',area:p.area||'',camp:camp?.name||'',date:camp?fmt(camp.camp_date):'',venue:camp?.venue||'',link:camp?`${siteUrl()}#/register/${camp.id}`:siteUrl()})
  const ready=!!status?.ready,[how,setHow]=useState(null),mode=how||(ready&&getSendMode()!=='manual'?'auto':'manual'),manual=mode==='manual'||!ready
  const per=!manual?Math.max(1,Number(status.per_minute)||6):null
  const send=async()=>{if(!people.length)return toast.error('Nobody matches. Change the filters.');if(msg.body.trim().length<5)return toast.error('Write the message first')
    setBusy(true);try{const r=await enqueue(msg.title||msg.body.slice(0,40),'broadcast',people.map(p=>({phone:p.phone,name:p.name,donor_id:p.donor_id,member_id:p.member_id,body:fill(msg.body,vars(p)).trim(),vars:{...vars(p),message:fill(msg.body,vars(p)).trim()}})),msg.when?new Date(msg.when).toISOString():null,manual)
      setSendMode(manual?'manual':'auto');celebrate();toast.success(`${r.queued} messages ${manual?'ready to tap through':'going out from the club number'}${r.skipped?`, ${r.skipped} skipped (stopped or wrong number)`:''}`);onQueued?.(r)}catch(e){toast.error(errText(e))}setBusy(false)}
  // a spoken request becomes the message (and picks the blood group for urgent needs)
  const spoke=x=>{
    if(x.kind==='urgent'){if(x.group){setSrc('donors');setF(v=>({...v,groups:[x.group],eligible:true}))}
      setMsg(m=>({...m,title:`Urgent ${x.group||''}`.trim(),body:`Hello {name}, ${x.group||'{bloodgroup}'} blood is urgently needed${x.units?` (${x.units} unit${x.units>1?'s':''})`:''}${x.hospital?` at ${x.hospital}`:''}. If you can donate, please ${x.phone?`call ${x.contact?x.contact+' on ':''}${x.phone}`:'reply to this message'}. - {club}`}));return toast.success('Message written from what you said. Check it before sending.')}
    const st=STARTERS.find(([l])=>x.kind==='camp'?l==='Camp invite':x.kind==='thanks'?l==='Thank you':false)
    if(st&&x.text.split(' ').length<6){setMsg(m=>({...m,title:st[0],body:st[1]}));return}
    setMsg(m=>({...m,body:x.text.charAt(0).toUpperCase()+x.text.slice(1)+(/[.!?]$/.test(x.text)?'':'.')+' - {club}'}))}
  const toggleGroup=g=>setF({...f,groups:f.groups.includes(g)?f.groups.filter(x=>x!==g):[...f.groups,g]})
  const ins=t=>setMsg({...msg,body:msg.body+t})
  return <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
    <div className="space-y-5">
      <section className="card"><h3 className="mb-3 font-semibold text-fg">1. Who gets it</h3>
        <div className="mb-4 grid grid-cols-3 gap-2">{[['donors','Donors',Users],['members','Club members',IdCard],['paste','Paste numbers',ClipboardPaste]].map(([k,l,I])=>
          <button key={k} onClick={()=>setSrc(k)} className={`tile flex flex-col items-center gap-1 py-3 text-sm transition ${src===k?'border-brand/60 bg-brand/10 text-fg ring-2 ring-brand/20':'text-fog-muted hover:text-fg'}`}><I size={18}/>{l}</button>)}</div>
        {src==='donors'&&<div className="space-y-3">
          <div><div className="label">Blood group</div><div className="flex flex-wrap gap-1.5">{BLOOD.map(g=><button key={g} onClick={()=>toggleGroup(g)} className={`chip font-display font-semibold ${f.groups.includes(g)?'border-blood/50 bg-blood/15 text-fg':''}`}>{g}</button>)}</div></div>
          <div className="grid gap-3 sm:grid-cols-3"><Field label="Area or town"><input className="input" placeholder="Any" value={f.area} onChange={e=>setF({...f,area:e.target.value})}/></Field>
            <Field label="Gender"><select className="input" value={f.gender} onChange={e=>setF({...f,gender:e.target.value})}><option value="">Any</option><option>Male</option><option>Female</option></select></Field>
            <label className="mt-6 flex items-center gap-2 text-sm text-fog"><input type="checkbox" checked={f.eligible} onChange={e=>setF({...f,eligible:e.target.checked})}/>Can donate now</label></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Camp"><select className="input" value={f.camp} onChange={e=>setF({...f,camp:e.target.value,campStatus:''})}><option value="">Any donor</option>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select></Field>
            {f.camp&&<Field label="In that camp"><select className="input" value={f.campStatus} onChange={e=>setF({...f,campStatus:e.target.value})}><option value="">Registered (any)</option><option value="donated">Donated</option><option value="registered">Registered, not come yet</option><option value="deferred">Deferred</option><option value="no_show">Did not come</option><option value="none">Not registered</option></select></Field>}</div>
          <p className="text-xs text-fog-faint">Only donors who agreed to be contacted are included. People who replied STOP are skipped.</p></div>}
        {src==='members'&&<Field label="Members"><select className="input" value={f.memberType} onChange={e=>setF({...f,memberType:e.target.value})}><option value="">All active members</option><option>Active</option><option>Prospective</option><option>Honorary</option><option>Alumni</option></select></Field>}
        {src==='paste'&&<Field label="Mobile numbers" hint="One per line, or separated by commas. Copy a column from Excel."><textarea className="input min-h-[120px] font-mono" value={f.paste} onChange={e=>setF({...f,paste:e.target.value})}/></Field>}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand/10 px-3 py-2 text-sm"><Users size={16} className="text-brand"/><b className="tabular-nums text-fg">{donors===null&&src==='donors'?'…':people.length}</b><span className="text-fog-muted">people will get this message</span></div></section>

      <section className="card"><h3 className="mb-3 font-semibold text-fg">2. The message</h3>
        <div className="mb-3 flex flex-wrap items-start gap-1.5">{STARTERS.map(([l,b])=><button key={l} className="chip" onClick={()=>setMsg({...msg,body:b,title:l})}>{l}</button>)}
          <SpeakFill className="chip" label="Speak the message" hint='e.g. "Urgent O positive needed at GH Salem, call 98765 43210" or say the whole message' onResult={spoke}/>
          <AiWrite kind="whatsapp" club={club} current={msg.body} onText={t=>setMsg(m=>({...m,body:t}))}/></div>
        <Field label="Title (only for you)"><input className="input" placeholder="For example: November camp invite" value={msg.title} onChange={e=>setMsg({...msg,title:e.target.value})}/></Field>
        <div className="mt-3"><Field label="Message" required><textarea className="input min-h-[140px]" value={msg.body} onChange={e=>setMsg({...msg,body:e.target.value})}/></Field>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-fog-faint"><Smile size={13}/>Insert:{['{name}','{bloodgroup}','{camp}','{date}','{venue}','{link}','{club}','🩸','🙏','❤️'].map(t=><button key={t} className="chip px-2 py-0.5 text-xs" onClick={()=>ins(t)}>{t}</button>)}</div></div>
        {/\{(camp|date|venue|link)\}/.test(msg.body)&&<div className="mt-3"><Field label="Camp for {camp}, {date}, {venue} and {link}"><select className="input" value={msg.camp} onChange={e=>setMsg({...msg,camp:e.target.value})}><option value="">None</option>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select></Field></div>}
        <div className="mt-3"><Field label="When" hint="Leave empty to start now. Nothing is sent at night (quiet hours)."><input type="datetime-local" className="input" value={msg.when} onChange={e=>setMsg({...msg,when:e.target.value})}/></Field></div></section></div>

    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-3xl border border-ink-700 bg-[#0B141A]">
        <div className="flex items-center gap-2 bg-[#202C33] px-4 py-3 text-sm text-white"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#25D366]/20 text-[#25D366]"><Megaphone size={15}/></span>{people[0]?.name||'Preview'}</div>
        <div className="min-h-[200px] bg-[radial-gradient(#ffffff08_1px,transparent_1px)] p-4 [background-size:14px_14px]">
          <div className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#005C4B] px-3 py-2 text-[14px] leading-snug text-[#E9EDEF] shadow">{fill(msg.body,vars(people[0]||{name:'Priya'}))||' '}
            <div className="mt-1 text-right text-[10px] text-[#8696A0]">{new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})} ✓✓</div></div></div></div>
      <div className="card text-sm text-fog-muted">
        <div className="mb-2 font-medium text-fg">How to send</div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to send">
          {[['auto',Zap,'Club number','Automatic',!ready],['manual',Smartphone,'Open WhatsApp','You tap send',false]].map(([k,I,l,h,off])=>
            <button key={k} role="radio" aria-checked={(k==='manual')===manual} disabled={off} onClick={()=>setHow(k)} className={`tile flex flex-col items-center gap-1 px-2 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-45 ${(k==='manual')===manual?'border-brand/60 bg-brand/10 text-fg ring-2 ring-brand/20':'hover:text-fg'}`}>
              <I size={18} className={k==='auto'?'text-brand':'text-[#25D366]'}/><span className="text-sm font-medium">{l}</span><span className="text-[11px] text-fog-faint">{h}</span></button>)}</div>
        {!ready&&<div className="mt-2 text-xs text-fog-faint">Club number is off: the club phone is not connected (WhatsApp and alerts → Connect).</div>}
        {per?<div className="mt-3">The club phone sends them, about {Math.ceil(people.length/per)} minutes for all at {per} a minute. Nothing to tap.</div>:<div className="mt-3">WhatsApp opens for each person with the message typed. You press send, then the next one is ready.</div>}
        <button className="btn mt-4 w-full py-3" disabled={busy||!people.length} onClick={send}>{msg.when?<CalendarClock size={16}/>:<Send size={16}/>}{busy?'Queuing…':msg.when?`Schedule for ${people.length}`:`Send to ${people.length}`}</button></div>
    </aside>
  </div>
}
