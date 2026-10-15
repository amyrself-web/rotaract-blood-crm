export const BLOOD=['A+','A-','B+','B-','AB+','AB-','O+','O-']
export const normPhone=p=>String(p||'').replace(/\D/g,'').slice(-10)
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x}
export const nextEligible=(last,gender)=>last?addDays(last,gender==='Female'?120:90):null
export const fmt=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-'
export const wa=(phone,text)=>`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
export const slots=(s,e)=>{if(!s||!e)return[];const o=[];for(let h=+s.slice(0,2);h<+e.slice(0,2);h++)o.push(String(h).padStart(2,'0')+':00');return o}
