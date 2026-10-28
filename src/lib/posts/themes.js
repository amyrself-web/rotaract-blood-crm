// Designs ("templates") for posts. Every design lays out the same content (a spec from types.js),
// so any post can be made in any design, size and language.
// Sizes inside the main area use calc(var(--z)*Npx): the post maker shrinks --z until nothing overflows.
import {esc,FONTS,iconImg,initials} from './kit'

export const SIZES={square:{w:1080,h:1080,label:'Square',hint:'Instagram, Facebook, WhatsApp'},portrait:{w:1080,h:1350,label:'Portrait',hint:'Instagram feed (4:5)'},story:{w:1080,h:1920,label:'Story',hint:'WhatsApp status, Instagram story'}}
export const LANGS=[['both','English + Tamil'],['en','English'],['ta','Tamil']]

// ---------- colour ----------
const MOODS={blood:'#E11D48',urgent:'#DC2626',calm:null,pink:'#DB2777',warm:'#EA580C',green:'#16A34A',celebrate:'#D97706'}
export const ACCENTS=[['auto','Match the post'],['brand','Club colour'],['#E11D48','Red'],['#B91C1C','Crimson'],['#2563EB','Blue'],['#0E7490','Teal'],['#16A34A','Green'],['#EA580C','Orange'],['#D97706','Gold'],['#7C3AED','Purple'],['#DB2777','Pink'],['#0F172A','Black']]
const hx=h=>{h=String(h||'').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h||'2563eb',16);return [(n>>16)&255,(n>>8)&255,n&255]}
const toHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')
export const mix=(a,b,t)=>{const x=hx(a),y=hx(b);return toHex(x.map((v,i)=>v+(y[i]-v)*t))}
const alpha=(a,o)=>{const [r,g,b]=hx(a);return `rgba(${r},${g},${b},${o})`}
const lum=a=>{const [r,g,b]=hx(a).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b}
export function paletteOf(spec,brand,accent){
  const club=/^#?[0-9a-f]{3,6}$/i.test(brand?.brand_color||'')?(brand.brand_color.startsWith('#')?brand.brand_color:'#'+brand.brand_color):'#2563EB'
  let a=accent==='brand'?club:accent&&accent!=='auto'?accent:(MOODS[spec?.mood]||club)
  if(lum(a)>0.45)a=mix(a,'#000',0.35)       // too light for white text on it
  return {a,a2:mix(a,'#000',0.4),deep:mix(a,'#05070D',0.86),soft:mix(a,'#fff',0.9),tint:mix(a,'#fff',0.75),glow:mix(a,'#fff',0.35)}
}

// ---------- text ----------
const isTa=s=>/[஀-௿]/.test(String(s||''))
const fam=(s,base)=>isTa(s)?FONTS.ta:base
const z=n=>`calc(var(--z,1)*${Math.round(n)}px)`
const LABEL_TA={Date:'தேதி',Time:'நேரம்',Venue:'இடம்',Until:'வரை',When:'எப்போது',Where:'இடம்',With:'உடன்'}
export function wordsOf(s,lang){const ta=lang==='ta'
  const title=ta?(s.title_ta||s.title):s.title
  return {kicker:ta?(s.kicker_ta||s.kicker):s.kicker,title,sub:lang!=='en'&&s.ta&&s.ta!==title?s.ta:'',lead:ta?(s.lead_ta||s.lead):s.lead,cta:ta?(s.cta_ta||s.cta):s.cta,lab:l=>ta?(LABEL_TA[l]||l):l}}
// a headline size that fits the width in about `lines` lines
function headSize(text,{w,lines=3,max=96,min=46,font}){const t=String(text||''),n=Math.max(4,t.length)
  const k=isTa(t)?0.78:font===FONTS.cond?0.46:font===FONTS.serif?0.54:0.6
  return Math.max(min,Math.min(max,Math.floor(w*lines/(n*k))))}
const clip=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1).trim()+'…':s}

