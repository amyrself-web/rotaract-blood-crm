import {useEffect,useMemo,useRef,useState} from 'react'
import {isBlood,typeName,takesOnline,kindOf} from '../lib/campTypes'
import {toast} from 'sonner'
import {Download,Image as ImageIcon,Megaphone,Heart,Star,Siren,BarChart3} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt,BLOOD} from '../lib/util'
import {PageHeader,Field,errText} from '../components/ui'
import {logoImage,withBrand} from '../lib/docpdf'
import {brandQr} from '../lib/qr'
import {siteUrl} from '../lib/wa'

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const F="Sora, Manrope, sans-serif",B="Manrope, sans-serif",TA="'Noto Serif Tamil', serif"
const KINDS=[['invite','Camp invite',Megaphone],['thanks','Camp thank-you',Heart],['star','Donor of the month',Star],['urgent','Urgent need',Siren],['impact','Our impact',BarChart3]]
const t5=t=>t?String(t).slice(0,5):''

function frame(inner,{brand,lg,bg='linear-gradient(150deg,#0B1324 0%,#16233F 60%,#3B0D1A 100%)'}){
  const logo=lg?`<div style="width:92px;height:92px;border-radius:24px;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${lg.data}" style="max-width:76px;max-height:76px"/></div>`
    :`<div style="width:92px;height:92px;border-radius:24px;background:#E11D48;display:flex;align-items:center;justify-content:center;color:#fff;font:800 44px ${F}">+</div>`
  return `<div style="position:relative;width:1080px;height:1080px;overflow:hidden;background:${bg};color:#fff;font-family:${B}">
    <div style="position:absolute;right:-180px;top:-180px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,${brand.brand_color||'#4C8DFF'}55,transparent 70%)"></div>
    <div style="position:absolute;left:-200px;bottom:-200px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,#E11D4855,transparent 70%)"></div>
    <div style="position:absolute;left:72px;top:64px;right:72px;display:flex;align-items:center;gap:22px">${logo}<div><div style="font:700 34px ${F}">${esc(brand.club_name)}</div>${brand.address?`<div style="font:500 22px ${B};color:#A9B8D6;margin-top:4px">${esc(brand.address)}</div>`:''}</div></div>
    ${inner}
    <div style="position:absolute;left:0;right:0;bottom:0;height:14px;display:flex"><div style="flex:6;background:#E11D48"></div><div style="flex:3;background:${brand.brand_color||'#4C8DFF'}"></div><div style="flex:1;background:#fff"></div></div></div>`
}
// html2canvas draws text low when the line height is 'normal', so every font gets an explicit one
const tight=h=>h.replace(/font:(\d+) (\d+)px (?!\/)/g,'font:$1 $2px/1.15 ').replace(/font:(\d+) (\d+)px\/1\.02/g,'font:$1 $2px/1.05')
function postHtml(kind,d,ctx){return tight(postInner(kind,d,ctx))}
const POSTER={
  'Blood donation':['BLOOD DONATION CAMP','இரத்த தானம் செய்வோம், உயிர் காப்போம்','Register now','Scan the code · Eat well · Bring a photo ID','உயிர் காத்த உங்களுக்கு நன்றி','to every donor and volunteer at'],
  'Eye checking':['FREE EYE CHECK-UP CAMP','இலவச கண் பரிசோதனை முகாம்','Register now','Scan the code · Bring old glasses and reports','பார்வை காக்க வந்த அனைவருக்கும் நன்றி','to everyone who came, and to our doctors and volunteers at'],
  'Cancer awareness':['CANCER AWARENESS CAMP','விழிப்புணர்வே முதல் பாதுகாப்பு','Register for a free check-up','Scan the code · Early check-ups save lives','விழிப்புணர்வுக்குத் துணை நின்றவர்களுக்கு நன்றி','to everyone who joined us, and to our doctors and volunteers at'],
  'Food donation':['FOOD DONATION DRIVE','பசியில்லா சமூகம் படைப்போம்','Join us','Volunteers and sponsors welcome','பசி போக்கிய கரங்களுக்கு நன்றி','to every volunteer and sponsor of'],
  'Environment (plantation)':['TREE PLANTATION DRIVE','மரம் வளர்ப்போம், மழை பெறுவோம்','Plant a tree with us','Bring a friend · Wear comfortable clothes','பசுமை காக்க வந்தவர்களுக்கு நன்றி','to every volunteer who planted with us at'],
  Others:['COMMUNITY CAMP','சேவையே எங்கள் இலக்கு','Join us','Everyone is welcome','கை கொடுத்த அனைவருக்கும் நன்றி','to everyone who joined us at']}
