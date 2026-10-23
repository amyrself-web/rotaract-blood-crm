// Letter of gratitude to the family of an eye / body / organ / skin donor, in English and Tamil.
// Designed in HTML so the browser shapes Tamil script correctly, then turned into an A4 PDF.
import {withBrand,logoImage} from './docpdf'

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const ref=n=>`ED-${String(n??0).padStart(4,'0')}`
const W=794,H=1123

const TXT={
  en:{label:'Letter of Gratitude',memory:'In loving memory of',to:'To',dear:n=>`Dear ${n},`,aged:a=>`Aged ${a}`,passed:d=>`Passed away on ${d}`,
    kinds:{eye:'Eyes',body:'Body',organ:'Organs',skin:'Skin'},kindsLower:{eye:'eyes',body:'body',organ:'organs',skin:'skin'},
    details:[['donated','Gift of'],['institution','Received by'],['corneas','Corneas'],['collected','Collected on']],
    refl:'Ref. no.',date:'Date',
    body:(c,club,k)=>[
      `On behalf of every member of ${club}, we offer our heartfelt condolences to you and your family on the loss of ${c.deceased_name}.`,
      `In your time of grief, your family chose to donate the ${k} of ${c.deceased_name}${c.institution?` to ${c.institution}`:''}. Few decisions carry such quiet courage and such deep kindness.`,
      ...(c.kinds||[]).map(x=>({eye:`This gift of sight can restore vision to ${c.corneas===1?'one person':'two people'} who live in darkness today. Through their eyes, ${first(c)} will continue to see the world.`,
        body:'The gift of the body will help train the doctors of tomorrow, who will in turn care for thousands of patients in the years ahead.',
        organ:'The gift of organs can save lives and give families the precious gift of more time together.',
        skin:'The gift of skin will help burn victims heal and return to their lives with dignity.'}[x])).filter(Boolean),
      `${first(c)} lives on in the lives of others. We are honoured to have been a part of this noble act, and our club will always remember your family's generosity.`],
    close:'With deep respect and gratitude,',quote:'"Donate your eyes. Let someone see the world after you."',
    titles:{}},
  ta:{label:'நன்றி மடல்',memory:'அன்னாரின் நினைவாக',to:'பெறுநர்',dear:n=>`அன்புள்ள ${n} அவர்களுக்கு,`,aged:a=>`வயது ${a}`,passed:d=>`மறைந்த நாள்: ${d}`,
    kinds:{eye:'கண்கள்',body:'உடல்',organ:'உறுப்புகள்',skin:'தோல்'},kindsLower:{eye:'கண்களை',body:'உடலை',organ:'உறுப்புகளை',skin:'தோலை'},
    details:[['donated','தானம்'],['institution','பெற்ற நிறுவனம்'],['corneas','விழி வெண்படலம்'],['collected','பெறப்பட்ட நாள்']],
    refl:'குறிப்பு எண்',date:'தேதி',
    body:(c,club,k)=>[
      `${club} சார்பாக, அமரர் ${c.deceased_name} அவர்களின் மறைவால் வாடும் உங்களுக்கும் உங்கள் குடும்பத்தினருக்கும் எங்கள் ஆழ்ந்த இரங்கலைத் தெரிவித்துக் கொள்கிறோம்.`,
      `இந்தத் துயரமான நேரத்திலும், அமரர் ${c.deceased_name} அவர்களின் ${k}${c.institution?` ${c.institution} நிறுவனத்திற்கு`:''} தானமாக வழங்க உங்கள் குடும்பத்தினர் எடுத்த முடிவு, மிக உயர்ந்த மனிதநேயச் செயலாகும்.`,
      ...(c.kinds||[]).map(x=>({eye:`இந்தக் கண் தானம், இன்று இருளில் வாழும் ${c.corneas===1?'ஒருவருக்கு':'இருவருக்கு'} பார்வை அளிக்கக்கூடும். அவர்களின் கண்கள் வழியாக அமரர் ${first(c)} அவர்கள் இந்த உலகைத் தொடர்ந்து காண்பார்.`,
        body:'இந்த உடல் தானம், நாளைய மருத்துவர்கள் பயின்று ஆயிரக்கணக்கான நோயாளிகளுக்குச் சிகிச்சை அளிக்க உதவும்.',
        organ:'இந்த உறுப்பு தானம் பல உயிர்களைக் காக்கும்; பல குடும்பங்களுக்கு மீண்டும் ஒன்றாக வாழும் நாட்களை அளிக்கும்.',
        skin:'இந்தத் தோல் தானம், தீக்காயங்களால் பாதிக்கப்பட்டவர்கள் குணமடைந்து மீண்டும் கண்ணியத்துடன் வாழ உதவும்.'}[x])).filter(Boolean),
      `அமரர் ${first(c)} அவர்கள் பிறரின் வாழ்வில் என்றும் வாழ்வார். இந்த உன்னதச் செயலில் பங்கேற்றதை நாங்கள் பெருமையாகக் கருதுகிறோம்; உங்கள் குடும்பத்தின் தாராள மனதை எங்கள் சங்கம் என்றும் நினைவில் கொள்ளும்.`],
    close:'ஆழ்ந்த மரியாதையுடனும் நன்றியுடனும்,',quote:'“கண்களைத் தானம் செய்வோம்; மறைந்த பின்னும் உலகைக் காண்போம்.”',
    titles:{President:'தலைவர்',Secretary:'செயலாளர்',Treasurer:'பொருளாளர்','Vice President':'துணைத் தலைவர்','Joint Secretary':'இணைச் செயலாளர்'}},
}
const first=c=>String(c.deceased_name||'').split(' ')[0]
const list=(arr,lang)=>arr.length<2?arr.join(''):lang==='ta'?arr.join(', '):arr.slice(0,-1).join(', ')+' and '+arr.at(-1)

