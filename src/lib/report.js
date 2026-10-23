// Camp report in two formats: an A4 invoice-style report and an 80 mm thermal receipt.
const rs=n=>'Rs. '+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})
const pad=(p,n,w)=>n==null?'':`${p}-${String(n).padStart(w,'0')}`
const hexRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return [76,141,255];const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255]}
const NAVY=[11,19,36],INK=[45,55,72],MUTED=[110,124,148],LINE=[226,232,242],BLOOD=[180,35,58],SOFT=[246,248,252]
const STATUS={registered:'Registered',checked_in:'Checked in',screened:'Cleared',donated:'Donated',deferred:'Deferred',no_show:'No-show'}

async function imageData(url){
  if(!url)return null
  try{const b=await (await fetch(url,{mode:'cors'})).blob()
    return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=()=>res(null);f.readAsDataURL(b)})}catch{return null}
}

export async function reportPdf(r,fmt,brand={},prepared=''){
  const {buildPdf}=await import('./docpdf')
  const G=['A+','A-','B+','B-','AB+','AB-','O+','O-'],bal=r.sponsors_received-r.expenses
  const reportNo=`RPT-${String(r.camp_no??0).padStart(3,'0')}-${new Date().toISOString().slice(2,10).replace(/-/g,'')}`
  return buildPdf({title:'Camp report',heading:r.camp.name,brand,prepared,docNo:reportNo,footer:`Camp report · ${r.camp.name}`,
    subtitle:`${fmt(r.camp.date)}${r.start_time?`, ${r.start_time.slice(0,5)} to ${(r.end_time||'').slice(0,5)}`:''}${r.camp.venue?`  ·  ${r.camp.venue}`:''}`,
    filename:`camp-report-${pad('C',r.camp_no,3)}-${r.camp.name.replace(/\W+/g,'-').toLowerCase()}.pdf`,
    meta:[['Report no.',reportNo],['Camp no.',pad('C',r.camp_no,3)],['Date',new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})],prepared&&['Prepared by',prepared]].filter(Boolean),
    blocks:[
      {type:'stats',items:[['Registered',r.registered],['Donated',`${r.donated}${r.camp.target?` / ${r.camp.target}`:''}`,'blood'],['Blood collected',`${(r.volume_ml/1000).toFixed(2)} L`,'blood'],['Deferred',r.deferred],['No-show',r.no_show],['First-time',r.first_time]]},
      {type:'table',heading:'Donations by blood group',columns:[...G,'Total'],rows:[[...G.map(g=>r.by_group[g]||0),r.donated]],
        opts:{styles:{halign:'center',fontSize:10},headStyles:{halign:'center'},columnStyles:{8:{fontStyle:'bold'}}}},
      {type:'table',heading:`Donor register (${r.donors.length})`,columns:['#','Token','Donor ID','Name','Group','Status','Bag no.','ml','Certificate'],
        rows:r.donors.map((d,i)=>[i+1,pad('T',d.token,3),pad('D',d.donor_no,4),d.name,d.group||'-',STATUS[d.status]||d.status,d.bag||'',d.volume||'',d.cert_no?pad('CRT',d.cert_no,6):'']),
        opts:{columnStyles:{0:{halign:'right',cellWidth:8},4:{halign:'center',fontStyle:'bold',textColor:BLOOD},7:{halign:'right'}}}},
      {type:'table',heading:'Sponsorship',columns:['#','Ref','Sponsor','Status','Amount'],rows:r.sponsor_list.map((x,i)=>[i+1,pad('SP',x.no,4),x.name,x.received?'Received':'Pledged',rs(x.amount)]),
        opts:{columnStyles:{0:{cellWidth:8,halign:'right'},4:{halign:'right'}},foot:[['','','','Received',rs(r.sponsors_received)]],footStyles:{halign:'right'}},empty:'No sponsors recorded.'},
      {type:'table',heading:'Expenses',columns:['#','Voucher','Date','Category','Details','Amount'],rows:r.expense_list.map((e,i)=>[i+1,pad('EX',e.no,4),fmt(e.date),e.category,e.description||'',rs(e.amount)]),
        opts:{columnStyles:{0:{cellWidth:8,halign:'right'},5:{halign:'right'}},foot:[['','','','','Total',rs(r.expenses)]],footStyles:{halign:'right'}},empty:'No expenses recorded.'},
      {type:'totals',rows:[['Budget',rs(r.camp.budget||0)],['Sponsorship received',rs(r.sponsors_received)],['Expenses',rs(r.expenses)]],final:['Balance',rs(bal)],negative:bal<0,
        side:`Volunteers present: ${r.volunteers_present} of ${r.volunteers}\nChecklist done: ${r.tasks_done} of ${r.tasks_total}\nFirst-time donors: ${r.first_time}`},
      r.volunteer_list?.length?{type:'table',heading:'Volunteers',columns:['#','Name','Desk','Shift','Present'],rows:r.volunteer_list.map((v,i)=>[i+1,v.name,v.desk||'',v.shift||'',v.attended?'Yes':'No']),opts:{columnStyles:{0:{cellWidth:8,halign:'right'}}}}:{type:'text'},
      {type:'signatures',items:[[prepared,'Prepared by'],[brand.signatory_name,brand.signatory_title||'President'],[brand.signatory2_name,brand.signatory2_title||'Secretary']]}]})
}