const posterOf=c=>{const p=POSTER[c?.camp_type]||POSTER.Others;return c?.camp_type==='Others'?[`${typeName(c).toUpperCase()} CAMP`,...p.slice(1)]:p}
function postInner(kind,d,ctx){
  const {brand}=ctx
  if(kind==='invite'){const c=d.camp;if(!c)return frame(`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 34px ${B};color:#A9B8D6">Choose a camp</div>`,ctx)
    return frame(`<div style="position:absolute;left:72px;right:72px;top:230px">
      <div style="display:inline-block;padding:6px 22px 16px;border-radius:999px;background:${isBlood(c)?'#E11D48':ctx.brand.brand_color||'#0EA5A4'};font:800 24px ${F};letter-spacing:3px">${esc(posterOf(c)[0])}</div>
      <div style="font:800 ${c.name.length>28?64:76}px/1.05 ${F};margin-top:26px;max-width:930px">${esc(c.name)}</div>
      <div style="font:700 32px ${TA};color:#FFC9D2;margin-top:18px">${posterOf(c)[1]}</div>
      <div style="display:flex;gap:16px;margin-top:34px;max-width:936px">${[['DATE',fmt(c.camp_date)],['TIME',c.start_time?`${t5(c.start_time)} – ${t5(c.end_time)}`:'All day'],['VENUE',c.venue||'']].filter(x=>x[1]).map(([l,v])=>`<div style="flex:1;border:2px solid #ffffff33;border-radius:22px;padding:18px 22px;background:#ffffff0f"><div style="font:700 18px ${B};letter-spacing:2px;color:#A9B8D6">${l}</div><div style="font:800 ${String(v).length>16?24:30}px ${F};margin-top:6px">${esc(v)}</div></div>`).join('')}</div></div>
      <div style="position:absolute;left:72px;bottom:72px;right:72px;display:flex;align-items:flex-end;justify-content:space-between">
        <div><div style="font:800 40px ${F}">${esc(posterOf(c)[2])}</div><div style="font:500 24px ${B};color:#A9B8D6;margin-top:6px">${esc(takesOnline(c)?posterOf(c)[3]:posterOf(c)[3].replace('Scan the code · ',''))}</div>${brand.contact_phone?`<div style="font:700 26px ${B};margin-top:14px">📞 ${esc(brand.contact_phone)}</div>`:''}</div>
        ${ctx.qr&&takesOnline(c)?`<div style="background:#fff;border-radius:26px;padding:16px"><img src="${ctx.qr}" style="width:230px;height:230px"/></div>`:''}</div>`,ctx)}
  if(kind==='thanks'){const c=d.camp,s=d.stats||{};if(!c)return frame('',ctx)
    return frame(`<div style="position:absolute;left:72px;right:72px;top:250px;text-align:center">
      <div style="font:800 120px/1 ${F}">THANK YOU</div><div style="font:700 44px ${TA};color:#FFC9D2;margin-top:40px">${posterOf(c)[4]}</div>
      <div style="font:500 30px ${B};color:#C9D4EA;margin-top:26px">${esc(posterOf(c)[5])} <b style="color:#fff">${esc(c.name)}</b>, ${fmt(c.camp_date)}</div>
      <div style="display:flex;gap:22px;justify-content:center;margin-top:56px">${(s.tiles||[[s.donated||0,'units collected'],[(s.donated||0)*3,'lives touched'],[s.registered||0,'came forward']]).map(([n,l])=>`<div style="width:280px;border-radius:28px;padding:26px;background:#ffffff12;border:2px solid #ffffff2a"><div style="font:800 84px ${F};color:#FF8796">${n}</div><div style="font:600 24px ${B};color:#C9D4EA;margin-top:16px">${l}</div></div>`).join('')}</div></div>`,ctx)}
  if(kind==='star'){const x=d.donor;if(!x)return frame(`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 34px ${B};color:#A9B8D6">Choose a donor</div>`,ctx)
    const ini=String(x.name).split(' ').map(s=>s[0]).slice(0,2).join('')
    return frame(`<div style="position:absolute;left:72px;right:72px;top:220px;text-align:center">
      <div style="font:800 30px ${F};letter-spacing:6px;color:#FFD166">★ DONOR OF THE MONTH ★</div>
      <div style="margin:40px auto 0;width:300px;height:300px;border-radius:50%;background:linear-gradient(150deg,#F0435A,#B4233A);display:flex;align-items:center;justify-content:center;padding-bottom:22px;box-sizing:border-box;font:800 120px ${F};box-shadow:0 0 0 14px #ffffff18,0 0 0 28px #ffffff0a">${esc(ini)}</div>
      <div style="font:800 78px ${F};margin-top:44px">${esc(x.name)}</div>
      <div style="display:flex;gap:18px;justify-content:center;margin-top:26px"><div style="padding:8px 30px 20px;border-radius:999px;background:#E11D48;font:800 36px ${F}">${esc(x.blood_group||'')}</div><div style="padding:8px 30px 20px;border-radius:999px;background:#ffffff18;font:700 34px ${F}">${x.total} donation${x.total==1?'':'s'}</div></div>
      <div style="font:500 28px ${B};color:#C9D4EA;margin-top:30px">Thank you for being a hero, again and again.</div></div>`,ctx)}
  if(kind==='urgent'){const u=d.urgent
    return frame(`<div style="position:absolute;left:72px;right:72px;top:220px">
      <div style="display:inline-block;padding:6px 26px 18px;border-radius:14px;background:#fff;color:#E11D48;font:800 34px ${F};letter-spacing:4px">URGENT</div>
      <div style="display:flex;align-items:center;gap:40px;margin-top:40px"><div style="width:330px;height:330px;border-radius:48px;background:linear-gradient(150deg,#F0435A,#B4233A);display:flex;align-items:center;justify-content:center;padding-bottom:30px;box-sizing:border-box;font:800 150px ${F}">${esc(u.group)}</div>
        <div><div style="font:800 64px/1.05 ${F}">blood needed</div><div style="font:700 40px ${TA};color:#FFC9D2;margin-top:24px">அவசரமாக இரத்தம் தேவை</div><div style="font:700 34px ${B};margin-top:26px">${esc(u.units||1)} unit${u.units>1?'s':''} · ${esc(u.hospital||'')}</div></div></div>
      <div style="margin-top:60px;border-radius:28px;padding:30px 36px;background:#ffffff12;border:2px solid #ffffff2a"><div style="font:600 26px ${B};color:#C9D4EA">Can you donate today? Call</div><div style="font:800 64px ${F};margin-top:6px">${esc(u.contact||brand.contact_phone||'')}</div></div></div>`,ctx,
      )}
  const m=d.impact||{}
  return frame(`<div style="position:absolute;left:72px;right:72px;top:220px">
    <div style="font:800 76px ${F}">Together we have</div><div style="font:700 38px ${TA};color:#FFC9D2;margin-top:26px">நாம் இணைந்து செய்தவை</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:46px">${[[m.units||0,'units of blood collected'],[(m.units||0)*3,'lives touched'],[m.camps||0,'blood camps'],[m.eye||0,'eye donations'],[m.projects||0,'service projects'],[Math.round(m.hours||0),'volunteer hours']].map(([n,l])=>`<div style="border-radius:26px;padding:22px 28px;background:#ffffff10;border:2px solid #ffffff22"><div style="font:800 66px ${F};color:#FF8796">${n}</div><div style="font:600 24px ${B};color:#C9D4EA;margin-top:16px">${l}</div></div>`).join('')}</div></div>`,ctx)
}

