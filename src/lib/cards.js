// ID cards, entry passes and donor cards. Designed in HTML (so Tamil renders correctly) and saved as PDF,
// either one card per page at real card size (85.6 x 54 mm, for a card printer or print shop)
// or 9 per A4 sheet with cut marks (front sheet, then a back sheet ready for double-sided printing).
import QRCode from 'qrcode'
import {withBrand,logoImage} from './docpdf'
import regUrl from '../assets/fonts/Manrope_400Regular.ttf?url'
import semiUrl from '../assets/fonts/Manrope_600SemiBold.ttf?url'
import boldUrl from '../assets/fonts/Manrope_800ExtraBold.ttf?url'

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const pad=(p,n,w=3)=>n==null?'':`${p}-${String(n).padStart(w,'0')}`
const fmtCode=c=>c&&c.length===12?c.match(/.{4}/g).join('-'):c||''
const PW=324,PH=514  // portrait card in CSS px (54 x 85.6 mm)
const F="'ManropeCard', Manrope, sans-serif",TA="'Noto Serif Tamil', serif"
export const rotaryEnd=(d=new Date())=>new Date(d.getMonth()>=6?d.getFullYear()+1:d.getFullYear(),5,30)
const dmy=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-'
export const memberCardUrl=code=>`${location.origin}${location.pathname}#/member/${fmtCode(code)}`

let ready
async function prepare(){
  ready??=(async()=>{
    const st=document.createElement('style')
    st.textContent=`@font-face{font-family:ManropeCard;src:url(${regUrl}) format('truetype');font-weight:400}
      @font-face{font-family:ManropeCard;src:url(${semiUrl}) format('truetype');font-weight:600}
      @font-face{font-family:ManropeCard;src:url(${boldUrl}) format('truetype');font-weight:800}`
    // the app's Tailwind reset makes images block-level and squeezes SVGs; cards need the plain browser behaviour
    st.textContent+=`.crm-card-snap img,.crm-card-snap svg{display:inline-block;max-width:none;vertical-align:middle}`
    document.head.appendChild(st)
    await Promise.all([import('@fontsource/noto-serif-tamil/400.css'),import('@fontsource/noto-serif-tamil/700.css')])
    await Promise.all(["400 12px ManropeCard","600 12px ManropeCard","800 12px ManropeCard","400 12px 'Noto Serif Tamil'","700 12px 'Noto Serif Tamil'"]
      .map(f=>document.fonts?.load(f,'Aதமிழ்')?.catch(()=>{})))})()
  return ready
}
const qr=(text,dark='#0B1324')=>QRCode.toDataURL(text,{margin:0,width:300,color:{dark,light:'#ffffff'}})
const logoTag=(lg,box)=>lg?(()=>{const k=Math.min(box/lg.w,box/lg.h);return `<img src="${lg.data}" style="width:${Math.round(lg.w*k)}px;height:${Math.round(lg.h*k)}px"/>`})()
  :`<svg width="${box}" height="${box}" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#E11D48"/><path d="M50 18C50 18 26 48 26 63a24 24 0 0 0 48 0C74 48 50 18 50 18z" fill="#fff"/></svg>`
const initials=n=>String(n||'?').split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()

