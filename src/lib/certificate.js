import QRCode from 'qrcode'

// Certificate is designed in HTML (so any language and the club logo render properly), then turned into an A4 landscape PDF.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const certNo=n=>n==null?'':`CRT-${String(n).padStart(6,'0')}`
export const fmtCode=c=>c&&c.length===12?c.match(/.{4}/g).join('-'):c||''
export const verifyUrl=c=>`${location.origin}${location.pathname}#/verify/${encodeURIComponent(c)}`

const DROP='M50 6C50 6 18 46 18 66a32 32 0 0 0 64 0C82 46 50 6 50 6z'
function seal(){
  const text='VOLUNTARY BLOOD DONOR  ·  GIFT OF LIFE  ·'
  return `<svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="sc" d="M75 75 m-55 0 a55 55 0 1 1 110 0 a55 55 0 1 1 -110 0"/></defs>
    <circle cx="75" cy="75" r="72" fill="#B4233A"/><circle cx="75" cy="75" r="66" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 3"/>
    <circle cx="75" cy="75" r="44" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".6"/>
    <text font-family="Sora, sans-serif" font-size="10.5" font-weight="600" letter-spacing="2.2" fill="#fff"><textPath href="#sc" textLength="338" lengthAdjust="spacing">${text}</textPath></text>
    <g transform="translate(51 46) scale(.48)"><path d="${DROP}" fill="#fff"/></g></svg>`
}
function pattern(){
  let c='';for(let i=0;i<14;i++)c+=`<circle cx="0" cy="0" r="${40+i*26}" fill="none" stroke="#0B1324" stroke-opacity=".045" stroke-width="1"/>`
  return `<svg width="1123" height="794" style="position:absolute;inset:0" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(1123 794)">${c}</g><g transform="translate(0 0)">${c}</g>
    <path d="${DROP}" transform="translate(830 330) scale(3.4)" fill="#F0435A" fill-opacity=".035"/></svg>`
}