// ---------- shared blocks ----------
function header(c,T){const {brand,lg,il}=c
  const logo=lg?`<div style="width:96px;height:96px;border-radius:${T.logoR??24}px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;${T.logoRing?`box-shadow:0 0 0 2px ${T.logoRing}`:''}"><img src="${lg.data}" style="max-width:80px;max-height:80px;display:block"/></div>`
    :`<div style="width:96px;height:96px;border-radius:${T.logoR??24}px;background:${T.acc};display:flex;align-items:center;justify-content:center;flex:none;${T.logoRing?`box-shadow:0 0 0 2px ${T.logoRing}`:''}">${iconImg('hands',52,'#fff')}</div>`
  const intl=il?`<div style="display:flex;flex-direction:column;align-items:center;flex:none;max-width:200px">${il.dark===false||T.dark?`<div style="background:#fff;border-radius:18px;padding:8px;display:flex">`:'<div style="display:flex">'}<img src="${il.data}" style="max-height:${c.brand.intl_logo_label?70:84}px;max-width:160px;display:block"/></div>${c.brand.intl_logo_label?`<div style="font:700 15px/1.2 ${FONTS.body};color:${T.muted};margin-top:6px;text-align:center;letter-spacing:.5px">${esc(clip(c.brand.intl_logo_label,28))}</div>`:''}</div>`:''
  return `<div style="display:flex;align-items:center;gap:22px;${T.headCenter?'justify-content:center;text-align:left':''}">${logo}<div style="flex:${T.headCenter?'0 1 auto':'1'};min-width:0">
    <div style="font:${T.clubWeight||800} ${c.brand.club_name?.length>34?28:32}px/1.15 ${T.clubFont||FONTS.display};color:${T.fg};${T.clubUpper?'text-transform:uppercase;letter-spacing:1px':''}">${esc(clip(c.brand.club_name,52))}</div>
    ${c.brand.address?`<div style="font:600 20px/1.3 ${FONTS.body};color:${T.muted};margin-top:4px">${esc(clip(c.brand.address,58))}</div>`:''}</div>${intl}</div>`}

