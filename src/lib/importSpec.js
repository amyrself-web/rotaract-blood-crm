// What each module's import file holds. The database (import_spec in v19) checks the same columns again.
// type: text | phone | email | date | time | int | num | bool | enum | code | ref
import {BLOOD} from './util.js'
import {YEAR_NAME,clubYearOf} from './year.js'

const POSITIONS=['President','Vice President','Secretary','Joint Secretary','Treasurer','Sergeant-at-Arms','Club Service Director','Community Service Director',
  'International Service Director','Professional Development Director','Public Relations Director','Blood Donation Chair','IT and Media','Board member','Member']
const GENDER=['Male','Female','Other']
const ATT=[['present','Present'],['late','Late'],['leave','Leave'],['absent','Absent']]
const opt=a=>a.map(x=>Array.isArray(x)?x:[x,x])

const F=(key,label,type='text',x={})=>({key,label,type,...x,options:x.options?opt(x.options):undefined})

export const ENTITIES=[
  {key:'donors',label:'Donors',desc:'Blood donors: name, mobile, group, address',perm:['donors'],
   unique:'Donor ID, or mobile number, or email',
   fields:[F('donor_no','Donor ID','code',{hint:'Only to update a donor who is already in the CRM (D-0012). Leave empty for new donors.',ex:''}),
     F('full_name','Full name','text',{req:true,ex:'Ravi Kumar'}),F('phone','Mobile','phone',{req:true,ex:'9876543210'}),F('email','Email','email',{ex:'ravi@example.com'}),
     F('blood_group','Blood group','enum',{options:BLOOD,ex:'O+'}),F('gender','Gender','enum',{options:GENDER,ex:'Male'}),F('dob','Date of birth','date',{ex:'15/08/1998'}),
     F('address','Address','text',{ex:'12, Main Road, Sankari'}),F('area','Area / town','text',{ex:'Sankari'}),F('last_donation','Last donation date','date',{ex:'01/06/2026'}),
     F('consent','Agreed to be contacted','bool',{hint:'Yes only if the donor agreed to WhatsApp / SMS. Empty means No.',ex:'Yes'})]},
  {key:'members',label:'Members',desc:'Club members with position and joining date',perm:['members'],
   unique:'Member ID, or mobile number, or email, or RI / club member ID',
   fields:[F('member_no','Member ID','code',{hint:'Only to update a member already in the CRM (M-003). Leave empty for new members.',ex:''}),
     F('full_name','Full name','text',{req:true,ex:'Divya Shree'}),F('phone','Mobile','phone',{ex:'9790010002'}),F('email','Email','email',{ex:'divya@example.com'}),
     F('dob','Date of birth','date',{ex:'21/08/2002'}),F('gender','Gender','enum',{options:GENDER,ex:'Female'}),F('blood_group','Blood group','enum',{options:BLOOD,ex:'B+'}),
     F('address','Address','text',{ex:'4, North Street, Salem'}),F('area','Area / town','text',{ex:'Salem'}),F('occupation','Occupation','text',{ex:'Student'}),
     F('organisation','College / company','text',{ex:'Sona College'}),F('position','Position','enum',{options:POSITIONS,ex:'Secretary'}),
     F('membership_type','Membership type','enum',{options:['Active','Prospective','Honorary','Alumni'],ex:'Active'}),
     F('status','Status','enum',{options:[['active','Active'],['inactive','Inactive'],['resigned','Resigned']],ex:'Active'}),
     F('joined_on','Joined on','date',{ex:'01/07/2024'}),F('left_on','Left on','date',{ex:''}),F('ri_member_id','RI / club member ID','text',{ex:''}),
     F('emergency_contact','Emergency contact','text',{ex:'Mother 9876500000'}),F('notes','Notes','text',{ex:''})]},
  {key:'member_dues',label:'Member payments',desc:'Subscription and donation receipts',perm:['members'],
   unique:'Receipt no, or the same member + paid date + subscription amount',
   fields:[F('receipt_no','Receipt no','code',{hint:'Only to update a receipt already in the CRM (RC-0004).',ex:''}),
     F('member_ref','Member','ref',{req:true,hint:'Member ID (M-003), mobile number, email or exact name.',ex:'M-001'}),
     F('period','Club year','text',{hint:'July to June, e.g. 2026-27. Empty: taken from the paid date.',ex:clubYearOf()}),F('paid_on','Paid on','date',{req:true,ex:'01/08/2026'}),
     F('subscription','Subscription (Rs.)','num',{ex:'15000'}),F('donation','Donation (Rs.)','num',{ex:'0'}),
     F('mode','Mode','enum',{options:['Cash','UPI','Bank transfer','Cheque'],ex:'UPI'}),F('reference','Reference','text',{hint:'UPI or cheque number',ex:''}),F('notes','Notes','text',{ex:''})]},
  {key:'donor_events',label:'Past blood donations',desc:'Donations a donor made before (also sets the last donation date)',perm:['donors'],
   unique:'Same donor + date + kind',
   fields:[F('donor_ref','Donor','ref',{req:true,hint:'Donor ID (D-0012), mobile number or email.',ex:'9876543210'}),F('event_date','Donation date','date',{req:true,ex:'15/03/2026'}),
     F('kind','Kind','enum',{options:[['outside_donation','Donated elsewhere'],['emergency_donation','Emergency donation']],ex:'Donated elsewhere'}),
     F('place','Hospital / place','text',{ex:'GH Salem'}),F('units','Units','int',{ex:'1'}),F('notes','Notes','text',{ex:''})]},
  {key:'camps',label:'Camps',desc:'Blood, eye, food, plantation, cancer awareness and other camps',perm:['camps'],
   unique:'Camp ID, or the same name + date',
   fields:[F('camp_no','Camp ID','code',{hint:'Only to update a camp already in the CRM (C-004).',ex:''}),F('name','Camp name','text',{req:true,ex:'Free eye check-up camp'}),
     F('camp_type','Camp type','enum',{options:['Blood donation','Eye checking','Food donation','Environment (plantation)','Cancer awareness','Others'],ex:'Eye checking'}),
     F('camp_type_other','Type name (for Others)','text',{ex:''}),F('camp_date','Date','date',{req:true,ex:'10/09/2026'}),F('start_time','Starts','time',{ex:'09:00'}),F('end_time','Ends','time',{ex:'15:00'}),
     F('venue','Venue','text',{ex:'PHC Edappadi'}),F('target_donors','Target donors','int',{ex:''}),F('slot_capacity','Donors per slot','int',{ex:''}),
     F('status','Status','enum',{options:[['planned','Planned'],['open','Registration open'],['live','Live today'],['completed','Completed'],['closed','Closed']],ex:'Completed'}),
     F('budget','Budget (Rs.)','num',{ex:''}),F('beneficiaries','People helped','int',{ex:'120'}),F('about','About the camp','text',{ex:'With Lotus Eye Hospital'})]},
  {key:'camp_attendance',label:'Camp attendance',desc:'Which members came to each camp',perm:['camps','members'],
   unique:'Same camp + member (updates the mark)',
   fields:[F('camp_ref','Camp','ref',{req:true,hint:'Camp ID (C-004), camp date (if only one camp that day) or exact camp name.',ex:'C-001'}),
     F('member_ref','Member','ref',{req:true,hint:'Member ID, mobile or exact name.',ex:'M-001'}),F('status','Attendance','enum',{options:ATT,ex:'Present'}),
     F('late_minutes','Minutes late','int',{ex:''}),F('duty','Duty','text',{ex:'Registration desk'})]},
  {key:'meetings',label:'Meetings',desc:'Past or planned meetings with minutes',perm:['meetings'],
   unique:'Meeting ID, or the same title + date',
   fields:[F('meeting_no','Meeting ID','code',{hint:'Only to update a meeting already in the CRM (MT-005).',ex:''}),F('title','Title','text',{req:true,ex:'Monthly meeting'}),
     F('kind','Type','enum',{options:['Weekly','Monthly','Board','General body','Special','Joint','Installation','Others'],ex:'Monthly'}),F('kind_other','Type name (for Others)','text',{ex:''}),
     F('audience','Who is it for','enum',{options:[['all','All members'],['board','Board members only']],ex:'All members'}),F('meeting_date','Date','date',{req:true,ex:'05/08/2026'}),
     F('start_time','Starts','time',{ex:'18:30'}),F('end_time','Ends','time',{ex:'20:00'}),F('venue','Venue','text',{ex:'Club office'}),
     F('mode','Mode','enum',{options:['In person','Online','Hybrid'],ex:'In person'}),F('online_link','Meeting link','text',{ex:''}),F('chaired_by','Chaired by','text',{ex:'Arun Prakash'}),
     F('minutes_by','Minutes by','text',{ex:'Divya Shree'}),F('chief_guest','Chief guest','text',{ex:''}),F('guests','Guests (number)','int',{ex:''}),F('guest_names','Guest names','text',{ex:''}),
     F('agenda','Agenda','text',{ex:''}),F('minutes','Minutes','text',{ex:''}),F('decisions','Decisions','text',{ex:''}),
     F('status','Status','enum',{options:[['scheduled','Scheduled'],['held','Held'],['cancelled','Cancelled']],ex:'Held'})]},
  {key:'meeting_attendance',label:'Meeting attendance',desc:'Present, late, leave or absent for each meeting',perm:['meetings'],
   unique:'Same meeting + member (updates the mark)',
   fields:[F('meeting_ref','Meeting','ref',{req:true,hint:'Meeting ID (MT-005), meeting date (if only one meeting that day) or exact title.',ex:'MT-001'}),
     F('member_ref','Member','ref',{req:true,hint:'Member ID, mobile or exact name.',ex:'M-001'}),F('status','Attendance','enum',{options:ATT,ex:'Late'}),
     F('late_minutes','Minutes late','int',{ex:'20'}),F('note','Note','text',{ex:''})]},
  {key:'hospitals',label:'Hospitals and blood banks',desc:'Directory of hospitals, blood banks and contacts',perm:['emergency','camps','afterlife'],
   unique:'Same name + city, or the same phone',
   fields:[F('name','Name','text',{req:true,ex:'Government Hospital'}),F('kind','Kind','enum',{options:['Hospital','Blood bank','Eye bank','Medical college','Ambulance','Other'],ex:'Blood bank'}),
     F('city','City','text',{ex:'Salem'}),F('address','Address','text',{ex:'Omalur Main Road'}),F('phone','Phone','text',{ex:'0427 2210000'}),F('phone2','Phone 2','text',{ex:''}),
     F('contact_person','Contact person','text',{ex:'Dr. Kumar'}),F('email','Email','email',{ex:''}),F('open_24x7','Open 24x7','bool',{ex:'Yes'}),F('tie_up','Tie-up with club','bool',{ex:'No'}),
     F('blood_groups_note','Blood groups note','text',{ex:''}),F('notes','Notes','text',{ex:''})]},
  {key:'projects',label:'Service projects',desc:'Community service projects',perm:['members'],
   unique:'Project ID, or the same title + start date',
   fields:[F('project_no','Project ID','code',{hint:'Only to update a project already in the CRM (P-002).',ex:''}),F('title','Title','text',{req:true,ex:'Tree planting drive'}),
     F('avenue','Avenue','enum',{options:['Club service','Community service','Professional development','International service','Blood donation','Public image','Other'],ex:'Community service'}),
     F('status','Status','enum',{options:[['planned','Planned'],['ongoing','Ongoing'],['completed','Completed'],['cancelled','Cancelled']],ex:'Completed'}),
     F('start_date','Start date','date',{ex:'02/10/2026'}),F('end_date','End date','date',{ex:''}),F('venue','Venue','text',{ex:'Govt school'}),F('partner','Partner','text',{ex:''}),
     F('beneficiaries','People helped','int',{ex:'300'}),F('budget','Budget (Rs.)','num',{ex:''}),F('spent','Spent (Rs.)','num',{ex:''}),F('description','Description','text',{ex:''}),F('outcome','Outcome','text',{ex:'120 saplings planted'})]},
  {key:'events',label:'Club events',desc:'Installation, fundraisers, workshops and more',perm:['meetings','members'],
   unique:'Event ID, or the same title + date',
   fields:[F('event_no','Event ID','code',{hint:'Only to update an event already in the CRM.',ex:''}),F('title','Title','text',{req:true,ex:'Installation night'}),
     F('kind','Kind','enum',{options:['Installation','Fundraiser','Fellowship','Workshop','Awareness','Sports','Other'],ex:'Installation'}),F('event_date','Date','date',{req:true,ex:'12/07/2026'}),
     F('start_time','Starts','time',{ex:'18:00'}),F('end_time','Ends','time',{ex:''}),F('venue','Venue','text',{ex:'Rotary Hall'}),F('capacity','Capacity','int',{ex:''}),
     F('open_registration','Online registration','bool',{ex:'No'}),F('fee','Entry fee (Rs.)','num',{ex:''}),F('description','Description','text',{ex:''}),
     F('status','Status','enum',{options:[['planned','Planned'],['open','Open'],['done','Done'],['cancelled','Cancelled']],ex:'Done'})]},
]
export const entity=k=>ENTITIES.find(e=>e.key===k)

