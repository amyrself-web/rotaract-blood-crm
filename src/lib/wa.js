// WhatsApp outbox helpers used by every page that sends messages.
import {useEffect,useState} from 'react'
import {supabase} from './supabase'

export const siteUrl=()=>`${location.origin}${location.pathname}`
export const certLink=code=>code?`${siteUrl()}#/certificate/${code.length===12?code.match(/.{4}/g).join('-'):code}`:''
export const fill=(body,v)=>String(body||'').replace(/\{(\w+)\}/g,(_,k)=>v[k]??'')
export const PROVIDERS={manual:'Tap to send',cloud:'Official WhatsApp API',qr:'Club phone linked by QR'}
export const KIND_LABEL={broadcast:'Broadcast',direct:'Direct message',duty:'Duty slip',login:'Login details',donation_thanks:'Donation thanks',birthday:'Birthday',eligible_again:'Eligible again',reminder_early:'Camp reminder',reminder_1d:'Camp reminder, day before',
  reminder_today:'Camp reminder, morning',thank_you:'Thank-you',followup:'Next-day thank-you',certificate:'Certificate',invite:'Camp invite',meeting_1d:'Meeting reminder',emergency:'Emergency',test:'Test'}

// items: [{phone,name,body,donor_id?,member_id?,ref?,vars?}]
// manual=true: you send them yourself ("Open WhatsApp"); the automatic sender leaves them alone
export async function enqueue(title,kind,items,sendAfter=null,manual=false){
  const {data,error}=await supabase.rpc('wa_enqueue',{p_title:title,p_kind:kind,p_items:items,p_send_after:sendAfter,p_manual:!!manual})
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
export function useWaReady(){
  const [s,setS]=useState(shared)
  useEffect(()=>{subs.add(setS);if(Date.now()-last>20000)pollShared();if(!timer)timer=setInterval(pollShared,60000)
    return()=>{subs.delete(setS);if(!subs.size){clearInterval(timer);timer=null}}},[])
  return s
}
export const refreshWaReady=()=>pollShared()
// how messages go out: 'auto' (club number) or 'manual' (open WhatsApp yourself); remembered on this device
export const getSendMode=()=>{try{return localStorage.getItem('wa-send-mode')||''}catch{return ''}}
export const setSendMode=m=>{try{localStorage.setItem('wa-send-mode',m)}catch{}}