// ---------- member ID card (portrait) ----------
async function memberFaces(m,brand,lg){
  const accent=brand.brand_color||'#4C8DFF',photo=m.photo_url?await logoImage(m.photo_url):null,code=await qr(memberCardUrl(m.card_code))
  const ph=photo?(()=>{const k=Math.max(118/photo.w,146/photo.h);return `<img src="${photo.data}" style="width:${Math.round(photo.w*k)}px;height:${Math.round(photo.h*k)}px;margin-left:${Math.round((118-photo.w*k)/2)}px;margin-top:${Math.round((146-photo.h*k)/2)}px"/>`})()
    :`<div style="width:118px;height:146px;text-align:center;background:linear-gradient(135deg,${accent},#0B1324);color:#fff;font:800 40px/146px ${F}">${esc(initials(m.full_name))}</div>`
  const front=`<div style="position:relative;width:${PW}px;height:${PH}px;background:#fff;overflow:hidden;font-family:${F}">
    <div style="position:absolute;left:0;right:0;top:0;height:168px;background:radial-gradient(260px 160px at 100% 0,${accent}88,transparent 70%),linear-gradient(160deg,#0B1324,#14244A)"></div>
    <svg style="position:absolute;left:0;top:132px" width="${PW}" height="60" viewBox="0 0 ${PW} 60" preserveAspectRatio="none"><path d="M0 36 C 90 0, 220 70, ${PW} 22 L ${PW} 60 L 0 60 Z" fill="#fff"/></svg>
    <div style="position:absolute;left:18px;right:18px;top:16px;display:flex;align-items:center;gap:10px">
      <div style="width:42px;height:42px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${logoTag(lg,34)}</div>
      <div style="min-width:0"><div style="font:800 13px ${F};color:#fff;line-height:1.15">${esc(brand.club_name)}</div><div style="font:600 8.5px ${F};letter-spacing:1.6px;color:#A9B8D6;margin-top:3px">MEMBER IDENTITY CARD</div></div></div>
    <div style="position:absolute;left:${(PW-126)/2}px;top:88px;width:118px;height:146px;border:4px solid #fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgba(11,19,36,.25);background:#E9EDF5">${ph}</div>
    <div style="position:absolute;left:14px;right:14px;top:252px;text-align:center">
      <div style="font:800 20px ${F};color:#0B1324;line-height:1.15">${esc(m.full_name)}</div>
      <div style="display:flex;justify-content:center;margin-top:11px"><div style="height:22px;line-height:22px;padding:0 12px;border-radius:999px;background:${accent}1f;color:${accent};font:800 10.5px/19px ${F};padding-bottom:3px;box-sizing:border-box;letter-spacing:.6px;white-space:nowrap">${esc(String(m.position||'Member').toUpperCase())}</div></div></div>
    <div style="position:absolute;left:20px;right:20px;top:330px;display:flex;gap:8px">
      ${[['MEMBER ID',pad('M',m.member_no)],['BLOOD',m.blood_group||'-'],['VALID TILL',dmy(rotaryEnd())]].map(([l,v],i)=>`<div style="flex:${i===2?1.4:1};border:1px solid #E6E9F0;border-radius:10px;padding:7px 8px;text-align:center"><div style="font:600 7.5px ${F};letter-spacing:1px;color:#7A869C">${l}</div><div style="font:800 12px ${F};color:${i===1?'#C81E3A':'#0B1324'};margin-top:3px;white-space:nowrap">${esc(v)}</div></div>`).join('')}</div>
    <div style="position:absolute;left:20px;right:20px;top:392px;font:600 9.5px ${F};color:#6B778C;text-align:center">${esc(m.membership_type||'Active')} member since ${dmy(m.joined_on)}</div>
    <div style="position:absolute;left:20px;right:20px;bottom:30px;display:flex;justify-content:space-between;align-items:flex-end">
      <div><div style="height:22px"></div><div style="border-top:1px solid #0B1324;width:110px;padding-top:3px;font:600 8px ${F};color:#6B778C">${esc(brand.signatory_title||'President')}</div></div>
      <div style="font:800 9px ${F};color:#C81E3A;letter-spacing:1px">${esc(fmtCode(m.card_code))}</div></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:10px;display:flex"><div style="flex:6;background:#0B1324"></div><div style="flex:3;background:#C81E3A"></div><div style="flex:1;background:${accent}"></div></div></div>`
  const back=`<div style="position:relative;width:${PW}px;height:${PH}px;background:#fff;overflow:hidden;font-family:${F}">
    <div style="position:absolute;left:0;right:0;top:0;height:10px;display:flex"><div style="flex:6;background:#0B1324"></div><div style="flex:3;background:#C81E3A"></div><div style="flex:1;background:${accent}"></div></div>
    <div style="position:absolute;left:0;right:0;top:34px;text-align:center"><img src="${code}" style="width:150px;height:150px"/>
      <div style="font:800 11px ${F};color:#0B1324;margin-top:10px">Scan to verify this card</div><div style="font:600 9px ${F};color:#6B778C;margin-top:2px;letter-spacing:1px">${esc(fmtCode(m.card_code))}</div></div>
    <div style="position:absolute;left:22px;right:22px;top:250px;font:400 10px/1.5 ${F};color:#253043">
      ${[['Emergency contact',m.emergency_contact],['Phone',m.phone],['Address',m.address||m.area]].filter(x=>x[1]).map(([l,v])=>`<div style="margin-bottom:8px"><div style="font:600 7.5px ${F};letter-spacing:1px;color:#7A869C">${l.toUpperCase()}</div><div style="font-weight:600">${esc(v)}</div></div>`).join('')}</div>
    <div style="position:absolute;left:22px;right:22px;bottom:30px;border-top:1px dashed #D5DBE6;padding-top:10px;text-align:center;font:400 8.5px/1.5 ${F};color:#6B778C">
      <div style="font:800 10px ${F};color:#0B1324">${esc(brand.club_name)}</div>${esc([brand.address,brand.contact_phone,brand.contact_email].filter(Boolean).join(' · '))}
      <div style="margin-top:6px">This card belongs to the club. If found, please return it to the address above.</div></div></div>`
  return [front,back]
}

