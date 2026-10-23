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
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')])
  const doc=new jsPDF({unit:'mm',format:'a4'}),W=210,M=14,accent=hexRgb(brand.brand_color)
  const club=brand.club_name||'Sankari Rotaract Club',logo=await imageData(brand.logo_url)
  const reportNo=`RPT-${String(r.camp_no??0).padStart(3,'0')}-${new Date().toISOString().slice(2,10).replace(/-/g,'')}`
  // header band
  doc.setFillColor(...NAVY).rect(0,0,W,34,'F');doc.setFillColor(...BLOOD).rect(0,34,W,1.6,'F')
  let x=M
  if(logo){try{doc.setFillColor(255,255,255).roundedRect(M,7,20,20,3,3,'F');doc.addImage(logo,M+1.5,8.5,17,17);x=M+25}catch{}}
  doc.setTextColor(255,255,255).setFont('helvetica','bold').setFontSize(16).text(club,x,16)
  doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(190,202,224)
  doc.text([brand.address,[brand.contact_phone,brand.contact_email].filter(Boolean).join('  |  '),brand.reg_no&&('Reg. no. '+brand.reg_no)].filter(Boolean),x,21.5)
  doc.setFont('helvetica','bold').setFontSize(13).setTextColor(255,255,255).text('CAMP REPORT',W-M,15,{align:'right'})
  doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(190,202,224)
  doc.text([`Report no. ${reportNo}`,`Generated ${new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`],W-M,21,{align:'right'})
  // camp details and key numbers, like the "bill to" boxes on an invoice
  let y=44
  const box=(bx,bw,title,rows)=>{doc.setFillColor(...SOFT).setDrawColor(...LINE).roundedRect(bx,y,bw,32,2,2,'FD')
    doc.setFont('helvetica','bold').setFontSize(8).setTextColor(...accent).text(title,bx+4,y+6)
    rows.forEach(([k,v],i)=>{doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(...MUTED).text(k,bx+4,y+12+i*5.5)
      doc.setFont('helvetica','bold').setTextColor(...NAVY).text(String(v??'-'),bx+30,y+12+i*5.5,{maxWidth:bw-34})})}
  box(M,(W-2*M)/2-3,'CAMP',[['Camp',r.camp.name],['Camp no.',pad('C',r.camp_no,3)],['Date',`${fmt(r.camp.date)}${r.start_time?`, ${r.start_time.slice(0,5)}-${(r.end_time||'').slice(0,5)}`:''}`],['Venue',r.camp.venue]])
  box(W/2+3,(W-2*M)/2-3,'AT A GLANCE',[['Registered',r.registered],['Donated',`${r.donated}${r.camp.target?` of ${r.camp.target} target`:''}`],['Collected',`${(r.volume_ml/1000).toFixed(2)} litres`],['Deferred',`${r.deferred}   No-show ${r.no_show}`]])
  y+=40
  const head=(t)=>{if(y>262){doc.addPage();y=20}doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...NAVY).text(t,M,y);doc.setDrawColor(...accent).setLineWidth(.6).line(M,y+1.6,M+12,y+1.6);y+=5}
  const table=(columns,body,opts={})=>{autoTable(doc,{startY:y,margin:{left:M,right:M},head:[columns],body,theme:'grid',
    styles:{font:'helvetica',fontSize:8.5,cellPadding:2.2,lineColor:LINE,lineWidth:.2,textColor:INK},
    headStyles:{fillColor:NAVY,textColor:255,fontStyle:'bold',fontSize:8.3},alternateRowStyles:{fillColor:SOFT},...opts});y=doc.lastAutoTable.finalY+9}
  // blood groups
  head('Donations by blood group')
  const G=['A+','A-','B+','B-','AB+','AB-','O+','O-']
  table([...G,'Total'],[[...G.map(g=>r.by_group[g]||0),r.donated]],{styles:{halign:'center',fontSize:9.5,cellPadding:3,lineColor:LINE,lineWidth:.2,textColor:INK},headStyles:{fillColor:BLOOD,textColor:255,halign:'center'}})
  // donors
  head(`Donor register (${r.donors.length})`)
  table(['#','Token','Donor ID','Name','Group','Status','Bag no.','ml','Certificate'],
    r.donors.map((d,i)=>[i+1,pad('T',d.token,3),pad('D',d.donor_no,4),d.name,d.group||'-',STATUS[d.status]||d.status,d.bag||'',d.volume||'',d.cert_no?pad('CRT',d.cert_no,6):'']),
    {columnStyles:{0:{halign:'right',cellWidth:8},4:{halign:'center',fontStyle:'bold',textColor:BLOOD},7:{halign:'right'}}})
  // money, invoice style
  head('Sponsorship')
  table(['#','Ref','Sponsor','Status','Amount'],r.sponsor_list.map((s,i)=>[i+1,pad('SP',s.no,4),s.name,s.received?'Received':'Pledged',rs(s.amount)]),
    {columnStyles:{0:{cellWidth:8,halign:'right'},4:{halign:'right'}},foot:[['','','','Received',rs(r.sponsors_received)]],footStyles:{fillColor:[255,255,255],textColor:NAVY,fontStyle:'bold',halign:'right'}})
  head('Expenses')
  table(['#','Voucher','Date','Category','Details','Amount'],r.expense_list.map((e,i)=>[i+1,pad('EX',e.no,4),fmt(e.date),e.category,e.description||'',rs(e.amount)]),
    {columnStyles:{0:{cellWidth:8,halign:'right'},5:{halign:'right'}},foot:[['','','','','Total',rs(r.expenses)]],footStyles:{fillColor:[255,255,255],textColor:NAVY,fontStyle:'bold',halign:'right'}})
  // totals box
  if(y>240){doc.addPage();y=20}
  const bx=W-M-78,bal=r.sponsors_received-r.expenses
  doc.setDrawColor(...LINE).setFillColor(...SOFT).roundedRect(bx,y,78,30,2,2,'FD')
  ;[['Budget',rs(r.camp.budget||0)],['Sponsorship received',rs(r.sponsors_received)],['Expenses',rs(r.expenses)]].forEach(([k,v],i)=>{
    doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(...MUTED).text(k,bx+4,y+6+i*5.5);doc.setTextColor(...NAVY).text(v,bx+74,y+6+i*5.5,{align:'right'})})
  doc.setFillColor(...(bal<0?BLOOD:NAVY)).rect(bx,y+21,78,9,'F')
  doc.setFont('helvetica','bold').setFontSize(10).setTextColor(255,255,255).text('Balance',bx+4,y+27);doc.text(rs(bal),bx+74,y+27,{align:'right'})
  doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(...MUTED)
  doc.text([`Volunteers present: ${r.volunteers_present} of ${r.volunteers}`,`Checklist done: ${r.tasks_done} of ${r.tasks_total}`,`First-time donors: ${r.first_time}`],M,y+6)
  y+=40
  if(r.volunteer_list?.length){head('Volunteers');table(['#','Name','Desk','Shift','Present'],r.volunteer_list.map((v,i)=>[i+1,v.name,v.desk||'',v.shift||'',v.attended?'Yes':'No']),{columnStyles:{0:{cellWidth:8,halign:'right'}}})}
  // signatures
  if(y>250){doc.addPage();y=30}else y+=12
  const sig=(sx,n,t)=>{doc.setDrawColor(...NAVY).setLineWidth(.3).line(sx,y,sx+55,y);doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...NAVY).text(n||'',sx,y+5);doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...MUTED).text(t,sx,y+9.5)}
  sig(M,prepared,'Prepared by');sig(W/2-27,brand.signatory_name,brand.signatory_title||'President');sig(W-M-55,brand.signatory2_name,brand.signatory2_title||'Secretary')
  // footer on every page
  const pages=doc.getNumberOfPages()
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(...LINE).line(M,285,W-M,285)
    doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...MUTED).text(`${club}  |  ${r.camp.name}  |  Computer-generated report`,M,289.5)
    doc.text(`Page ${i} of ${pages}`,W-M,289.5,{align:'right'})}
  doc.setProperties({title:`${r.camp.name} report`,creator:club})
  doc.save(`camp-report-${pad('C',r.camp_no,3)}-${r.camp.name.replace(/\W+/g,'-').toLowerCase()}.pdf`)
}

