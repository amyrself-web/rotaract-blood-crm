// Lets the CRM open without internet (camp venues often have none). Data still comes from Supabase;
// the camp day page keeps its own copy and a queue of changes.
const V='crm-v1',SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png']
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url)
  if(r.method!=='GET')return
  const fonts=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)
  if(u.origin!==location.origin&&!fonts)return            // Supabase and others: always live
  if(r.mode==='navigate'){                                  // pages: fresh when online, saved copy when not
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put('./index.html',c));return res}).catch(()=>caches.match('./index.html')))
    return}
  if(fonts||u.pathname.includes('/assets/')){              // hashed files and fonts never change: cache first
    e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res})))
    return}
  e.respondWith(caches.match(r).then(hit=>{const net=fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res}).catch(()=>hit);return hit||net}))
})
