// Shared A4 letterhead for every PDF in the CRM: club letterhead at the top, a title block with reference details,
// clean tables, signatures, and a footer band on every page. Uses the Manrope font (same as the app).
import regUrl from '../assets/fonts/Manrope_400Regular.ttf?url'
import semiUrl from '../assets/fonts/Manrope_600SemiBold.ttf?url'
import boldUrl from '../assets/fonts/Manrope_800ExtraBold.ttf?url'

const hexRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return [76,141,255];const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255]}
export const NAVY=[11,19,36],INK=[40,50,68],MUTED=[108,121,145],LINE=[226,231,240],BLOOD=[200,30,58],SOFT=[247,249,252],GREEN=[22,130,80]
export const rs=n=>'Rs. '+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})
export const pad=(p,n,w=3)=>n==null?'':`${p}-${String(n).padStart(w,'0')}`
export async function imageData(url){
  if(!url)return null
  try{const b=await (await fetch(url,{mode:'cors'})).blob()
    return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=()=>res(null);f.readAsDataURL(b)})}catch{return null}
}

let fontCache
const b64=buf=>{let s='';const a=new Uint8Array(buf);for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s)}
export async function useFonts(doc){
  try{fontCache??=Promise.all([regUrl,semiUrl,boldUrl].map(u=>fetch(u).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(b64)))
    const [r,s,b]=await fontCache
    doc.addFileToVFS('Manrope-R.ttf',r);doc.addFont('Manrope-R.ttf','Manrope','normal')
    doc.addFileToVFS('Manrope-S.ttf',s);doc.addFont('Manrope-S.ttf','Manrope','semibold')
    doc.addFileToVFS('Manrope-B.ttf',b);doc.addFont('Manrope-B.ttf','Manrope','bold')
    return 'Manrope'}catch{fontCache=null;return 'helvetica'}
}
// a small blood-drop mark, drawn once on a canvas, used when the club has not uploaded a logo
let dropMark
function drop(color){
  if(dropMark)return dropMark
  try{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d')
    const g=x.createLinearGradient(0,0,160,160);g.addColorStop(0,'#F0435A');g.addColorStop(1,'#B4233A');x.fillStyle=g
    x.beginPath();x.roundRect?x.roundRect(0,0,160,160,36):x.rect(0,0,160,160);x.fill()
    x.fillStyle='#fff';x.translate(80,84);x.scale(1.05,1.05);x.fill(new Path2D('M0 -46C0 -46 -30 -8 -30 12a30 30 0 0 0 60 0C30 -8 0 -46 0 -46z'))
    return dropMark=c.toDataURL('image/png')}catch{return null}
}

