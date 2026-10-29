// WhatsApp outbox helpers used by every page that sends messages.
import {useEffect,useState} from 'react'
import {supabase} from './supabase'

export const siteUrl=()=>`${location.origin}${location.pathname}`
export const certLink=code=>code?`${siteUrl()}#/certificate/${code.length===12?code.match(/.{4}/g).join('-'):code}`:''
export const fill=(body,v)=>String(body||'').replace(/\{(\w+)\}/g,(_,k)=>v[k]??'')
export const PROVIDERS={manual:'Tap to send',cloud:'Official WhatsApp API',qr:'Club phone linked by QR'}
export const KIND_LABEL={broadcast:'Broadcast',direct:'Direct message',duty:'Duty slip',event_pass:'Entry pass',notice:'Notice',login:'Login details',donation_thanks:'Donation thanks',birthday:'Birthday',eligible_again:'Eligible again',reminder_early:'Camp reminder',reminder_1d:'Camp reminder, day before',
  reminder_today:'Camp reminder, morning',thank_you:'Thank-you',followup:'Next-day thank-you',certificate:'Certificate',invite:'Camp invite',meeting_1d:'Meeting reminder',emergency:'Emergency',test:'Test'}

// items: [{phone,name,body,donor_id?,member_id?,ref?,vars?}]
// manual=true: you send them yourself ("Open WhatsApp"); the automatic sender leaves them alone
export async function enqueue(title,kind,items,sendAfter=null,manual=false,urgent=false){
  const args={p_title:title,p_kind:kind,p_items:items,p_send_after:sendAfter}
  let {data,error}=await supabase.rpc('wa_enqueue',{...args,p_manual:!!manual,...(urgent?{p_urgent:true}:{})})
  // database not yet on v14: queue the old way (the Outbox "Tap to send" still works)
  if(error&&(error.code==='PGRST202'||/p_manual/.test(error.message||'')))({data,error}=await supabase.rpc('wa_enqueue',args))
  if(error)throw error
  if(!manual)kick()
  return data
}
// with the Cloud API, start sending at once instead of waiting for the next minute
export async function kick(){
  try{const {data}=await supabase.from('wa_settings').select('provider').eq('id',1).single();if(data?.provider==='cloud')supabase.functions.invoke('wa-cloud?run=1',{body:{}}).catch(()=>{})}catch{}
}

export function useWaStatus(ms=15000){
  const [s,setS]=useState(null)
  useEffect(()=>{let live=true
    const get=()=>supabase.rpc('wa_status').then(({data})=>live&&data&&setS(data))
    get();const t=setInterval(get,ms);return()=>{live=false;clearInterval(t)}},[ms])
  return s
}

// one shared, slow poll for the many send buttons on a page (null = cannot see the sender, e.g. no Messages permission)
let shared=null,subs=new Set(),timer=null,last=0
async function pollShared(){const {data,error}=await supabase.rpc('wa_status');shared=error?null:data;last=Date.now();subs.forEach(f=>f(shared))}
export function useWaReady(enabled=true){
  const [s,setS]=useState(shared)
  useEffect(()=>{if(!enabled)return;subs.add(setS);if(Date.now()-last>20000)pollShared();if(!timer)timer=setInterval(pollShared,60000)
    return()=>{subs.delete(setS);if(!subs.size){clearInterval(timer);timer=null}}},[enabled])
  return s
}
export const refreshWaReady=()=>pollShared()
// how messages go out: 'auto' (club number) or 'manual' (open WhatsApp yourself); remembered on this device
// why a queued message has not gone yet, in plain words (status = wa_status())
const hm=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'}):''
const ago=t=>{if(!t)return 'never';const m=Math.round((Date.now()-new Date(t))/60000);return m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} days ago`}
export function waitReason(r,s){if(r.status!=='queued')return null
  if(r.manual)return ['You send this one: use Tap to send','green']
  if(!s||s.provider==='manual')return ['Waiting for you to send it','green']
  if(s.provider==='qr'&&s.status==='offline')return [`Sender is not running (last seen ${ago(s.last_seen)}). It goes when the sender is back`,'red']
  if(s.provider==='qr'&&s.status==='qr')return ['Club phone is logged out: scan the QR in Connect','red']
  if(s.provider==='qr'&&s.status!=='connected')return ['Club phone is not connected yet','amber']
  const quiet=s.quiet_now&&!r.urgent&&r.kind!=='emergency'
  if(quiet&&new Date(r.send_after)<=new Date(new Date(s.quiet_ends).getTime()+60000))return [`Quiet hours: goes at ${hm(s.quiet_ends)}`,'amber']
  if(new Date(r.send_after)>new Date())return [`Scheduled for ${hm(r.send_after)}`,'blue']
  if(s.cap_left===0)return ['Daily limit reached: goes tomorrow','amber']
  return ['In line: going out now','blue']}
export const sinceText=ago

export const getSendMode=()=>{try{return localStorage.getItem('wa-send-mode')||''}catch{return ''}}
export const setSendMode=m=>{try{localStorage.setItem('wa-send-mode',m)}catch{}}