function lamp(){return `<svg width="54" height="70" viewBox="0 0 54 70" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#F28C28"/></linearGradient>
  <linearGradient id="br" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7C27D"/><stop offset="1" stop-color="#A9772B"/></linearGradient></defs>
  <path d="M27 2C27 2 18 14 18 21a9 9 0 0 0 18 0C36 14 27 2 27 2z" fill="url(#fl)"/><path d="M27 12c0 0-4 5-4 9a4 4 0 0 0 8 0c0-4-4-9-4-9z" fill="#FFF6D6"/>
  <path d="M8 30h38c0 6-8.5 10-19 10S8 36 8 30z" fill="url(#br)"/><rect x="24" y="40" width="6" height="16" rx="2" fill="url(#br)"/>
  <path d="M13 66c0-6 6-10 14-10s14 4 14 10z" fill="url(#br)"/></svg>`}
function seal(club,accent){const t=`${club}  ·  WITH GRATITUDE  ·  `.toUpperCase()
  return `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><defs><path id="sp" d="M64 64 m-47 0 a47 47 0 1 1 94 0 a47 47 0 1 1 -94 0"/></defs>
    <circle cx="64" cy="64" r="61" fill="none" stroke="${accent}" stroke-width="2"/><circle cx="64" cy="64" r="56" fill="none" stroke="${accent}" stroke-opacity=".5" stroke-dasharray="2 3"/>
    <circle cx="64" cy="64" r="36" fill="${accent}" fill-opacity=".08" stroke="${accent}" stroke-opacity=".6"/>
    <text font-family="Manrope, sans-serif" font-size="8.6" font-weight="700" letter-spacing="1.6" fill="${accent}"><textPath href="#sp" textLength="292" lengthAdjust="spacingAndGlyphs">${esc(t)}</textPath></text>
    <g transform="translate(46 46) scale(.36)"><path d="M50 6C50 6 18 46 18 66a32 32 0 0 0 64 0C82 46 50 6 50 6z" fill="#C81E3A"/></g>
</svg>`}