// Draws the letterhead (first page) and returns the y where content starts.
export async function letterhead(doc,{brand={},label,heading,subtitle,meta=[],W,F}){
  const M=16,accent=hexRgb(brand.brand_color),club=brand.club_name||'Sankari Rotaract Club'
  const logo=(await imageData(brand.logo_url))||drop()
  if(logo){try{doc.addImage(logo,M,12,17,17)}catch{}}
  const x=M+21
  doc.setFont(F,'bold').setFontSize(15).setTextColor(...NAVY).text(club,x,19)
  doc.setFont(F,'normal').setFontSize(8).setTextColor(...MUTED)
  doc.text([brand.address||'Rotaract Club · Blood donation and community service',brand.reg_no?`Reg. no. ${brand.reg_no}`:''].filter(Boolean),x,24)
  const contact=[brand.contact_phone&&['Phone',brand.contact_phone],brand.contact_email&&['Email',brand.contact_email]].filter(Boolean)
  contact.forEach(([k,v],i)=>{doc.setFont(F,'semibold').setFontSize(7).setTextColor(...accent).text(k.toUpperCase(),W-M,16+i*7.5,{align:'right'})
    doc.setFont(F,'normal').setFontSize(8.5).setTextColor(...INK).text(v,W-M,19.6+i*7.5,{align:'right'})})
  // two-tone rule under the letterhead
  doc.setDrawColor(...LINE).setLineWidth(.3).line(M,34,W-M,34)
  doc.setFillColor(...BLOOD).rect(M,33.2,26,1.6,'F');doc.setFillColor(...accent).rect(M+26,33.2,10,1.6,'F')
  // title block
  let y=45
  doc.setFont(F,'bold').setFontSize(7.5).setTextColor(...BLOOD).text(String(label||'').toUpperCase(),M,y,{charSpace:.9})
  const metaW=meta.length?62:0
  doc.setFont(F,'bold').setFontSize(19).setTextColor(...NAVY)
  const lines=doc.splitTextToSize(String(heading||label||''),W-2*M-metaW-6).slice(0,2);doc.text(lines,M,y+8.5)
  let ty=y+8.5+(lines.length-1)*7.5
  if(subtitle){doc.setFont(F,'normal').setFontSize(9.5).setTextColor(...MUTED).text(doc.splitTextToSize(subtitle,W-2*M-metaW-6).slice(0,2),M,ty+6);ty+=6}
  if(meta.length){const bx=W-M-metaW,bh=5+meta.length*6.2
    doc.setFillColor(...SOFT).setDrawColor(...LINE).setLineWidth(.2).roundedRect(bx,y-4,metaW,bh,1.5,1.5,'FD');doc.setFillColor(...accent).rect(bx,y-4,1.1,bh,'F')
    meta.forEach(([k,v],i)=>{doc.setFont(F,'normal').setFontSize(7.5).setTextColor(...MUTED).text(k,bx+4,y+1.6+i*6.2)
      doc.setFont(F,'semibold').setFontSize(8.5).setTextColor(...NAVY).text(String(v??'-'),W-M-3,y+1.6+i*6.2,{align:'right',maxWidth:metaW-26})})
    ty=Math.max(ty,y-4+bh-2)}
  return ty+11
}
function runningHeader(doc,{brand,label,W,F}){
  const M=16;doc.setFont(F,'bold').setFontSize(9).setTextColor(...NAVY).text(brand.club_name||'Sankari Rotaract Club',M,13)
  doc.setFont(F,'normal').setFontSize(8).setTextColor(...MUTED).text(String(label||''),W-M,13,{align:'right'})
  doc.setDrawColor(...LINE).setLineWidth(.3).line(M,16,W-M,16);doc.setFillColor(...BLOOD).rect(M,15.5,12,1,'F')
}
export function footers(doc,{brand={},label,W,H,F,first=true}){
  const M=16,pages=doc.getNumberOfPages(),accent=hexRgb(brand.brand_color),club=brand.club_name||'Sankari Rotaract Club'
  const stamp=new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  for(let i=1;i<=pages;i++){doc.setPage(i)
    if(i>1||!first)runningHeader(doc,{brand,label,W,F})
    doc.setDrawColor(...LINE).setLineWidth(.3).line(M,H-15,W-M,H-15)
    doc.setFont(F,'semibold').setFontSize(7.5).setTextColor(...NAVY).text(club,M,H-10.5)
    doc.setFont(F,'normal').setFontSize(7).setTextColor(...MUTED).text([brand.contact_phone,brand.contact_email].filter(Boolean).join('   ·   ')||'Computer-generated document',M+doc.getTextWidth(club)+4,H-10.5)
    doc.text(`Generated ${stamp}`,W/2+30,H-10.5,{align:'center'})
    doc.setFont(F,'semibold').setFontSize(7.5).setTextColor(...NAVY).text(`Page ${i} of ${pages}`,W-M,H-10.5,{align:'right'})
    // bottom band
    doc.setFillColor(...NAVY).rect(0,H-4,W*.72,4,'F');doc.setFillColor(...BLOOD).rect(W*.72,H-4,W*.2,4,'F');doc.setFillColor(...accent).rect(W*.92,H-4,W*.08,4,'F')}
}

/* blocks: {type:'boxes',boxes:[{title,rows:[[k,v]]}]} | {type:'table',heading,columns,rows,opts,empty} | {type:'text',heading,text}
           | {type:'stats',items:[[label,value,tone]]} | {type:'totals',rows:[[k,v]],final:[k,v],negative} | {type:'signatures',items:[[name,title]]} */
