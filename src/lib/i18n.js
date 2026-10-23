// English / Tamil. The English text is the key; anything not in the list stays in English.
// Covers the pages donors and members use (public pages, donor portal, My club) and the menu.
import {useSyncExternalStore} from 'react'

const TA={
  // menu
  'Dashboard':'முகப்பு','My club':'என் சங்கம்','Calendar':'நாள்காட்டி','Camps':'முகாம்கள்','Camp day':'முகாம் நாள்','Camp planning':'முகாம் திட்டம்','Certificates':'சான்றிதழ்கள்',
  'Blood stock':'இரத்த இருப்பு','Hospitals and blood banks':'மருத்துவமனைகள், இரத்த வங்கிகள்','Donors':'கொடையாளர்கள்','Import Excel':'Excel இறக்குமதி','WhatsApp and alerts':'WhatsApp மற்றும் அறிவிப்புகள்',
  'Eye and body donation':'கண் மற்றும் உடல் தானம்','Post maker':'பதிவு உருவாக்கி','Members':'உறுப்பினர்கள்','Meetings':'கூட்டங்கள்','Service projects':'சேவைத் திட்டங்கள்','Notice board':'அறிவிப்புப் பலகை',
  'Club events':'சங்க நிகழ்வுகள்','Club assets':'சங்க சொத்துகள்','Money and accounts':'பணம் மற்றும் கணக்கு','Reports':'அறிக்கைகள்','Users and roles':'பயனர்கள்','Audit log':'தணிக்கைப் பதிவு',
  'Recycle bin':'மறுசுழற்சி தொட்டி','Privacy and backup':'தனியுரிமை, காப்புப் பிரதி','Settings':'அமைப்புகள்','Overview':'கண்ணோட்டம்','Camp work':'முகாம் பணி','People':'மக்கள்','Club':'சங்கம்','Admin':'நிர்வாகம்',
  'Home':'முகப்பு','Stock':'இருப்பு','WhatsApp':'WhatsApp','Search':'தேடு','Sign out':'வெளியேறு','My profile':'என் சுயவிவரம்',
  // common
  'Loading…':'ஏற்றுகிறது…','Register':'பதிவு செய்','Registering…':'பதிவு செய்கிறது…','Cancel':'ரத்து','Save':'சேமி','Send':'அனுப்பு','Close':'மூடு','Preparing…':'தயாராகிறது…',
  'Full name':'முழுப் பெயர்','Your name':'உங்கள் பெயர்','Mobile number':'கைபேசி எண்','Date of birth':'பிறந்த தேதி','Blood group':'இரத்த வகை','Area or town':'பகுதி அல்லது ஊர்','Not known':'தெரியாது',
  'College or organisation':'கல்லூரி அல்லது நிறுவனம்','Time slot':'நேரம்','Full':'நிரம்பியது','Open':'திறந்துள்ளது','left':'மீதம்',
  // landing and registration
  'Blood donation camp':'இரத்த தான முகாம்','No camp is scheduled right now. Please check back soon.':'இப்போது முகாம் இல்லை. விரைவில் மீண்டும் பாருங்கள்.',
  'Live':'நேரலை','Today':'இன்று','Camp is on':'முகாம் நடக்கிறது','To go':'மீதம்','Registered':'பதிவு செய்தோர்','Donated':'தானம் செய்தோர்','Register to donate':'தானம் செய்ய பதிவு செய்',
  'Team and donor login':'குழு மற்றும் கொடையாளர் உள்நுழைவு','See our impact':'எங்கள் சேவை',
  'Blood donation camp registration':'இரத்த தான முகாம் பதிவு','Registration for this camp is not open. Please check with the club.':'இந்த முகாமுக்குப் பதிவு திறக்கப்படவில்லை. சங்கத்திடம் கேளுங்கள்.',
  'You are registered':'நீங்கள் பதிவு செய்துவிட்டீர்கள்','Your token number':'உங்கள் டோக்கன் எண்',
  'Show this token at the desk and bring a photo ID. Eat well and drink water before you come.':'மேசையில் இந்த டோக்கனைக் காட்டுங்கள், புகைப்பட அடையாள அட்டை கொண்டு வாருங்கள். வருவதற்கு முன் நன்றாகச் சாப்பிட்டு, தண்ணீர் குடியுங்கள்.',
  '10 digits, used for camp reminders.':'10 இலக்கம், முகாம் நினைவூட்டலுக்கு.','Donors must be 18 to 65 years old.':'18 முதல் 65 வயது வரை உள்ளவர்கள் தானம் செய்யலாம்.',
  'Leave as not known if you are unsure; it is tested at the camp.':'தெரியாவிட்டால் விட்டுவிடுங்கள்; முகாமில் பரிசோதிக்கப்படும்.',
  'I agree to be contacted about this camp and future blood donation drives, and to my details being stored for this purpose.':'இந்த முகாம் மற்றும் எதிர்கால இரத்த தான முகாம்கள் பற்றி என்னைத் தொடர்புகொள்ளவும், இதற்காக என் விவரங்களைச் சேமிக்கவும் ஒப்புக்கொள்கிறேன்.',
  'Choose a time slot':'நேரத்தைத் தேர்ந்தெடுங்கள்','Enter your full name':'உங்கள் முழுப் பெயரை உள்ளிடுங்கள்','Enter a valid 10-digit mobile number':'சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடுங்கள்',
  // donor portal
  'Find your donor record':'உங்கள் கொடையாளர் பதிவைக் கண்டறியுங்கள்','Link your account to your donations':'உங்கள் கணக்கை உங்கள் தானங்களுடன் இணையுங்கள்',
  'Enter the mobile number and date of birth you gave when you registered at a camp. New here? Register at the next camp first.':'முகாமில் பதிவு செய்தபோது கொடுத்த கைபேசி எண்ணையும் பிறந்த தேதியையும் உள்ளிடுங்கள். புதியவரா? அடுத்த முகாமில் முதலில் பதிவு செய்யுங்கள்.',
  'I agree to be contacted about camps and blood donation drives.':'முகாம்கள் பற்றி என்னைத் தொடர்புகொள்ள ஒப்புக்கொள்கிறேன்.','Link my record':'என் பதிவை இணை',
  'Hello':'வணக்கம்','Thank you for being a blood donor':'இரத்த தானம் செய்வதற்கு நன்றி','Donations':'தானங்கள்','Status':'நிலை','Next donation':'அடுத்த தானம்','You can donate now':'இப்போது தானம் செய்யலாம்','From':'முதல்',
  'Your upcoming camps':'உங்கள் வரவிருக்கும் முகாம்கள்','Camps open for registration':'பதிவுக்குத் திறந்துள்ள முகாம்கள்','Donated, thank you':'தானம் செய்தீர்கள், நன்றி','No camp is open right now.':'இப்போது திறந்த முகாம் இல்லை.',
  'Your donations':'உங்கள் தானங்கள்','Certificate':'சான்றிதழ்','Recorded by the club':'சங்கம் பதிவு செய்தது','Your donations will appear here after your first camp.':'உங்கள் முதல் முகாமுக்குப் பிறகு தானங்கள் இங்கே தெரியும்.',
  'Are you a member of the club? Link your member record':'நீங்கள் சங்க உறுப்பினரா? உங்கள் உறுப்பினர் பதிவை இணையுங்கள்',
  'Life saver':'உயிர் காப்பவர்','Regular donor':'வழக்கமான கொடையாளர்','Repeat donor':'மீண்டும் தானம் செய்தவர்','First donation done':'முதல் தானம் முடிந்தது','Ready to donate':'தானம் செய்யத் தயார்',
  'Your badges':'உங்கள் பதக்கங்கள்','more donations to the next badge':'தானங்களில் அடுத்த பதக்கம்',
  'My data and privacy':'என் தரவு மற்றும் தனியுரிமை','Download my data':'என் தரவைப் பதிவிறக்கு','Everything the club holds about you':'உங்களைப் பற்றி சங்கம் வைத்துள்ள அனைத்தும்',
  'Stop messages':'செய்திகளை நிறுத்து','No more WhatsApp or SMS from us':'இனி WhatsApp அல்லது SMS வராது','Correct my details':'என் விவரங்களைத் திருத்து','Name, date of birth, blood group':'பெயர், பிறந்த தேதி, இரத்த வகை',
  'Erase my data':'என் தரவை அழி','Remove my personal details':'என் தனிப்பட்ட விவரங்களை நீக்கு',
  // my club
  'My ID card':'என் அடையாள அட்டை','Edit my details':'என் விவரங்களைத் திருத்து','My attendance this year':'இந்த ஆண்டு என் வருகை','My open action items':'என் நிலுவைப் பணிகள்','Dues this year':'இந்த ஆண்டு சந்தா',
  'My blood donations':'என் இரத்த தானங்கள்','Upcoming meetings':'வரவிருக்கும் கூட்டங்கள்','Recent meetings and minutes':'சமீபத்திய கூட்டங்கள், குறிப்புகள்','My action items':'என் பணிகள்','My dues':'என் சந்தா',
  'Blood camps coming up':'வரவிருக்கும் இரத்த முகாம்கள்','Club team':'சங்கக் குழு','Notice board':'அறிவிப்புப் பலகை','Have your say':'உங்கள் கருத்து','My service hours':'என் சேவை நேரம்','Log hours':'நேரம் பதிவு',
  'hours this year':'இந்த ஆண்டு மணிநேரம்','waiting for approval':'ஒப்புதலுக்குக் காத்திருக்கிறது','Your path to induction':'உறுப்பினர் சேர்க்கைக்கான உங்கள் பாதை',
  'Mark my attendance':'என் வருகையைப் பதிவு செய்','Apply for leave':'விடுப்பு கேள்','Meeting today':'இன்று கூட்டம்','Go to my page':'என் பக்கத்துக்குச் செல்',
  // certificate, member check, events, impact
  'Download my certificate':'என் சான்றிதழைப் பதிவிறக்கு','Finding your certificate…':'உங்கள் சான்றிதழைத் தேடுகிறது…','Your gift can save up to three lives.':'உங்கள் தானம் மூன்று உயிர்களைக் காக்கும்.',
  'Thank you':'நன்றி','Date':'தேதி','Camp':'முகாம்','See the next camp':'அடுத்த முகாமைப் பார்',
  'Valid member ID':'செல்லுபடியாகும் உறுப்பினர் அட்டை','ID card not found':'அடையாள அட்டை கிடைக்கவில்லை','Member since':'உறுப்பினர் முதல்',
  'Event not found':'நிகழ்வு கிடைக்கவில்லை','Entry fee':'நுழைவுக் கட்டணம்','You are already registered':'நீங்கள் ஏற்கனவே பதிவு செய்துள்ளீர்கள்','Your pass number':'உங்கள் அனுமதிச் சீட்டு எண்',
  'Show this number at the entrance.':'நுழைவாயிலில் இந்த எண்ணைக் காட்டுங்கள்.','Sorry, this event is full.':'மன்னிக்கவும், இடம் நிரம்பிவிட்டது.','Registration is closed.':'பதிவு முடிந்தது.',
  'Our impact':'எங்கள் சேவை','Units of blood collected':'சேகரித்த இரத்த அலகுகள்','Lives touched':'தொட்ட உயிர்கள்','Registered donors':'பதிவு செய்த கொடையாளர்கள்','Blood camps held':'நடத்திய முகாம்கள்',
  'Eye donations':'கண் தானங்கள்','Body donations':'உடல் தானங்கள்','Pledges':'உறுதிமொழிகள்','Service projects done':'முடிந்த சேவைத் திட்டங்கள்','People helped':'பயன்பெற்றோர்','Volunteer hours':'தன்னார்வ மணிநேரம்',
  'Active members':'செயலில் உள்ள உறுப்பினர்கள்','Blood collected, by group':'வகை வாரியாக இரத்தம்','Last 12 months':'கடந்த 12 மாதங்கள்','Next camp':'அடுத்த முகாம்','Every unit can save up to three lives.':'ஒவ்வொரு அலகும் மூன்று உயிர்களைக் காக்கும்.',
  'Share':'பகிர்','Link copied':'இணைப்பு நகலெடுக்கப்பட்டது',
}

const KEY='lang',subs=new Set()
let lang=(()=>{try{return localStorage.getItem(KEY)==='ta'?'ta':'en'}catch{return 'en'}})()
document.documentElement.lang=lang
export const setLang=l=>{lang=l==='ta'?'ta':'en';try{localStorage.setItem(KEY,lang)}catch{};document.documentElement.lang=lang;subs.forEach(f=>f())}
export const t=s=>lang==='ta'&&TA[s]||s
export function useLang(){
  const l=useSyncExternalStore(f=>{subs.add(f);return()=>subs.delete(f)},()=>lang)
  return {lang:l,setLang,t:s=>l==='ta'&&TA[s]||s}
}
