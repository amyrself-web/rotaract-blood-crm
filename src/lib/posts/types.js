// Every kind of post: what it needs, the fields people can fill, and the content it produces.
// A post's content ("spec") is the same for all designs; each design (themes.js) lays it out its own way.
import {fmt,BLOOD} from '../util'
import {isBlood,typeName,kindOf,takesOnline,CANCERS} from '../campTypes'
import {MYTHS,ELIGIBILITY,DAYS,initials,t12} from './kit'

const CAMP_WORDS={
  'Blood donation':{icon:'drop',mood:'blood',kicker:'Blood donation camp',kicker_ta:'இரத்த தான முகாம்',ta:'இரத்த தானம் செய்வோம், உயிர் காப்போம்',lead:'One donation can save up to three lives.',cta:'Register now',cta_ta:'இப்போதே பதிவு செய்யுங்கள்',ctaSub:'Eat well · Drink water · Bring a photo ID'},
  'Eye checking':{icon:'eye',mood:'calm',kicker:'Free eye check-up camp',kicker_ta:'இலவச கண் பரிசோதனை முகாம்',ta:'உங்கள் பார்வை, எங்கள் அக்கறை',lead:'Free eye check-up by expert doctors. Spectacles and cataract referrals for those who need them.',cta:'Register now',cta_ta:'பதிவு செய்யுங்கள்',ctaSub:'Bring your old glasses and eye reports'},
  'Cancer awareness':{icon:'ribbon',mood:'pink',kicker:'Cancer awareness camp',kicker_ta:'புற்றுநோய் விழிப்புணர்வு முகாம்',ta:'விழிப்புணர்வே முதல் பாதுகாப்பு',lead:'Talks by doctors and a free check-up. Early detection saves lives.',cta:'Register for a free check-up',cta_ta:'இலவச பரிசோதனைக்குப் பதிவு',ctaSub:'Women and men of all ages welcome'},
  'Food donation':{icon:'meal',mood:'warm',kicker:'Food donation drive',kicker_ta:'அன்னதானம்',ta:'பசியில்லா சமூகம் படைப்போம்',lead:'Join us to serve food to people who need it most.',cta:'Volunteer or sponsor',cta_ta:'தன்னார்வலராக இணையுங்கள்',ctaSub:'Every plate counts'},
  'Environment (plantation)':{icon:'tree',mood:'green',kicker:'Tree plantation drive',kicker_ta:'மரம் நடும் விழா',ta:'மரம் வளர்ப்போம், மழை பெறுவோம்',lead:'Plant a sapling, adopt a tree, grow a greener town.',cta:'Plant a tree with us',cta_ta:'எங்களுடன் மரம் நடுங்கள்',ctaSub:'Bring a friend · Wear comfortable clothes'},
  Others:{icon:'hands',mood:'calm',kicker:'Community camp',kicker_ta:'சமூக சேவை முகாம்',ta:'சேவையே எங்கள் இலக்கு',lead:'Everyone is welcome.',cta:'Join us',cta_ta:'இணையுங்கள்',ctaSub:''}}
const cw=c=>{const w=CAMP_WORDS[c?.camp_type]||CAMP_WORDS.Others;return c?.camp_type==='Others'?{...w,kicker:typeName(c)+' camp'}:w}
const when=c=>[['Date',fmt(c.camp_date)],['Time',c.start_time?`${t12(c.start_time)} – ${t12(c.end_time)}`:'All day'],['Venue',c.venue||'To be announced']]
const regLink=(c,site)=>c&&takesOnline(c)&&['open','live'].includes(c.status)?`${site}#/register/${c.id}`:null
const campStats=(c,s)=>{if(!c)return [];const k=kindOf(c)
  if(!s)return c.beneficiaries?[[c.beneficiaries,'people helped']]:[]
  if(k==='blood'){const b=s.blood||{};return [[b.donated||0,'units collected'],[(b.donated||0)*3,'lives touched'],[b.registered||0,'came forward']]}
  if(k==='food'){const f=s.food||{};return [[f.people||0,'people fed'],[f.packets||0,'food packets'],[f.points||0,'places reached']]}
  if(k==='plants'){const p=s.plants||{};return [[p.planted||0,'saplings planted'],[p.batches||0,'sites greened'],[(s.team?.members_present||0)+(s.team?.volunteers_present||0),'volunteers']]}
  const p=s.people||{};if(c.camp_type==='Eye checking')return [[p.attended||0,'people screened'],[p.actions?.['Spectacles given']||0,'spectacles given'],[p.referred||0,'referred for care']]
  if(c.camp_type==='Cancer awareness')return [[p.attended||0,'people screened'],[(s.sessions||[]).reduce((a,y)=>a+(y.attendees||0),0),'heard the talks'],[p.referred||0,'referred for care']]
  return [[c.beneficiaries||p.attended||0,'people helped'],[s.team?.members_present||0,'members'],[s.team?.volunteers_present||0,'volunteers']]}

