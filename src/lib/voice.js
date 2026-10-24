// Speech to text in the browser (Chrome, Edge, Android, Safari on iPhone). Free; nothing is stored by the club.
// listen({lang:'ta-IN'|'en-IN', onPartial, onFinal, onEnd, onError}) returns a stop() function.
const SR=typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition)
export const canListen=!!SR

export function listen({lang='en-IN',onPartial,onFinal,onEnd,onError,continuous=true}){
  if(!SR){onError?.('This browser cannot hear speech. Use Chrome or Edge.');return()=>{}}
  // one microphone at a time: starting here stops any other listener on the page
  const me=Symbol();window.dispatchEvent(new CustomEvent('crm-voice-start',{detail:me}))
  const other=e=>{if(e.detail!==me)stopNow()};window.addEventListener('crm-voice-start',other)
  const r=new SR();r.lang=lang;r.interimResults=true;r.continuous=continuous;r.maxAlternatives=1
  let stopped=false,quiet=null
  // continuous listening stops by itself after 25 s of silence
  const hush=()=>{clearTimeout(quiet);if(continuous)quiet=setTimeout(()=>stopNow(),25000)};hush()
  const stopNow=()=>{if(stopped)return;stopped=true;clearTimeout(quiet);window.removeEventListener('crm-voice-start',other);try{r.stop()}catch{}onEnd?.()}
  r.onresult=e=>{hush();let part='';for(let i=e.resultIndex;i<e.results.length;i++){const x=e.results[i];if(x.isFinal)onFinal?.(x[0].transcript.trim());else part+=x[0].transcript}
    onPartial?.(part.trim())}
  r.onerror=e=>{if(e.error==='no-speech'||e.error==='aborted')return;onError?.(e.error==='not-allowed'||e.error==='service-not-allowed'?'Allow the microphone for this site, then try again.':e.error==='network'?'Speech needs the internet. Check the connection.':'Could not hear clearly. Try again.')}
  r.onend=()=>{if(stopped)return;if(continuous){try{r.start();return}catch{}}stopped=true;clearTimeout(quiet);window.removeEventListener('crm-voice-start',other);onEnd?.()}
  try{r.start()}catch{onError?.('The microphone is busy. Try again.')}
  return stopNow
}

// Puts text into a text box the same way typing does, so the page sees the change.
export function insertText(el,text){
  if(!el||!text)return
  const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
  const set=Object.getOwnPropertyDescriptor(proto,'value').set
  const v=el.value||'',type=(el.type||'').toLowerCase()
  if(type==='tel'||el.inputMode==='numeric'||type==='number'){const d=spokenDigits(text);set.call(el,(v+d).slice(0,el.maxLength>0?el.maxLength:99))}
  else{
    let s=0,e=v.length;try{s=el.selectionStart??v.length;e=el.selectionEnd??v.length}catch{}
    const before=v.slice(0,s),after=v.slice(e),gap=before&&!/\s$/.test(before)?' ':''
    const add=gap+tidy(text,!before.trim()||/[.!?]\s*$/.test(before))
    set.call(el,before+add+after);try{el.setSelectionRange(before.length+add.length,before.length+add.length)}catch{}
  }
  el.dispatchEvent(new Event('input',{bubbles:true}))
}
// first letter of a sentence in capitals; spoken punctuation becomes marks
function tidy(t,start){
  t=t.replace(/\s*\b(full stop|period)\b/gi,'.').replace(/\s*\bcomma\b/gi,',').replace(/\s*\bquestion mark\b/gi,'?').replace(/\s*\b(new line|next line)\b\s*/gi,'\n')
     .replace(/\s*(முற்றுப்புள்ளி)\s*/g,'. ').replace(/\s*(கமா)\s*/g,', ')
  return start?t.charAt(0).toUpperCase()+t.slice(1):t
}
const NUM={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,oh:0,'பூஜ்ஜியம்':0,'ஒன்று':1,'இரண்டு':2,'மூன்று':3,'நான்கு':4,'ஐந்து':5,'ஆறு':6,'ஏழு':7,'எட்டு':8,'ஒன்பது':9}
export function spokenDigits(t){
  t=String(t).toLowerCase().replace(/double (\w+)/g,'$1 $1').replace(/triple (\w+)/g,'$1 $1 $1')
  return t.split(/[\s,-]+/).map(w=>NUM[w]??w).join('').replace(/[^\d]/g,'')
}