// ---------- reading cells ----------
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9+\-]/g,'')
export const headerKey=(h,e)=>{const n=norm(String(h??'').replace(/\*/g,''));if(!n)return null
  const f=e.fields.find(f=>norm(f.label)===n||norm(f.key)===n)||e.fields.find(f=>norm(f.label.replace(/\(.*\)/,''))===n)
  if(f)return f.key
  const HINT={full_name:/^(name|fullname|donorname|membername)$/,phone:/mobile|phone|contact|cell|whatsapp/,email:/mail/,blood_group:/blood|group/,gender:/gender|sex/,dob:/dob|birth/,
    address:/address/,area:/area|town|village|place|city/,last_donation:/lastdon/,member_ref:/member/,donor_ref:/donor/,meeting_ref:/meeting/,camp_ref:/camp/}
  const hit=e.fields.find(f=>HINT[f.key]?.test(n));return hit?.key||null}

const pad=n=>String(n).padStart(2,'0')
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12}
export function toDate(v){if(v==null||v==='')return {v:null}
  if(v instanceof Date){const d=new Date(v.getTime()+12*36e5);return {v:`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`}}
  if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+v*864e5);return {v:d.toISOString().slice(0,10)}}
  const s=String(v).trim();let y,m,d,x
  if((x=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)))[y,m,d]=[+x[1],+x[2],+x[3]]
  else if((x=s.match(/^(\d{1,2})[-\/. ](\d{1,2})[-\/. ](\d{2,4})$/)))[d,m,y]=[+x[1],+x[2],+x[3]]
  else if((x=s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,9})[-\/ ,]*(\d{2,4})$/))){const mm=MON[x[2].toLowerCase().slice(0,4)]||MON[x[2].toLowerCase().slice(0,3)];if(!mm)return {e:`"${s}" is not a date (use DD/MM/YYYY)`};[d,m,y]=[+x[1],mm,+x[3]]}
  else return {e:`"${s}" is not a date (use DD/MM/YYYY)`}
  if(y<100)y+=y>40?1900:2000
  const t=new Date(Date.UTC(y,m-1,d));if(isNaN(t)||t.getUTCDate()!==d||t.getUTCMonth()!==m-1)return {e:`"${s}" is not a real date`}
  return {v:`${y}-${pad(m)}-${pad(d)}`}}