function page(c,brand,lang,lg){
  const T=TXT[lang],ta=lang==='ta',accent=brand.brand_color||'#4C8DFF',club=brand.club_name||''
  const fmtD=d=>d?new Date(d).toLocaleDateString(ta?'ta-IN':'en-IN',{day:'numeric',month:'long',year:'numeric'}):'-'
  const kinds=(c.kinds||['eye'])
  const kWords=list(kinds.map(k=>T.kindsLower[k]),lang)
  const serif=ta?"'Noto Serif Tamil', serif":"'Cormorant Garamond', Georgia, serif",body=ta?"'Noto Serif Tamil', serif":"Manrope, sans-serif"
  const values={donated:list(kinds.map(k=>T.kinds[k]),lang),institution:c.institution||'-',corneas:kinds.includes('eye')&&c.corneas!=null&&c.corneas!==''?String(c.corneas):'',collected:c.collected_at?fmtD(c.collected_at):''}
  const chips=T.details.filter(([k])=>values[k]).map(([k,l],i)=>`<td style="padding:10px 16px;vertical-align:top;${i?'border-left:1px solid #E6E9F0;':''}"><div style="font:600 10.5px ${ta?"'Noto Serif Tamil',serif":'Manrope,sans-serif'};letter-spacing:.3px;color:#7A869C">${esc(l)}</div><div style="font:700 13px ${body};color:#0B1324;margin-top:3px">${esc(values[k])}</div></td>`).join('')
  const logo=lg?(()=>{const k=Math.min(64/lg.w,64/lg.h);return `<img src="${lg.data}" style="width:${Math.round(lg.w*k)}px;height:${Math.round(lg.h*k)}px"/>`})()
    :`<svg width="56" height="56" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#E11D48"/><path d="M50 18C50 18 26 48 26 63a24 24 0 0 0 48 0C74 48 50 18 50 18z" fill="#fff"/></svg>`
  const sign=(n,t)=>`<div style="width:220px;text-align:center"><div style="height:46px"></div><div style="border-top:1.4px solid #0B1324;padding-top:7px;font:700 14px Manrope,sans-serif;color:#0B1324">${esc(n||'')}</div><div style="font:500 12px ${body};color:#6B778C;margin-top:2px">${esc((ta&&T.titles[t])||t||'')}</div></div>`
  const contact=[brand.contact_phone,brand.contact_email].filter(Boolean).map(esc).join('<br/>')
  return `<div style="position:relative;width:${W}px;height:${H}px;background:#fff;overflow:hidden;font-family:${body}">
    <div style="position:absolute;inset:0;background:radial-gradient(600px 420px at 100% 0,${accent}12,transparent 70%),radial-gradient(520px 380px at 0 100%,#C81E3A0d,transparent 70%)"></div>
    <div style="position:absolute;inset:22px;border:1.5px solid #0B1324;border-radius:6px"></div><div style="position:absolute;inset:28px;border:1px solid ${accent};border-radius:4px;opacity:.6"></div>
    <div style="position:absolute;left:56px;right:56px;top:50px;bottom:44px;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${logo}</div>
        <div style="flex:1;min-width:0"><div style="font:800 21px Manrope,sans-serif;color:#0B1324;letter-spacing:-.2px">${esc(club)}</div>
          <div style="font:500 12px Manrope,sans-serif;color:#6B778C;margin-top:3px">${esc([brand.address,brand.reg_no&&('Reg. no. '+brand.reg_no)].filter(Boolean).join('  ·  ')||'Blood donation and community service')}</div></div>
        <div style="text-align:right;font:500 11.5px/1.6 Manrope,sans-serif;color:#3A4558">${contact}</div></div>
      <div style="position:relative;height:3px;margin-top:14px;border-bottom:1px solid #E3E7EF"><div style="position:absolute;left:0;top:0;width:90px;height:3px;background:#C81E3A"></div><div style="position:absolute;left:90px;top:0;width:34px;height:3px;background:${accent}"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:12px;font:500 12px ${body};color:#6B778C">
        <span>${esc(T.refl)}: <b style="color:#0B1324;font-family:Manrope,sans-serif">${ref(c.case_no)}</b></span><span>${esc(T.date)}: <b style="color:#0B1324">${esc(fmtD(new Date()))}</b></span></div>
      <div style="text-align:center;margin-top:10px">
        <div style="display:flex;justify-content:center">${lamp()}</div>
        <div style="font:${ta?'700 30px':'italic 600 40px'} ${serif};color:#C81E3A;margin-top:4px;line-height:1.25">${esc(T.label)}</div>
        <div style="font:500 ${ta?'14px':'15px'} ${body};color:#6B778C;margin-top:6px;letter-spacing:${ta?0:'.5px'}">${esc(T.memory)}</div>
        <div style="font:${ta?'700 30px':'600 40px'} ${ta?serif:"'Cormorant Garamond', Georgia, serif"};color:#0B1324;margin-top:2px;line-height:1.25">${esc(c.deceased_name)}</div>
        <div style="font:500 13px ${body};color:#6B778C;margin-top:6px">${esc([c.age?T.aged(c.age):'',c.area||'',T.passed(fmtD(c.died_on))].filter(Boolean).join('   ·   '))}</div>
        <table style="margin:16px auto 0;border:1px solid #E6E9F0;border-radius:12px;background:#fff;border-collapse:separate;border-spacing:0;text-align:left;max-width:100%"><tr>${chips}</tr></table></div>
      <div data-body style="flex:1;min-height:0;overflow:hidden;margin:22px 16px 0;padding-bottom:8px;font:400 ${ta?'14.2px/1.9':'15px/1.72'} ${body};color:#253043">
        <div style="margin-bottom:12px;color:#6B778C;font-size:.87em">${esc(T.to)}: <b style="color:#0B1324">${esc(c.family_contact)}${c.family_relation?` (${esc(c.family_relation)})`:''}</b>${c.address||c.area?`, ${esc(c.address||c.area)}`:''}</div>
        <p style="margin:0 0 10px;font-weight:600;color:#0B1324">${esc(T.dear(c.family_contact))}</p>
        ${T.body(c,club,kWords).map(p=>`<p style="margin:0 0 9px;text-align:justify">${esc(p)}</p>`).join('')}
        <p style="margin:12px 0 0">${esc(T.close)}</p></div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin:8px 16px 0">
        ${sign(brand.signatory_name,brand.signatory_title||'President')}<div style="margin-bottom:-6px">${seal(club,accent)}</div>${sign(brand.signatory2_name,brand.signatory2_title||'Secretary')}</div>
      <div style="text-align:center;margin-top:14px;font:${ta?'600 13.5px':'italic 600 17px'} ${serif};color:#C81E3A">${esc(T.quote)}</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:8px;display:flex"><div style="flex:72;background:#0B1324"></div><div style="flex:20;background:#C81E3A"></div><div style="flex:8;background:${accent}"></div></div>
  </div>`
}