// ---------- entry passes for a camp or event (portrait, front only) ----------
const ROLE={Volunteer:'#2F6FED',Doctor:'#0E9F6E',Medical:'#0E9F6E',Organiser:'#C81E3A',Guest:'#7C5CFF',Media:'#D97706',Donor:'#C81E3A'}
async function passFace(p,ev,brand,lg){
  const col=ROLE[p.role]||brand.brand_color||'#2F6FED',code=await qr(`${brand.club_name} | ${ev.name} | ${p.role}${p.no?' '+p.no:''}${p.name?' | '+p.name:''}`)
  return `<div style="position:relative;width:${PW}px;height:${PH}px;background:#fff;overflow:hidden;font-family:${F}">
    <div style="position:absolute;left:0;right:0;top:0;height:150px;background:linear-gradient(160deg,#0B1324,#14244A)"></div>
    <div style="position:absolute;left:18px;right:18px;top:18px;display:flex;align-items:center;gap:10px">
      <div style="width:40px;height:40px;border-radius:11px;background:#fff;display:flex;align-items:center;justify-content:center">${logoTag(lg,32)}</div>
      <div style="min-width:0"><div style="font:800 12.5px ${F};color:#fff;line-height:1.15">${esc(brand.club_name)}</div><div style="font:600 8.5px ${F};color:#A9B8D6;margin-top:3px">ENTRY PASS</div></div></div>
    <div style="position:absolute;left:18px;right:18px;top:80px;color:#fff"><div style="font:800 15px ${F};line-height:1.2">${esc(ev.name)}</div><div style="font:600 10px ${F};color:#C9D4EA;margin-top:4px">${esc([dmy(ev.date),ev.venue].filter(Boolean).join(' · '))}</div></div>
    <div style="position:absolute;left:0;right:0;top:150px;height:56px;background:${col};text-align:center;font:800 26px/50px ${F};letter-spacing:5px;color:#fff">${esc(String(p.role).toUpperCase())}</div>
    <div style="position:absolute;left:20px;right:20px;top:232px;text-align:center">
      ${p.name?`<div style="font:800 22px ${F};color:#0B1324;line-height:1.15">${esc(p.name)}</div>`:`<div style="font:600 10px ${F};color:#7A869C;text-align:left">NAME</div><div style="border-bottom:1.5px solid #0B1324;height:30px"></div>`}
      ${p.desk||p.shift?`<div style="font:600 12px ${F};color:#253043;margin-top:10px">${esc([p.desk,p.shift].filter(Boolean).join(' · '))}</div>`:p.name?'':`<div style="font:600 10px ${F};color:#7A869C;text-align:left;margin-top:16px">DESK / ORGANISATION</div><div style="border-bottom:1.5px solid #0B1324;height:28px"></div>`}
      ${p.no?`<div style="display:flex;justify-content:center;margin-top:10px"><div style="height:20px;padding:0 10px;border-radius:999px;background:#F1F4F9;font:800 10px/17px ${F};padding-bottom:3px;box-sizing:border-box;color:#0B1324">${esc(p.no)}</div></div>`:''}</div>
    <div style="position:absolute;left:0;right:0;bottom:38px;text-align:center"><img src="${code}" style="width:92px;height:92px"/></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:24px;background:${col};opacity:.12"></div>
    <div style="position:absolute;left:0;right:0;bottom:7px;text-align:center;font:600 8px ${F};color:#6B778C">Please wear this pass at all times</div></div>`
}