export default function PostMaker(){
  const {brand:b0}=useBrand(),brand=withBrand(b0)
  const [kind,setKind]=useState('invite'),[camps,setCamps]=useState([]),[cid,setCid]=useState(''),[stats,setStats]=useState(null),[q,setQ]=useState(''),[top,setTop]=useState([]),[donor,setDonor]=useState(null),[impact,setImpact]=useState(null)
  const [urgent,setUrgent]=useState({group:'O+',units:2,hospital:'',contact:''}),[lg,setLg]=useState(null),[qr,setQr]=useState(''),[busy,setBusy]=useState(false),hidden=useRef()
  useEffect(()=>{import('@fontsource/noto-serif-tamil/700.css');logoImage(brand.logo_url).then(setLg)
    supabase.from('camps').select('*').is('deleted_at',null).order('camp_date',{ascending:false}).then(({data})=>{setCamps(data||[]);const o=(data||[]).find(c=>c.status==='open')||data?.[0];if(o)setCid(o.id)})
    supabase.rpc('donor_leaderboard',{p_limit:15}).then(({data})=>{setTop(data||[]);if(data?.[0])setDonor({name:data[0].name,blood_group:data[0].blood_group,total:data[0].total})})
    supabase.rpc('public_impact').then(({data})=>setImpact(data))},[])
  const camp=camps.find(c=>c.id===cid)
  useEffect(()=>{if(!camp)return;brandQr(`${siteUrl()}#/register/${camp.id}`,brand,{size:520,quiet:1}).then(setQr)
    if(isBlood(camp))supabase.from('registrations').select('status').eq('camp_id',camp.id).then(({data})=>setStats({registered:(data||[]).length,donated:(data||[]).filter(r=>r.status==='donated').length}))
    else supabase.rpc('camp_summary',{p_camp:camp.id}).then(({data:x})=>{if(!x)return setStats({tiles:[[camp.beneficiaries||0,'people helped']]});const k=kindOf(camp),t=x.team
      setStats({tiles:k==='food'?[[x.food.people,'people fed'],[x.food.packets,'food packets'],[x.food.points,'places reached']]
        :k==='plants'?[[x.plants.planted,'saplings planted'],[x.plants.batches,'places greened'],[t.members_present+t.volunteers_present,'volunteers']]
        :camp.camp_type==='Eye checking'?[[x.people.attended,'people screened'],[x.people.actions?.['Spectacles given']||0,'spectacles given'],[x.people.referred,'referred for care']]
        :camp.camp_type==='Cancer awareness'?[[x.people.attended,'people screened'],[(x.sessions||[]).reduce((a,y)=>a+(y.attendees||0),0),'heard the talks'],[x.people.referred,'referred for care']]
        :[[camp.beneficiaries||x.people.attended,'people helped'],[t.members_present,'members'],[t.volunteers_present,'volunteers']]})})},[cid])
  const html=useMemo(()=>postHtml(kind,{camp,stats,donor,urgent,impact},{brand,lg,qr}),[kind,camp,stats,donor,urgent,impact,lg,qr])
  const save=async()=>{setBusy(true);try{const {default:html2canvas}=await import('html2canvas');await document.fonts?.ready
      const el=hidden.current,cv=await html2canvas(el.firstElementChild,{scale:1,width:1080,height:1080,windowWidth:1080,windowHeight:1080,backgroundColor:null,logging:false})
      const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download=`${kind}-post.png`;a.click();toast.success('Image saved. Post it on WhatsApp status or Instagram.')}catch(e){toast.error(errText(e))}setBusy(false)}
  return <div>
    <PageHeader eyebrow="People" title="Post maker" description="Square images for WhatsApp status, Instagram and Facebook, in the club's colours." actions={<button className="btn" disabled={busy} onClick={save}><Download size={16}/>{busy?'Saving…':'Download image'}</button>}/>
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div className="card grid grid-cols-2 gap-2 p-3">{KINDS.map(([k,l,I])=><button key={k} onClick={()=>setKind(k)} className={`tile flex flex-col items-center gap-1 py-3 text-xs transition ${kind===k?'border-brand/60 bg-brand/10 text-fg ring-2 ring-brand/20':'text-fog-muted hover:text-fg'}`}><I size={18}/>{l}</button>)}</div>
        <div className="card space-y-3">
          {['invite','thanks'].includes(kind)&&<Field label="Camp"><select className="input" value={cid} onChange={e=>setCid(e.target.value)}>{camps.map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select></Field>}
          {kind==='star'&&<><Field label="Pick from top donors"><select className="input" value={donor?.name||''} onChange={e=>{const x=top.find(d=>d.name===e.target.value);if(x)setDonor({name:x.name,blood_group:x.blood_group,total:x.total})}}>{top.map(d=><option key={d.id} value={d.name}>{d.name} · {d.total}</option>)}</select></Field>
            <Field label="Or type a name"><input className="input" value={q} onChange={e=>{setQ(e.target.value);setDonor({...(donor||{}),name:e.target.value})}}/></Field></>}
          {kind==='urgent'&&<><Field label="Blood group"><select className="input" value={urgent.group} onChange={e=>setUrgent({...urgent,group:e.target.value})}>{BLOOD.map(g=><option key={g}>{g}</option>)}</select></Field>
            <Field label="Units"><input type="number" min="1" className="input" value={urgent.units} onChange={e=>setUrgent({...urgent,units:e.target.value})}/></Field>
            <Field label="Hospital"><input className="input" value={urgent.hospital} onChange={e=>setUrgent({...urgent,hospital:e.target.value})}/></Field>
            <Field label="Phone to call"><input className="input" value={urgent.contact} onChange={e=>setUrgent({...urgent,contact:e.target.value})}/></Field></>}
          {kind==='impact'&&<p className="text-sm text-fog-muted">Numbers come from the CRM: camps, blood units, eye donations, projects and hours.</p>}
          <p className="text-xs text-fog-faint"><ImageIcon size={12} className="mr-1 inline"/>1080 × 1080 PNG. The logo and colours come from Settings.</p></div></div>
      <div className="card grid place-items-center overflow-hidden p-4"><div className="relative aspect-square w-full max-w-[560px] overflow-hidden rounded-2xl shadow-2xl">
        <div translate="no" className="absolute left-0 top-0 origin-top-left" style={{transform:'scale(var(--k))',width:1080,height:1080}} ref={el=>{if(el){const k=el.parentElement.clientWidth/1080;el.style.setProperty('--k',k)}}} dangerouslySetInnerHTML={{__html:html}}/></div></div>
    </div>
    <div ref={hidden} translate="no" aria-hidden className="pointer-events-none fixed left-[-12000px] top-0" dangerouslySetInnerHTML={{__html:html}}/>
  </div>
}
