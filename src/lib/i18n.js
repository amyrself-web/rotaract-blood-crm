// English / Tamil. The English text is the key; anything not in the list stays in English.
// t() covers the public pages, donor portal and My club straight away; the rest of the CRM is translated on screen (see below).
import {useSyncExternalStore} from 'react'

const TA={
  // menu
  'Dashboard':'முகப்பு','My club':'என் சங்கம்','Calendar':'நாள்காட்டி','Camps':'முகாம்கள்','Camp day':'முகாம் நாள்','Camp planning':'முகாம் திட்டம்','Certificates':'சான்றிதழ்கள்',
  'Blood stock':'இரத்த இருப்பு','Hospitals and blood banks':'மருத்துவமனைகள், இரத்த வங்கிகள்','Donors':'கொடையாளர்கள்','Import Excel':'Excel இறக்குமதி','WhatsApp and alerts':'WhatsApp மற்றும் அறிவிப்புகள்',
  'Eye and body donation':'கண் மற்றும் உடல் தானம்','Post maker':'பதிவு உருவாக்கி','Members':'உறுப்பினர்கள்','Meetings':'கூட்டங்கள்','Service projects':'சேவைத் திட்டங்கள்','Notice board':'அறிவிப்புப் பலகை',
  'Club events':'சங்க நிகழ்வுகள்','Club assets':'சங்க சொத்துகள்','Money and accounts':'பணம் மற்றும் கணக்கு','Reports':'அறிக்கைகள்','Users and roles':'பயனர்கள்','Audit log':'தணிக்கைப் பதிவு',
  'Recycle bin':'மறுசுழற்சி தொட்டி','Privacy and backup':'தனியுரிமை, காப்புப் பிரதி','Settings':'அமைப்புகள்','Overview':'கண்ணோட்டம்','Camp work':'முகாம் பணி','People':'மக்கள்','Club':'சங்கம்','Admin':'நிர்வாகம்',
  'Home':'முகப்பு','Stock':'இருப்பு','WhatsApp':'WhatsApp','Search':'தேடு','Sign out':'வெளியேறு','My profile':'என் சுயவிவரம்',
  // common
  'Loading…':'ஏற்றுகிறது…','Register':'பதிவு செய்','Registering…':'பதிவு செய்கிறது…','Cancel':'ரத்து','Save':'சேமி','Send':'அனுப்பு','Close':'மூடு','Preparing…':'தயாராகிறது…',
  'Full name':'முழுப் பெயர்','Your name':'உங்கள் பெயர்','Mobile number':'கைபேசி எண்','Date of birth':'பிறந்த தேதி','Blood group':'இரத்த வகை','Area or town':'பகுதி அல்லது ஊர்','Not known':'தெரியாது',
  'College or organisation':'கல்லூரி அல்லது நிறுவனம்','Time slot':'நேரம்','Full':'நிரம்பியது','Open':'திறந்துள்ளது','left':'மீதம்',
  // landing and registration
  'Blood donation camp':'இரத்த தான முகாம்','No camp is scheduled right now. Please check back soon.':'இப்போது முகாம் இல்லை. விரைவில் மீண்டும் பாருங்கள்.',
  'Live':'நேரலை','Today':'இன்று','Camp is on':'முகாம் நடக்கிறது','To go':'மீதம்','Registered':'பதிவு செய்தோர்','Donated':'தானம் செய்தோர்','Register to donate':'தானம் செய்ய பதிவு செய்',
  'Team and donor login':'குழு மற்றும் கொடையாளர் உள்நுழைவு','See our impact':'எங்கள் சேவை',
  'Blood donation camp registration':'இரத்த தான முகாம் பதிவு','Registration for this camp is not open. Please check with the club.':'இந்த முகாமுக்குப் பதிவு திறக்கப்படவில்லை. சங்கத்திடம் கேளுங்கள்.',
  'You are registered':'நீங்கள் பதிவு செய்துவிட்டீர்கள்','Your token number':'உங்கள் டோக்கன் எண்',
  'Show this token at the desk and bring a photo ID. Eat well and drink water before you come.':'மேசையில் இந்த டோக்கனைக் காட்டுங்கள், புகைப்பட அடையாள அட்டை கொண்டு வாருங்கள். வருவதற்கு முன் நன்றாகச் சாப்பிட்டு, தண்ணீர் குடியுங்கள்.',
  '10 digits, used for camp reminders.':'10 இலக்கம், முகாம் நினைவூட்டலுக்கு.','Donors must be 18 to 65 years old.':'18 முதல் 65 வயது வரை உள்ளவர்கள் தானம் செய்யலாம்.',
  'Leave as not known if you are unsure; it is tested at the camp.':'தெரியாவிட்டால் விட்டுவிடுங்கள்; முகாமில் பரிசோதிக்கப்படும்.',
  'I agree to be contacted about this camp and future blood donation drives, and to my details being stored for this purpose.':'இந்த முகாம் மற்றும் எதிர்கால இரத்த தான முகாம்கள் பற்றி என்னைத் தொடர்புகொள்ளவும், இதற்காக என் விவரங்களைச் சேமிக்கவும் ஒப்புக்கொள்கிறேன்.',
  'Choose a time slot':'நேரத்தைத் தேர்ந்தெடுங்கள்','Enter your full name':'உங்கள் முழுப் பெயரை உள்ளிடுங்கள்','Enter a valid 10-digit mobile number':'சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடுங்கள்',
  // donor portal
  'Find your donor record':'உங்கள் கொடையாளர் பதிவைக் கண்டறியுங்கள்','Link your account to your donations':'உங்கள் கணக்கை உங்கள் தானங்களுடன் இணையுங்கள்',
  'Enter the mobile number and date of birth you gave when you registered at a camp. New here? Register at the next camp first.':'முகாமில் பதிவு செய்தபோது கொடுத்த கைபேசி எண்ணையும் பிறந்த தேதியையும் உள்ளிடுங்கள். புதியவரா? அடுத்த முகாமில் முதலில் பதிவு செய்யுங்கள்.',
  'I agree to be contacted about camps and blood donation drives.':'முகாம்கள் பற்றி என்னைத் தொடர்புகொள்ள ஒப்புக்கொள்கிறேன்.','Link my record':'என் பதிவை இணை',
  'Hello':'வணக்கம்','Thank you for being a blood donor':'இரத்த தானம் செய்வதற்கு நன்றி','Donations':'தானங்கள்','Status':'நிலை','Next donation':'அடுத்த தானம்','You can donate now':'இப்போது தானம் செய்யலாம்','From':'முதல்',
  'Your upcoming camps':'உங்கள் வரவிருக்கும் முகாம்கள்','Camps open for registration':'பதிவுக்குத் திறந்துள்ள முகாம்கள்','Donated, thank you':'தானம் செய்தீர்கள், நன்றி','No camp is open right now.':'இப்போது திறந்த முகாம் இல்லை.',
  'Your donations':'உங்கள் தானங்கள்','Certificate':'சான்றிதழ்','Recorded by the club':'சங்கம் பதிவு செய்தது','Your donations will appear here after your first camp.':'உங்கள் முதல் முகாமுக்குப் பிறகு தானங்கள் இங்கே தெரியும்.',
  'Are you a member of the club? Link your member record':'நீங்கள் சங்க உறுப்பினரா? உங்கள் உறுப்பினர் பதிவை இணையுங்கள்',
  'Life saver':'உயிர் காப்பவர்','Regular donor':'வழக்கமான கொடையாளர்','Repeat donor':'மீண்டும் தானம் செய்தவர்','First donation done':'முதல் தானம் முடிந்தது','Ready to donate':'தானம் செய்யத் தயார்',
  'Your badges':'உங்கள் பதக்கங்கள்','more donations to the next badge':'தானங்களில் அடுத்த பதக்கம்',
  'My data and privacy':'என் தரவு மற்றும் தனியுரிமை','Download my data':'என் தரவைப் பதிவிறக்கு','Everything the club holds about you':'உங்களைப் பற்றி சங்கம் வைத்துள்ள அனைத்தும்',
  'Stop messages':'செய்திகளை நிறுத்து','No more WhatsApp or SMS from us':'இனி WhatsApp அல்லது SMS வராது','Correct my details':'என் விவரங்களைத் திருத்து','Name, date of birth, blood group':'பெயர், பிறந்த தேதி, இரத்த வகை',
  'Erase my data':'என் தரவை அழி','Remove my personal details':'என் தனிப்பட்ட விவரங்களை நீக்கு',
  // my club
  'My ID card':'என் அடையாள அட்டை','Edit my details':'என் விவரங்களைத் திருத்து','My attendance this year':'இந்த ஆண்டு என் வருகை','My open action items':'என் நிலுவைப் பணிகள்','Dues this year':'இந்த ஆண்டு சந்தா',
  'My blood donations':'என் இரத்த தானங்கள்','Upcoming meetings':'வரவிருக்கும் கூட்டங்கள்','Recent meetings and minutes':'சமீபத்திய கூட்டங்கள், குறிப்புகள்','My action items':'என் பணிகள்','My dues':'என் சந்தா',
  'Blood camps coming up':'வரவிருக்கும் இரத்த முகாம்கள்','Club team':'சங்கக் குழு','Notice board':'அறிவிப்புப் பலகை','Have your say':'உங்கள் கருத்து','My service hours':'என் சேவை நேரம்','Log hours':'நேரம் பதிவு',
  'hours this year':'இந்த ஆண்டு மணிநேரம்','waiting for approval':'ஒப்புதலுக்குக் காத்திருக்கிறது','Your path to induction':'உறுப்பினர் சேர்க்கைக்கான உங்கள் பாதை',
  'Mark my attendance':'என் வருகையைப் பதிவு செய்','Apply for leave':'விடுப்பு கேள்','Meeting today':'இன்று கூட்டம்','Go to my page':'என் பக்கத்துக்குச் செல்',
  // certificate, member check, events, impact
  'Download my certificate':'என் சான்றிதழைப் பதிவிறக்கு','Finding your certificate…':'உங்கள் சான்றிதழைத் தேடுகிறது…','Your gift can save up to three lives.':'உங்கள் தானம் மூன்று உயிர்களைக் காக்கும்.',
  'Thank you':'நன்றி','Date':'தேதி','Camp':'முகாம்','See the next camp':'அடுத்த முகாமைப் பார்',
  'Valid member ID':'செல்லுபடியாகும் உறுப்பினர் அட்டை','ID card not found':'அடையாள அட்டை கிடைக்கவில்லை','Member since':'உறுப்பினர் முதல்',
  'Event not found':'நிகழ்வு கிடைக்கவில்லை','Entry fee':'நுழைவுக் கட்டணம்','You are already registered':'நீங்கள் ஏற்கனவே பதிவு செய்துள்ளீர்கள்','Your pass number':'உங்கள் அனுமதிச் சீட்டு எண்',
  'Show this number at the entrance.':'நுழைவாயிலில் இந்த எண்ணைக் காட்டுங்கள்.','Sorry, this event is full.':'மன்னிக்கவும், இடம் நிரம்பிவிட்டது.','Registration is closed.':'பதிவு முடிந்தது.',
  'Our impact':'எங்கள் சேவை','Units of blood collected':'சேகரித்த இரத்த அலகுகள்','Lives touched':'தொட்ட உயிர்கள்','Registered donors':'பதிவு செய்த கொடையாளர்கள்','Blood camps held':'நடத்திய முகாம்கள்',
  'Eye donations':'கண் தானங்கள்','Body donations':'உடல் தானங்கள்','Pledges':'உறுதிமொழிகள்','Service projects done':'முடிந்த சேவைத் திட்டங்கள்','People helped':'பயன்பெற்றோர்','Volunteer hours':'தன்னார்வ மணிநேரம்',
  'Active members':'செயலில் உள்ள உறுப்பினர்கள்','Blood collected, by group':'வகை வாரியாக இரத்தம்','Last 12 months':'கடந்த 12 மாதங்கள்','Next camp':'அடுத்த முகாம்','Every unit can save up to three lives.':'ஒவ்வொரு அலகும் மூன்று உயிர்களைக் காக்கும்.',
  'Gave blood at our camp before? Enter the mobile number and date of birth you gave then.':'முன்பு எங்கள் முகாமில் இரத்தம் கொடுத்தீர்களா? அப்போது கொடுத்த கைபேசி எண், பிறந்த தேதியை உள்ளிடுங்கள்.',
  'I am a new donor':'நான் புதிய கொடையாளர்','Create my donor record':'என் கொடையாளர் பதிவை உருவாக்கு','Welcome':'வரவேற்கிறோம்','Gender':'பாலினம்','Male':'ஆண்','Female':'பெண்','Other':'மற்றவை','Please wait…':'காத்திருங்கள்…',
  'Your blood group is needed now':'உங்கள் இரத்த வகை இப்போது தேவை','You cannot donate yet, but you can share this with friends of the same group.':'நீங்கள் இன்னும் தானம் செய்ய முடியாது; அதே வகை நண்பர்களுடன் பகிருங்கள்.',
  'units at':'அலகுகள்,','Call':'அழை','Saved':'சேமிக்கப்பட்டது','My contact details':'என் தொடர்பு விவரங்கள்','Email':'மின்னஞ்சல்',
  'To change your name, mobile, date of birth or blood group, use "Correct my details" below.':'பெயர், கைபேசி, பிறந்த தேதி அல்லது இரத்த வகையை மாற்ற கீழே "என் விவரங்களைத் திருத்து" பயன்படுத்துங்கள்.',
  // login
  'Sign in':'உள்நுழை','Create a donor account':'கொடையாளர் கணக்கை உருவாக்கு','Club members and donors use the same sign-in.':'சங்க உறுப்பினர்களும் கொடையாளர்களும் ஒரே உள்நுழைவைப் பயன்படுத்துகிறார்கள்.',
  'See your donations and download certificates.':'உங்கள் தானங்களைப் பார்த்து சான்றிதழ்களைப் பதிவிறக்குங்கள்.','Password':'கடவுச்சொல்','Create donor account':'கொடையாளர் கணக்கை உருவாக்கு',
  'New donor or club member? Create an account':'புதிய கொடையாளரா அல்லது உறுப்பினரா? கணக்கை உருவாக்குங்கள்','Have an account? Sign in':'கணக்கு உள்ளதா? உள்நுழையுங்கள்','Forgot password?':'கடவுச்சொல் மறந்துவிட்டதா?',
  'Send reset link':'மீட்டமைப்பு இணைப்பை அனுப்பு','Back to sign in':'உள்நுழைவுக்குத் திரும்பு','Reset your password':'கடவுச்சொல்லை மீட்டமை',
  'We will email you a link to set a new password.':'புதிய கடவுச்சொல் அமைக்க மின்னஞ்சலில் இணைப்பு அனுப்புவோம்.','Caps Lock is on':'Caps Lock இயக்கத்தில் உள்ளது',
  'At least 8 characters':'குறைந்தது 8 எழுத்துகள்','Set a new password':'புதிய கடவுச்சொல் அமை','New password':'புதிய கடவுச்சொல்','Save password':'கடவுச்சொல்லைச் சேமி',
  'Share':'பகிர்','Link copied':'இணைப்பு நகலெடுக்கப்பட்டது',
}

