const fs=require('fs'),path=require('path');process.chdir(__dirname)
const ex=require('./todo-exact.json'),pt=require('./todo-pats.json')
const read=(f,arr,out)=>{for(const line of fs.readFileSync(f,'utf8').split('\n')){if(!line.trim())continue;const i=line.indexOf('\t');const n=+line.slice(0,i),v=line.slice(i+1).trim()
  if(Number.isNaN(n)||n>=arr.length){console.error('bad index',f,line.slice(0,40));continue}if(v&&v!=='-')out.push([arr[n],v])}}
const E=[];for(let k=0;fs.existsSync(`ta-${k}.tsv`);k++)read(`ta-${k}.tsv`,ex,E)
const P=[];read('ta-pats.tsv',pt,P);P.push(['{0}: tap to send','{0}: தட்டி அனுப்பு'],['Send {0} on WhatsApp','{0} பேருக்கு WhatsApp-இல் அனுப்பு'],['Deleted {0} show up here.','நீக்கிய {0} இங்கே தெரியும்.'],['Good morning, {0}','காலை வணக்கம், {0}'],['Good afternoon, {0}','மதிய வணக்கம், {0}'],['Good evening, {0}','மாலை வணக்கம், {0}'],['target {0}','இலக்கு {0}'])
const exact={};for(const [k,v] of E)exact[k.replace(/\s+/g,' ').trim()]=v
// lower-case status words shown straight from the database
Object.assign(exact,{registered:'பதிவு செய்தார',checked_in:'வருகை பதிவானது','checked in':'வருகை பதிவானது',screened:'பரிசோதிக்கப்பட்டது',donated:'தானம் செய்தார்',deferred:'தள்ளிவைக்கப்பட்டது','no show':'வரவில்லை',no_show:'வரவில்லை',
  planned:'திட்டமிடப்பட்டது',open:'திறந்துள்ளது',live:'நேரலை',completed:'முடிந்தது',closed:'மூடப்பட்டது',cancelled:'ரத்து செய்யப்பட்டது',ongoing:'நடந்துகொண்டிருக்கிறது',
  active:'செயலில்',inactive:'செயலில் இல்லை',resigned:'விலகினார்',prospective:'வருங்கால உறுப்பினர்',present:'வந்தார்',absent:'வரவில்லை',late:'தாமதம்',leave:'விடுப்பு',
  pending:'நிலுவையில்',done:'முடிந்தது',todo:'செய்ய வேண்டியது',available:'கிடைக்கிறது',collected:'சேகரிக்கப்பட்டது',issued:'வழங்கப்பட்டது',discarded:'அப்புறப்படுத்தப்பட்டது',expired:'காலாவதியானது',
  fulfilled:'நிறைவேறியது',received:'பெறப்பட்டது',paid:'செலுத்தப்பட்டது',admin:'நிர்வாகி',coordinator:'ஒருங்கிணைப்பாளர்',volunteer:'தன்னார்வலர்',medical:'மருத்துவக் குழு',member:'உறுப்பினர்',donor:'கொடையாளர்',
  Male:'ஆண்',Female:'பெண்',Other:'மற்றவை','Not known':'தெரியாது'})
exact.registered='பதிவு செய்தார்'
Object.assign(exact,{held:'நடந்தது',scheduled:'திட்டமிடப்பட்டது',weekly:'வாராந்திர',monthly:'மாதாந்திர',board:'நிர்வாகக் குழு',overdue:'கெடு தாண்டியது',receipts:'ரசீதுகள்',donors:'கொடையாளர்கள்',camps:'முகாம்கள்',members:'உறுப்பினர்கள்',
  task:'பணி',camp:'முகாம்',donor:'கொடையாளர்',volunteer:'தன்னார்வலர்',sponsor:'ஸ்பான்சர்',expense:'செலவு',meeting:'கூட்டம்',project:'திட்டம்',event:'நிகழ்வு',unit:'அலகு',request:'கோரிக்கை',
  you:'நீங்கள்','Not stated':'குறிப்பிடவில்லை','Register now':'இப்போதே பதிவு செய்','show up here.':'இங்கே தெரியும்.','Deleted':'நீக்கப்பட்ட',
  'Jan':'ஜன','Feb':'பிப்','Mar':'மார்','Apr':'ஏப்','May':'மே','Jun':'ஜூன்','Jul':'ஜூலை','Aug':'ஆக','Sep':'செப்','Sept':'செப்','Oct':'அக்','Nov':'நவ','Dec':'டிச'})
const out=`// Tamil for every screen of the CRM. Loaded only when Tamil is chosen. Generated; edit the TSV sources to change.
export const EXACT=${JSON.stringify(exact)}
export const PATTERNS=${JSON.stringify(P)}
`
fs.writeFileSync(path.join(__dirname,'../../src/lib/ta-dict.js'),out)
console.log('exact',Object.keys(exact).length,'patterns',P.length,'bytes',out.length)