// 80 mm thermal receipt with the camp summary, like a supermarket bill.
export async function receiptPdf(r,fmt,brand={}){
  brand=(await import('./docpdf')).withBrand(brand)
  const {jsPDF}=await import('jspdf'),G=['A+','A-','B+','B-','AB+','AB-','O+','O-'].filter(g=>r.by_group[g])
  const lines=24+G.length+(r.sponsor_list.length+r.expense_list.length)
  const doc=new jsPDF({unit:'mm',format:[80,Math.max(140,lines*5+60)]}),W=80,L=5,R=75
  let y=8;const c=(t,s=8,b=false)=>{doc.setFont('courier',b?'bold':'normal').setFontSize(s).setTextColor(0,0,0).text(String(t),W/2,y,{align:'center',maxWidth:70});y+=s*.45+1.6}
  const kv=(k,v,b=false)=>{doc.setFont('courier',b?'bold':'normal').setFontSize(8).text(String(k),L,y);doc.text(String(v),R,y,{align:'right'});y+=4.2}
  const rule=(ch='-')=>{doc.setFont('courier','normal').setFontSize(8).text(ch.repeat(40),W/2,y,{align:'center'});y+=4}
  c((brand.club_name||'Blood donation club').toUpperCase(),10,true);if(brand.address)c(brand.address,7);if(brand.contact_phone)c('Ph: '+brand.contact_phone,7)
  rule('=');c('BLOOD DONATION CAMP',9,true);c('SUMMARY RECEIPT',8);rule('=')
  kv('Camp no.',pad('C',r.camp_no,3));kv('Date',fmt(r.camp.date));doc.setFont('courier','normal').setFontSize(8).text(r.camp.name,L,y,{maxWidth:70});y+=4.2*Math.ceil(r.camp.name.length/36)
  rule()
  kv('Registered',r.registered);kv('Arrived',r.arrived);kv('Donated',r.donated,true);kv('Deferred',r.deferred);kv('No-show',r.no_show);kv('Blood collected',`${(r.volume_ml/1000).toFixed(2)} L`,true)
  rule();G.forEach(g=>kv(`  ${g}`,r.by_group[g]));if(G.length)rule()
  r.sponsor_list.forEach(s=>kv(`SP ${s.name.slice(0,22)}`,s.received?rs(s.amount):'pledged'))
  kv('Sponsorship',rs(r.sponsors_received),true);rule()
  r.expense_list.forEach(e=>kv(`EX ${(e.category||'').slice(0,22)}`,rs(e.amount)))
  kv('Expenses',rs(r.expenses),true);rule('=');kv('BALANCE',rs(r.sponsors_received-r.expenses),true);rule('=')
  c('Thank you, donors and volunteers!',8,true);c(new Date().toLocaleString('en-IN'),7)
  doc.autoPrint?.();window.open(doc.output('bloburl'),'_blank')||doc.save(`receipt-${pad('C',r.camp_no,3)}.pdf`)
}
