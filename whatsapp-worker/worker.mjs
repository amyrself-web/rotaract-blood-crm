// Sends the CRM's WhatsApp outbox from the club's own WhatsApp number.
// 1. Shows a QR code in the CRM (Settings → WhatsApp). Scan it from the club phone: WhatsApp → Linked devices → Link a device.
// 2. Takes queued messages one at a time, at the speed set in the CRM, never in quiet hours, and only up to the daily limit.
// 3. Anyone who replies STOP is never messaged again (START undoes it).
// 4. Queues the daily automatic messages at 8 am in case the database scheduler is not set up.
// 5. Keeps itself up to date: every 6 hours it fetches the newest sender from the CRM's GitHub and restarts on it (AUTO_UPDATE=0 to turn off).
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createClient} from '@supabase/supabase-js'

const VERSION='1.4.0'
const ENGINE=(process.env.ENGINE||'baileys').toLowerCase()   // 'baileys' (built in) or 'openwa' (an OpenWA gateway on this machine)
const here=path.dirname(fileURLToPath(import.meta.url))   // works on Windows too
for(const f of [path.join(here,'.env'),'.env'])if(fs.existsSync(f))for(const line of fs.readFileSync(f,'utf8').split('\n')){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env,DRY=process.env.DRY_RUN==='1'
const AUTH_DIR=path.resolve(here,process.env.AUTH_DIR||'auth')
if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');process.exit(1)}
const sb=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const log=(...a)=>console.log(new Date().toISOString(),...a)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const istNow=()=>new Date(Date.now()+5.5*3600e3)   // read with getUTC* for Indian time

let B=null,sock=null,state='starting',qr=null,me={},starting=false,owa=null

async function beat(){
  const {data,error}=await sb.rpc('wa_heartbeat',{p_status:state,p_qr:qr,p_phone:me.phone||null,p_name:me.name||null,p_version:VERSION})
  if(error)return log('heartbeat failed:',error.message)
  if(data==='logout')owa?await owa.logout():await logout()
  else if(data==='restart'){log('restart asked from the CRM');if(owa)await owa.restart();else{try{sock?.end?.()}catch{}setTimeout(start,1000)}}
}

async function logout(){
  log('logging out of WhatsApp')
  try{await sock?.logout?.()}catch{}
  fs.rmSync(AUTH_DIR,{recursive:true,force:true});state='logged_out';qr=null;me={};await beat()
  setTimeout(start,2000)
}

// STOP / START replies, from either engine
async function incoming(phone,text,reply){
  const t=String(text||'').trim().toLowerCase()
  if(/^(stop|unsubscribe|நிறுத்து|நிறுத்தவும்)$/.test(t)){await sb.rpc('wa_optout_add',{p_phone:phone,p_reason:'Replied STOP'});await reply('You will not get messages from us any more. Reply START if you want them again.');log('opt-out',phone)}
  else if(t==='start'){await sb.rpc('wa_optout_remove',{p_phone:phone});await reply('Welcome back. You will get camp updates from us again. Reply STOP to stop.');log('opt-in',phone)}
}

async function start(){
  if(ENGINE==='openwa'&&!DRY){
    const {createOpenWA}=await import('./openwa.mjs')
    owa=createOpenWA({log,setState:(s,q,who)=>{const changed=s!==state||q!==qr;state=s;qr=q;if(who)me=who;if(changed){if(s==='qr')log('scan the QR in the CRM (WhatsApp and alerts → Connect)');beat()}},
      onIncoming:(phone,text)=>incoming(phone,text,msg=>owa.reply(phone,msg))})
    return owa.start()
  }
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
        try{await incoming(phone,text,msg=>sock.sendMessage(jid,{text:msg}))}
        catch(e){log('reply handling failed',e.message)}}})
  }catch(e){log('start failed:',e.message);state='starting';setTimeout(start,15000)}
  finally{starting=false}
}

