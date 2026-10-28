import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {toast} from 'sonner'
import {Download,Share2,Search,ImagePlus,X,Copy,RotateCcw,Megaphone,Heart,Star,Siren,Users,Calendar,Trophy,Sparkles,Eye,Droplet,Lightbulb,CheckCircle2,PartyPopper,HandHeart,Award,Cake,HeartHandshake,ChevronDown} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt,BLOOD} from '../lib/util'
import {PageHeader,Field,errText} from '../components/ui'
import {logoImage,withBrand} from '../lib/docpdf'
import {brandQr} from '../lib/qr'
import {siteUrl} from '../lib/wa'
import {YEAR_NAME,clubYearOf} from '../lib/year'
import {POSTS,GROUPS,postOf} from '../lib/posts/types'
import {THEMES,SIZES,LANGS,ACCENTS,renderPost,paletteOf,wordsOf} from '../lib/posts/themes'
import {loadPostFonts,postFontCSS} from '../lib/posts/kit'

const ICON={megaphone:Megaphone,calendar:Calendar,siren:Siren,heart:Heart,handshake:HeartHandshake,users:Users,star:Star,trophy:Trophy,drop:Droplet,bulb:Lightbulb,check:CheckCircle2,eye:Eye,party:PartyPopper,hands:HandHeart,award:Award,cake:Cake,sparkles:Sparkles}
const today=()=>new Date().toISOString().slice(0,10)
const daysAgo=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10)
const nextBirthday=d=>{if(!d)return 999;const t=new Date(),b=new Date(d);const n=new Date(t.getFullYear(),b.getMonth(),b.getDate());if(n<new Date(t.getFullYear(),t.getMonth(),t.getDate()))n.setFullYear(t.getFullYear()+1);return Math.round((n-new Date(t.getFullYear(),t.getMonth(),t.getDate()))/864e5)}

// shrink the main area (--z) until nothing overflows (measured from the children: scrollHeight is wrong when content sits at the bottom)
const overflows=n=>{const k=[...n.children];if(!k.length)return false;const top=Math.min(...k.map(c=>c.offsetTop)),bot=Math.max(...k.map(c=>c.offsetTop+c.offsetHeight));return bot-top>n.clientHeight-6||n.scrollWidth>n.clientWidth+2}
function fitPost(host){const r=host?.firstElementChild;if(!r)return 1;let z=1
  for(;z>0.5;z-=0.03){host.style.setProperty('--z',z.toFixed(2));if(![...r.querySelectorAll('[data-fit]')].some(overflows))break}
  return +z.toFixed(2)}
// a scaled, live copy of the post
function Scaled({html,w,h,z,width,className=''}){const k=width/w
  return <div className={`relative overflow-hidden ${className}`} style={{width,height:Math.round(h*k)}}>
    <div translate="no" className="absolute left-0 top-0 origin-top-left" style={{width:w,height:h,transform:`scale(${k})`,'--z':z}} dangerouslySetInnerHTML={{__html:html}}/></div>}
function useWidth(){const ref=useRef(),[w,setW]=useState(320)
  useLayoutEffect(()=>{const el=ref.current;if(!el)return;const ro=new ResizeObserver(()=>setW(Math.max(220,el.clientWidth)));ro.observe(el);return()=>ro.disconnect()},[])
  return [ref,w]}
// a short caption to paste with the image
function captionOf(spec,lang,brand){if(!spec)return '';const W=wordsOf(spec,lang),l=[]
  if(W.kicker)l.push(W.kicker.toUpperCase());l.push(W.title+(W.sub?` | ${W.sub}`:''));if(spec.myth)l.push(`Myth: ${spec.myth}\nFact: ${spec.fact}`);if(W.lead)l.push(W.lead)
  spec.facts?.forEach(([k,v])=>v&&l.push(`${k}: ${v}`));spec.stats?.forEach(([v,k])=>l.push(`${typeof v==='number'?v.toLocaleString('en-IN'):v} ${k}`))
  spec.list?.forEach(([n,r])=>l.push(`• ${n}${r?` (${r})`:''}`));spec.checklist?.forEach(([e,t])=>l.push(`✓ ${lang==='ta'?t:e}`))
  if(W.cta)l.push(`${W.cta}${spec.phone?`: ${spec.phone}`:''}`);if(spec.qr)l.push(spec.qr);if(brand.contact_phone&&!spec.phone)l.push(`📞 ${brand.contact_phone}`)
  const tag=s=>'#'+String(s||'').replace(/[^A-Za-z0-9]/g,'');l.push([tag(brand.club_name),spec.mood==='blood'||spec.mood==='urgent'?'#DonateBlood #SaveLives':'#Service #WeServe'].filter(t=>t.length>1).join(' '))
  return l.filter(Boolean).join('\n\n')}