export async function makeCertificate({name,camp,date,venue,bloodGroup,volume,certificate,verifyCode,donorNo,brand={}}){
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')])
  const check=verifyCode||certificate,qr=await QRCode.toDataURL(verifyUrl(fmtCode(check)),{margin:0,width:260,color:{dark:'#0B1324',light:'#ffffff'}})
  const accent=brand.brand_color||'#4C8DFF'
  const club=brand.club_name||'Sankari Rotaract Club'
  const logo=brand.logo_url?`<img src="${esc(brand.logo_url)}" crossorigin="anonymous" style="width:74px;height:74px;object-fit:contain;border-radius:16px;background:#fff;padding:6px;box-shadow:0 4px 14px rgba(11,19,36,.12)"/>`
    :`<svg width="64" height="64" viewBox="0 0 100 100"><path d="${DROP}" fill="#E11D48"/><path d="M38 64a12 12 0 0 0 12 12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/></svg>`
  const sign=(n,t)=>n||t?`<div style="text-align:center;width:210px"><div style="height:44px"></div><div style="border-top:1.5px solid #0B1324;padding-top:8px;font:600 15px Sora,sans-serif;color:#0B1324">${esc(n||'')}</div>
    <div style="font:500 12px Manrope,sans-serif;color:#5D6E8F;margin-top:2px">${esc(t||'')}</div></div>`:''
  const chip=(l,v)=>v?`<div style="padding:10px 18px;border-left:1px solid #E3E8F1"><div style="font:500 11px Manrope,sans-serif;color:#5D6E8F;letter-spacing:.3px">${l}</div><div style="font:700 15px Sora,sans-serif;color:#0B1324;margin-top:3px">${esc(v)}</div></div>`:''
  const el=document.createElement('div')
  el.style.cssText='position:fixed;left:-12000px;top:0;width:1123px;height:794px;background:#fff;overflow:hidden'
  el.innerHTML=`
  <div style="position:absolute;inset:0;background:linear-gradient(135deg,#ffffff 0%,#FBFCFF 55%,#FFF4F6 100%)"></div>
  ${pattern()}
  <div style="position:absolute;inset:0;width:150px;background:linear-gradient(180deg,#0B1324 0%,#16233F 100%)"></div>
  <div style="position:absolute;left:150px;top:0;bottom:0;width:7px;background:linear-gradient(180deg,#F0435A,#B4233A)"></div>
  <svg style="position:absolute;left:0;top:0" width="150" height="794" xmlns="http://www.w3.org/2000/svg">
    <text transform="translate(82 730) rotate(-90)" font-family="Sora, sans-serif" font-size="15" font-weight="700" letter-spacing="6" fill="#ffffff" fill-opacity=".92">CERTIFICATE OF APPRECIATION</text>
    <rect x="52" y="190" width="46" height="3" rx="1.5" fill="${accent}"/>
    <text transform="translate(82 150) rotate(-90)" font-family="Manrope, sans-serif" font-size="12" font-weight="600" letter-spacing="3" fill="#9DB0D3" text-anchor="middle">${esc(certificate)}</text></svg>
  <div style="position:absolute;inset:26px 26px 26px 183px;border:1.5px solid #0B1324;border-radius:6px;opacity:.85"></div>
  <div style="position:absolute;inset:32px 32px 32px 189px;border:1px solid ${accent};border-radius:4px;opacity:.55"></div>
  <div style="position:absolute;left:215px;right:60px;top:62px;bottom:56px;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:18px">${logo}
      <div><div style="font:700 24px Sora,sans-serif;color:#0B1324;letter-spacing:-.3px">${esc(club)}</div>
        <div style="font:500 13px Manrope,sans-serif;color:#5D6E8F;margin-top:3px">${esc([brand.address,brand.reg_no&&('Reg. '+brand.reg_no)].filter(Boolean).join(' · ')||'Blood donation camp')}</div></div></div>
    <div style="margin-top:42px;font:600 13px Manrope,sans-serif;letter-spacing:4px;color:#B4233A">CERTIFICATE OF APPRECIATION</div>
    <div style="font:700 44px Sora,sans-serif;color:#0B1324;letter-spacing:-1px;margin-top:6px;line-height:1.05">Thank you for giving blood</div>
    <div style="font:500 16px Manrope,sans-serif;color:#45546F;margin-top:22px">This certificate is proudly presented to</div>
    <div style="font:italic 600 62px 'Cormorant Garamond',Georgia,serif;color:#B4233A;margin-top:2px;line-height:1.1;max-width:640px">${esc(name)}</div>
    <div style="font:500 16px/1.6 Manrope,sans-serif;color:#45546F;margin-top:12px;max-width:640px">for voluntarily donating blood at <b style="color:#0B1324">${esc(camp)}</b>. Your gift can save up to three lives.</div>
    <div style="display:flex;margin-top:26px;border:1px solid #E3E8F1;border-radius:12px;background:#fff;width:max-content">
      ${bloodGroup?`<div style="padding:10px 18px"><div style="font:500 11px Manrope,sans-serif;color:#5D6E8F">Blood group</div><div style="font:700 22px Sora,sans-serif;color:#E11D48;margin-top:1px">${esc(bloodGroup)}</div></div>`:''}
      ${chip('Date',date).replace(bloodGroup?'':'border-left:1px solid #E3E8F1','')}${chip('Venue',venue)}${chip('Volume',volume?volume+' ml':'')}${chip('Donor ID',donorNo)}</div>
    <div style="margin-top:auto;display:flex;align-items:flex-end;gap:38px">
      ${sign(brand.signatory_name,brand.signatory_title||'President')}${sign(brand.signatory2_name,brand.signatory2_name?brand.signatory2_title||'Secretary':'')}
      <div style="flex:1"></div>
      <div style="text-align:center"><img src="${qr}" style="width:96px;height:96px"/><div style="font:600 10.5px Manrope,sans-serif;color:#5D6E8F;margin-top:6px">Scan to verify</div><div style="font:700 10.5px 'Courier New',monospace;color:#0B1324;margin-top:2px;letter-spacing:.5px">${esc(fmtCode(check))}</div></div></div>
  </div>
  <div style="position:absolute;right:66px;top:150px">${seal()}</div>`
  document.body.appendChild(el)
  try{
    await Promise.all([...el.querySelectorAll('img')].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})))
    await document.fonts?.ready
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,width:1123,height:794,windowWidth:1123,windowHeight:794})
    const pdf=new jsPDF({orientation:'landscape',unit:'px',format:[1123,794],hotfixes:['px_scaling']})
    pdf.addImage(canvas.toDataURL('image/jpeg',.93),'JPEG',0,0,1123,794)
    pdf.setProperties({title:`Certificate ${certificate}`,subject:`Blood donation certificate for ${name}`,creator:club})
    pdf.save(`certificate-${certificate}.pdf`)
  }finally{el.remove()}
}
