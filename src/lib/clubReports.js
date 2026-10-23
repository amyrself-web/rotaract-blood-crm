import Papa from 'papaparse'
import {supabase} from './supabase'
import {buildPdf,pad,rs,BLOOD} from './docpdf'
import {fmt} from './util'

// Rotary year runs 1 July to 30 June
export const rotaryYear=(d=new Date())=>{const y=d.getMonth()>=6?d.getFullYear():d.getFullYear()-1;return {from:`${y}-07-01`,to:`${y+1}-06-30`,label:`${y}-${String(y+1).slice(2)}`}}
export const iso=d=>new Date(d).toLocaleDateString('en-CA')
export const KIND_LABEL={eye:'Eyes',body:'Body',organ:'Organs',skin:'Skin'}
export const csv=(rows,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([Papa.unparse(rows)],{type:'text/csv'}));a.download=name;a.click()}
const must=r=>{if(r.error)throw r.error;return r.data}
const slug=s=>String(s).replace(/[^\w-]+/g,'-').replace(/-+/g,'-').toLowerCase()
const stamp=()=>new Date().toISOString().slice(2,10).replace(/-/g,'')

export async function memberDirectoryPdf(brand){
  const m=must(await supabase.from('members').select('*').is('deleted_at',null).order('member_no'))
  const act=m.filter(x=>x.status==='active')
  return buildPdf({title:'Member directory',docNo:`MD-${stamp()}`,brand,footer:'Member directory',filename:`member-directory-${stamp()}.pdf`,landscape:true,blocks:[
    {type:'stats',items:[['Members',m.length],['Active',act.length],['Prospective',m.filter(x=>x.membership_type==='Prospective').length],['Honorary / Alumni',m.filter(x=>['Honorary','Alumni'].includes(x.membership_type)).length],['Blood donors linked',m.filter(x=>x.donor_id).length,'blood']]},
    {type:'table',heading:'Members',columns:['ID','Name','Position','Type','Status','Mobile','Email','Blood','Joined','Occupation'],
      rows:m.map(x=>[pad('M',x.member_no),x.full_name,x.position,x.membership_type,x.status,x.phone||'',x.email||'',x.blood_group||'',fmt(x.joined_on),[x.occupation,x.organisation].filter(Boolean).join(', ')]),
      opts:{columnStyles:{7:{halign:'center',fontStyle:'bold',textColor:BLOOD}}}},
    {type:'signatures',items:[[brand.signatory2_name,brand.signatory2_title||'Secretary'],[brand.signatory_name,brand.signatory_title||'President']]}]})
}

export async function duesPdf(brand,{from,to,label}){
  const [m,d]=await Promise.all([supabase.from('members').select('id,member_no,full_name,position,status').is('deleted_at',null).order('member_no'),
    supabase.from('member_dues').select('*').gte('paid_on',from).lte('paid_on',to).order('receipt_no')]).then(x=>x.map(must))
  const by=Object.fromEntries(m.map(x=>[x.id,x])),total=d.reduce((a,x)=>a+Number(x.amount),0),paid=new Set(d.map(x=>x.member_id))
  return buildPdf({title:'Dues collection',docNo:`DU-${stamp()}`,brand,footer:`Dues ${label}`,filename:`dues-${slug(label)}.pdf`,blocks:[
    {type:'boxes',boxes:[{title:'PERIOD',rows:[['From',fmt(from)],['To',fmt(to)],['Receipts',d.length]]},{title:'COLLECTION',rows:[['Total',rs(total)],['Members paid',paid.size],['Not paid',m.filter(x=>x.status==='active'&&!paid.has(x.id)).length]]}]},
    {type:'table',heading:'Receipts',columns:['Receipt','Date','Member','Period','Mode','Reference','Amount'],
      rows:d.map(x=>[pad('RC',x.receipt_no,4),fmt(x.paid_on),`${by[x.member_id]?.full_name||'-'} (${pad('M',by[x.member_id]?.member_no)})`,x.period,x.mode,x.reference||'',rs(x.amount)]),
      opts:{columnStyles:{6:{halign:'right'}},foot:[['','','','','','Total',rs(total)]]}},
    {type:'table',heading:'Active members with no payment in this period',columns:['ID','Name','Position'],
      rows:m.filter(x=>x.status==='active'&&!paid.has(x.id)).map(x=>[pad('M',x.member_no),x.full_name,x.position]),empty:'Every active member has paid.'},
    {type:'signatures',items:[[brand.signatory2_name,'Treasurer / Secretary'],[brand.signatory_name,brand.signatory_title||'President']]}]})
}