const KEY='lang',subs=new Set()
let lang=(()=>{try{return localStorage.getItem(KEY)==='ta'?'ta':'en'}catch{return 'en'}})()
document.documentElement.lang=lang
export const setLang=l=>{lang=l==='ta'?'ta':'en';try{localStorage.setItem(KEY,lang)}catch{};document.documentElement.lang=lang;subs.forEach(f=>f());lang==='ta'?enableTamil():disableTamil()}

// ---------- the whole CRM in Tamil ----------
// Every screen is written in English. When Tamil is chosen, the words on screen (text, placeholders, tooltips,
// button names, toasts) are swapped for Tamil from ta-dict.js as they appear, and swapped back for English.
// People's data (names, places, notes) is never in the word list, so it is left as typed.
let EXACT=null,PATS=[],loading=null,obs=null
const ATTRS=['placeholder','title','aria-label','alt']
const tNode=new WeakMap(),tAttr=new WeakMap(),touched=new Set()
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
function loadDict(){return loading||(loading=import('./ta-dict.js').then(m=>{EXACT={...m.EXACT,...TA}
  PATS=m.PATTERNS.filter(([en])=>en.replace(/\{\d+\}/g,'').replace(/[^A-Za-z]/g,'').length>=3)
    .map(([en,ta])=>{let i=0;const re=new RegExp('^'+en.split(/\{\d+\}/).map(esc).join('([\\s\\S]*?)')+'$');return {re,ta,n:(en.match(/\{\d+\}/g)||[]).length}})}))}