function footer(c,T){const b=c.brand,site=String(b.website||'').replace(/^https?:\/\//,'').replace(/\/$/,''),fb=String(b.facebook||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')
  const items=[b.contact_phone&&['phone',b.contact_phone],site&&['globe',site],b.instagram&&['at',String(b.instagram).replace(/^@/,'')],fb&&['link',fb]].filter(Boolean)
  if(!items.length)return ''
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:${T.footCenter?'center':'flex-start'};gap:12px 30px;padding-top:22px;${T.footLine===false?'':`border-top:2px solid ${T.line}`}">
    ${items.slice(0,4).map(([i,t])=>`<div style="display:flex;align-items:center;gap:10px;font:700 22px/1.2 ${FONTS.body};color:${T.muted}">${iconImg(i,24,T.footIcon||T.acc,2.2)}<span>${esc(clip(t,34))}</span></div>`).join('')}</div>`}

function kicker(text,T,align){if(!text)return ''
  return `<div style="display:flex;justify-content:${align==='center'?'center':'flex-start'}">${kickerIn(text,T,align)}</div>`}
function kickerIn(text,T,align){
  const f=`800 ${z(T.kickSize||24)}/1.2 ${fam(text,FONTS.display)}`,up=isTa(text)?'':'text-transform:uppercase;'
  if(T.kick==='pill')return `<div style="display:inline-block;padding:${z(10)} ${z(26)} ${z(12)};border-radius:999px;background:${T.kickBg||T.acc};color:${T.kickFg||'#fff'};font:${f};${up}letter-spacing:3px">${esc(text)}</div>`
  if(T.kick==='bar')return `<div style="display:inline-block;padding:${z(10)} ${z(22)} ${z(12)};background:${T.kickBg||T.fg};color:${T.kickFg||'#fff'};font:${f};${up}letter-spacing:4px">${esc(text)}</div>`
  if(T.kick==='rule')return `<div style="display:flex;align-items:center;gap:${z(18)};${align==='center'?'justify-content:center':''}"><div style="width:${z(54)};height:${z(5)};background:${T.acc};border-radius:3px"></div><div style="font:${f};color:${T.kickFg||T.acc};${up}letter-spacing:4px">${esc(text)}</div>${align==='center'?`<div style="width:${z(54)};height:${z(5)};background:${T.acc};border-radius:3px"></div>`:''}</div>`
  return `<div style="font:${f};color:${T.kickFg||T.acc};${up}letter-spacing:5px">${esc(text)}</div>`}

function hero(spec,c,T,size){const h=spec.hero||{},s=Math.round(size),photo=c.photo
  const ring=T.heroRing?`box-shadow:0 0 0 ${Math.round(s*0.045)}px ${T.heroRing},0 0 0 ${Math.round(s*0.09)}px ${alpha(T.heroRing.startsWith('#')?T.heroRing:'#ffffff',0.35)}`:''
  const m=T.heroRing?`margin:${z(s*0.09)};`:''
  const box=(inner,round)=>`<div style="${m}width:${z(s)};height:${z(s)};flex:none;border-radius:${round?'50%':Math.round(s*0.22)+'px'};background:${T.heroBg};display:flex;align-items:center;justify-content:center;position:relative;${ring}">${inner}</div>`
  if(photo)return `<div style="${m||`margin:${z(s*0.04)};`}width:${z(s)};height:${z(s)};flex:none;border-radius:${T.photoSquare?Math.round(s*0.12)+'px':'50%'};background:url(${photo}) center/cover no-repeat;${ring||`box-shadow:0 0 0 ${Math.round(s*0.04)}px ${T.heroBg}`}"></div>`
  if(h.kind==='initials')return box(`<div style="font:800 ${z(s*0.38)}/1 ${FONTS.display};color:${T.heroFg};padding-bottom:${z(s*0.04)}">${esc(h.value||'?')}</div>${h.badge?`<div style="position:absolute;right:0;bottom:${z(s*0.02)};padding:${z(6)} ${z(18)} ${z(9)};border-radius:999px;background:#fff;color:${T.acc};font:800 ${z(s*0.13)}/1.1 ${FONTS.display};box-shadow:0 6px 18px rgba(0,0,0,.18)">${esc(h.badge)}</div>`:''}`,true)
  if(h.kind==='text'){const v=String(h.value||''),fs=v.length<=2?0.46:v.length<=3?0.36:0.24
    return box(`<div style="text-align:center"><div style="font:800 ${z(s*fs)}/1 ${FONTS.display};color:${T.heroFg};letter-spacing:${v.length>3?2:0}px">${esc(v)}</div>${h.sub?`<div style="font:700 ${z(s*0.1)}/1.2 ${FONTS.body};color:${T.heroFg};opacity:.8;margin-top:${z(8)}">${esc(h.sub)}</div>`:''}</div>`,false)}
  return box(iconImg(h.value||spec.icon||'sparkles',Math.round(s*0.5),T.heroFg,1.6),T.heroRound!==false)}

// dense posts on a square leave out the big picture so the words stay large
const heroTop=(s,c)=>sparse(s)||c.h>1200?'top':'none'
const sparse=s=>!(s.facts?.length||s.stats?.length||s.list?.length||s.checklist?.length||s.myth)

function body(spec,W,T,c,align){const out=[],cw=c.w-2*c.pad,ctr=align==='center'
  if(spec.myth){out.push(`<div style="display:flex;flex-direction:column;gap:${z(18)};text-align:left">
    <div style="border-radius:${T.r}px;padding:${z(26)} ${z(30)};background:${T.card};border:2px solid ${T.cardLine}"><div style="display:flex;align-items:center;gap:${z(12)};font:800 ${z(22)}/1.2 ${FONTS.display};letter-spacing:4px;color:${T.muted}">${iconImg('x',26,T.muted,3)}MYTH</div><div style="font:700 ${z(36)}/1.25 ${FONTS.display};color:${T.muted};margin-top:${z(10)};text-decoration:line-through;text-decoration-color:${alpha(T.accHex,0.7)}">${esc(spec.myth)}</div></div>
    <div style="border-radius:${T.r}px;padding:${z(26)} ${z(30)};background:${T.acc};color:#fff"><div style="display:flex;align-items:center;gap:${z(12)};font:800 ${z(22)}/1.2 ${FONTS.display};letter-spacing:4px">${iconImg('check',26,'#fff',2.6)}FACT</div><div style="font:700 ${z(36)}/1.3 ${FONTS.body};margin-top:${z(10)}">${esc(spec.fact)}</div></div></div>`)}
  if(W.lead&&!spec.myth)out.push(`<div style="font:500 ${z(spec.facts?.length||spec.stats?.length?29:33)}/1.4 ${fam(W.lead,FONTS.body)};color:${T.muted};${ctr?'margin:0 auto;':''}max-width:${cw}px">${esc(clip(W.lead,260))}</div>`)
  if(spec.facts?.length){const f=spec.facts.filter(x=>x&&x[1]),n=f.length,long=f.some(x=>String(x[1]).length>18)
    out.push(`<div style="display:grid;grid-template-columns:${n>2&&long&&c.h>1500?'1fr':`repeat(${n},1fr)`};gap:${z(16)};text-align:left">${f.map(([l,v])=>`<div style="border-radius:${T.r}px;padding:${z(18)} ${z(22)} ${z(20)};background:${T.card};border:2px solid ${T.cardLine}">
      <div style="font:800 ${z(18)}/1.2 ${fam(W.lab(l),FONTS.body)};letter-spacing:2px;color:${T.label||T.acc};text-transform:uppercase">${esc(W.lab(l))}</div><div style="font:800 ${z(String(v).length>22?24:String(v).length>14?27:31)}/1.25 ${FONTS.display};color:${T.fg};margin-top:${z(6)}">${esc(clip(v,48))}</div></div>`).join('')}</div>`)}
  if(spec.stats?.length){const s=spec.stats,n=s.length,cols=n<=3?n:n===4?2:3,big=n<=2?96:n<=3?80:64
    out.push(`<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${z(18)};text-align:${ctr?'center':'left'}">${s.map(([v,l])=>`<div style="border-radius:${T.r}px;padding:${z(22)} ${z(24)};background:${T.card};border:2px solid ${T.cardLine}">
      <div style="font:${T.numWeight||800} ${z(String(v).length>5?big*0.72:big)}/1 ${T.numFont||FONTS.display};color:${T.num}">${esc(typeof v==='number'?v.toLocaleString('en-IN'):v)}</div><div style="font:700 ${z(23)}/1.25 ${FONTS.body};color:${T.muted};margin-top:${z(12)}">${esc(l)}</div></div>`).join('')}</div>`)}
  if(spec.list?.length){const l=spec.list,two=l.length>5
    out.push(`<div style="display:grid;grid-template-columns:${two?'1fr 1fr':'1fr'};gap:${z(12)} ${z(28)};text-align:left">${l.map(([n,r])=>`<div style="display:flex;align-items:center;gap:${z(14)};padding:${z(12)} 0;border-bottom:2px solid ${T.line}">
      <div style="width:${z(12)};height:${z(12)};border-radius:50%;background:${T.acc};flex:none"></div><div style="min-width:0"><div style="font:800 ${z(two?26:30)}/1.2 ${FONTS.display};color:${T.fg}">${esc(clip(n,30))}</div>${r?`<div style="font:600 ${z(two?19:22)}/1.2 ${FONTS.body};color:${T.muted};margin-top:${z(2)}">${esc(clip(r,34))}</div>`:''}</div></div>`).join('')}</div>`)}
  if(spec.checklist?.length)out.push(`<div style="display:flex;flex-direction:column;gap:${z(12)};text-align:left">${spec.checklist.map(([en,ta])=>`<div style="display:flex;align-items:center;gap:${z(18)};border-radius:${T.r}px;padding:${z(14)} ${z(22)};background:${T.card};border:2px solid ${T.cardLine}">
    ${iconImg('check',40,T.accHex,2.4)}<div><div style="font:700 ${z(c.lang==='ta'?0:28)}/1.25 ${FONTS.body};color:${T.fg};${c.lang==='ta'?'display:none':''}">${esc(en)}</div>${c.lang!=='en'?`<div style="font:700 ${z(c.lang==='ta'?28:21)}/1.35 ${FONTS.ta};color:${c.lang==='ta'?T.fg:T.muted}">${esc(ta)}</div>`:''}</div></div>`).join('')}</div>`)
  return out.join('')}

