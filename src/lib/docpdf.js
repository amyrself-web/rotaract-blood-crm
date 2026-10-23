// Shared A4 document builder (same look as the camp report): navy header with logo, info boxes,
// tables, paragraphs, signatures and "page x of y" footer.
const hexRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return [76,141,255];const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255]}
export const NAVY=[11,19,36],INK=[45,55,72],MUTED=[110,124,148],LINE=[226,232,242],BLOOD=[180,35,58],SOFT=[246,248,252],GREEN=[22,130,80]
export const rs=n=>'Rs. '+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})
export const pad=(p,n,w=3)=>n==null?'':`${p}-${String(n).padStart(w,'0')}`
export async function imageData(url){
  if(!url)return null
  try{const b=await (await fetch(url,{mode:'cors'})).blob()
    return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=()=>res(null);f.readAsDataURL(b)})}catch{return null}
}

/* blocks: {type:'boxes',boxes:[{title,rows:[[k,v]]}]} | {type:'table',heading,columns,rows,opts} | {type:'text',heading,text}
           | {type:'stats',items:[[label,value]]} | {type:'signatures',items:[[name,title]]} */
export async function buildPdf({title,docNo,brand={},blocks=[],filename,footer,landscape=false,save=true}){
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')])
  const doc=new jsPDF({unit:'mm',format:'a4',orientation:landscape?'landscape':'portrait'})
  const W=landscape?297:210,H=landscape?210:297,M=14,accent=hexRgb(brand.brand_color)
  const club=brand.club_name||'Sankari Rotaract Club',logo=await imageData(brand.logo_url)
  doc.setFillColor(...NAVY).rect(0,0,W,34,'F');doc.setFillColor(...BLOOD).rect(0,34,W,1.6,'F')
  let x=M
  if(logo){try{doc.setFillColor(255,255,255).roundedRect(M,7,20,20,3,3,'F');doc.addImage(logo,M+1.5,8.5,17,17);x=M+25}catch{}}
  doc.setTextColor(255,255,255).setFont('helvetica','bold').setFontSize(16).text(club,x,16)
  doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(190,202,224)
  doc.text([brand.address,[brand.contact_phone,brand.contact_email].filter(Boolean).join('  |  '),brand.reg_no&&('Reg. no. '+brand.reg_no)].filter(Boolean),x,21.5)
  doc.setFont('helvetica','bold').setFontSize(13).setTextColor(255,255,255).text(title.toUpperCase(),W-M,15,{align:'right'})
  doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(190,202,224)
  doc.text([docNo&&`No. ${docNo}`,`Generated ${new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`].filter(Boolean),W-M,21,{align:'right'})
  let y=44
  const room=n=>{if(y+n>H-18){doc.addPage();y=20}}
  const head=t=>{if(!t)return;room(14);doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...NAVY).text(t,M,y);doc.setDrawColor(...accent).setLineWidth(.6).line(M,y+1.6,M+12,y+1.6);y+=5}
  for(const b of blocks){
    if(b.type==='boxes'){const n=b.boxes.length,gap=6,bw=(W-2*M-gap*(n-1))/n,bh=8+Math.max(...b.boxes.map(x=>x.rows.length))*5.5+3;room(bh+4)
      b.boxes.forEach((bx,i)=>{const bxX=M+i*(bw+gap);doc.setFillColor(...SOFT).setDrawColor(...LINE).roundedRect(bxX,y,bw,bh,2,2,'FD')
        doc.setFont('helvetica','bold').setFontSize(8).setTextColor(...accent).text(bx.title,bxX+4,y+6)
        bx.rows.forEach(([k,v],j)=>{doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(...MUTED).text(k,bxX+4,y+12+j*5.5)
          doc.setFont('helvetica','bold').setTextColor(...NAVY).text(String(v??'-'),bxX+(b.keyWidth||32),y+12+j*5.5,{maxWidth:bw-(b.keyWidth||32)-4})})})
      y+=bh+8}
    else if(b.type==='stats'){const n=b.items.length,gap=4,bw=(W-2*M-gap*(n-1))/n;room(22)
      b.items.forEach(([l,v,tone],i)=>{const sx=M+i*(bw+gap);doc.setFillColor(...(tone==='blood'?[253,236,239]:SOFT)).setDrawColor(...LINE).roundedRect(sx,y,bw,18,2,2,'FD')
        doc.setFont('helvetica','bold').setFontSize(14).setTextColor(...(tone==='blood'?BLOOD:NAVY)).text(String(v),sx+bw/2,y+9,{align:'center'})
        doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...MUTED).text(l,sx+bw/2,y+14.5,{align:'center'})});y+=26}
    else if(b.type==='table'){head(b.heading)
      if(!b.rows.length){doc.setFont('helvetica','italic').setFontSize(9).setTextColor(...MUTED).text(b.empty||'Nothing recorded.',M,y+4);y+=12;continue}
      autoTable(doc,{startY:y,margin:{left:M,right:M,top:20,bottom:18},head:[b.columns],body:b.rows,theme:'grid',
        styles:{font:'helvetica',fontSize:8.5,cellPadding:2.2,lineColor:LINE,lineWidth:.2,textColor:INK,overflow:'linebreak'},
        headStyles:{fillColor:NAVY,textColor:255,fontStyle:'bold',fontSize:8.3},alternateRowStyles:{fillColor:SOFT},
        footStyles:{fillColor:[255,255,255],textColor:NAVY,fontStyle:'bold'},...(b.opts||{})});y=doc.lastAutoTable.finalY+9}
    else if(b.type==='text'){if(!b.text)continue;head(b.heading);doc.setFont('helvetica','normal').setFontSize(9.5).setTextColor(...INK)
      for(const line of doc.splitTextToSize(String(b.text),W-2*M)){room(6);doc.text(line,M,y+3);y+=4.8}y+=6}
    else if(b.type==='signatures'){room(30);y+=14;const n=b.items.length,sw=55,step=n>1?(W-2*M-sw)/(n-1):0
      b.items.forEach(([nm,t],i)=>{const sx=M+i*step;doc.setDrawColor(...NAVY).setLineWidth(.3).line(sx,y,sx+sw,y)
        doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...NAVY).text(nm||'',sx,y+5);doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...MUTED).text(t||'',sx,y+9.5)});y+=16}
  }
  const pages=doc.getNumberOfPages()
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(...LINE).line(M,H-12,W-M,H-12)
    doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...MUTED).text(`${club}  |  ${footer||title}  |  Computer-generated document`,M,H-7.5)
    doc.text(`Page ${i} of ${pages}`,W-M,H-7.5,{align:'right'})}
  doc.setProperties({title,creator:club})
  if(save)doc.save(filename||`${title.replace(/\W+/g,'-').toLowerCase()}.pdf`)
  return doc
}