// ---------- eye / body pledge card and blood donor card (landscape wallet cards) ----------
const LW=514,LH=324
const EYE='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="52" fill="#ffffff" fill-opacity=".12"/><path d="M12 55c11-20 26-30 43-30s32 10 43 30c-11 20-26 30-43 30S23 75 12 55z" fill="none" stroke="#fff" stroke-width="5"/><circle cx="55" cy="55" r="14" fill="#fff"/><circle cx="55" cy="55" r="6" fill="#B4233A"/></svg>')
const KIND={eye:['EYE DONOR','கண் தானம்'],body:['BODY DONOR','உடல் தானம்'],organ:['ORGAN DONOR','உறுப்பு தானம்'],skin:['SKIN DONOR','தோல் தானம்']}
function pledgeFaces(p,brand,lg){
  const kinds=['eye','body','organ','skin'].filter(k=>p[k]),main=KIND[kinds[0]||'eye']
  const front=`<div style="position:relative;width:${LW}px;height:${LH}px;background:#fff;overflow:hidden;font-family:${F}">
    <div style="position:absolute;left:0;top:0;bottom:0;width:178px;background:radial-gradient(200px 200px at 0 0,#F0435A,transparent 70%),linear-gradient(160deg,#B4233A,#6E0F22)"></div>
    <img src="${EYE}" style="position:absolute;left:34px;top:34px;width:110px;height:110px"/>
    <div style="position:absolute;left:14px;width:150px;top:160px;text-align:center;color:#fff"><div style="font:800 15px ${F};letter-spacing:1px">${main[0]}</div><div style="font:700 14px ${TA};margin-top:4px">${main[1]}</div>
      ${kinds.length>1?`<div style="font:600 9px ${F};margin-top:8px;opacity:.85">${kinds.map(k=>KIND[k][0].replace(' DONOR','')).join(' · ')}</div>`:''}</div>
    <div style="position:absolute;left:14px;width:150px;bottom:14px;text-align:center;font:600 9px ${F};color:#FFD3DA">${esc(pad('PL',p.pledge_no,4))}</div>
    <div style="position:absolute;left:198px;right:18px;top:18px;display:flex;align-items:center;gap:8px"><div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center">${logoTag(lg,28)}</div><div style="font:800 11.5px ${F};color:#0B1324;line-height:1.15">${esc(brand.club_name)}</div></div>
    <div style="position:absolute;left:198px;right:18px;top:62px"><div style="font:600 9px ${F};letter-spacing:1.2px;color:#7A869C">I HAVE PLEDGED TO DONATE AFTER MY DEATH</div><div style="font:400 10px ${TA};color:#6B778C;margin-top:2px">என் மறைவுக்குப் பின் தானம் செய்ய உறுதியளித்துள்ளேன்</div>
      <div style="font:800 22px ${F};color:#0B1324;margin-top:10px;line-height:1.15">${esc(p.full_name)}</div></div>
    <div style="position:absolute;left:198px;right:18px;top:168px;display:flex;gap:8px">
      ${[['BLOOD GROUP',p.blood_group||'-'],['PLEDGED ON',dmy(p.pledged_on)],['MOBILE',p.phone||'-']].map(([l,v],i)=>`<div style="flex:1;border:1px solid #E6E9F0;border-radius:9px;padding:6px 8px"><div style="font:600 7px ${F};letter-spacing:.8px;color:#7A869C">${l}</div><div style="font:800 11px ${F};color:${i===0?'#C81E3A':'#0B1324'};margin-top:2px;white-space:nowrap">${esc(v)}</div></div>`).join('')}</div>
    <div style="position:absolute;left:198px;right:18px;top:224px;font:600 9.5px ${F};color:#253043">Family contact: <b>${esc(p.family_contact||'-')}</b>${p.family_phone?` · ${esc(p.family_phone)}`:''}</div>
    <div style="position:absolute;left:198px;right:18px;bottom:16px;display:flex;justify-content:space-between;align-items:flex-end"><div style="border-top:1px solid #0B1324;width:120px;padding-top:3px;font:600 8px ${F};color:#6B778C">Donor signature</div>
      <div style="font:600 8px ${F};color:#6B778C;text-align:right">${esc(p.institution||'')}</div></div></div>`
  const back=`<div style="position:relative;width:${LW}px;height:${LH}px;background:#fff;overflow:hidden;font-family:${F}">
    <div style="position:absolute;left:0;right:0;top:0;height:46px;background:linear-gradient(90deg,#B4233A,#6E0F22);display:flex;align-items:center;justify-content:center;color:#fff;font:800 13px ${F};letter-spacing:1px">TO MY FAMILY ·&nbsp;<span style="font:700 13px ${TA};letter-spacing:0">என் குடும்பத்தினருக்கு</span></div>
    <div style="position:absolute;left:22px;right:22px;top:60px;font:400 10px/1.55 ${F};color:#253043">
      ${kinds.includes('eye')?`<div><b>Call the eye bank within 6 hours</b> of my death. Close my eyes, cover them with wet cotton, switch off the fan and raise my head.</div>
      <div style="font:400 10px/1.6 ${TA};color:#3A4558;margin-top:4px">என் மறைவுக்குப் பின் <b>6 மணி நேரத்திற்குள்</b> கண் வங்கிக்குத் தெரிவிக்கவும். கண்களை மூடி, ஈரப் பஞ்சு வைக்கவும்; மின்விசிறியை அணைக்கவும்.</div>`
      :`<div><b>Please inform the club and the medical college soon</b> after my death so my wish can be honoured.</div><div style="font:400 10px/1.6 ${TA};color:#3A4558;margin-top:4px">என் விருப்பம் நிறைவேற, என் மறைவுக்குப் பின் விரைவில் சங்கத்திற்குத் தெரிவிக்கவும்.</div>`}</div>
    <div style="position:absolute;left:22px;right:22px;bottom:18px;display:flex;gap:10px">
      ${[['EYE BANK / COLLEGE',p.institution||'-'],['CLUB HELPLINE',brand.contact_phone||'-'],['WITNESS',p.witness_name||'-']].map(([l,v])=>`<div style="flex:1;background:#F6F8FB;border-radius:9px;padding:8px 10px"><div style="font:600 7px ${F};letter-spacing:.8px;color:#7A869C">${l}</div><div style="font:800 10.5px ${F};color:#0B1324;margin-top:2px">${esc(v)}</div></div>`).join('')}</div></div>`
  return [front,back]
}
async function donorFaces(d,stats,brand,lg){
  const accent=brand.brand_color||'#4C8DFF'
  const front=`<div style="position:relative;width:${LW}px;height:${LH}px;background:#fff;overflow:hidden;font-family:${F}">
    <div style="position:absolute;inset:0;background:radial-gradient(320px 220px at 100% 0,${accent}26,transparent 70%)"></div>
    <div style="position:absolute;left:20px;right:20px;top:18px;display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center">${logoTag(lg,32)}</div>
      <div><div style="font:800 12.5px ${F};color:#0B1324">${esc(brand.club_name)}</div><div style="font:600 8.5px ${F};letter-spacing:1.4px;color:#C81E3A;margin-top:2px">BLOOD DONOR CARD · <span style="font:700 9px ${TA};letter-spacing:0">இரத்த தானம் செய்பவர்</span></div></div></div>
    <div style="position:absolute;right:24px;top:70px;width:118px;height:118px;border-radius:24px;background:linear-gradient(150deg,#F0435A,#B4233A);text-align:center;line-height:100px;color:#fff;font:800 40px/100px ${F};box-shadow:0 12px 26px rgba(180,35,58,.35)">${esc(d.blood_group||'?')}</div>
    <div style="position:absolute;left:22px;right:160px;top:78px"><div style="font:600 8px ${F};letter-spacing:1px;color:#7A869C">DONOR</div><div style="font:800 22px ${F};color:#0B1324;line-height:1.15;margin-top:2px">${esc(d.full_name)}</div>
      <div style="font:800 11px ${F};color:#C81E3A;margin-top:6px">${esc(pad('D',d.donor_no,4))}</div></div>
    <div style="position:absolute;left:22px;right:22px;bottom:22px;display:flex;gap:8px">
      ${[['DONATIONS',stats?.donations??'-'],['LAST DONATION',dmy(stats?.last||d.last_donation)],['MOBILE',d.phone||'-']].map(([l,v])=>`<div style="flex:1;border:1px solid #E6E9F0;border-radius:9px;padding:7px 9px;background:#fff"><div style="font:600 7px ${F};letter-spacing:.8px;color:#7A869C">${l}</div><div style="font:800 11.5px ${F};color:#0B1324;margin-top:2px;white-space:nowrap">${esc(v)}</div></div>`).join('')}</div></div>`
  const back=`<div style="position:relative;width:${LW}px;height:${LH}px;background:#0B1324;overflow:hidden;font-family:${F};color:#fff">
    <div style="position:absolute;inset:0;background:radial-gradient(300px 200px at 0 100%,#C81E3A55,transparent 70%)"></div>
    <div style="position:absolute;left:24px;right:24px;top:26px"><div style="font:800 16px ${F}">Thank you for saving lives</div><div style="font:700 13px ${TA};color:#FFC9D2;margin-top:4px">உயிர் காக்கும் உங்களுக்கு நன்றி</div>
      <div style="font:400 10px/1.6 ${F};color:#C9D4EA;margin-top:12px">Men can donate every 3 months and women every 4 months. Eat well, sleep well and drink water before you donate. Show this card at any of our camps.</div></div>
    <div style="position:absolute;left:24px;right:24px;bottom:22px;display:flex;justify-content:space-between;align-items:flex-end;font:600 9px/1.5 ${F};color:#A9B8D6">
      <div><div style="font:800 11px ${F};color:#fff">${esc(brand.club_name)}</div>${esc([brand.contact_phone,brand.contact_email].filter(Boolean).join(' · '))}</div><div style="text-align:right">Issued ${dmy(new Date())}</div></div></div>`
  return [front,back]
}

