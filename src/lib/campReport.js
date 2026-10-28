// One report for any camp type, from camp_summary(): what happened, who worked, and the money.
import {supabase} from './supabase'
import {buildPdf,pad,rs} from './docpdf'
import {fmt} from './util'
import {typeName,kindOf,words} from './campTypes'

export const loadSummary=async id=>{const {data,error}=await supabase.rpc('camp_summary',{p_camp:id});if(error)throw error;return data}
const t5=t=>t?String(t).slice(0,5):''
const pairs=o=>Object.entries(o||{}).sort((a,b)=>b[1]-a[1])

export async function campReportPdf(brand,s){
  const c=s.camp,k=kindOf(c),w=words(c)
  const head=[['Type',typeName(c)],['Date',fmt(c.camp_date)],['Time',c.start_time?`${t5(c.start_time)} – ${t5(c.end_time)}`:'–'],['Venue',c.venue||'–'],
    ...(c.partner?[['Partner',c.partner]]:[]),...(c.doctors?[['Doctors / speakers',c.doctors]]:[])]
  const blocks=[{type:'boxes',keyWidth:36,boxes:[{title:'Camp',rows:head.slice(0,4)},...(head.length>4?[{title:'With',rows:head.slice(4)}]:[])]}]
  if(k==='blood'){const b=s.blood
    blocks.push({type:'stats',items:[['Registered',b.registered],['Came',b.arrived],['Donated',b.donated],['Deferred',b.deferred],['Blood collected',`${b.litres} L`]]})}
  if(k==='people'){const p=s.people
    blocks.push({type:'stats',items:[['Registered',p.registered],['Seen',p.attended],['Normal',p.normal],['Needs care',p.needs_care],['Suspicious',p.suspicious],['Referred',p.referred]]})
    blocks.push({type:'table',heading:'Who came',columns:['Men','Women','Children (under 18)','Seniors (60+)','Registered online','Did not come'],rows:[[p.male,p.female,p.children,p.seniors,p.online,p.no_show]]})
    if(Object.keys(p.findings||{}).length)blocks.push({type:'table',heading:'Findings',columns:['Finding','People'],rows:pairs(p.findings)})
    if(Object.keys(p.actions||{}).length)blocks.push({type:'table',heading:'What was done',columns:['Action','People'],rows:pairs(p.actions)})
    if(Object.keys(p.screenings||{}).length)blocks.push({type:'table',heading:'Screenings',columns:['Screening','People'],rows:pairs(p.screenings)})
    blocks.push({type:'table',heading:'Follow-up',columns:['Referred','Follow-up pending','Followed up'],rows:[[p.referred,p.follow_pending,p.follow_done]]})
    if(s.sessions?.length)blocks.push({type:'table',heading:'Awareness talks',columns:['Time','Topic','Speaker','People','Pamphlets'],rows:s.sessions.map(x=>[t5(x.held_at),x.topic,x.speaker||'',x.attendees??'',x.materials??''])})}
  if(k==='food'){const f=s.food
    blocks.push({type:'stats',items:[['People served',f.people],['Packets',f.packets],['Places',f.points],...(c.target_people?[['Target',c.target_people]]:[])]})
    blocks.push({type:'table',heading:'Where food was served',columns:['Time','Place','Who','People','Packets','Items','By'],rows:f.list.map(x=>[t5(x.served_at),x.place,x.group_type||'',x.people,x.packets??'',x.items||'',x.served_by||''])})}
  if(k==='plants'){const p=s.plants
    blocks.push({type:'stats',items:[['Saplings planted',p.planted],['Batches',p.batches],...(c.target_people?[['Target',c.target_people]]:[]),['Survival',p.checked?`${Math.round(p.alive/p.checked*100)}% (${p.alive} of ${p.checked})`:'not checked yet']]})
    blocks.push({type:'table',heading:'Saplings',columns:['Species','Count','Place','Landmark','Planted by','Waters','Alive','Checked'],rows:p.list.map(x=>[x.species,x.count,x.place||'',x.landmark||'',x.planted_by||'',[x.guardian,x.guardian_phone].filter(Boolean).join(' '),x.alive??'',x.last_check?fmt(x.last_check):''])})}
  const t=s.team,m=s.money
  blocks.push({type:'table',heading:'Team',columns:['Members present','Members on leave','Volunteers listed','Volunteers present'],rows:[[t.members_present,t.members_leave,t.volunteers,t.volunteers_present]]})
  blocks.push({type:'table',heading:'Money',columns:['Budget','Sponsorship received','Expenses','Balance'],rows:[[m.budget!=null?rs(m.budget):'–',rs(m.sponsors),rs(m.expenses),rs(m.sponsors-m.expenses)]]})
  if(c.about)blocks.push({type:'text',heading:'About',text:c.about})
  blocks.push({type:'signatures',items:[[brand.signatory2_name,brand.signatory2_title||'Secretary'],[brand.signatory_name,brand.signatory_title||'President']]})
  return buildPdf({title:'Camp report',heading:c.name,subtitle:`${typeName(c)} · ${fmt(c.camp_date)}${c.venue?' · '+c.venue:''} · ${c.beneficiaries??0} ${w.helped}`,docNo:pad('C',c.camp_no,3),brand,
    footer:`${typeName(c)} camp report`,filename:`camp-report-${pad('C',c.camp_no,3)}.pdf`,blocks})
}