export async function buildPdf({title,heading,subtitle,docNo,meta,prepared,brand={},blocks=[],filename,footer,landscape=false,save=true}){
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')])
  const doc=new jsPDF({unit:'mm',format:'a4',orientation:landscape?'landscape':'portrait'})
  const F=await useFonts(doc),W=landscape?297:210,H=landscape?210:297,M=16,accent=hexRgb(brand.brand_color)
  const today=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  let y=await letterhead(doc,{brand,label:title,heading:heading||title,subtitle,W,F,
    meta:meta||[docNo&&['Ref. no.',docNo],['Date',today],prepared&&['Prepared by',prepared]].filter(Boolean)})
  const room=n=>{if(y+n>H-22){doc.addPage();y=26}}
  const head=t=>{if(!t)return;room(16);doc.setFillColor(...accent).roundedRect(M,y-3.2,2.2,4.2,.6,.6,'F')
    doc.setFont(F,'bold').setFontSize(10.5).setTextColor(...NAVY).text(t,M+4.5,y);y+=5}
  for(const b of blocks){
    if(b.type==='boxes'){const n=b.boxes.length,gap=5,bw=(W-2*M-gap*(n-1))/n,bh=9+Math.max(...b.boxes.map(x=>x.rows.length))*5.6+2;room(bh+4)
      b.boxes.forEach((bx,i)=>{const X=M+i*(bw+gap);doc.setFillColor(...SOFT).setDrawColor(...LINE).setLineWidth(.2).roundedRect(X,y,bw,bh,2,2,'FD')
        doc.setFont(F,'bold').setFontSize(7).setTextColor(...accent).text(bx.title.toUpperCase(),X+4.5,y+6,{charSpace:.6})
        bx.rows.forEach(([k,v],j)=>{doc.setFont(F,'normal').setFontSize(8.3).setTextColor(...MUTED).text(k,X+4.5,y+12.5+j*5.6)
          doc.setFont(F,'semibold').setTextColor(...NAVY).text(String(v??'-'),X+(b.keyWidth||31),y+12.5+j*5.6,{maxWidth:bw-(b.keyWidth||31)-4})})})
      y+=bh+8}
    else if(b.type==='stats'){const n=b.items.length,gap=4,bw=(W-2*M-gap*(n-1))/n;room(24)
      b.items.forEach(([l,v,tone],i)=>{const X=M+i*(bw+gap),c=tone==='blood'?BLOOD:NAVY
        doc.setFillColor(255,255,255).setDrawColor(...LINE).setLineWidth(.25).roundedRect(X,y,bw,19,2,2,'FD');doc.setFillColor(...(tone==='blood'?BLOOD:accent)).rect(X+4,y,10,.9,'F')
        doc.setFont(F,'bold').setFontSize(14).setTextColor(...c).text(String(v),X+4,y+10)
        doc.setFont(F,'normal').setFontSize(7).setTextColor(...MUTED).text(String(l),X+4,y+15.3,{maxWidth:bw-6})});y+=27}
    else if(b.type==='table'){head(b.heading)
      if(!b.rows.length){doc.setFont(F,'normal').setFontSize(9).setTextColor(...MUTED).text(b.empty||'Nothing recorded.',M,y+4);y+=12;continue}
      autoTable(doc,{startY:y,margin:{left:M,right:M,top:24,bottom:22},head:[b.columns.map(c=>String(c).toUpperCase())],body:b.rows,theme:'plain',
        styles:{font:F,fontSize:8.4,cellPadding:{top:2.3,bottom:2.3,left:2.2,right:2.2},textColor:INK,overflow:'linebreak',lineColor:LINE,lineWidth:{bottom:.15}},
        headStyles:{font:F,fontStyle:'bold',fontSize:6.8,textColor:MUTED,fillColor:SOFT,lineColor:NAVY,lineWidth:{bottom:.45},cellPadding:{top:2.6,bottom:2.6,left:2.2,right:2.2}},
        footStyles:{font:F,fontStyle:'bold',fontSize:8.8,textColor:NAVY,fillColor:[255,255,255],lineColor:NAVY,lineWidth:{top:.45}},
        ...(b.opts||{}),didParseCell:d=>{const cs=(b.opts?.columnStyles||{})[d.column.index];if(d.section!=='body'&&cs?.halign)d.cell.styles.halign=cs.halign}});y=doc.lastAutoTable.finalY+9}
    else if(b.type==='text'){if(!b.text)continue;head(b.heading);doc.setFont(F,'normal').setFontSize(9.4).setTextColor(...INK)
      for(const line of doc.splitTextToSize(String(b.text),W-2*M)){room(6);doc.text(line,M,y+3);y+=4.9}y+=6}
    else if(b.type==='totals'){const bw=82,X=W-M-bw,rows=b.rows||[],bh=6+rows.length*5.8+10;room(bh+4)
      if(b.side){doc.setFont(F,'normal').setFontSize(8.5).setTextColor(...MUTED).text(b.side,M,y+5)}
      doc.setFillColor(...SOFT).setDrawColor(...LINE).setLineWidth(.2).roundedRect(X,y,bw,bh,2,2,'FD')
      rows.forEach(([k,v],i)=>{doc.setFont(F,'normal').setFontSize(8.5).setTextColor(...MUTED).text(k,X+4.5,y+6.5+i*5.8);doc.setFont(F,'semibold').setTextColor(...NAVY).text(v,X+bw-4.5,y+6.5+i*5.8,{align:'right'})})
      doc.setFillColor(...(b.negative?BLOOD:NAVY)).roundedRect(X,y+bh-10,bw,10,2,2,'F');doc.rect(X,y+bh-10,bw,3,'F')
      doc.setFont(F,'bold').setFontSize(10).setTextColor(255,255,255).text(b.final[0],X+4.5,y+bh-3.6);doc.text(b.final[1],X+bw-4.5,y+bh-3.6,{align:'right'});y+=bh+9}
    else if(b.type==='signatures'){if(y+30>H-17){doc.addPage();y=30}else y+=Math.min(16,Math.max(8,H-17-30-y));const n=b.items.length,sw=54,step=n>1?(W-2*M-sw)/(n-1):0
      b.items.forEach(([nm,t],i)=>{const X=M+i*step;doc.setDrawColor(...NAVY).setLineWidth(.3).line(X,y,X+sw,y)
        doc.setFont(F,'bold').setFontSize(9).setTextColor(...NAVY).text(nm||'',X,y+5);doc.setFont(F,'normal').setFontSize(7.8).setTextColor(...MUTED).text(t||'',X,y+9.5)});y+=16}
  }
  footers(doc,{brand,label:footer||title,W,H,F})
  doc.setProperties({title:heading||title,creator:brand.club_name||'Sankari Rotaract Club'})
  if(save)doc.save(filename||`${title.replace(/\W+/g,'-').toLowerCase()}.pdf`)
  return doc
}