// 80 mm thermal receipt with the camp summary, like a supermarket bill.
export async function receiptPdf(r,fmt,brand={}){
  const {jsPDF}=await import('jspdf'),G=['A+','A-','B+','B-','AB+','AB-','O+','O-'].filter(g=>r.by_group[g])
  const lines=24+G.length+(r.sponsor_list.length+r.expense_list.length)
  const doc=new jsPDF({unit:'mm',format:[80,Math.max(140,lines*5+60)]}),W=80,L=5,R=75
  let y=8;const c=(t,s=8,b=false)=>{doc.setFont('courier',b?'bold':'normal').setFontSize(s).setTextColor(0,0,0).text(String(t),W/2,y,{align:'center',maxWidth:70});y+=s*.45+1.6}
  const kv=(k,v,b=false)=>{doc.setFont('courier',b?'bold':'normal').setFontSize(8).text(String(k),L,y);doc.text(String(v),R,y,{align:'right'});y+=4.2}
  const rule=(ch='-')=>{doc.setFont('courier','normal').setFontSize(8).text(ch.repeat(40),W/2,y,{align:'center'});y+=4}
  c((brand.club_name||'Rotaract Club').toUpperCase(),10,true);if(brand.address)c(brand.address,7);if(brand.contact_phone)c('Ph: '+brand.contact_phone,7)
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