// ---------- understanding a spoken request ----------
// "urgent O positive blood two units at GH Salem call 98765 43210" →
// {group:'O+', units:2, hospital:'GH Salem', phone:'9876543210', urgent:true, kind:'urgent'}
const GROUPS=[[/\b(ab)\s*(\+|positive|pos|பாசிட்டிவ்|பாசிடிவ்)/i,'AB+'],[/\b(ab)\s*(-|negative|neg|நெகட்டிவ்|நெகடிவ்)/i,'AB-'],
  [/\b(a)\s*(\+|positive|pos|பாசிட்டிவ்|பாசிடிவ்)/i,'A+'],[/\b(a)\s*(-|negative|neg|நெகட்டிவ்|நெகடிவ்)/i,'A-'],
  [/\b(b|bee|be)\s*(\+|positive|pos|பாசிட்டிவ்|பாசிடிவ்)/i,'B+'],[/\b(b|bee|be)\s*(-|negative|neg|நெகட்டிவ்|நெகடிவ்)/i,'B-'],
  [/\b(o|oh|zero)\s*(\+|positive|pos|பாசிட்டிவ்|பாசிடிவ்)/i,'O+'],[/\b(o|oh|zero)\s*(-|negative|neg|நெகட்டிவ்|நெகடிவ்)/i,'O-'],
  [/ஏபி\s*(பாசிட்டிவ்|பாசிடிவ்|\+)/,'AB+'],[/ஏபி\s*(நெகட்டிவ்|நெகடிவ்|-)/,'AB-'],[/(^|\s)ஏ\s*(பாசிட்டிவ்|பாசிடிவ்|\+)/,'A+'],[/(^|\s)ஏ\s*(நெகட்டிவ்|நெகடிவ்|-)/,'A-'],
  [/பி\s*(பாசிட்டிவ்|பாசிடிவ்|\+)/,'B+'],[/பி\s*(நெகட்டிவ்|நெகடிவ்|-)/,'B-'],[/ஓ\s*(பாசிட்டிவ்|பாசிடிவ்|\+)/,'O+'],[/ஓ\s*(நெகட்டிவ்|நெகடிவ்|-)/,'O-']]
const WORDNUM={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,'ஒரு':1,'ஒன்று':1,'இரண்டு':2,'ரெண்டு':2,'மூன்று':3,'மூணு':3,'நான்கு':4,'நாலு':4,'ஐந்து':5,'அஞ்சு':5}
export function understand(text){
  const t=` ${String(text||'').replace(/\s+/g,' ').trim()} `,low=t.toLowerCase(),out={text:t.trim()}
  for(const [re,g] of GROUPS)if(re.test(t)){out.group=g;break}
  const ph=spokenDigits(low.replace(/[^\d\s]/g,' ').trim()).match(/[6-9]\d{9}/)||t.replace(/\s+/g,'').match(/[6-9]\d{9}/);if(ph)out.phone=ph[0]
  const u=low.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ஒரு|ஒன்று|இரண்டு|ரெண்டு|மூன்று|மூணு|நான்கு|நாலு|ஐந்து|அஞ்சு)\s*(units?|bags?|bottles?|யூனிட்|பாட்டில்|பை)/)
  if(u)out.units=Number(u[1])||WORDNUM[u[1]]
  const h=t.match(/\b(?:at|in)\s+((?:GH|govt|government|KMCH|PSG|[A-Z][\w.]*)(?:\s+[A-Z][\w.]*){0,4})/)||t.match(/([஀-௿\w.]+(?:\s+[஀-௿\w.]+){0,3})\s*(?:மருத்துவமனையில்|ஹாஸ்பிடல்|ஆஸ்பத்திரி|hospital)/i)
  if(h)out.hospital=h[1].replace(/\s+(call|contact|phone)$/i,'')
    .replace(/^.*?(யூனிட்|பாட்டில்|units?|bags?)\s*/i,'').replace(/^(அவசரம்|அவசரமாக|urgent)\s*/i,'').replace(/(பாசிட்டிவ்|பாசிடிவ்|நெகட்டிவ்|நெகடிவ்)\s*/g,'').trim()||undefined
  const c=t.match(/\b(?:contact|call)\s+([A-Za-z.]+(?:\s+[A-Za-z.]+)?)/i);if(c&&!/^\d/.test(c[1]))out.contact=c[1].replace(/\s+on$/i,'')
  out.urgent=/urgent|emergency|need|needed|required|அவசர|தேவை|வேணும்|வேண்டும்/i.test(t)
  out.kind=out.group&&out.urgent?'urgent':/camp|முகாம்/i.test(t)?'camp':/thank|நன்றி/i.test(t)?'thanks':/birthday|பிறந்த/i.test(t)?'birthday':'free'
  return out
}
