import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Smartphone,Cloud,QrCode,CheckCircle2,LogOut,RefreshCw,Copy,Send,Gauge,Moon,Laptop,ExternalLink} from 'lucide-react'
import QRCode from 'qrcode'
import {supabase} from '../../lib/supabase'
import {Field,Badge,useConfirm,errText} from '../ui'
import {siteUrl,useWaStatus,KIND_LABEL} from '../../lib/wa'

const FN_URL=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-cloud`
const copy=t=>navigator.clipboard?.writeText(t).then(()=>toast.success('Copied'))
const Step=({n,children})=><li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-semibold text-brand">{n}</span><div className="min-w-0 flex-1 text-sm text-fog">{children}</div></li>
const Cmd=({children})=><div className="mt-1 flex items-start gap-2 rounded-lg bg-ink-950 p-2 font-mono text-xs text-fog"><pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all">{children}</pre><button className="btn-ghost p-1" aria-label="Copy command" onClick={()=>copy(children)}><Copy size={13}/></button></div>
const TPL_KINDS=['broadcast','birthday','eligible_again','reminder_1d','reminder_today','followup','certificate','meeting_1d','emergency']

export default function Connect(){
  const confirm=useConfirm(),st=useWaStatus(4000)
  const [w,setW]=useState(null),[saving,setSaving]=useState(false),[qrImg,setQrImg]=useState(''),[test,setTest]=useState({phone:'',template:''})
  useEffect(()=>{supabase.from('wa_settings').select('*').eq('id',1).single().then(({data,error})=>error?toast.error(error.message):setW({...data,quiet_from:data.quiet_from.slice(0,5),quiet_to:data.quiet_to.slice(0,5)}))},[])
  useEffect(()=>{if(st?.qr)QRCode.toDataURL(st.qr,{margin:2,width:300}).then(setQrImg);else setQrImg('')},[st?.qr])
  const save=async(patch={})=>{const next={...w,...patch};setW(next);setSaving(true)
    const {id,updated_at,last_rules_at,last_rules,...row}=next
    const {error}=await supabase.from('wa_settings').update({...row,per_minute:Number(row.per_minute),daily_cap:Number(row.daily_cap),site_url:siteUrl(),updated_at:new Date().toISOString()}).eq('id',1)
    setSaving(false);error?toast.error(error.message):toast.success('WhatsApp settings saved')}
  const cmd=async c=>{if(c==='logout'&&!await confirm({title:'Log out the club phone?',body:'Messages stop until someone scans the QR code again.',action:'Log out'}))return
    const {error}=await supabase.rpc('wa_command',{p_cmd:c});error?toast.error(error.message):toast.success(c==='logout'?'Logging out…':'Restarting…')}
  const sendTest=async()=>{const {data,error}=await supabase.functions.invoke('wa-cloud?test=1',{body:{phone:test.phone,template:test.template||undefined}})
    if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch{}return toast.error(m)}data?.ok?toast.success('Test message sent'):toast.error(data?.error||'Not sent')}
  if(!w)return <div className="skeleton h-72"/>
  const P=[['manual',Smartphone,'Tap to send','Free. No setup. The CRM opens WhatsApp with each message typed; you press send. Good for up to about 100 messages at a time.'],
    ['cloud',Cloud,'Official WhatsApp API','Sends by itself, from Meta’s servers. Needs a Meta Business account and approved message templates. Small charge per message.'],
    ['qr',QrCode,'Club phone, linked by QR','Sends by itself from the club’s own number. Needs a computer or an old Android phone that stays on with the CRM sender running.']]
  const tpl=w.cloud_templates||{},setTpl=(k,p)=>setW({...w,cloud_templates:{...tpl,[k]:{...(tpl[k]||{}),...p}}})
  return <div className="space-y-5">
    <section className="card"><h3 className="mb-3 font-semibold text-fg">How messages are sent</h3>
      <div className="grid gap-3 md:grid-cols-3">{P.map(([k,I,l,d])=><button key={k} onClick={()=>save({provider:k})} className={`tile p-4 text-left transition ${w.provider===k?'border-brand/60 bg-brand/10 ring-2 ring-brand/20':'hover:border-ink-500'}`}>
        <div className="flex items-center gap-2"><I size={18} className="text-brand"/><span className="font-semibold text-fg">{l}</span>{w.provider===k&&<CheckCircle2 size={16} className="ml-auto text-ok"/>}</div>
        <p className="mt-1.5 text-xs text-fog-muted">{d}</p></button>)}</div></section>

    {w.provider==='qr'&&<section className="card"><div className="mb-4 flex flex-wrap items-center gap-3"><h3 className="flex-1 font-semibold text-fg">Club phone</h3>
        <Badge tone={st?.status==='connected'?'green':st?.status==='qr'?'blue':'amber'}>{st?.status==='connected'?'Connected':st?.status==='qr'?'Waiting for scan':st?.status==='starting'?'Starting':st?.status==='logged_out'?'Logged out':'Sender not running'}</Badge>
        {st?.status&&st.status!=='offline'&&<><button className="btn-quiet" onClick={()=>cmd('restart')}><RefreshCw size={15}/>Restart</button>{st.status==='connected'&&<button className="btn-quiet text-blood" onClick={()=>cmd('logout')}><LogOut size={15}/>Log out</button>}</>}</div>
      {st?.status==='connected'?<div className="flex items-center gap-4 rounded-2xl bg-ok/10 p-4"><CheckCircle2 size={32} className="text-ok"/><div><div className="font-display text-lg font-semibold text-fg">+{st.phone}</div><div className="text-sm text-fog-muted">{st.name||'WhatsApp'} · {st.sent_today} sent today · {st.queued} waiting</div></div></div>
      :st?.status==='qr'&&qrImg?<div className="flex flex-wrap items-center gap-6"><img src={qrImg} alt="WhatsApp link QR code" className="h-60 w-60 rounded-2xl bg-white p-2"/>
        <ol className="space-y-2 text-sm text-fog"><li>1. Open WhatsApp on the club phone</li><li>2. Tap ⋮ (Android) or Settings (iPhone) → <b>Linked devices</b></li><li>3. Tap <b>Link a device</b> and point the phone at this code</li><li className="text-xs text-fog-faint">The code changes every 20 seconds; this page updates by itself.</li></ol></div>
      :<div><p className="mb-3 text-sm text-fog-muted">The sender is a small program. Run it on any computer or old Android phone that stays switched on and connected to the internet. When it starts, the QR code shows here.</p>
        <ol className="space-y-4">
          <Step n="1"><b>Windows or Mac laptop:</b> install Node.js 20 from nodejs.org, then in a terminal:<Cmd>{`git clone https://github.com/amyrself-web/rotaract-blood-crm.git\ncd rotaract-blood-crm/whatsapp-worker\nnpm install\ncopy .env.example .env      (Mac: cp .env.example .env)\nnpm start`}</Cmd></Step>
          <Step n="2"><b>Old Android phone:</b> install Termux from F-Droid, then:<Cmd>{`pkg install nodejs-lts git -y\ngit clone https://github.com/amyrself-web/rotaract-blood-crm.git\ncd rotaract-blood-crm/whatsapp-worker && npm install\ncp .env.example .env && nano .env\nnpm start`}</Cmd></Step>
          <Step n="3">In the <b>.env</b> file paste the Supabase <b>secret (service role) key</b> from Supabase → Project Settings → API keys. Keep that file private.</Step>
          <Step n="4">Keep the device on charge and on Wi-Fi. Use a separate club number, not a personal one.</Step></ol></div>}
    </section>}

    {w.provider==='cloud'&&<section className="card space-y-4"><h3 className="font-semibold text-fg">Official WhatsApp API</h3>
      <ol className="space-y-3">
        <Step n="0">One time, in a terminal with the Supabase CLI: <Cmd>{`supabase functions deploy wa-cloud --no-verify-jwt --project-ref ${(import.meta.env.VITE_SUPABASE_URL||'').match(/https:\/\/([^.]+)/)?.[1]||'YOUR_PROJECT'}`}</Cmd>then run <code className="code">supabase/v9b-cloud-cron.sql</code> in the Supabase SQL Editor so waiting messages go out every minute.</Step>
        <Step n="1">Create a Meta Business account and a WhatsApp app at <a className="text-brand hover:underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com <ExternalLink size={11} className="inline"/></a>. Add a phone number that is not already on the WhatsApp app.</Step>
        <Step n="2">Make a permanent access token (System user → Generate token, with whatsapp_business_messaging). In Supabase → Edge Functions → Secrets add <code className="code">WA_CLOUD_TOKEN</code> = that token and <code className="code">WA_VERIFY_TOKEN</code> = any phrase.</Step>
        <Step n="3">Webhook (so STOP replies and failures come back): callback URL<Cmd>{FN_URL}</Cmd>verify token = the phrase from step 2. Subscribe to <b>messages</b>.</Step>
        <Step n="4">Messages to people who have not written to you in 24 hours must use an approved template. Create templates in WhatsApp Manager and enter their names below. Parameters are filled in order, for example <code className="code">name, camp, date</code>.</Step></ol>
      <Field label="Phone number ID" hint="WhatsApp → API setup → Phone number ID"><input className="input font-mono" value={w.cloud_phone_id||''} onChange={e=>setW({...w,cloud_phone_id:e.target.value})}/></Field>
      <div className="overflow-x-auto"><table className="table text-sm"><thead><tr><th>Message</th><th>Template name</th><th className="w-20">Language</th><th>Parameters, in order</th></tr></thead>
        <tbody>{TPL_KINDS.map(k=><tr key={k}><td className="whitespace-nowrap text-fog">{KIND_LABEL[k]||k}</td>
          <td><input className="input px-2 py-1 font-mono text-xs" placeholder="not set" value={tpl[k]?.name||''} onChange={e=>setTpl(k,{name:e.target.value})}/></td>
          <td><input className="input px-2 py-1 text-xs" placeholder="en" value={tpl[k]?.lang||''} onChange={e=>setTpl(k,{lang:e.target.value})}/></td>
          <td><input className="input px-2 py-1 font-mono text-xs" placeholder="name, message" value={(tpl[k]?.params||[]).join(', ')} onChange={e=>setTpl(k,{params:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></td></tr>)}</tbody></table></div>
      <p className="text-xs text-fog-faint">Words you can use as parameters: name, message (the whole message), club, camp, date, venue, slot, link, bloodgroup, meeting, time.</p>
      <div className="tile flex flex-wrap items-end gap-3 p-4"><Field label="Send a test to"><input className="input" inputMode="numeric" placeholder="10-digit mobile" value={test.phone} onChange={e=>setTest({...test,phone:e.target.value})}/></Field>
        <Field label="Template (optional)"><input className="input font-mono" placeholder="hello_world" value={test.template} onChange={e=>setTest({...test,template:e.target.value})}/></Field>
        <button className="btn-quiet" onClick={sendTest}><Send size={15}/>Send test</button></div>
    </section>}

    <section className="card"><h3 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Gauge size={17} className="text-brand"/>Speed and quiet hours</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Messages a minute" hint="Keep low for a new number"><input className="input" type="number" min="1" max="30" value={w.per_minute} onChange={e=>setW({...w,per_minute:e.target.value})}/></Field>
        <Field label="Most in a day"><input className="input" type="number" min="1" max="5000" value={w.daily_cap} onChange={e=>setW({...w,daily_cap:e.target.value})}/></Field>
        <Field label={<span className="inline-flex items-center gap-1"><Moon size={12}/>Quiet from</span>}><input className="input" type="time" value={w.quiet_from} onChange={e=>setW({...w,quiet_from:e.target.value})}/></Field>
        <Field label="Quiet until"><input className="input" type="time" value={w.quiet_to} onChange={e=>setW({...w,quiet_to:e.target.value})}/></Field></div>
      <p className="mt-2 text-xs text-fog-faint">Nothing is sent in quiet hours; it waits for the morning. {w.provider==='qr'&&'For a club phone, start with 6 a minute and 250 a day, and raise slowly.'}</p>
      <div className="mt-4 flex justify-end"><button className="btn" disabled={saving} onClick={()=>save()}>{saving?'Saving…':'Save'}</button></div></section>
  </div>
}