function cta(spec,W,T,c,align){if(!W.cta&&!spec.phone&&!spec.qr)return ''
  const ctr=align==='center'&&!spec.qr
  const left=`<div style="display:flex;flex-direction:column;align-items:${ctr?'center':'flex-start'};gap:${z(12)};min-width:0;flex:1">
    ${W.cta?`<div style="display:inline-block;padding:${z(16)} ${z(34)} ${z(18)};border-radius:${T.btnR??999}px;background:${T.btnBg||T.acc};color:${T.btnFg||'#fff'};font:800 ${z(isTa(W.cta)?28:32)}/1.2 ${fam(W.cta,FONTS.display)}">${esc(W.cta)}${spec.phone?'':' →'}</div>`:''}
    ${spec.phone?`<div style="font:800 ${z(64)}/1.1 ${FONTS.display};color:${T.fg};letter-spacing:1px">${esc(spec.phone)}</div>`:''}
    ${spec.ctaSub?`<div style="font:600 ${z(23)}/1.35 ${FONTS.body};color:${T.muted}">${esc(spec.ctaSub)}</div>`:''}</div>`
  const qr=spec.qr&&c.qr?`<div style="flex:none;background:#fff;border-radius:${Math.min(T.r,26)}px;padding:${z(14)};${T.dark?'':`border:2px solid ${T.cardLine}`}"><img src="${c.qr}" style="width:${z(c.h>1500?250:200)};height:${z(c.h>1500?250:200)};display:block"/><div style="font:800 ${z(15)}/1.2 ${FONTS.body};color:#0B1324;text-align:center;margin-top:${z(6)};letter-spacing:2px">SCAN TO REGISTER</div></div>`:''
  return `<div style="display:flex;align-items:flex-end;gap:${z(28)};${ctr?'justify-content:center;text-align:center':''}">${left}${qr}</div>`}

