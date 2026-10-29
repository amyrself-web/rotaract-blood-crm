// Token slips for camp day: one 80 mm slip per person for a thermal printer, or many on one A4 sheet to cut.
// items: [{token, name, line}]   ('line' is a short detail: blood group, age, slot ...)
import {useFonts,withBrand,logoImage,placeLogo,watermarkImages,drawWatermark,NAVY,MUTED,INK,LINE,BLOOD} from './docpdf'
import {fmt} from './util'
import {typeName} from './campTypes'

export const tokenCode=n=>n==null?'-':`T-${String(n).padStart(3,'0')}`
const pref=()=>{try{return JSON.parse(localStorage.getItem('token-print')||'{}')}catch{return {}}}
export const tokenPrefs=()=>({auto:false,size:'80mm',...pref()})
export const setTokenPrefs=p=>{try{localStorage.setItem('token-print',JSON.stringify({...tokenPrefs(),...p}))}catch{}}

// one slip drawn at (x,y), w wide; returns nothing
function slip(doc,F,{x,y,w,h},it,ctx){
  const {brand,camp,lg,cx=x+w/2}=ctx,pad=4
  let t=y+pad+1
  if(lg){placeLogo(doc,lg,cx-5,t-1,10);t+=11}
  doc.setFont(F,'bold').setFontSize(9.5).setTextColor(...NAVY).text(doc.splitTextToSize(brand.club_name||'Club',w-2*pad).slice(0,2),cx,t+2,{align:'center'});t+=(doc.splitTextToSize(brand.club_name||'Club',w-2*pad).length>1?9:5)
  doc.setFont(F,'normal').setFontSize(7.4).setTextColor(...MUTED)
  const campLine=doc.splitTextToSize(`${typeName(camp)} · ${camp.name}`,w-2*pad).slice(0,2);doc.text(campLine,cx,t+1.5,{align:'center'});t+=campLine.length*3.3
  doc.text([fmt(camp.camp_date),camp.venue].filter(Boolean).join(' · '),cx,t+1.5,{align:'center',maxWidth:w-2*pad});t+=4
  doc.setDrawColor(...LINE).setLineDashPattern([1,1],0).setLineWidth(.3).line(x+pad,t,x+w-pad,t).setLineDashPattern([],0);t+=5
  doc.setFont(F,'bold').setFontSize(7).setTextColor(...BLOOD).text('YOUR TOKEN',cx,t,{align:'center',charSpace:1});t+=1
  doc.setFont(F,'bold').setFontSize(h<70?30:38).setTextColor(...NAVY).text(tokenCode(it.token),cx,t+(h<70?10:13),{align:'center'});t+=h<70?14:18
  doc.setFont(F,'bold').setFontSize(11).setTextColor(...INK).text(doc.splitTextToSize(it.name||'',w-2*pad).slice(0,2),cx,t,{align:'center'});t+=doc.splitTextToSize(it.name||'',w-2*pad).slice(0,2).length*4.6
  if(it.line){doc.setFont(F,'semibold').setFontSize(8.5).setTextColor(...MUTED).text(it.line,cx,t,{align:'center',maxWidth:w-2*pad});t+=4.5}
  doc.setFont(F,'normal').setFontSize(6.8).setTextColor(...MUTED).text(['Please wait for your token to be called.',new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})],cx,Math.max(t+2,y+h-7),{align:'center'})
}

export async function tokenPdf(items,{camp,brand,size='80mm'}){
  brand=withBrand(brand)
  const {jsPDF}=await import('jspdf')
  const lg=await logoImage(brand.logo_url),wm=await watermarkImages(brand)
  let doc,F
  if(size==='a4'){
    doc=new jsPDF({unit:'mm',format:'a4'});F=await useFonts(doc)
    const cols=2,rows=4,M=10,W=210,H=297,cw=(W-2*M)/cols,ch=(H-2*M)/rows
    items.forEach((it,i)=>{const k=i%(cols*rows);if(i&&!k)doc.addPage()
      const x=M+(k%cols)*cw,y=M+Math.floor(k/cols)*ch
      doc.setDrawColor(190,198,212).setLineDashPattern([2,1.5],0).setLineWidth(.25).rect(x,y,cw,ch).setLineDashPattern([],0)
      drawWatermark(doc,wm,cw,ch,{size:Math.min(cw,ch)*.5,x0:x,y0:y,opacity:.07})
      slip(doc,F,{x:x+4,y:y+2,w:cw-8,h:ch-4},it,{brand,camp,lg})})
  }else{
    const H=96;doc=new jsPDF({unit:'mm',format:[80,H]});F=await useFonts(doc)
    items.forEach((it,i)=>{if(i)doc.addPage([80,H]);drawWatermark(doc,wm,80,H,{size:46,opacity:.07});slip(doc,F,{x:2,y:2,w:76,h:H-4},it,{brand,camp,lg})})
  }
  doc.setProperties({title:`Tokens ${camp.name}`})
  return doc
}

// prints through a hidden frame (no new tab, works right after a save), or saves the PDF if the browser cannot
export function printPdf(doc,name='tokens.pdf'){
  try{doc.autoPrint?.()}catch{}
  const url=URL.createObjectURL(doc.output('blob')),f=document.createElement('iframe')
  f.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';f.src=url;document.body.appendChild(f)
  f.onload=()=>{setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch{doc.save(name)}},250)}
  setTimeout(()=>{f.remove();URL.revokeObjectURL(url)},120000)
}
export async function printTokens(items,opts){if(!items.length)return;const doc=await tokenPdf(items,opts);printPdf(doc,`tokens-${opts.camp.name.replace(/\W+/g,'-').toLowerCase()}.pdf`);return doc}