// Letter of gratitude to the family of an eye or body donor, on the club letterhead.
export async function gratitudeLetter(c,brand={},fmt){
  const {jsPDF}=await import('jspdf')
  const doc=new jsPDF({unit:'mm',format:'a4'}),W=210,H=297,M=16,F=await useFonts(doc)
  let y=await letterhead(doc,{brand,label:'Letter of gratitude',heading:c.deceased_name,
    subtitle:['In loving memory',c.age?`aged ${c.age}`:'',c.area||'',`Passed away on ${fmt(c.died_on)}`].filter(Boolean).join('  ·  '),W,F,meta:[['Ref. no.',pad('ED',c.case_no,4)],['Date',fmt(new Date())]]})
  const kinds=(c.kinds||[]).map(k=>({eye:'eyes',body:'body',organ:'organs',skin:'skin'}[k])).join(', ')
  doc.setFont(F,'normal').setFontSize(10).setTextColor(...INK).text([`To`,`${c.family_contact}${c.family_relation?` (${c.family_relation})`:''}`,c.address||c.area||''].filter(Boolean),M,y+2)
  y+=22
  const body=`Dear ${c.family_contact},\n\nOn behalf of every member of ${brand.club_name||'our club'}, we offer our heartfelt condolences to you and your family.\n\nIn your time of grief, your family chose to donate the ${kinds||'eyes'} of ${c.deceased_name}${c.institution?` to ${c.institution}`:''}. ${(c.kinds||[]).includes('eye')?`This noble gift can restore sight to ${c.corneas===1?'one person':'two people'} who live in darkness today. `:''}${(c.kinds||[]).includes('body')?'The gift of the body will help train the doctors who will care for thousands of patients in the years ahead. ':''}\n\nThis act of kindness lets ${c.deceased_name.split(' ')[0]} live on in the lives of others. We are honoured to have been a part of it, and we will always remember your family's generosity.\n\nWith deep respect and gratitude,`
  doc.setFont(F,'normal').setFontSize(10.5).setTextColor(...INK)
  for(const line of doc.splitTextToSize(body,W-2*M)){doc.text(line,M,y);y+=5.8}
  y=Math.max(y+26,232)
  ;[[brand.signatory_name,brand.signatory_title||'President',M],[brand.signatory2_name,brand.signatory2_title||'Secretary',W-M-58]].forEach(([n,t,x])=>{
    doc.setDrawColor(...NAVY).setLineWidth(.3).line(x,y,x+58,y);doc.setFont(F,'bold').setFontSize(9.5).setTextColor(...NAVY).text(n||'',x,y+5.5);doc.setFont(F,'normal').setFontSize(8).setTextColor(...MUTED).text(t,x,y+10)})
  doc.setFont(F,'semibold').setFontSize(8.5).setTextColor(...BLOOD).text('"Donate your eyes, let someone see the world after you."',W/2,H-24,{align:'center'})
  footers(doc,{brand,label:'Letter of gratitude',W,H,F})
  doc.setProperties({title:`Letter of gratitude ${pad('ED',c.case_no,4)}`,creator:brand.club_name||''})
  doc.save(`gratitude-${pad('ED',c.case_no,4)}.pdf`)
}