function titleBlock(spec,W,T,c,align,width){const font=fam(W.title,T.titleFont||FONTS.display)
  const fs=spec.title_big?Math.min(220,Math.floor(width/(String(W.title).length*0.62))):headSize(W.title,{w:width,lines:c.h>1500?4:3,max:T.titleMax||(c.h>1500?112:96),font:T.titleFont})
  const up=T.titleUpper&&!isTa(W.title)
  return `<div style="font:${T.titleWeight||800} ${T.titleItalic&&!isTa(W.title)?'italic ':''}${z(up?fs*1.06:fs)}/${isTa(W.title)?1.3:T.titleFont===FONTS.cond?1.02:1.08} ${font};color:${T.title||T.fg};${up?'text-transform:uppercase;':''}letter-spacing:${up?1:-0.5}px;overflow-wrap:break-word">${esc(W.title)}</div>
    ${W.sub?`<div style="font:700 ${z(Math.min(44,headSize(W.sub,{w:width,lines:2,max:42,min:26})))}/1.4 ${FONTS.ta};color:${T.sub||T.acc}">${esc(W.sub)}</div>`:''}`}

// the main area: kicker, title, hero, details, call to action
function main(spec,W,T,c,{align='left',heroAt='side',heroSize}={}){const cw=c.w-2*c.pad,few=sparse(spec),ctr=align==='center'
  const hs=heroSize||(few?(c.h>1500?400:c.h>1200?320:260):(c.h>1500?240:170))
  const showHero=heroAt!=='none'&&(spec.hero||c.photo)
  const head=`${kicker(W.kicker,T,align)}${titleBlock(spec,W,T,c,align,showHero&&heroAt==='side'?cw-hs-36:cw)}`
  const top=showHero&&heroAt==='side'?`<div style="display:flex;align-items:center;gap:36px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:${z(20)}">${head}</div>${hero(spec,c,T,hs)}</div>`
    :showHero&&heroAt==='top'?`<div style="display:flex;justify-content:${ctr?'center':'flex-start'}">${hero(spec,c,T,hs)}</div><div style="display:flex;flex-direction:column;gap:${z(20)};align-items:${ctr?'center':'stretch'}">${head}</div>`
    :`<div style="display:flex;flex-direction:column;gap:${z(20)};align-items:${ctr?'center':'stretch'}">${head}</div>`
  return `<div data-fit style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:${T.vAlign||'center'};gap:${z(c.h>1500?44:30)};text-align:${ctr?'center':'left'};padding:4px 0">
    ${top}${body(spec,W,T,c,align)}${cta(spec,W,T,c,align)}</div>`}

const root=(c,bg,inner,extra='')=>`<div style="position:relative;width:${c.w}px;height:${c.h}px;overflow:hidden;background:${bg};font-family:${FONTS.body};${extra}">${inner}</div>`
const col=(c,inner,gap=36,extra='')=>`<div style="position:absolute;inset:0;padding:${c.pad}px;display:flex;flex-direction:column;gap:${gap}px;${extra}">${inner}</div>`
const circle=(x,y,d,bg,extra='')=>`<div style="position:absolute;left:${x}px;top:${y}px;width:${d}px;height:${d}px;border-radius:50%;background:${bg};${extra}"></div>`

// ---------- designs ----------
const DARK=(p,o={})=>({dark:true,fg:'#fff',muted:'#C3CCDD',line:'rgba(255,255,255,.16)',card:'rgba(255,255,255,.07)',cardLine:'rgba(255,255,255,.14)',acc:p.a,accHex:p.a,num:p.glow,sub:p.tint,heroBg:p.a,heroFg:'#fff',r:26,...o})
const LIGHT=(p,o={})=>({dark:false,fg:'#0F172A',muted:'#475569',line:'#E2E8F0',card:'#fff',cardLine:'#E2E8F0',acc:p.a,accHex:p.a,num:p.a,sub:p.a2,heroBg:p.a,heroFg:'#fff',r:24,...o})