async function sendOne(o){
  const jid=`91${o.phone}@s.whatsapp.net`
  try{
    if(DRY){log(`DRY_RUN to ${o.phone} (${o.name||''}): ${o.body.slice(0,80)}`);return sb.rpc('wa_result',{p_id:o.id,p_ok:true,p_error:null,p_msg_id:'dry-'+o.id.slice(0,8)})}
    if(owa){const r=await owa.send(o.phone,o.body,o.id);if(r.ok)log('sent to',o.phone);return sb.rpc('wa_result',{p_id:o.id,p_ok:r.ok,p_error:r.ok?null:r.error,p_msg_id:r.ok?r.id:null})}
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
// Every 10 minutes ask the database to do the day's work: at (send time - 30 min) it runs the morning check and queues
// birthday wishes and reminders for the send time. The database also does this by itself (pg_cron); this is a second clock.
async function dailyRules(){
  const {data,error}=await sb.rpc('daily_tick')
  if(!error){if(data&&Object.keys(data).length)log('daily tick',JSON.stringify(data));return}
  if(!/daily_tick/.test(error.message||''))return log('daily tick failed:',error.message)
  const t=istNow(),day=t.toISOString().slice(0,10)          // older database without daily_tick
  if(rulesDay===day||t.getUTCHours()<8)return
  const r=await sb.rpc('wa_daily_rules',{p_day:null})
  if(r.error)return log('daily messages failed:',r.error.message)
  rulesDay=day;log('daily messages queued',JSON.stringify(r.data))
}

// self-update: the newest sender files come from the CRM's own GitHub repository
const REPO_RAW=process.env.UPDATE_URL||'https://raw.githubusercontent.com/amyrself-web/rotaract-blood-crm/main/whatsapp-worker/'
const newer=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)}return false}
async function selfUpdate(){
  if(process.env.AUTO_UPDATE==='0'||DRY)return
  try{const r=await fetch(REPO_RAW+'worker.mjs',{cache:'no-store'});if(!r.ok)return log('update check failed:',r.status)
    const code=await r.text(),v=(code.match(/const VERSION='([\d.]+)'/)||[])[1]
    if(!v||!newer(v,VERSION)||!code.includes('sendLoop')||code.length<4000)return
    const ow=await fetch(REPO_RAW+'openwa.mjs',{cache:'no-store'}).then(x=>x.ok?x.text():null).catch(()=>null)
    fs.writeFileSync(path.join(here,'worker.mjs.new'),code);fs.renameSync(path.join(here,'worker.mjs.new'),path.join(here,'worker.mjs'))
    if(ow&&ow.length>1000)fs.writeFileSync(path.join(here,'openwa.mjs'),ow)
    log(`updated the sender ${VERSION} -> ${v}, restarting on the new version`);state='starting';await beat().catch(()=>{});process.exit(1)
  }catch(e){log('update check error:',e?.message||e)}}

// never die silently: log unexpected errors and keep going; after many in a row, exit so Windows / systemd starts a fresh copy
let crashes=[]
process.on('unhandledRejection',e=>log('unexpected error (still running):',e?.message||e))
process.on('uncaughtException',e=>{log('unexpected crash:',e?.stack||e);crashes=crashes.filter(t=>Date.now()-t<60000);crashes.push(Date.now())
  if(crashes.length>5){log('too many errors in a minute, restarting');process.exit(1)}})
log(`CRM WhatsApp worker ${VERSION} · engine ${ENGINE}${DRY?' (dry run)':''}`)
await start()
setInterval(()=>beat().catch(e=>log('heartbeat error:',e?.message||e)),20000)
setInterval(()=>dailyRules().catch(e=>log('daily tick error:',e?.message||e)),10*60000);dailyRules().catch(e=>log('daily tick error:',e?.message||e))
setTimeout(()=>selfUpdate(),60000);setInterval(()=>selfUpdate(),6*3600e3)
sendLoop().catch(e=>{log("send loop stopped, restarting:",e?.message||e);process.exit(1)})
process.on('SIGTERM',async()=>{state='offline';await beat();process.exit(0)})
process.on('SIGINT',async()=>{state='offline';await beat();process.exit(0)})
