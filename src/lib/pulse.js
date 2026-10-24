// Public pages reload their numbers the moment anything changes in the CRM.
// One shared listener on the site_pulse row (realtime), with a light check every 30 s and when the tab comes back,
// so it also works where realtime is blocked. The row holds only a time stamp.
import {useEffect,useRef} from 'react'
import {supabase,hasSupabase} from './supabase'

const subs=new Set();let ch=null,timer=null,last=null,live=false,debounce=null
const fire=()=>{clearTimeout(debounce);debounce=setTimeout(()=>subs.forEach(f=>{try{f()}catch{}}),350)}
const seen=at=>{if(!at)return;if(last&&at!==last)fire();last=at}
async function check(){const {data}=await supabase.from('site_pulse').select('at').eq('topic','public').maybeSingle().then(r=>r,()=>({}));seen(data?.at)}
const vis=()=>document.visibilityState==='visible'&&check()
function start(){
  check()
  ch=supabase.channel('site-pulse').on('postgres_changes',{event:'UPDATE',schema:'public',table:'site_pulse'},p=>seen(p.new?.at))
    .subscribe(s=>{live=s==='SUBSCRIBED'})
  timer=setInterval(()=>{if(!live||Math.random()<.25)check()},30000)
  document.addEventListener('visibilitychange',vis);window.addEventListener('focus',vis);window.addEventListener('online',vis)
}
function stop(){clearInterval(timer);timer=null;if(ch)supabase.removeChannel(ch);ch=null;live=false
  document.removeEventListener('visibilitychange',vis);window.removeEventListener('focus',vis);window.removeEventListener('online',vis)}

// usePulse(reload): calls reload() whenever the club's public information changes
export function usePulse(reload){
  const ref=useRef(reload);ref.current=reload
  useEffect(()=>{if(!hasSupabase)return;const f=()=>ref.current?.();subs.add(f);if(subs.size===1)start()
    return()=>{subs.delete(f);if(!subs.size)stop()}},[])
}