function translate(v,depth=0){
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(v),core=m[2].replace(/\s+/g,' ')
  if(!core||!/[A-Za-z]/.test(core))return null
  let out=EXACT[core]
  if(out==null&&depth<2)for(const p of PATS){const r=p.re.exec(core);if(r){out=p.ta.replace(/\{(\d+)\}/g,(_,k)=>{const part=r[+k+1]??'';return translate(part,depth+1)??part});break}}
  return out==null?null:m[1]+out+m[3]
}
const skip=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){if(e.translate===false||e.classList?.contains('notranslate')||e.isContentEditable||/^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|NOSCRIPT)$/.test(e.tagName))return true}return false}
function doText(n){const v=n.nodeValue,rec=tNode.get(n);if(rec&&v===rec.ta)return
  if(skip(n.parentElement)){return}const tr=translate(v);if(tr==null||tr===v){tNode.delete(n);return}
  tNode.set(n,{en:v,ta:tr});touched.add(new WeakRef(n));n.nodeValue=tr}
function doAttr(el,a){const v=el.getAttribute(a);if(v==null)return;let recs=tAttr.get(el);const rec=recs?.[a];if(rec&&v===rec.ta)return
  const tr=translate(v);if(tr==null||tr===v)return;if(!recs){recs={};tAttr.set(el,recs);touched.add(new WeakRef(el))}recs[a]={en:v,ta:tr};el.setAttribute(a,tr)}
