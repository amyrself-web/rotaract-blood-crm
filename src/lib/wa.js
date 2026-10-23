// WhatsApp outbox helpers used by every page that sends messages.
import {useEffect,useState} from 'react'
import {supabase} from './supabase'

export const siteUrl=()=>`${location.origin}${location.pathname}`
export const certLink=code=>code?`${siteUrl()}#/certificate/${code.length===12?code.match(/.{4}/g).join('-'):code}`:''
export const fill=(body,v)=>String(body||'').replace(/\{(\w+)\}/g,(_,k)=>v[k]??'')
export const PROVIDERS={manual:'Tap to send',cloud:'Official WhatsApp API',qr:'Club phone linked by QR'}
export const KIND_LABEL={broadcast:'Broadcast',birthday:'Birthday',eligible_again:'Eligible again',reminder_early:'Camp reminder',reminder_1d:'Camp reminder, day before',
  reminder_today:'Camp reminder, morning',thank_you:'Thank-you',followup:'Next-day thank-you',certificate:'Certificate',invite:'Camp invite',meeting_1d:'Meeting reminder',emergency:'Emergency',test:'Test'}

// items: [{phone,name,body,donor_id?,member_id?,ref?,vars?}]
export async function enqueue(title,kind,items,sendAfter=null){
  const {data,error}=await supabase.rpc('wa_enqueue',{p_title:title,p_kind:kind,p_items:items,p_send_after:sendAfter})
  if(error)throw error
  kick()
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
