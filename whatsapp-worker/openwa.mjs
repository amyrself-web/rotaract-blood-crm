// OpenWA engine: the CRM worker drives an OpenWA gateway (github.com/rmyndharis/OpenWA) over its REST API
// instead of talking to WhatsApp itself. OpenWA can use whatsapp-web.js (a real headless Chrome, lower ban risk)
// and has its own dashboard. Everything stays on this machine: the worker calls OpenWA on localhost / the
// compose network, and OpenWA calls the worker back (webhook) when someone replies STOP.
import fs from 'node:fs'
import http from 'node:http'
import crypto from 'node:crypto'

export function createOpenWA({log,setState,onIncoming}){
  const base=(process.env.OPENWA_URL||'http://localhost:2785').replace(/\/$/,'')
  const name=process.env.OPENWA_SESSION||'club-crm'
  const hookPort=Number(process.env.WEBHOOK_PORT||2790)
  const hookUrl=process.env.WEBHOOK_PUBLIC_URL||`http://host.docker.internal:${hookPort}/openwa`
  const secret=process.env.WEBHOOK_SECRET||crypto.createHash('sha256').update('crm-'+(process.env.SUPABASE_SERVICE_ROLE_KEY||'')).digest('hex').slice(0,32)
  let sid=null,lastStart=0,hooked=false
  const key=()=>{const f=process.env.OPENWA_API_KEY_FILE;if(process.env.OPENWA_API_KEY)return process.env.OPENWA_API_KEY
    try{return f?fs.readFileSync(f,'utf8').trim():''}catch{return ''}}
  async function api(method,p,body,headers={}){
    const r=await fetch(base+'/api'+p,{method,headers:{'X-API-Key':key(),'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined})
    const text=await r.text();let j=null;try{j=text?JSON.parse(text):null}catch{}
    if(!r.ok){const e=new Error(`OpenWA ${method} ${p}: ${r.status} ${j?.message||text.slice(0,120)}`);e.status=r.status;throw e}
    return j
  }
  async function ensure(){
    if(sid)return sid
    const list=await api('GET','/sessions?name='+encodeURIComponent(name))
    sid=(Array.isArray(list)?list[0]:list?.data?.[0])?.id||(await api('POST','/sessions',{name})).id
    log('OpenWA session',name,sid);return sid
  }
  async function hook(){
    if(hooked)return
    const hooks=await api('GET',`/sessions/${sid}/webhooks`).catch(()=>[])
    const arr=Array.isArray(hooks)?hooks:hooks?.data||[]
    if(!arr.some(h=>h.url===hookUrl))await api('POST',`/sessions/${sid}/webhooks`,{url:hookUrl,events:['message.received'],secret})
    hooked=true;log('STOP replies come back to',hookUrl)
  }
  // keep the session running and tell the CRM what state it is in
  async function tick(){
    try{
      await ensure()
      const s=await api('GET',`/sessions/${sid}`)
      const st=String(s?.status||'').toLowerCase()
      if(st==='ready'){setState('connected',null,{phone:s.phone||'',name:s.pushName||''});await hook().catch(e=>log('webhook setup:',e.message))}
      else if(st==='qr_ready'){const q=await api('GET',`/sessions/${sid}/qr`).catch(()=>null);setState('qr',q?.qrCode||null)}
      else if(['created','stopped','disconnected','failed','logged_out',''].includes(st)){
        setState(st==='logged_out'?'logged_out':'starting',null)
        if(Date.now()-lastStart>60000){lastStart=Date.now();await api('POST',`/sessions/${sid}/start`).catch(e=>log('start:',e.message))}}
      else setState('starting',null)
    }catch(e){if(e.status===404)sid=null;setState('starting',null);log('OpenWA not reachable:',e.message)}
  }
  // the webhook receiver: OpenWA POSTs message.received here; the HMAC proves it came from OpenWA
  http.createServer((req,res)=>{
    if(req.method!=='POST'||!req.url.startsWith('/openwa')){res.writeHead(404).end();return}
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>2e6)req.destroy()})
    req.on('end',async()=>{
      const sig=String(req.headers['x-openwa-signature']||''),want='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex')
      if(sig.length!==want.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(want))){res.writeHead(401).end();return}
      res.writeHead(200).end('ok')
      try{const b=JSON.parse(raw),d=b.data||b.payload?.data||{}
        if((b.event||b.payload?.event)!=='message.received'||d.fromMe)return
        const from=String(d.senderPhone||d.from||'').split('@')[0].replace(/\D/g,'').slice(-10)
        if(from.length===10&&!String(d.from||'').endsWith('@g.us'))await onIncoming(from,String(d.body||''))}catch(e){log('webhook:',e.message)}
    })
  }).listen(hookPort,process.env.WEBHOOK_HOST||'0.0.0.0',()=>log('listening for OpenWA webhooks on port',hookPort))

  return {
    async start(){await tick();setInterval(tick,5000)},
    async send(phone,text,id){
      await ensure()
      const c=await api('GET',`/sessions/${sid}/contacts/check/91${phone}`).catch(e=>{throw new Error('retry: '+e.message)})
      if(!c?.exists)return {ok:false,error:'This number is not on WhatsApp'}
      const m=await api('POST',`/sessions/${sid}/messages/send-text`,{chatId:c.whatsappId,text},{'Idempotency-Key':id})
      return {ok:true,id:m?.id||m?.messageId||m?.data?.id||null}
    },
    async reply(phone,text){await ensure();await api('POST',`/sessions/${sid}/messages/send-text`,{chatId:`91${phone}@c.us`,text}).catch(()=>{})},
    async logout(){await ensure();await api('POST',`/sessions/${sid}/logout`).catch(e=>log('logout:',e.message));hooked=false},
    async restart(){await ensure();await api('POST',`/sessions/${sid}/stop`).catch(()=>{});lastStart=0;await tick()},
  }
}
