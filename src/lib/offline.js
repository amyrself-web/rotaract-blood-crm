// Camp day without internet: actions are kept on this device and sent, in order, when the connection is back.
import {supabase} from './supabase'
const KEY='offline-queue'
export const isNetError=e=>!navigator.onLine||/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(e?.message||String(e||''))
export const readQueue=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
const write=q=>{try{localStorage.setItem(KEY,JSON.stringify(q))}catch{};window.dispatchEvent(new Event('offline-queue'))}
export const enqueueAction=a=>write([...readQueue(),{...a,id:crypto.randomUUID?.()||String(Date.now()+Math.random()),at:new Date().toISOString()}])
export const dropAction=id=>write(readQueue().filter(x=>x.id!==id))
let running=null
// sends waiting actions one by one; stops at the first network error; actions the server refuses are marked with the reason
export function flush(){
  running??=(async()=>{let sent=0
    try{for(const a of readQueue()){if(a.error)continue
      const {error}=await supabase.rpc(a.fn,a.args).then(r=>r,e=>({error:e}))
      if(error){if(isNetError(error))break;write(readQueue().map(x=>x.id===a.id?{...x,error:error.message}:x));continue}
      dropAction(a.id);sent++}}
    finally{running=null}
    return sent})()
  return running
}
export const cacheGet=k=>{try{return JSON.parse(localStorage.getItem('cache-'+k)||'null')}catch{return null}}
export const cacheSet=(k,v)=>{try{localStorage.setItem('cache-'+k,JSON.stringify(v))}catch{}}