export const THEMES=[
 {key:'midnight',label:'Midnight',hint:'Dark, glowing, modern',draw(spec,W,c,p){const T=DARK(p,{kick:'pill',heroRing:p.a})
   return root(c,`linear-gradient(155deg,#0A0F1E 0%,${p.deep} 55%,${mix(p.a,'#000',0.6)} 100%)`,
     circle(c.w-420,-260,760,`radial-gradient(circle,${alpha(p.a,0.45)},${alpha(p.a,0)} 68%)`)+circle(-300,c.h-460,760,`radial-gradient(circle,${alpha(p.glow,0.22)},${alpha(p.glow,0)} 70%)`)
     +col(c,header(c,T)+main(spec,W,T,c,{heroAt:sparse(spec)?'top':'side'})+footer(c,T))
     +`<div style="position:absolute;left:0;right:0;bottom:0;height:14px;display:flex"><div style="flex:6;background:${p.a}"></div><div style="flex:3;background:${p.glow}"></div><div style="flex:1;background:#fff"></div></div>`)}},
 {key:'paper',label:'Classic paper',hint:'Cream, serif, elegant',draw(spec,W,c,p){const T=LIGHT(p,{fg:'#1C1917',muted:'#57534E',line:'#E7DFD2',card:'#FFFDF8',cardLine:'#E7DFD2',kick:'rule',titleFont:FONTS.serif,numFont:FONTS.serif,headCenter:true,footCenter:true,clubFont:FONTS.serif,heroRing:'#fff',r:14,title:'#1C1917'})
   return root(c,'#FBF6EC',`<div style="position:absolute;inset:28px;border:2px solid ${alpha(p.a,0.55)}"></div><div style="position:absolute;inset:40px;border:1px solid ${alpha(p.a,0.3)}"></div>`
     +col({...c,pad:c.pad+16},header(c,T)+main(spec,W,T,c,{align:'center',heroAt:heroTop(spec,c),heroSize:sparse(spec)?undefined:c.h>1500?220:150})+footer(c,T)))}},
 {key:'bold',label:'Bold colour',hint:'Big type on the post colour',draw(spec,W,c,p){const T=DARK(p,{kick:'bar',kickBg:'#fff',kickFg:p.a2,titleFont:FONTS.cond,titleUpper:true,titleWeight:400,titleMax:c.h>1500?150:128,muted:'#FDECEE',sub:'#fff',num:'#fff',card:'rgba(0,0,0,.16)',cardLine:'rgba(255,255,255,.22)',label:'#fff',btnBg:'#fff',btnFg:p.a2,heroBg:'#fff',heroFg:p.a,heroRing:'rgba(255,255,255,.3)',r:20,footIcon:'#fff',logoRing:'rgba(255,255,255,.4)'})
   return root(c,`linear-gradient(160deg,${p.a} 0%,${p.a2} 100%)`,circle(c.w-520,c.h-560,900,'rgba(255,255,255,.07)')+circle(c.w-300,c.h-340,460,'rgba(255,255,255,.07)')
     +col(c,header(c,T)+main(spec,W,T,c,{heroAt:sparse(spec)?'top':'side'})+footer(c,T)))}},
 {key:'split',label:'Split panel',hint:'Colour panel on top, clean white below',draw(spec,W,c,p){const T=LIGHT(p,{kick:'pill',heroBg:'#fff',heroFg:p.a,heroRing:'rgba(255,255,255,.35)'}),TH=DARK(p,{muted:'rgba(255,255,255,.85)',logoRing:'rgba(255,255,255,.5)'})
   const few=sparse(spec),ph=Math.round(c.h*(few?(c.h>1500?0.3:0.36):c.h>1500?0.24:c.h>1200?0.22:0.19)),hs=few||c.h>1200?Math.round(few?ph*0.55:Math.min(ph*0.42,c.h>1500?210:150)):0
   return root(c,'#fff',`<div style="position:absolute;left:0;right:0;top:0;height:${ph}px;background:linear-gradient(135deg,${p.a},${p.a2})">${circle(-120,ph-260,420,'rgba(255,255,255,.08)')}${circle(c.w-260,-140,420,'rgba(255,255,255,.08)')}
       <div style="position:absolute;left:${c.pad}px;right:${c.pad}px;top:${c.pad-16}px">${header(c,TH)}</div>
       <div style="position:absolute;left:0;right:0;bottom:-${Math.round(hs/2)}px;display:flex;justify-content:center">${hs&&(spec.hero||c.photo)?hero(spec,c,{...T,heroBg:p.a2,heroFg:'#fff',heroRing:'#fff'},hs).replace(/calc\(var\(--z,1\)\*(\d+)px\)/g,'$1px'):''}</div></div>`
     +col(c,main(spec,W,T,c,{align:'center',heroAt:'none'})+footer(c,{...T,footCenter:true}),28,`padding-top:${ph+(hs&&(spec.hero||c.photo)?hs/2+24:40)}px`))}},
 {key:'photo',label:'Photo',hint:'Your photo full size, text at the bottom',draw(spec,W,c,p){const T=DARK(p,{kick:'pill',card:'rgba(255,255,255,.12)',cardLine:'rgba(255,255,255,.2)',vAlign:'flex-end'})
   const bg=c.photo?`url(${c.photo}) center/cover no-repeat`:`linear-gradient(160deg,${p.a2},${p.deep})`
   return root(c,bg,(c.photo?'':`<div style="position:absolute;right:-80px;top:${Math.round(c.h*0.14)}px;opacity:.16">${iconImg(spec.icon||'sparkles',Math.round(c.w*0.8),'#fff',1.2)}</div>`)
     +`<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,13,.55) 0%,rgba(5,7,13,0) 22%,rgba(5,7,13,.2) 42%,${alpha(mix(p.deep,'#000',0.4),0.94)} 72%,${mix(p.deep,'#000',0.5)} 100%)"></div>`
     +col(c,header(c,T)+main(spec,W,T,{...c,photo:null},{heroAt:'none'})+footer(c,T)))}},
 {key:'frame',label:'Framed',hint:'White with a coloured frame',draw(spec,W,c,p){const T=LIGHT(p,{kick:'plain',headCenter:true,footCenter:true,heroBg:p.soft,heroFg:p.a,heroRing:p.tint,r:18})
   const corner=(x,y)=>`<div style="position:absolute;${x}:30px;${y}:30px;width:70px;height:70px;border-${x}:10px solid ${p.a};border-${y}:10px solid ${p.a}"></div>`
   return root(c,'#fff',`<div style="position:absolute;inset:18px;border:3px solid ${p.tint}"></div>`+corner('left','top')+corner('right','top')+corner('left','bottom')+corner('right','bottom')
     +col({...c,pad:c.pad+20},header(c,T)+main(spec,W,T,c,{align:'center',heroAt:heroTop(spec,c),heroSize:sparse(spec)?undefined:c.h>1500?200:140})+footer(c,T)))}},
 {key:'modern',label:'Modern shapes',hint:'Light, geometric, fresh',draw(spec,W,c,p){const T=LIGHT(p,{kick:'rule',card:'#fff',cardLine:'#E5E9F2',heroBg:p.a,heroRing:p.tint})
   return root(c,'#F4F6FB',circle(c.w-330,-250,620,p.soft)+circle(c.w-150,-110,300,p.tint)+`<div style="position:absolute;left:-140px;bottom:-140px;width:420px;height:420px;border-radius:90px;transform:rotate(24deg);background:${p.soft}"></div>`
     +`<div style="position:absolute;left:0;top:0;bottom:0;width:16px;background:linear-gradient(${p.a},${p.a2})"></div>`
     +col(c,header(c,T)+main(spec,W,T,c,{heroAt:sparse(spec)?'top':'side'})+footer(c,T)))}},
 {key:'vibrant',label:'Vibrant card',hint:'Gradient with a white card',draw(spec,W,c,p){const T=LIGHT(p,{kick:'pill',card:p.soft,cardLine:p.tint,heroRing:p.tint}),TH=DARK(p,{muted:'rgba(255,255,255,.88)',footIcon:'#fff',logoRing:'rgba(255,255,255,.5)'})
   const ic={...c,w:c.w-2*c.pad,pad:48}
   return root(c,`linear-gradient(135deg,${p.a} 0%,${mix(p.a,'#7C3AED',0.45)} 100%)`,circle(-160,-160,480,'rgba(255,255,255,.1)')+circle(c.w-260,c.h-300,520,'rgba(255,255,255,.1)')
     +col(c,header(c,TH)+`<div style="flex:1;min-height:0;display:flex;flex-direction:column;background:#fff;border-radius:40px;padding:48px;box-shadow:0 30px 60px rgba(0,0,0,.18)">${main(spec,W,T,ic,{heroAt:sparse(spec)?'top':c.h>1200?'side':'none',align:sparse(spec)?'center':'left',heroSize:sparse(spec)?(c.h>1500?320:200):(c.h>1500?200:140)})}</div>`+footer(c,{...TH,footLine:false,footCenter:true}),30))}},
 {key:'news',label:'Newsprint',hint:'Headline style, black and colour',draw(spec,W,c,p){const T=LIGHT(p,{fg:'#111',muted:'#3F3F46',line:'#111',card:'#FFFEFA',cardLine:'#111',kick:'bar',kickBg:p.a,titleFont:FONTS.serif,titleMax:c.h>1500?120:104,heroBg:'#111',heroFg:'#fff',r:0,btnR:0,btnBg:'#111',label:p.a,clubFont:FONTS.serif,clubUpper:true,logoR:0})
   const today=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
   return root(c,'#F3EFE6',col(c,header(c,T)+`<div style="border-top:6px solid #111;border-bottom:2px solid #111;padding:8px 0;display:flex;justify-content:space-between;font:800 18px/1.2 ${FONTS.body};letter-spacing:3px;color:#111;text-transform:uppercase"><span>${esc(today)}</span><span style="color:${p.a}">${esc(clip(spec.kicker||'',30))}</span></div>`
     +main(spec,W,T,c,{heroAt:sparse(spec)?'top':'side'})+footer(c,T),26))}},
 {key:'minimal',label:'Minimal',hint:'White space, calm and clear',draw(spec,W,c,p){const T=LIGHT(p,{kick:'plain',card:'#F8FAFC',cardLine:'#F1F5F9',heroBg:p.soft,heroFg:p.a,headCenter:true,footCenter:true,footLine:false,r:20})
   return root(c,'#fff',col({...c,pad:c.pad+12},header(c,T)+`<div style="width:90px;height:6px;border-radius:3px;background:${p.a};margin:0 auto"></div>`+main(spec,W,T,c,{align:'center',heroAt:sparse(spec)?'top':'none'})+footer(c,T)))}},
 {key:'festive',label:'Festive',hint:'Celebration, confetti, gold',draw(spec,W,c,p){const gold='#FCD34D',T=DARK(p,{kick:'rule',kickFg:gold,acc:gold,accHex:'#F59E0B',titleFont:FONTS.serif,titleItalic:true,title:'#FFF7E0',sub:gold,num:gold,heroBg:`linear-gradient(150deg,${gold},#F59E0B)`,heroFg:p.deep,heroRing:'rgba(252,211,77,.4)',btnBg:gold,btnFg:p.deep,headCenter:true,footCenter:true,footIcon:gold,label:gold})
   let conf='',seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280
   for(let i=0;i<46;i++){const x=Math.round(rnd()*c.w),y=Math.round(rnd()*c.h),w=8+Math.round(rnd()*14),col2=[gold,'#fff',p.glow,'#F472B6','#60A5FA'][i%5]
     if(x>150&&x<c.w-150&&y>200&&y<c.h-200)continue
     conf+=`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w*(i%3?0.45:1))}px;border-radius:${i%3?2:50}px;background:${col2};opacity:.85;transform:rotate(${Math.round(rnd()*180)}deg)"></div>`}
   return root(c,`radial-gradient(circle at 50% 35%,${mix(p.a,'#000',0.45)} 0%,${p.deep} 70%)`,conf
     +col(c,header(c,T)+main(spec,W,T,c,{align:'center',heroAt:heroTop(spec,c),heroSize:sparse(spec)?undefined:c.h>1500?210:140})+footer(c,T)))}},
]
export const themeOf=k=>THEMES.find(t=>t.key===k)||THEMES[0]

export function renderPost(spec,{theme,size='square',lang='both',accent='auto',...ctx}){const S=SIZES[size]||SIZES.square
  if(!spec)return root({w:S.w,h:S.h},'#0B1324',`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 36px/1.3 ${FONTS.body};color:#94A3B8">Choose what the post is about</div>`)
  const c={...ctx,lang,w:S.w,h:S.h,pad:size==='story'?84:72},p=paletteOf(spec,ctx.brand,accent),W=wordsOf(spec,lang)
  return themeOf(theme).draw(spec,W,c,p)}