export function toTime(v){if(v==null||v==='')return {v:null}
  if(v instanceof Date)return {v:`${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`}
  if(typeof v==='number'&&v>=0&&v<1){const m=Math.round(v*1440);return {v:`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`}}
  const x=String(v).trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);if(!x)return {e:`"${v}" is not a time (use 09:30 or 6:30 PM)`}
  let h=+x[1];const m=+(x[2]||0),ap=x[3]?.[0];if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0
  return h>23||m>59?{e:`"${v}" is not a time`}:{v:`${pad(h)}:${pad(m)}`}}
const YES=/^(y|yes|true|1|ok|agreed|ஆம்|ஆமாம்|சரி)$/i,NO=/^(n|no|false|0|இல்லை)$/i
export function cell(f,raw){
  if(raw==null)return {v:null};if(typeof raw==='string'&&!raw.trim())return {v:null}
  switch(f.type){
    case 'date':return toDate(raw)
    case 'time':return toTime(raw)
    case 'phone':{const d=String(raw).replace(/\D/g,'');const p=d.length>10?d.slice(-10):d;return /^[6-9]\d{9}$/.test(p)?{v:p}:{e:`Mobile "${raw}" must be 10 digits starting with 6-9`}}
    case 'email':{const s=String(raw).trim().toLowerCase();return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)?{v:s}:{e:`"${raw}" is not an email address`}}
    case 'int':case 'num':{const s=String(raw).replace(/rs\.?|₹|,|\s/gi,'');const n=Number(s);if(!s||isNaN(n))return {e:`"${raw}" is not a number`};if(n<0)return {e:`"${raw}" cannot be below 0`};return {v:f.type==='int'?Math.round(n):n}}
    case 'bool':{const s=String(raw).trim();return YES.test(s)?{v:true}:NO.test(s)?{v:false}:{e:`"${raw}": write Yes or No`}}
    case 'enum':{let s=String(raw).trim()
      if(f.key==='blood_group')s=s.toUpperCase().replace(/\s/g,'').replace(/POSITIVE|POS|\+VE|VE\+/g,'+').replace(/NEGATIVE|NEG|-VE/g,'-').replace(/^0/,'O')
      if(f.key==='gender'){const g=s.toLowerCase();s=g[0]==='m'||g==='ஆண்'?'Male':g[0]==='f'||g==='பெண்'?'Female':s}
      const n=norm(s),hit=f.options.find(([v,l])=>norm(v)===n||norm(l)===n);return hit?{v:hit[0]}:{e:`"${raw}" is not one of: ${f.options.map(o=>o[1]).join(', ')}`}}
    default:return {v:String(raw).trim()}}}