// ---------- rendering ----------
async function snap(html,w,h){
  const {default:html2canvas}=await import('html2canvas')
  const el=document.createElement('div');el.className='crm-card-snap';el.style.cssText=`position:fixed;left:-14000px;top:0;width:${w}px;height:${h}px`;el.innerHTML=html;document.body.appendChild(el)
  try{await document.fonts?.ready;return (await html2canvas(el.firstElementChild,{scale:3,backgroundColor:'#ffffff',logging:false,width:w,height:h,windowWidth:w,windowHeight:h})).toDataURL('image/jpeg',.94)}finally{el.remove()}
}
// cards: [[frontHtml, backHtml?], ...]; portrait or landscape; layout 'card' or 'sheet'
async function save(cards,{portrait,layout,filename,title}){
  const {jsPDF}=await import('jspdf')
  const cw=portrait?54:85.6,ch=portrait?85.6:54,w=portrait?PW:LW,h=portrait?PH:LH
  const imgs=[];for(const faces of cards){const out=[];for(const f of faces)out.push(await snap(f,w,h));imgs.push(out)}
  let pdf
  if(layout==='sheet'){
    pdf=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'})
    const cols=portrait?3:2,rows=portrait?3:5,gx=4,gy=4,ox=(210-cols*cw-(cols-1)*gx)/2,oy=(297-rows*ch-(rows-1)*gy)/2,per=cols*rows
    const marks=(x,y)=>{pdf.setDrawColor(150).setLineWidth(.1);[[x,y],[x+cw,y],[x,y+ch],[x+cw,y+ch]].forEach(([a,b])=>{pdf.line(a-3,b,a-1,b);pdf.line(a+1,b,a+3,b);pdf.line(a,b-3,a,b-1);pdf.line(a,b+1,a,b+3)})}
    for(let s=0;s<imgs.length;s+=per){const chunk=imgs.slice(s,s+per)
      if(s)pdf.addPage()
      chunk.forEach((c,i)=>{const x=ox+(i%cols)*(cw+gx),y=oy+Math.floor(i/cols)*(ch+gy);pdf.addImage(c[0],'JPEG',x,y,cw,ch);marks(x,y)})
      if(chunk.some(c=>c[1])){pdf.addPage()   // backs, columns mirrored for double-sided printing (flip on long edge)
        chunk.forEach((c,i)=>{if(!c[1])return;const col=cols-1-(i%cols),x=ox+col*(cw+gx),y=oy+Math.floor(i/cols)*(ch+gy);pdf.addImage(c[1],'JPEG',x,y,cw,ch);marks(x,y)})}}
  }else{
    pdf=new jsPDF({unit:'mm',format:[cw,ch],orientation:portrait?'portrait':'landscape'})
    let first=true;for(const c of imgs)for(const f of c){if(!first)pdf.addPage([cw,ch],portrait?'portrait':'landscape');first=false;pdf.addImage(f,'JPEG',0,0,cw,ch)}
  }
  pdf.setProperties({title});pdf.save(filename)
}