export default function PostMaker(){
  const {brand:b0}=useBrand(),brand=withBrand(b0)
  const [type,setType]=useState('camp_invite'),[theme,setTheme]=useState('midnight'),[size,setSize]=useState('square'),[lang,setLang]=useState('both'),[accent,setAccent]=useState('auto')
  const [v,setV]=useState({}),[ov,setOv]=useState({}),[photo,setPhoto]=useState(''),[q,setQ]=useState(''),[editOpen,setEditOpen]=useState(false)
  const [D,setD]=useState({}),[cid,setCid]=useState(''),[lg,setLg]=useState(null),[il,setIl]=useState(null),[qr,setQr]=useState(''),[fonts,setFonts]=useState(false),[busy,setBusy]=useState(''),[z,setZ]=useState(1)
  const hidden=useRef(),file=useRef(),loaded=useRef(new Set()),[pref,pw]=useWidth()
  const post=postOf(type),S=SIZES[size]
  const put=(k,x)=>setD(d=>({...d,[k]:x}))
  useEffect(()=>{loadPostFonts().then(()=>setFonts(true));logoImage(brand.logo_url).then(setLg);logoImage(brand.intl_logo_url).then(setIl)
    supabase.from('camps').select('*').is('deleted_at',null).order('camp_date',{ascending:false}).then(({data})=>{put('camps',data||[]);const t=today(),l=data||[]
      const o=[...l].reverse().find(c=>['open','live'].includes(c.status)&&c.camp_date>=t)||l.find(c=>c.status==='live')||l[0];if(o)setCid(o.id)})},[brand.logo_url,brand.intl_logo_url])
  // load only what the chosen post needs
  const need=async k=>{if(loaded.current.has(k))return;loaded.current.add(k)
    if(k==='top'){const {data}=await supabase.rpc('donor_leaderboard',{p_limit:20});put('top',data||[])}
    if(k==='impact'){const {data}=await supabase.rpc('public_impact');put('impact',data||{})}
    if(k==='meetings'){const {data}=await supabase.from('meetings').select('*').is('deleted_at',null).gte('meeting_date',daysAgo(30)).order('meeting_date');put('meetings',data||[])}
    if(k==='events'){const {data}=await supabase.from('events').select('*').is('deleted_at',null).gte('event_date',daysAgo(30)).order('event_date');put('events',data||[])}
    if(k==='projects'){const {data}=await supabase.from('projects').select('*').is('deleted_at',null).order('start_date',{ascending:false,nullsFirst:false}).limit(60);put('projects',data||[])}
    if(k==='newMembers'||k==='birthdays'){loaded.current.add('newMembers');loaded.current.add('birthdays')
      const {data}=await supabase.from('members').select('id,full_name,dob,joined_on,position,photo_url').is('deleted_at',null).eq('status','active');put('members',data||[])}
    if(k==='board'){const {data}=await supabase.rpc('board_of_year',{p_year:clubYearOf()});put('board',data||[])}}
  useEffect(()=>{post?.needs?.forEach(n=>!['camp','campStats','sponsors'].includes(n)&&need(n))
    const d={};post?.fields.forEach(f=>{if(f.def!==undefined)d[f.k]=f.def});setV(d);setOv({})},[type])
  const camp=(D.camps||[]).find(c=>c.id===cid)
  useEffect(()=>{if(!camp)return;put('campStats',null);put('sponsors',[])
    supabase.rpc('camp_summary',{p_camp:camp.id}).then(({data})=>put('campStats',data||null))
    supabase.from('sponsors').select('name,amount').eq('camp_id',camp.id).order('amount',{ascending:false}).then(({data})=>put('sponsors',data||[]))},[cid])
  // the first sensible choice for pickers
  useEffect(()=>{setV(x=>{const y={...x}
    if(post?.fields.some(f=>f.type==='donor')&&!y.donor&&D.top?.[0])y.donor={name:D.top[0].name,blood_group:D.top[0].blood_group,total:D.top[0].total}
    if(post?.fields.some(f=>f.type==='meeting')&&!y.meeting&&D.meetings?.length)y.meeting=D.meetings.find(m=>m.meeting_date>=today())||D.meetings.at(-1)
    if(post?.fields.some(f=>f.type==='event')&&!y.event&&D.events?.length)y.event=D.events.find(m=>m.event_date>=today())||D.events.at(-1)
    if(post?.fields.some(f=>f.type==='project')&&!y.project&&D.projects?.length)y.project=D.projects[0]
    if(post?.fields.some(f=>f.type==='birthday')&&!y.person&&D.members?.length)y.person=[...D.members].filter(m=>m.dob).sort((a,b)=>nextBirthday(a.dob)-nextBirthday(b.dob))[0]
    return y})},[type,D.top,D.meetings,D.events,D.projects,D.members])

  const spec=useMemo(()=>{if(!post)return null
    const data={camp,campStats:D.campStats,sponsors:D.sponsors,impact:D.impact,newMembers:D.members,board:D.board,yearName:YEAR_NAME,year:clubYearOf(),site:siteUrl(),brand}
    let s=null;try{s=post.build(data,v)}catch(e){console.error(e)}
    if(!s)return null;s={...s}
    if(ov.title)s.title=s.title_ta=ov.title;if(ov.ta!==undefined&&ov.ta!=='')s.ta=ov.ta;if(ov.lead)s.lead=s.lead_ta=ov.lead;if(ov.cta)s.cta=s.cta_ta=ov.cta;if(ov.kicker)s.kicker=s.kicker_ta=ov.kicker
    return s},[post,camp,D,v,ov])
  useEffect(()=>{setQr('');if(spec?.qr)brandQr(spec.qr,brand,{size:520,quiet:1}).then(setQr)},[spec?.qr])
  const ctx={brand,lg,il,qr,photo,size,lang,accent}
  const html=useMemo(()=>renderPost(spec,{...ctx,theme}),[spec,theme,size,lang,accent,lg,il,qr,photo,brand])
  useLayoutEffect(()=>{setZ(fitPost(hidden.current))},[html,fonts])
  const thumbs=useMemo(()=>THEMES.map(t=>[t,renderPost(spec,{...ctx,theme:t.key})]),[spec,size,lang,accent,lg,il,qr,photo,brand])
  const pal=paletteOf(spec,brand,accent)

  // the browser draws the image itself (SVG snapshot), so it looks exactly like the preview; html2canvas only if that fails
  const canvas=async()=>{await loadPostFonts();await document.fonts?.ready;const node=hidden.current.firstElementChild
    try{const {toCanvas}=await import('html-to-image');return await toCanvas(node,{fontEmbedCSS:await postFontCSS(),width:S.w,height:S.h,pixelRatio:1,preferredFontFormat:'woff2',skipAutoScale:true})}
    catch(e){console.warn('html-to-image failed, using html2canvas',e);const {default:html2canvas}=await import('html2canvas')
      return html2canvas(node,{scale:1,width:S.w,height:S.h,windowWidth:S.w,windowHeight:S.h,backgroundColor:null,logging:false,useCORS:true})}}
  const name=()=>`${type}-${theme}-${size}.png`
  const download=async()=>{setBusy('save');try{const cv=await canvas(),a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download=name();a.click();toast.success('Image saved. Post it on WhatsApp status, Instagram or Facebook.')}catch(e){toast.error(errText(e))}setBusy('')}
  const share=async()=>{setBusy('share');try{const cv=await canvas(),blob=await new Promise(ok=>cv.toBlob(ok,'image/png')),f=new File([blob],name(),{type:'image/png'})
      if(navigator.canShare?.({files:[f]})){await navigator.share({files:[f],text:captionOf(spec,lang,brand)})}
      else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name();a.click();toast.message('Sharing is not available here, so the image was saved instead.')}}
    catch(e){if(e?.name!=='AbortError')toast.error(errText(e))}setBusy('')}
  const copyCaption=async()=>{try{await navigator.clipboard.writeText(captionOf(spec,lang,brand));toast.success('Caption copied')}catch{toast.error('Could not copy. Select the text and copy it.')}}
  const pickPhoto=e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!f.type.startsWith('image/'))return toast.error('Choose a photo (JPG or PNG).')
    const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const k=Math.min(1,1600/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k)
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);setPhoto(cv.toDataURL('image/jpeg',0.88))};img.src=r.result};r.readAsDataURL(f)}

  const list=POSTS.filter(p=>!q||(p.label+' '+p.group).toLowerCase().includes(q.toLowerCase()))
  const field=f=>{const set=x=>setV(o=>({...o,[f.k]:x}))
    if(f.type==='camp')return <Field key={f.k} label="Camp"><select className="input" value={cid} onChange={e=>setCid(e.target.value)}>{(D.camps||[]).map(c=><option key={c.id} value={c.id}>{c.name} ({fmt(c.camp_date)})</option>)}</select></Field>
    if(f.type==='donor')return <div key={f.k} className="space-y-3"><Field label="Pick from top donors"><select className="input" value={v.donor?.name||''} onChange={e=>{const x=(D.top||[]).find(d=>d.name===e.target.value);if(x)set({name:x.name,blood_group:x.blood_group,total:x.total})}}>
        <option value="">Choose…</option>{(D.top||[]).map(d=><option key={d.id||d.name} value={d.name}>{d.name} · {d.blood_group||'?'} · {d.total}</option>)}</select></Field>
      <div className="grid grid-cols-[1fr_96px] gap-2"><Field label="Or type a name"><input className="input" value={v.donor?.name||''} onChange={e=>set({...(v.donor||{}),name:e.target.value})}/></Field>
        <Field label="Donations"><input type="number" min="1" className="input" value={v.donor?.total||''} onChange={e=>set({...(v.donor||{}),total:+e.target.value||1})}/></Field></div></div>
    const pick=(rows,label,show)=><Field key={f.k} label={f.label}><select className="input" value={v[f.k]?.id||''} onChange={e=>set((rows||[]).find(r=>r.id===e.target.value))}>
      {!(rows||[]).length&&<option value="">{label}</option>}{(rows||[]).map(r=><option key={r.id} value={r.id}>{show(r)}</option>)}</select></Field>
    if(f.type==='meeting')return pick(D.meetings,'No meetings in the last 30 days or ahead',m=>`${m.title} (${fmt(m.meeting_date)})`)
    if(f.type==='event')return pick(D.events,'No events in the last 30 days or ahead',m=>`${m.title} (${fmt(m.event_date)})`)
    if(f.type==='project')return pick(D.projects,'No projects yet',m=>m.title)
    if(f.type==='birthday')return pick([...(D.members||[])].filter(m=>m.dob).sort((a,b)=>nextBirthday(a.dob)-nextBirthday(b.dob)),'No member birthdays saved',m=>`${m.full_name} · ${new Date(m.dob).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}${nextBirthday(m.dob)===0?' (today)':''}`)
    if(f.type==='group')return <Field key={f.k} label={f.label}><select className="input" value={v[f.k]||''} onChange={e=>set(e.target.value)}><option value="">—</option>{BLOOD.map(g=><option key={g}>{g}</option>)}</select></Field>
    if(f.type==='select')return <Field key={f.k} label={f.label}><select className="input" value={v[f.k]??''} onChange={e=>set(e.target.value)}>{f.options.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
    if(f.type==='textarea')return <Field key={f.k} label={f.label}><textarea rows={3} className="input" value={v[f.k]??''} onChange={e=>set(e.target.value)}/></Field>
    return <Field key={f.k} label={f.label}><input type={f.type==='number'?'number':'text'} className="input" value={v[f.k]??''} onChange={e=>set(f.type==='number'?e.target.value:e.target.value)}/></Field>}
  const W=spec?wordsOf(spec,lang):{}

  return <div>
    <PageHeader eyebrow="People" title="Post maker" description="Ready-to-post images for WhatsApp status, Instagram and Facebook. Pick what to say, then a design."
      actions={<><button className="btn-ghost" disabled={!!busy||!spec} onClick={share}><Share2 size={16}/>{busy==='share'?'Preparing…':'Share'}</button><button className="btn" disabled={!!busy||!spec} onClick={download}><Download size={16}/>{busy==='save'?'Saving…':'Download image'}</button></>}/>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* what the post is about */}
      <div className="card flex max-h-none flex-col p-3 lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto">
        <label className="relative mb-2 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input aria-label="Search posts" className="input pl-9" placeholder={`Search ${POSTS.length} kinds of post`} value={q} onChange={e=>setQ(e.target.value)}/></label>
        {GROUPS.map(g=>{const l=list.filter(p=>p.group===g);if(!l.length)return null
          return <div key={g} className="mb-2"><div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-fog-faint">{g}</div>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">{l.map(p=>{const I=ICON[p.icon]||Sparkles
              return <button key={p.key} onClick={()=>setType(p.key)} aria-pressed={type===p.key} className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm transition ${type===p.key?'border-brand/60 bg-brand/10 text-fg ring-2 ring-brand/20':'border-transparent text-fog-muted hover:bg-ink-800 hover:text-fg'}`}>
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${type===p.key?'bg-brand text-white':'bg-ink-800 text-fog-muted'}`}><I size={15}/></span><span className="leading-tight">{p.label}</span></button>})}</div></div>})}
        {!list.length&&<p className="p-3 text-sm text-fog-faint">No post matches “{q}”.</p>}
      </div>

      {/* preview */}
      <div className="min-w-0 space-y-4">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <div role="group" aria-label="Size" className="inline-flex rounded-xl border border-ink-700 bg-ink-900/60 p-1">{Object.entries(SIZES).map(([k,s])=><button key={k} title={s.hint} aria-pressed={size===k} onClick={()=>setSize(k)} className={`rounded-lg px-3 py-1.5 text-sm ${size===k?'bg-ink-700 text-fg ring-1 ring-ink-500':'text-fog-muted hover:text-fg'}`}>{s.label}</button>)}</div>
          <div role="group" aria-label="Language" className="inline-flex rounded-xl border border-ink-700 bg-ink-900/60 p-1">{LANGS.map(([k,l])=><button key={k} aria-pressed={lang===k} onClick={()=>setLang(k)} className={`rounded-lg px-3 py-1.5 text-sm ${lang===k?'bg-ink-700 text-fg ring-1 ring-ink-500':'text-fog-muted hover:text-fg'}`}>{l}</button>)}</div>
          <span className="ml-auto text-xs text-fog-faint">{S.w} × {S.h} px · {S.hint}</span>
        </div>
        <div ref={pref} className="card grid place-items-center overflow-hidden p-3 sm:p-5">
          <Scaled html={html} w={S.w} h={S.h} z={z} width={Math.min(pw-(pw>500?40:24),size==='story'?420:620)} className="rounded-2xl shadow-2xl ring-1 ring-black/10"/>
        </div>
        <div className="card p-3">
          <div className="mb-2 flex items-center justify-between px-1"><h3 className="text-sm font-semibold text-fg">Designs <span className="font-normal text-fog-faint">· {THEMES.length}</span></h3><span className="text-xs text-fog-faint">Every post works in every design</span></div>
          <div className="flex gap-3 overflow-x-auto pb-2" role="listbox" aria-label="Designs">{thumbs.map(([t,h])=><button key={t.key} role="option" aria-selected={theme===t.key} aria-label={`Design ${t.label}`} onClick={()=>setTheme(t.key)} className={`flex-none rounded-xl p-1.5 text-left transition ${theme===t.key?'bg-brand/10 ring-2 ring-brand':'hover:bg-ink-800'}`}>
            <Scaled html={h} w={S.w} h={S.h} z={0.8} width={size==='story'?96:132} className="rounded-lg ring-1 ring-black/10"/>
            <div className="mt-1.5 w-[132px] truncate text-xs font-medium text-fg">{t.label}</div><div className="w-[132px] truncate text-[11px] text-fog-faint">{t.hint}</div></button>)}</div>
        </div>
      </div>

      {/* details */}
      <div className="space-y-4 lg:col-span-2 xl:col-span-1">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-fg">{post?.label}</h3>
          {post?.fields.length?post.fields.map(field):<p className="text-sm text-fog-muted">{post?.needs?.includes('impact')?'Numbers come straight from the CRM.':'Nothing to fill in. Change the words below if you like.'}</p>}
          {post?.needs?.includes('camp')&&!(D.camps||[]).length&&<p className="text-sm text-fog-faint">No camps yet. Add one on the Camps page.</p>}
        </div>
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-fg">Colour</h3>
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">{ACCENTS.map(([k,l])=>{const c=k==='auto'?paletteOf(spec,brand,'auto').a:k==='brand'?paletteOf(spec,brand,'brand').a:k
            return <button key={k} role="radio" aria-checked={accent===k} title={l} aria-label={l} onClick={()=>setAccent(k)} className={`grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-ink-900 transition ${accent===k?'ring-2 ring-fg':'hover:scale-105'}`} style={{background:c}}>
              {k==='auto'&&<Sparkles size={14} className="text-white"/>}{k==='brand'&&<span className="text-[10px] font-bold text-white">CLUB</span>}</button>})}</div>
          <p className="text-xs text-fog-faint">{ACCENTS.find(a=>a[0]===accent)?.[1]}: <span className="font-mono">{pal.a}</span></p>
        </div>
        <div className="card space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Photo</h3>{photo&&<button className="btn-ghost h-8 px-2 text-xs" onClick={()=>setPhoto('')}><X size={14}/>Remove</button>}</div>
          {photo?<img src={photo} alt="Chosen photo" className="h-28 w-full rounded-xl object-cover"/>:<p className="text-xs text-fog-faint">Add a photo of the donor, the camp or the team. The Photo design uses it full size; the others show it in the circle.</p>}
          <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Choose photo" onChange={pickPhoto}/>
          <button className="btn-ghost w-full" onClick={()=>file.current.click()}><ImagePlus size={16}/>{photo?'Change photo':'Add a photo'}</button>
        </div>
        <div className="card">
          <button className="flex w-full items-center justify-between text-sm font-semibold text-fg" aria-expanded={editOpen} onClick={()=>setEditOpen(o=>!o)}>Change the words<ChevronDown size={16} className={`transition ${editOpen?'rotate-180':''}`}/></button>
          {editOpen&&<div className="mt-3 space-y-3">
            <Field label="Small label"><input className="input" placeholder={W.kicker||''} value={ov.kicker||''} onChange={e=>setOv({...ov,kicker:e.target.value})}/></Field>
            <Field label="Headline"><input className="input" placeholder={W.title||''} value={ov.title||''} onChange={e=>setOv({...ov,title:e.target.value})}/></Field>
            <Field label="Tamil line"><input className="input" placeholder={spec?.ta||''} value={ov.ta||''} onChange={e=>setOv({...ov,ta:e.target.value})}/></Field>
            <Field label="Message"><textarea rows={3} className="input" placeholder={W.lead||''} value={ov.lead||''} onChange={e=>setOv({...ov,lead:e.target.value})}/></Field>
            <Field label="Button text"><input className="input" placeholder={W.cta||''} value={ov.cta||''} onChange={e=>setOv({...ov,cta:e.target.value})}/></Field>
            {Object.values(ov).some(Boolean)&&<button className="btn-ghost w-full" onClick={()=>setOv({})}><RotateCcw size={15}/>Back to the suggested words</button>}
          </div>}
        </div>
        <div className="card space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-fg">Caption</h3><button className="btn-ghost h-8 px-2 text-xs" disabled={!spec} onClick={copyCaption}><Copy size={14}/>Copy</button></div>
          <textarea readOnly aria-label="Caption" rows={5} className="input text-xs" value={captionOf(spec,lang,brand)}/>
          {!(brand.website||brand.instagram||brand.facebook)&&<p className="text-xs text-fog-faint">Add the club's website, Instagram and Facebook in Settings to show them at the bottom of every post.</p>}
        </div>
      </div>
    </div>
    <div ref={hidden} data-post-render translate="no" aria-hidden className="pointer-events-none fixed left-[-12000px] top-0" style={{width:S.w,height:S.h}} dangerouslySetInnerHTML={{__html:html}}/>
  </div>
}