function walk(root){if(root.nodeType===3)return doText(root);if(root.nodeType!==1||skip(root))return
  for(const a of ATTRS)if(root.hasAttribute(a))doAttr(root,a)
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n
  while((n=w.nextNode())){if(n.nodeType===3)doText(n);else for(const a of ATTRS)if(n.hasAttribute(a))doAttr(n,a)}}
async function enableTamil(){await loadDict();if(lang!=='ta'||obs)return
  walk(document.body)
  obs=new MutationObserver(list=>{for(const r of list){if(r.type==='characterData')doText(r.target);else if(r.type==='attributes')doAttr(r.target,r.attributeName);else r.addedNodes.forEach(walk)}})
  obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS})}
function disableTamil(){obs?.disconnect();obs=null
  for(const ref of touched){const n=ref.deref();if(!n)continue
    if(n.nodeType===3){const rec=tNode.get(n);if(rec&&n.nodeValue===rec.ta)n.nodeValue=rec.en;tNode.delete(n)}
    else{const recs=tAttr.get(n);if(recs)for(const [a,rec] of Object.entries(recs))if(n.getAttribute(a)===rec.ta)n.setAttribute(a,rec.en);tAttr.delete(n)}}
  touched.clear()}
// for text that is drawn, not shown as page text (toasts are page text, so they are covered already)
export const tr=s=>lang==='ta'&&EXACT?translate(s)??s:s
if(lang==='ta')enableTamil()
export const t=s=>lang==='ta'&&TA[s]||s
export function useLang(){
  const l=useSyncExternalStore(f=>{subs.add(f);return()=>subs.delete(f)},()=>lang)
  return {lang:l,setLang,t:s=>l==='ta'&&TA[s]||s}
}