export async function attendancePdf(brand,{from,to,label}){
  const s=must(await supabase.rpc('attendance_summary',{p_from:from,p_to:to}))
  const pct=x=>x.held?Math.round(x.present/x.held*100):0,avg=s.members.length?Math.round(s.members.reduce((a,x)=>a+pct(x),0)/s.members.length):0
  return buildPdf({title:'Attendance register',docNo:`AT-${stamp()}`,brand,footer:`Attendance ${label}`,filename:`attendance-${slug(label)}.pdf`,blocks:[
    {type:'stats',items:[['Meetings held',s.meetings.length],['Active members',s.members.length],['Average attendance',avg+'%'],['Guests',s.meetings.reduce((a,x)=>a+(x.guests||0),0)]]},
    {type:'table',heading:'Member attendance',columns:['ID','Member','Position','Held','Present','Leave','Attendance'],
      rows:[...s.members].sort((a,b)=>pct(b)-pct(a)).map(x=>[pad('M',x.no),x.name,x.position,x.held,x.present,x.leave,pct(x)+'%']),
      opts:{columnStyles:{3:{halign:'center'},4:{halign:'center'},5:{halign:'center'},6:{halign:'right',fontStyle:'bold'}}}},
    {type:'table',heading:'Meetings',columns:['No.','Date','Type','Title','Present','Guests'],rows:s.meetings.map(x=>[pad('MT',x.no),fmt(x.date),x.kind,x.title,x.present,x.guests||0])},
    {type:'signatures',items:[[brand.signatory2_name,brand.signatory2_title||'Secretary'],[brand.signatory_name,brand.signatory_title||'President']]}]})
}

export async function minutesPdf(brand,mt,attendance,members,actions){
  const st={present:'Present',late:'Late',leave:'On leave',absent:'Absent'},byId=Object.fromEntries(members.map(m=>[m.id,m]))
  const rows=members.map(m=>[pad('M',m.member_no),m.full_name,m.position,st[attendance[m.id]||'absent']])
  const present=members.filter(m=>['present','late'].includes(attendance[m.id])).length
  return buildPdf({title:'Minutes of meeting',docNo:pad('MT',mt.meeting_no),brand,footer:`${mt.title}, ${fmt(mt.meeting_date)}`,filename:`minutes-${pad('MT',mt.meeting_no)}.pdf`,blocks:[
    {type:'boxes',boxes:[{title:'MEETING',rows:[['Title',mt.title],['Type',mt.kind],['Date',`${fmt(mt.meeting_date)}${mt.start_time?`, ${mt.start_time.slice(0,5)}${mt.end_time?'-'+mt.end_time.slice(0,5):''}`:''}`],['Venue',mt.mode==='Online'?'Online':mt.venue||'-']]},
      {title:'ATTENDANCE',rows:[['Chaired by',mt.chaired_by||'-'],['Minutes by',mt.minutes_by||'-'],['Present',`${present} of ${members.length}`],['Guests',`${mt.guests||0}${mt.chief_guest?` (chief guest: ${mt.chief_guest})`:''}`]]}]},
    {type:'text',heading:'Agenda',text:mt.agenda},{type:'text',heading:'Minutes',text:mt.minutes},{type:'text',heading:'Decisions',text:mt.decisions},
    {type:'table',heading:'Action items',columns:['#','Action','Owner','Due','Status'],rows:actions.map((a,i)=>[i+1,a.task,byId[a.owner_member]?.full_name||'-',fmt(a.due),a.done?'Done':'Open']),empty:'No action items.'},
    {type:'table',heading:'Attendance',columns:['ID','Member','Position','Status'],rows},
    mt.guest_names?{type:'text',heading:'Guests',text:mt.guest_names}:{type:'text'},
    mt.next_meeting?{type:'text',heading:'Next meeting',text:fmt(mt.next_meeting)}:{type:'text'},
    {type:'signatures',items:[[mt.minutes_by||brand.signatory2_name,'Recorded by'],[mt.chaired_by||brand.signatory_name,'Chairperson']]}]})
}