const camp={k:'camp',type:'camp',label:'Camp'}
export const GROUPS=['Camps','Donors','Urgent and awareness','Club','Greetings']
export const POSTS=[
  // ---------------- camps ----------------
  {key:'camp_invite',group:'Camps',label:'Camp invite',icon:'megaphone',needs:['camp'],fields:[camp],
   build:({camp:c,site})=>{if(!c)return null;const w=cw(c);return {mood:w.mood,icon:w.icon,kicker:w.kicker,kicker_ta:w.kicker_ta,title:c.name,ta:w.ta,lead:c.about||w.lead,facts:when(c),
     hero:{kind:'icon',value:w.icon},cta:w.cta,cta_ta:w.cta_ta,ctaSub:regLink(c,site)?'Scan the code · '+w.ctaSub:w.ctaSub,qr:regLink(c,site),note:c.partner?`With ${c.partner}`:''}}},
  {key:'camp_tomorrow',group:'Camps',label:'Camp tomorrow',icon:'calendar',needs:['camp'],fields:[camp],
   build:({camp:c,site})=>{if(!c)return null;const w=cw(c);return {mood:w.mood,icon:w.icon,kicker:'Tomorrow',kicker_ta:'நாளை',title:c.name,ta:'நாளை சந்திப்போம்!',lead:w.ctaSub||w.lead,facts:when(c),
     hero:{kind:'text',value:'1',sub:'day to go'},cta:'See you tomorrow',cta_ta:'நாளை சந்திப்போம்',ctaSub:regLink(c,site)?'Not registered yet? Scan the code':'',qr:regLink(c,site)}}},
  {key:'camp_live',group:'Camps',label:'We are live today',icon:'siren',needs:['camp'],fields:[camp],
   build:({camp:c})=>{if(!c)return null;const w=cw(c);return {mood:w.mood==='blood'?'urgent':w.mood,icon:w.icon,kicker:'Happening now',kicker_ta:'இப்போது நடக்கிறது',title:c.name,ta:'இன்றே வாருங்கள்!',lead:`${w.lead} Walk in any time until ${t12(c.end_time)||'the end of the day'}.`,
     facts:[['Venue',c.venue||''],['Until',t12(c.end_time)||'Evening']],hero:{kind:'text',value:'LIVE'},cta:'Walk in today',cta_ta:'இன்றே வாருங்கள்',ctaSub:w.ctaSub}}},
  {key:'camp_thanks',group:'Camps',label:'Camp thank-you',icon:'heart',needs:['camp','campStats'],fields:[camp],
   build:({camp:c,campStats:s})=>{if(!c)return null;const w=cw(c);return {mood:'celebrate',icon:'heart',kicker:'Thank you',kicker_ta:'நன்றி',title:'Thank you!',title_ta:'நன்றி!',ta:isBlood(c)?'உயிர் காத்த உங்களுக்கு நன்றி':'கை கொடுத்த அனைவருக்கும் நன்றி',
     lead:`To everyone who made ${c.name} on ${fmt(c.camp_date)} a success: donors, doctors, volunteers and sponsors.`,stats:campStats(c,s),hero:{kind:'icon',value:'heart'}}}},
  {key:'camp_sponsors',group:'Camps',label:'Thank our sponsors',icon:'handshake',needs:['camp','sponsors'],fields:[camp],
   build:({camp:c,sponsors})=>{if(!c)return null;return {mood:'celebrate',icon:'handshake',kicker:'With gratitude',kicker_ta:'நன்றியுடன்',title:'Thank you, sponsors',ta:'உதவிய கரங்களுக்கு நன்றி',
     lead:`${c.name} was possible because of your support.`,list:(sponsors||[]).slice(0,12).map(s=>[s.name,'']),hero:{kind:'icon',value:'handshake'}}}},
  {key:'volunteers',group:'Camps',label:'Volunteers needed',icon:'users',needs:['camp'],fields:[camp,{k:'roles',label:'Roles needed',type:'text',def:'Registration desk, crowd control, refreshments'}],
   build:({camp:c,brand},v)=>({mood:'calm',icon:'users',kicker:'Volunteers needed',kicker_ta:'தன்னார்வலர்கள் தேவை',title:'Lend a hand',title_ta:'கை கொடுங்கள்',ta:'சேவைக்கு வாருங்கள்',lead:c?`Help us run ${c.name}. Roles: ${v.roles}.`:`Roles: ${v.roles}.`,
     facts:c?when(c):[],hero:{kind:'icon',value:'users'},cta:'Join the team',cta_ta:'குழுவில் இணையுங்கள்',ctaSub:brand.contact_phone?`Call ${brand.contact_phone}`:''})},
  // ---------------- donors ----------------
  {key:'donor_month',group:'Donors',label:'Donor of the month',icon:'star',needs:['top'],fields:[{k:'donor',label:'Donor',type:'donor'},{k:'month',label:'Month',type:'text',def:new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}],
   build:({},v)=>{const d=v.donor||{};return {mood:'celebrate',icon:'trophy',kicker:`Donor of the month · ${v.month}`,kicker_ta:'இந்த மாத நட்சத்திரக் கொடையாளர்',title:d.name||'Name',ta:'மீண்டும் மீண்டும் உயிர் காக்கும் நாயகர்',
     lead:'Thank you for being a hero, again and again.',hero:{kind:'initials',value:initials(d.name),badge:d.blood_group},stats:[[d.total||1,`donation${d.total==1?'':'s'}`],[(d.total||1)*3,'lives touched']]}}},
  {key:'donor_thanks',group:'Donors',label:'Thank a donor',icon:'heart',fields:[{k:'name',label:'Donor name',type:'text',def:''},{k:'group',label:'Blood group',type:'group',def:''},{k:'where',label:'Where they donated',type:'text',def:''}],
   build:({},v)=>({mood:'celebrate',icon:'drop',kicker:'Thank you, hero',kicker_ta:'நன்றி, நாயகரே',title:v.name||'Donor name',ta:'உங்கள் தானம் ஒரு உயிரைக் காத்தது',lead:`Thank you for donating blood${v.where?` at ${v.where}`:''}. Your gift will save lives.`,
     hero:{kind:'text',value:v.group||'♥'},cta:'Be a donor like them',cta_ta:'நீங்களும் தானம் செய்யுங்கள்'})},
  {key:'milestone',group:'Donors',label:'Milestone reached',icon:'trophy',fields:[{k:'number',label:'Number',type:'number',def:100},{k:'what',label:'Of what',type:'text',def:'units of blood collected'},{k:'since',label:'Since',type:'text',def:'this year'}],
   build:({},v)=>({mood:'celebrate',icon:'trophy',kicker:'Milestone',kicker_ta:'மைல்கல்',title:`${Number(v.number||0).toLocaleString('en-IN')}`,title_big:true,ta:'உங்களால் சாத்தியமானது',lead:`${v.what} ${v.since}. Thank you to every donor and volunteer.`,hero:{kind:'icon',value:'trophy'}})},
  {key:'rare_group',group:'Donors',label:'Calling a blood group',icon:'drop',fields:[{k:'group',label:'Blood group',type:'group',def:'O-'}],
   build:({brand},v)=>({mood:'blood',icon:'drop',kicker:'Donors wanted',kicker_ta:'கொடையாளர்கள் தேவை',title:`${v.group||'O-'} donors, we need you`,ta:`${v.group||'O-'} இரத்த வகை கொடையாளர்களே, வாருங்கள்`,lead:'Join our donor list so we can call you when a patient needs your group.',
     hero:{kind:'text',value:v.group||'O-'},cta:'Join the donor list',cta_ta:'பட்டியலில் சேருங்கள்',ctaSub:brand.contact_phone?`Call ${brand.contact_phone}`:''})},
  // ---------------- urgent and awareness ----------------
  {key:'urgent',group:'Urgent and awareness',label:'Urgent blood need',icon:'siren',fields:[{k:'group',label:'Blood group',type:'group',def:'O+'},{k:'units',label:'Units',type:'number',def:2},{k:'hospital',label:'Hospital',type:'text',def:''},{k:'contact',label:'Phone to call',type:'text',def:''}],
   build:({brand},v)=>({mood:'urgent',icon:'siren',kicker:'Urgent',kicker_ta:'அவசரம்',title:`${v.group} blood needed`,title_ta:`${v.group} இரத்தம் தேவை`,ta:'அவசரமாக இரத்தம் தேவை',lead:`${v.units||1} unit${v.units>1?'s':''}${v.hospital?` at ${v.hospital}`:''}. Please share.`,
     hero:{kind:'text',value:v.group},cta:'Can you donate today? Call',cta_ta:'இன்று தானம் செய்ய முடியுமா? அழையுங்கள்',phone:v.contact||brand.contact_phone||''})},
  {key:'myth',group:'Urgent and awareness',label:'Myth vs fact',icon:'bulb',fields:[{k:'n',label:'Which one',type:'select',options:MYTHS.map((m,i)=>[String(i),m[0]]),def:'0'}],
   build:({},v)=>{const m=MYTHS[Number(v.n)||0];return {mood:'calm',icon:'bulb',kicker:'Myth vs fact',kicker_ta:'கட்டுக்கதை vs உண்மை',title:'Myth busted',title_ta:m[2],ta:m[2],myth:m[0],fact:m[1],hero:{kind:'icon',value:'bulb'},cta:'Donate blood. Save lives.',cta_ta:'இரத்த தானம் செய்வோம்'}}},
  {key:'eligibility',group:'Urgent and awareness',label:'Can I donate?',icon:'check',fields:[],
   build:()=>({mood:'calm',icon:'check',kicker:'Can I donate blood?',kicker_ta:'நான் இரத்த தானம் செய்யலாமா?',title:'You can donate if',title_ta:'நீங்கள் தானம் செய்யலாம்',checklist:ELIGIBILITY,hero:{kind:'icon',value:'check'},cta:'Find your nearest camp',cta_ta:'அருகிலுள்ள முகாமைக் கண்டறியுங்கள்'})},
  {key:'why_donate',group:'Urgent and awareness',label:'Why donate blood',icon:'drop',fields:[],
   build:()=>({mood:'blood',icon:'drop',kicker:'Every 2 seconds',kicker_ta:'ஒவ்வொரு 2 வினாடிக்கும்',title:'someone needs blood',title_ta:'யாரோ ஒருவருக்கு இரத்தம் தேவை',ta:'உங்கள் ஒரு தானம் மூன்று உயிர்களைக் காக்கும்',
     stats:[['10','minutes to donate'],['3','lives saved'],['24 h','to replace fluid']],hero:{kind:'icon',value:'drop'},cta:'Donate blood. Save lives.',cta_ta:'இரத்த தானம் செய்வோம்'})},
  {key:'eye_pledge',group:'Urgent and awareness',label:'Pledge your eyes',icon:'eye',fields:[],
   build:({brand})=>({mood:'calm',icon:'eye',kicker:'Eye donation',kicker_ta:'கண் தானம்',title:'Let your eyes live on',title_ta:'கண்கள் வாழட்டும்',ta:'கண் தானம் செய்வோம், இருவருக்குப் பார்வை தருவோம்',
     lead:'One pair of donated eyes can give sight to two people. Pledge today and tell your family.',hero:{kind:'icon',value:'eye'},cta:'Pledge with us',cta_ta:'உறுதிமொழி எடுங்கள்',ctaSub:brand.contact_phone?`Call ${brand.contact_phone}`:''})},
  // ---------------- club ----------------
  {key:'impact',group:'Club',label:'Our impact',icon:'trophy',needs:['impact'],fields:[],
   build:({impact:m})=>{m=m||{};const st=[[m.units||0,'units of blood'],[(m.units||0)*3,'lives touched'],[m.all_camps||m.camps||0,'camps held'],[m.helped||0,'people helped'],[m.meals||0,'meals served'],[m.saplings||0,'saplings planted'],[m.eye||0,'eye donations'],[Math.round(m.hours||0),'volunteer hours']].filter(x=>x[0]>0)
     return {mood:'celebrate',icon:'sparkles',kicker:'Our impact',kicker_ta:'எங்கள் சேவை',title:'Together we have',title_ta:'நாம் இணைந்து செய்தவை',stats:st.length?st.slice(0,6):[[0,'and counting']],hero:{kind:'icon',value:'sparkles'}}}},
  {key:'meeting',group:'Club',label:'Meeting notice',icon:'calendar',needs:['meetings'],fields:[{k:'meeting',label:'Meeting',type:'meeting'}],
   build:({},v)=>{const m=v.meeting;if(!m)return null;return {mood:'calm',icon:'calendar',kicker:`${m.kind==='Others'?(m.kind_other||'Club'):m.kind} meeting`,kicker_ta:'கூட்ட அறிவிப்பு',title:m.title,ta:'அனைத்து உறுப்பினர்களும் கலந்துகொள்ளவும்',
     facts:[['Date',fmt(m.meeting_date)],['Time',m.start_time?t12(m.start_time):'—'],['Venue',m.mode==='Online'?'Online':(m.venue||'—')]],lead:m.agenda?String(m.agenda).split('\n').slice(0,3).join(' · '):'',hero:{kind:'icon',value:'calendar'},
     cta:m.audience==='board'?'Board members, please attend':'All members, please attend',cta_ta:'தவறாமல் வாருங்கள்'}}},
  {key:'event',group:'Club',label:'Event invite',icon:'party',needs:['events'],fields:[{k:'event',label:'Event',type:'event'}],
   build:({site},v)=>{const e=v.event;if(!e)return null;return {mood:'celebrate',icon:'party',kicker:e.kind||'Event',kicker_ta:'நிகழ்வு',title:e.title,ta:'அனைவரும் வருக',lead:e.description||'',
     facts:[['Date',fmt(e.event_date)],['Time',e.start_time?t12(e.start_time):'—'],['Venue',e.venue||'—']],hero:{kind:'icon',value:'party'},cta:e.open_registration?'Register now':'You are invited',cta_ta:'அன்புடன் அழைக்கிறோம்',
     qr:e.open_registration?`${site}#/event/${e.id}`:null,ctaSub:e.fee?`Entry Rs. ${e.fee}`:''}}},
  {key:'project',group:'Club',label:'Project highlight',icon:'hands',needs:['projects'],fields:[{k:'project',label:'Project',type:'project'}],
   build:({},v)=>{const p=v.project;if(!p)return null;return {mood:'green',icon:'hands',kicker:p.avenue||'Service project',kicker_ta:'சேவைத் திட்டம்',title:p.title,ta:'சேவையே எங்கள் இலக்கு',lead:p.outcome||p.description||'',
     stats:[p.beneficiaries&&[p.beneficiaries,'people helped']].filter(Boolean),facts:[p.start_date&&['When',fmt(p.start_date)],p.venue&&['Where',p.venue],p.partner&&['With',p.partner]].filter(Boolean),hero:{kind:'icon',value:'hands'}}}},
  {key:'welcome',group:'Club',label:'Welcome new members',icon:'users',needs:['newMembers'],fields:[{k:'days',label:'Joined in the last (days)',type:'number',def:60}],
   build:({newMembers},v)=>{const since=Date.now()-(Number(v.days)||60)*864e5,l=(newMembers||[]).filter(m=>m.joined_on&&new Date(m.joined_on)>=since)
     return {mood:'celebrate',icon:'users',kicker:'Welcome to the family',kicker_ta:'குடும்பத்திற்கு வரவேற்கிறோம்',title:l.length===1?`Welcome, ${l[0].full_name}`:'Welcome, new members',ta:'அன்புடன் வரவேற்கிறோம்',
       list:l.length>1?l.slice(0,12).map(m=>[m.full_name,m.position&&m.position!=='Member'?m.position:'']):[],lead:l.length?'Together we serve.':'No members joined in this period. Change the days.',hero:{kind:l.length===1?'initials':'icon',value:l.length===1?initials(l[0].full_name):'users'}}}},
  {key:'board',group:'Club',label:'Our board',icon:'award',needs:['board'],fields:[],
   build:({board,yearName,year})=>({mood:'calm',icon:'award',kicker:`${yearName} ${year}`,kicker_ta:'நிர்வாகக் குழு',title:'Meet our board',title_ta:'எங்கள் நிர்வாகக் குழு',ta:'சேவைக்குத் தலைமை',list:(board||[]).slice(0,14).map(b=>[b.name,b.position]),hero:{kind:'icon',value:'award'}})},
  {key:'birthday',group:'Club',label:'Birthday wish',icon:'cake',needs:['birthdays'],fields:[{k:'person',label:'Whose birthday',type:'birthday'},{k:'name',label:'Or type a name',type:'text',def:''}],
   build:({},v)=>{const n=v.name||v.person?.full_name||'Name';return {mood:'celebrate',icon:'cake',kicker:'Happy birthday',kicker_ta:'இனிய பிறந்தநாள் வாழ்த்துகள்',title:n,ta:'இனிய பிறந்தநாள் வாழ்த்துகள்!',lead:'Wishing you good health, happiness and many more years of service.',hero:{kind:'initials',value:initials(n)}}}},
  {key:'announcement',group:'Club',label:'Announcement',icon:'megaphone',fields:[{k:'kicker',label:'Small label',type:'text',def:'Announcement'},{k:'title',label:'Headline',type:'text',def:'Your headline here'},{k:'ta',label:'Tamil line',type:'text',def:''},{k:'lead',label:'Message',type:'textarea',def:''},{k:'cta',label:'Call to action',type:'text',def:''}],
   build:({brand},v)=>({mood:'calm',icon:'megaphone',kicker:v.kicker,title:v.title,ta:v.ta,lead:v.lead,cta:v.cta,hero:{kind:'icon',value:'megaphone'},ctaSub:brand.contact_phone?`Call ${brand.contact_phone}`:''})},
  // ---------------- greetings ----------------
  {key:'day',group:'Greetings',label:'Special day greeting',icon:'sparkles',fields:[{k:'day',label:'Day',type:'select',options:Object.entries(DAYS).map(([k,d])=>[k,`${d[0]}${d[4]?` (${d[4]})`:''}`]),def:'blood_donor_day'},{k:'msg',label:'Message (optional)',type:'textarea',def:''}],
   build:({},v)=>{const d=DAYS[v.day]||DAYS.blood_donor_day;return {mood:['drop'].includes(d[3])?'blood':['tree'].includes(d[3])?'green':['ribbon','flower'].includes(d[3])?'pink':'celebrate',icon:d[3],kicker:'Warm wishes',kicker_ta:'வாழ்த்துகள்',title:d[0],ta:d[1],lead:v.msg||d[2],hero:{kind:'icon',value:d[3]},greeting:true}}},
]
export const postOf=k=>POSTS.find(p=>p.key===k)
export {BLOOD,CANCERS}
