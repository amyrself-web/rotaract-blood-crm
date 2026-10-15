import {BLOOD,normPhone} from './util.js'
export const FIELDS=[['full_name','Name',true],['phone','Mobile number',true],['blood_group','Blood group'],['gender','Gender'],['dob','Date of birth'],['area','Area'],['last_donation','Last donation date'],['email','Email']]
export const HINTS={full_name:/name/i,phone:/phone|mobile|contact|cell/i,blood_group:/blood|group/i,gender:/gender|sex/i,dob:/dob|birth/i,area:/area|place|town|city|village|address/i,last_donation:/last|donat/i,email:/mail/i}
export const bg=v=>{if(v==null)return null;const s=String(v).toUpperCase().replace(/POSITIVE|POS|\+VE/g,'+').replace(/NEGATIVE|NEG|-VE/g,'-').replace(/[^ABO+\-]/g,'');return BLOOD.includes(s)?s:null}
export const gender=v=>{const s=String(v??'').trim().toLowerCase();return !s?null:s[0]==='m'?'Male':s[0]==='f'?'Female':'Other'}
export const iso=v=>{if(v==null||v==='')return null;let d=null
  if(v instanceof Date)d=new Date(v.getTime()+12*36e5)
  else{const s=String(v).trim(),m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
    if(m){let y=+m[3];if(y<100)y+=y>30?1900:2000;d=new Date(Date.UTC(y,+m[2]-1,+m[1]));if(d.getUTCDate()!==+m[1]||d.getUTCMonth()!==+m[2]-1)d=null}
    else if(/^\d{4}-\d{2}-\d{2}/.test(s))d=new Date(s.slice(0,10)+'T00:00:00Z')}
  return d&&!isNaN(d)&&d.getUTCFullYear()>1930&&d<=new Date()?d.toISOString().slice(0,10):null}
export const clean=(rows,map,existing)=>{const seen=new Set(),ok=[],bad=[]
  rows.slice(1).forEach((r,i)=>{if(!r||r.every(c=>c==null||c===''))return
    const get=k=>map[k]===''||map[k]==null?null:r[map[k]]
    const name=String(get('full_name')??'').trim(),phone=normPhone(get('phone'))
    const why=!name?'Missing name':!/^[6-9]\d{9}$/.test(phone)?'Invalid mobile number':existing.has(phone)?'Already in CRM':seen.has(phone)?'Duplicate in file':null
    if(why){bad.push({row:i+2,name,mobile:String(get('phone')??''),reason:why});return}
    seen.add(phone)
    ok.push({full_name:name,phone,blood_group:bg(get('blood_group')),gender:gender(get('gender')),dob:iso(get('dob')),area:String(get('area')??'').trim()||null,last_donation:iso(get('last_donation')),email:String(get('email')??'').trim()||null,consent:false})})
  return {ok,bad}}
