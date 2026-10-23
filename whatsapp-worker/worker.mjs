// Sends the CRM's WhatsApp outbox from the club's own WhatsApp number.
// 1. Shows a QR code in the CRM (Settings → WhatsApp). Scan it from the club phone: WhatsApp → Linked devices → Link a device.
// 2. Takes queued messages one at a time, at the speed set in the CRM, never in quiet hours, and only up to the daily limit.
// 3. Anyone who replies STOP is never messaged again (START undoes it).
// 4. Queues the daily automatic messages at 8 am in case the database scheduler is not set up.
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from '@supabase/supabase-js'

const VERSION='1.0.0'
const here=path.dirname(new URL(import.meta.url).pathname)
for(const f of [path.join(here,'.env'),'.env'])if(fs.existsSync(f))for(const line of fs.readFileSync(f,'utf8').split('\n')){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env,DRY=process.env.DRY_RUN==='1'
const AUTH_DIR=path.resolve(here,process.env.AUTH_DIR||'auth')
if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');process.exit(1)}
const sb=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const log=(...a)=>console.log(new Date().toISOString(),...a)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const istNow=()=>new Date(Date.now()+5.5*3600e3)   // read with getUTC* for Indian time

let B=null,sock=null,state='starting',qr=null,me={},starting=false

async function beat(){
  const {data,error}=await sb.rpc('wa_heartbeat',{p_status:state,p_qr:qr,p_phone:me.phone||null,p_name:me.name||null,p_version:VERSION})
  if(error)return log('heartbeat failed:',error.message)
  if(data==='logout')await logout()
  else if(data==='restart'){log('restart asked from the CRM');try{sock?.end?.()}catch{}setTimeout(start,1000)}
}

async function logout(){
  log('logging out of WhatsApp')
  try{await sock?.logout?.()}catch{}
  fs.rmSync(AUTH_DIR,{recursive:true,force:true});state='logged_out';qr=null;me={};await beat()
  setTimeout(start,2000)
}

async function start(){
  if(starting)return;starting=true
  try{
    if(DRY){state='connected';me={phone:'0000000000',name:'Test (dry run)'};log('DRY_RUN: messages are printed, not sent');await beat();return}
    B??=await import('@whiskeysockets/baileys')
    const make=B.makeWASocket||B.default?.default||B.default
    const {state:auth,saveCreds}=await B.useMultiFileAuthState(AUTH_DIR)
    let version;try{({version}=await B.fetchLatestBaileysVersion())}catch{}
    const pino=(await import('pino')).default
    state='starting';await beat()
    sock=make({auth,version,printQRInTerminal:false,browser:B.Browsers.ubuntu('Club CRM'),logger:pino({level:'warn'}),markOnlineOnConnect:false,syncFullHistory:false,generateHighQualityLinkPreview:false})
    sock.ev.on('creds.update',saveCreds)
    sock.ev.on('connection.update',async u=>{
      if(u.qr){state='qr';qr=u.qr;log('scan the QR in the CRM (Settings → WhatsApp) or here:');(await import('qrcode-terminal')).default.generate(u.qr,{small:true});await beat()}
      if(u.connection==='open'){state='connected';qr=null;me={phone:String(sock.user?.id||'').split(':')[0].split('@')[0],name:sock.user?.name||sock.user?.verifiedName||''};log('connected as',me.phone,me.name);await beat()}
      if(u.connection==='close'){const code=u.lastDisconnect?.error?.output?.statusCode
        if(code===B.DisconnectReason.loggedOut){log('the phone unlinked this device');fs.rmSync(AUTH_DIR,{recursive:true,force:true});state='logged_out';me={};qr=null;await beat()}
        else{state='starting';log('connection closed',code||'','- reconnecting')}
        setTimeout(start,code===B.DisconnectReason.loggedOut?2000:5000)}
    })
    sock.ev.on('messages.upsert',async ({messages,type})=>{if(type!=='notify')return
      for(const m of messages){if(m.key.fromMe)continue;const jid=m.key.remoteJid||'';if(!jid.endsWith('@s.whatsapp.net'))continue
        const text=(m.message?.conversation||m.message?.extendedTextMessage?.text||'').trim().toLowerCase(),phone=jid.split('@')[0].slice(-10)
        try{if(/^(stop|unsubscribe|நிறுத்து|நிறுத்தவும்)$/.test(text)){await sb.rpc('wa_optout_add',{p_phone:phone,p_reason:'Replied STOP'});await sock.sendMessage(jid,{text:'You will not get messages from us any more. Reply START if you want them again.'});log('opt-out',phone)}
          else if(text==='start'){await sb.rpc('wa_optout_remove',{p_phone:phone});await sock.sendMessage(jid,{text:'Welcome back. You will get camp updates from us again. Reply STOP to stop.'});log('opt-in',phone)}}
        catch(e){log('reply handling failed',e.message)}}})
  }catch(e){log('start failed:',e.message);state='starting';setTimeout(start,15000)}
  finally{starting=false}
}

async function sendOne(o){
  const jid=`91${o.phone}@s.whatsapp.net`
  try{
    if(DRY){log(`DRY_RUN to ${o.phone} (${o.name||''}): ${o.body.slice(0,80)}`);return sb.rpc('wa_result',{p_id:o.id,p_ok:true,p_error:null,p_msg_id:'dry-'+o.id.slice(0,8)})}
    const [r]=await sock.onWhatsApp(jid)
    if(!r?.exists)return sb.rpc('wa_result',{p_id:o.id,p_ok:false,p_error:'This number is not on WhatsApp',p_msg_id:null})
    await sock.presenceSubscribe(r.jid).catch(()=>{});await sock.sendPresenceUpdate('composing',r.jid).catch(()=>{})
    await sleep(1200+Math.random()*1800);await sock.sendPresenceUpdate('paused',r.jid).catch(()=>{})
    const sent=await sock.sendMessage(r.jid,{text:o.body})
    log('sent to',o.phone);return sb.rpc('wa_result',{p_id:o.id,p_ok:true,p_error:null,p_msg_id:sent?.key?.id||null})
  }catch(e){log('send failed',o.phone,e.message);return sb.rpc('wa_result',{p_id:o.id,p_ok:false,p_error:'retry: '+e.message,p_msg_id:null})}
}

async function sendLoop(){
  for(;;){
    try{
      if(state==='connected'){
        const {data:s}=await sb.from('wa_settings').select('provider,per_minute').eq('id',1).single()
        if(s?.provider==='qr'){
          const {data:rows,error}=await sb.rpc('wa_claim',{p_limit:1})
          if(error)log('claim failed:',error.message)
          else if(rows?.length){await sendOne(rows[0]);await sleep(60000/Math.max(1,s.per_minute)*(0.7+Math.random()*0.6));continue}
        }
      }
    }catch(e){log('loop error',e.message)}
    await sleep(10000)
  }
}

let rulesDay=''
async function dailyRules(){
  const t=istNow(),day=t.toISOString().slice(0,10)
  if(rulesDay===day||t.getUTCHours()<8)return
  const {data,error}=await sb.rpc('wa_daily_rules',{p_day:null})
  if(error)return log('daily messages failed:',error.message)
  rulesDay=day;log('daily messages queued',JSON.stringify(data))
}

log(`CRM WhatsApp worker ${VERSION}${DRY?' (dry run)':''}`)
await start()
setInterval(beat,20000)
setInterval(dailyRules,10*60000);dailyRules()
sendLoop()
process.on('SIGTERM',async()=>{state='offline';await beat();process.exit(0)})
process.on('SIGINT',async()=>{state='offline';await beat();process.exit(0)})