// turn sheet rows into what the database receives, plus problems found before sending
export function prepare(e,rows,map){const out=[],errs={}
  rows.forEach((r,i)=>{const o={},bad=[]
    e.fields.forEach(f=>{const c=map[f.key];if(c===''||c==null)return;const {v,e:er}=cell(f,r[c]);if(er)bad.push(`${f.label}: ${er}`);else if(v!=null)o[f.key]=v})
    // required cells are checked by the database only for new records, so a row that updates an existing one can leave them empty
    if(e.key==='member_dues'&&o.period==null&&o.paid_on)o.period=clubYearOf(o.paid_on)
    out.push(o);if(bad.length&&Object.keys(o).length)errs[i]=bad})
  return {rows:out,errs}}

// template: sheet 1 = the columns with one example row; sheet 2 = how to fill each column
export function templateSheets(e){const f=e.fields
  return [{name:e.label,header:true,rows:[f.map(x=>x.label+(x.req?' *':'')),f.map(x=>x.ex??'')],widths:f.map(x=>Math.min(40,Math.max(14,x.label.length+4))),
      textCols:f.map((x,i)=>['phone','code','text','ref','email','date','time'].includes(x.type)?i:-1).filter(i=>i>=0),
      lists:Object.fromEntries(f.map((x,i)=>[i,x.type==='enum'?x.options.map(o=>o[1]):x.type==='bool'?['Yes','No']:null]).filter(([,o])=>o))},
    {name:'How to fill',rows:[[`${e.label}: how to fill the sheet`],[],['Column','Needed?','What to write','Example'],
      ...f.map(x=>[x.label,x.req?'Required':'Optional',x.hint||{date:'Date as DD/MM/YYYY',time:'Time as 09:30 or 6:30 PM',phone:'10-digit mobile number',email:'Email address',int:'Whole number',num:'Amount in rupees, numbers only',bool:'Yes or No',enum:'One of: '+(x.options||[]).map(o=>o[1]).join(', ')}[x.type]||'Text',x.ex??'']),
      [],['Duplicates',`A row is the same record when it has the same ${e.unique}. Such rows are skipped, or updated if you choose "Add new and update existing".`],
      ['Empty cells','An empty cell never clears a value that is already in the CRM.'],
      ['Undo','Every import can be undone from the Import page (History).']],
     widths:[26,12,70,26],titleRows:[0],noteCols:[2]}]}
export const templateCsv=e=>[e.fields.map(x=>x.label+(x.req?' *':'')),e.fields.map(x=>x.ex??'')]
export {YEAR_NAME}