export async function memberIdCards(members,brand,layout='card'){
  await prepare();brand=withBrand(brand);const lg=await logoImage(brand.logo_url),cards=[]
  for(const m of members)cards.push(await memberFaces(m,brand,lg))
  await save(cards,{portrait:true,layout,title:'Member ID cards',filename:members.length===1?`id-card-${pad('M',members[0].member_no)}.pdf`:`member-id-cards-${layout}.pdf`})
}
export async function entryPasses(people,ev,brand,layout='sheet'){
  await prepare();brand=withBrand(brand);const lg=await logoImage(brand.logo_url),cards=[]
  for(const p of people)cards.push([await passFace(p,ev,brand,lg)])
  await save(cards,{portrait:true,layout,title:`Entry passes ${ev.name}`,filename:`entry-passes-${String(ev.name).replace(/\W+/g,'-').toLowerCase()}.pdf`})
}
export async function pledgeCard(p,brand,layout='card'){
  await prepare();brand=withBrand(brand);const lg=await logoImage(brand.logo_url)
  await save([pledgeFaces(p,brand,lg)],{portrait:false,layout,title:`Donor card ${pad('PL',p.pledge_no,4)}`,filename:`donor-card-${pad('PL',p.pledge_no,4)}.pdf`})
}
export async function bloodDonorCard(d,stats,brand,layout='card'){
  await prepare();brand=withBrand(brand);const lg=await logoImage(brand.logo_url)
  await save([await donorFaces(d,stats,brand,lg)],{portrait:false,layout,title:`Blood donor card ${pad('D',d.donor_no,4)}`,filename:`blood-donor-card-${pad('D',d.donor_no,4)}.pdf`})
}