// Letter of gratitude to the family of an eye or body donor (A4, framed).
export async function gratitudeLetter(c,brand={},fmt){
  const {jsPDF}=await import('jspdf')
  const doc=new jsPDF({unit:'mm',format:'a4'}),W=210,H=297,M=18,accent=hexRgb(brand.brand_color)
  const club=brand.club_name||'Sankari Rotaract Club',logo=await imageData(brand.logo_url)
  doc.setDrawColor(...NAVY).setLineWidth(1.2).rect(8,8,W-16,H-16);doc.setDrawColor(...accent).setLineWidth(.4).rect(11,11,W-22,H-22)
  doc.setFillColor(...NAVY).rect(11,11,W-22,30,'F')
  let x=M+2;if(logo){try{doc.setFillColor(255,255,255).roundedRect(M,15,22,22,3,3,'F');doc.addImage(logo,M+1.5,16.5,19,19);x=M+27}catch{}}
  doc.setFont('helvetica','bold').setFontSize(17).setTextColor(255,255,255).text(club,x,25)
  doc.setFont('helvetica','normal').setFontSize(9).setTextColor(190,202,224).text([brand.address,brand.reg_no&&('Reg. no. '+brand.reg_no)].filter(Boolean),x,31)
  doc.setFontSize(9).setTextColor(...MUTED).text(`Ref: ${pad('ED',c.case_no,4)}`,M,54);doc.text(`Date: ${fmt(new Date())}`,W-M,54,{align:'right'})
  const kinds=(c.kinds||[]).map(k=>({eye:'eyes',body:'body',organ:'organs',skin:'skin'}[k])).join(', ')
  doc.setFont('times','bolditalic').setFontSize(26).setTextColor(...BLOOD).text('With gratitude',W/2,78,{align:'center'})
  doc.setFont('times','normal').setFontSize(13).setTextColor(...INK).text('in loving memory of',W/2,88,{align:'center'})
  doc.setFont('times','bold').setFontSize(24).setTextColor(...NAVY).text(c.deceased_name,W/2,102,{align:'center'})
  doc.setFont('helvetica','normal').setFontSize(9.5).setTextColor(...MUTED).text([c.age?`Aged ${c.age}`:'',c.area||'',`Passed away on ${fmt(c.died_on)}`].filter(Boolean).join('   |   '),W/2,110,{align:'center'})
  doc.setDrawColor(...accent).setLineWidth(.5).line(W/2-20,116,W/2+20,116)
  const body=`Dear ${c.family_contact}${c.family_relation?` (${c.family_relation})`:''},\n\nOn behalf of every member of ${club}, we offer our heartfelt condolences to you and your family.\n\nIn your time of grief, your family chose to donate the ${kinds||'eyes'} of ${c.deceased_name}${c.institution?` to ${c.institution}`:''}. ${(c.kinds||[]).includes('eye')?`This noble gift can restore sight to ${c.corneas===1?'one person':'two people'} who live in darkness today. `:''}${(c.kinds||[]).includes('body')?'The gift of the body will help train the doctors who will care for thousands of patients in the years ahead. ':''}\n\nThis act of kindness lets ${c.deceased_name.split(' ')[0]} live on in the lives of others. We are honoured to have been a part of it and we will always remember your family's generosity.\n\nWith deep respect and gratitude,`
  doc.setFont('times','normal').setFontSize(12.5).setTextColor(...INK)
  let y=130;for(const line of doc.splitTextToSize(body,W-2*M-8)){doc.text(line,M+4,y);y+=6.4}
  y=Math.max(y+26,236)
  const sig=(sx,n,t)=>{doc.setDrawColor(...NAVY).setLineWidth(.3).line(sx,y,sx+60,y);doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...NAVY).text(n||'',sx,y+5.5);doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(...MUTED).text(t,sx,y+10)}
  sig(M+4,brand.signatory_name,brand.signatory_title||'President');sig(W-M-64,brand.signatory2_name,brand.signatory2_title||'Secretary')
  doc.setFont('helvetica','italic').setFontSize(8.5).setTextColor(...MUTED).text('"Donate your eyes, let someone see the world after you."',W/2,H-20,{align:'center'})
  doc.setProperties({title:`Letter of gratitude ${pad('ED',c.case_no,4)}`,creator:club})
  doc.save(`gratitude-${pad('ED',c.case_no,4)}.pdf`)
}