export async function afterlifePdf(brand,{from,to,label}){
  const [s,c,p]=await Promise.all([supabase.rpc('afterlife_summary',{p_from:from,p_to:to}),
    supabase.from('afterlife_cases').select('*').is('deleted_at',null).gte('died_on',from).lte('died_on',to).order('case_no'),
    supabase.from('pledges').select('*').is('deleted_at',null).gte('pledged_on',from).lte('pledged_on',to).order('pledge_no')]).then(x=>x.map(must))
  const hrs=x=>x.collected_at&&x.died_at?((new Date(x.collected_at)-new Date(`${x.died_on}T${x.died_at}+05:30`))/36e5).toFixed(1)+' h':''
  return buildPdf({title:'Eye and body donation',docNo:`ED-${stamp()}`,brand,footer:`Eye and body donation ${label}`,filename:`eye-body-donation-${slug(label)}.pdf`,landscape:true,blocks:[
    {type:'stats',items:[['Eye donations',s.eye,'blood'],['Corneas',s.corneas,'blood'],['Body donations',s.body],['Organ / skin',s.organ+s.skin],['New pledges',s.pledges],['Active pledges',s.pledges_total]]},
    {type:'table',heading:`Donations after death (${c.length})`,columns:['Case','Name','Age','Died on','Donated','Institution','Collected','Time','Corneas','Family contact','Status'],
      rows:c.map(x=>[pad('ED',x.case_no,4),x.deceased_name,x.age??'',fmt(x.died_on),x.kinds.map(k=>KIND_LABEL[k]).join(', '),x.institution||'',x.collected_at?new Date(x.collected_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'',hrs(x),x.corneas??'',`${x.family_contact}${x.family_relation?` (${x.family_relation})`:''}`,x.status])},
    {type:'table',heading:`Pledges (${p.length})`,columns:['Pledge','Name','Mobile','Area','Pledged','Eye','Body','Organ','Skin','Card','Status'],
      rows:p.map(x=>[pad('PL',x.pledge_no,4),x.full_name,x.phone||'',x.area||'',fmt(x.pledged_on),x.eye?'Yes':'',x.body?'Yes':'',x.organ?'Yes':'',x.skin?'Yes':'',x.card_issued?'Issued':'',x.status])},
    {type:'signatures',items:[[brand.signatory2_name,brand.signatory2_title||'Secretary'],[brand.signatory_name,brand.signatory_title||'President']]}]})
}

const EVENT={outside_donation:'Donated elsewhere',emergency_donation:'Emergency donation',call:'Call',note:'Note',award:'Award',deferral:'Deferred'}
const STEP={registered:'Registered',checked_in:'Checked in',screened:'Cleared',donated:'Donated',deferred:'Deferred',no_show:'Did not come'}
export const timelineText=t=>t.type==='camp'?`${t.camp}: ${STEP[t.status]||t.status}${t.bag?`, bag ${t.bag}, ${t.volume} ml`:''}${t.cert_no?`, ${pad('CRT',t.cert_no,6)}`:''}${t.defer_reason?`, ${t.defer_reason}`:''}`
  :t.type==='event'?`${EVENT[t.kind]}${t.place?` at ${t.place}`:''}${t.units?`, ${t.units} unit${t.units>1?'s':''}`:''}${t.notes?`. ${t.notes}`:''}`
  :t.type==='message'?`WhatsApp ${String(t.kind||'').replace(/_/g,' ')}${t.ref?` (${t.ref})`:''}`:`Added to the CRM${t.source?` from ${t.source}`:''}`
export async function donorHistoryPdf(brand,donor,h){
  const s=h.stats
  return buildPdf({title:'Donor history',docNo:pad('D',donor.donor_no,4),brand,footer:`${donor.full_name} donor history`,filename:`donor-history-${pad('D',donor.donor_no,4)}.pdf`,blocks:[
    {type:'boxes',boxes:[{title:'DONOR',rows:[['Name',donor.full_name],['Donor ID',pad('D',donor.donor_no,4)],['Blood group',donor.blood_group||'-'],['Mobile',donor.phone]]},
      {title:'SUMMARY',rows:[['Donations',s.donations],['Collected',`${s.ml} ml at camps`],['First',fmt(s.first)],['Last',fmt(s.last)]]}]},
    {type:'stats',items:[['Donations',s.donations,'blood'],['Camps registered',s.camps],['Deferred',s.deferred],['Did not come',s.no_show],['Messages',s.messages]]},
    {type:'table',heading:'Full history (newest first)',columns:['Date','Type','Details','By'],rows:h.timeline.map(t=>[fmt(t.date),{camp:'Camp',event:'Record',message:'Message',added:'Added'}[t.type],timelineText(t),t.by||''])}]})
}
