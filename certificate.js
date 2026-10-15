import QRCode from 'qrcode'
export async function makeCertificate({name,camp,date,code}){
  const {jsPDF}=await import('jspdf')
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),W=297,H=210
  const safe=/[^\x00-\xFF]/.test(name)?'Blood Donor':name  // standard PDF fonts cannot print Tamil
  const t=(s,y,size,bold,rgb=[11,18,32])=>{doc.setFont('helvetica',bold?'bold':'normal').setFontSize(size).setTextColor(...rgb);doc.text(s,W/2,y,{align:'center'})}
  doc.setDrawColor(11,18,32).setLineWidth(2.2).rect(8,8,W-16,H-16)
  doc.setDrawColor(225,29,72).setLineWidth(.6).rect(13,13,W-26,H-26)
  t('SANKARI ROTARACT CLUB',38,14,true,[225,29,72])
  t('Certificate of Appreciation',62,34,true)
  t('This certificate is proudly presented to',82,14,false,[90,100,120])
  t(safe,104,30,true,[30,58,138])
  doc.setDrawColor(30,58,138).setLineWidth(.4).line(W/2-70,109,W/2+70,109)
  t('for voluntarily donating blood at',124,14,false,[90,100,120])
  t(camp,137,20,true)
  t(date,149,14,false)
  t('Thank you for your gift of life.',168,13,false,[90,100,120])
  doc.setFont('helvetica','normal').setFontSize(9).setTextColor(90,100,120).text('Certificate no. '+code,22,H-20)
  const url=`${location.origin}${location.pathname}#/verify/${code}`
  doc.addImage(await QRCode.toDataURL(url,{margin:0,width:300}),'PNG',W-46,H-48,24,24)
  doc.text('Scan to verify',W-34,H-20,{align:'center'})
  doc.save(`certificate-${code}.pdf`)
}