// lang: 'en', 'ta' or 'both' (English page then Tamil page)
export async function gratitudeLetterHtml(c,brand={},lang='en'){
  brand=withBrand(brand)
  const langs=lang==='both'?['en','ta']:[lang]
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf'),
    import('@fontsource/noto-serif-tamil/400.css'),import('@fontsource/noto-serif-tamil/700.css'),import('@fontsource/cormorant-garamond/600.css'),import('@fontsource/cormorant-garamond/600-italic.css')])
  await Promise.all([document.fonts?.load("400 16px 'Noto Serif Tamil'",'தமிழ்'),document.fonts?.load("700 16px 'Noto Serif Tamil'",'தமிழ்'),
    document.fonts?.load("600 16px 'Cormorant Garamond'",'Aa'),document.fonts?.load("italic 600 16px 'Cormorant Garamond'",'Aa')].map(p=>p?.catch?.(()=>{})))
  const lg=await logoImage(brand.logo_url)
  const pdf=new jsPDF({orientation:'portrait',unit:'px',format:[W,H],hotfixes:['px_scaling']})
  for(let i=0;i<langs.length;i++){
    const el=document.createElement('div');el.style.cssText=`position:fixed;left:-13000px;top:0;width:${W}px;height:${H}px`
    el.innerHTML=page(c,brand,langs[i],lg);document.body.appendChild(el)
    try{await document.fonts?.ready
      // long letters (for example eyes and body together) get slightly smaller text so nothing is cut off
      const b=el.querySelector('[data-body]');let fs=parseFloat(getComputedStyle(b).fontSize)
      while(b.scrollHeight>b.clientHeight&&fs>11){fs-=.4;b.style.fontSize=fs+'px'}
      const canvas=await html2canvas(el.firstElementChild,{scale:2,backgroundColor:'#ffffff',logging:false,width:W,height:H,windowWidth:W,windowHeight:H})
      if(i)pdf.addPage([W,H],'portrait');pdf.addImage(canvas.toDataURL('image/jpeg',.93),'JPEG',0,0,W,H)}finally{el.remove()}
  }
  pdf.setProperties({title:`Letter of gratitude ${ref(c.case_no)}`,creator:brand.club_name||''})
  pdf.save(`gratitude-${ref(c.case_no)}${lang==='both'?'':'-'+lang}.pdf`)
}
