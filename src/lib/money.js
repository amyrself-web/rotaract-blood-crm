// "Rupees Twelve Thousand Five Hundred Only" in Indian numbering (lakh, crore)
const ONE=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const TEN=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
const two=n=>n<20?ONE[n]:TEN[Math.floor(n/10)]+(n%10?' '+ONE[n%10]:'')
const three=n=>(n>=100?ONE[Math.floor(n/100)]+' Hundred'+(n%100?' and ':''):'')+(n%100?two(n%100):'')
export function inWords(amount){
  const a=Math.round(Number(amount||0)*100),r=Math.floor(a/100),p=a%100
  if(!r&&!p)return 'Rupees Zero Only'
  const parts=[];let n=r
  const cr=Math.floor(n/1e7);n%=1e7;const lk=Math.floor(n/1e5);n%=1e5;const th=Math.floor(n/1e3);n%=1e3
  if(cr)parts.push((cr>=100?inWords(cr).replace(/^Rupees |\sOnly$/g,''):two(cr))+' Crore');if(lk)parts.push(two(lk)+' Lakh');if(th)parts.push(two(th)+' Thousand');if(n)parts.push(three(n))
  return `Rupees ${parts.join(' ')||'Zero'}${p?` and ${two(p)} Paise`:''} Only`
}
