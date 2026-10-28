// Shared pieces for posts: text helpers, icons (Lucide, drawn as SVG), awareness facts and special days.
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {Droplet,Eye,Leaf,Utensils,Ribbon,CalendarDays,Star,Heart,Megaphone,Cake,Users,Trophy,Sparkles,Siren,HandHeart,Flag,Sun,Gift,Stethoscope,HeartHandshake,PartyPopper,BookOpen,Lightbulb,CheckCircle2,Award,Flower2,Moon,TreePine,Baby,GraduationCap,Phone,Globe,AtSign,Link2,MapPin,Clock,X} from 'lucide-react'

export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const FONTS={display:"'Sora', 'Manrope', sans-serif",body:"'Manrope', sans-serif",serif:"'Playfair Display', Georgia, serif",cond:"'Anton', 'Sora', sans-serif",ta:"'Noto Sans Tamil', 'Noto Serif Tamil', sans-serif"}
// fonts used only on posts, bundled so the images look the same everywhere (and work offline)
let fontsP
export function loadPostFonts(){return fontsP||=Promise.all([
  import('@fontsource/sora/600.css'),import('@fontsource/sora/700.css'),import('@fontsource/sora/800.css'),
  import('@fontsource/manrope/500.css'),import('@fontsource/manrope/600.css'),import('@fontsource/manrope/700.css'),import('@fontsource/manrope/800.css'),
  import('@fontsource/anton/400.css'),import('@fontsource/playfair-display/700.css'),import('@fontsource/playfair-display/800.css'),import('@fontsource/playfair-display/700-italic.css'),
  import('@fontsource/noto-sans-tamil/500.css'),import('@fontsource/noto-sans-tamil/700.css'),import('@fontsource/noto-sans-tamil/800.css')])
  .then(()=>Promise.all(['600 20px Sora','800 20px Sora','500 20px Manrope','700 20px Manrope','800 20px Manrope','20px Anton','700 20px "Playfair Display"','italic 700 20px "Playfair Display"','700 20px "Noto Sans Tamil"','800 20px "Noto Sans Tamil"']
    .map(f=>document.fonts?.load(f,'Aா').catch(()=>{})))).catch(()=>{})}

// the post fonts as data URLs, for drawing the image (an SVG snapshot cannot load font files itself)
let embedP
export function postFontCSS(){return embedP||=(async()=>{await loadPostFonts()
  const fams=/^(Sora|Manrope|Anton|Playfair Display|Noto Sans Tamil)$/,rules=[]
  for(const sh of document.styleSheets){let list;try{list=sh.cssRules}catch{continue}
    for(const r of list||[])if(r.type===5&&fams.test(r.style.getPropertyValue('font-family').replace(/["']/g,'').trim()))rules.push(r)}
  const keep=rules.filter(r=>/(latin|tamil)-(?!ext)[^/]*\.woff2/.test(r.cssText)&&!/latin-ext/.test(r.cssText))
  const toData=async u=>{const b=await (await fetch(u)).blob();return await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result);f.readAsDataURL(b)})}
  const out=await Promise.all(keep.map(async r=>{const m=r.cssText.match(/url\(["']?([^"')]+\.woff2)["']?\)/);if(!m)return ''
    try{const abs=new URL(m[1],r.parentStyleSheet?.href||location.href).href;return `@font-face{font-family:${r.style.getPropertyValue('font-family')};font-style:${r.style.getPropertyValue('font-style')||'normal'};font-weight:${r.style.getPropertyValue('font-weight')||'400'};src:url(${await toData(abs)}) format('woff2');${r.style.getPropertyValue('unicode-range')?`unicode-range:${r.style.getPropertyValue('unicode-range')};`:''}}`}catch{return ''}}))
  return out.join('\n')})()}

const ICONS={drop:Droplet,eye:Eye,leaf:Leaf,meal:Utensils,ribbon:Ribbon,calendar:CalendarDays,star:Star,heart:Heart,megaphone:Megaphone,cake:Cake,users:Users,trophy:Trophy,sparkles:Sparkles,
  siren:Siren,hands:HandHeart,flag:Flag,sun:Sun,gift:Gift,doctor:Stethoscope,handshake:HeartHandshake,party:PartyPopper,book:BookOpen,bulb:Lightbulb,check:CheckCircle2,award:Award,flower:Flower2,moon:Moon,tree:TreePine,baby:Baby,cap:GraduationCap,phone:Phone,globe:Globe,at:AtSign,link:Link2,pin:MapPin,clock:Clock,x:X}
const iconCache={}
export function icon(name,size=64,color='currentColor',stroke=1.75){const k=[name,size,color,stroke].join('|')
  if(!iconCache[k]){const I=ICONS[name]||Sparkles;iconCache[k]=renderToStaticMarkup(createElement(I,{size,color,strokeWidth:stroke}))}
  return iconCache[k]}
// as an <img>: html2canvas draws images reliably, inline SVG less so
export const iconImg=(name,size,color,stroke=1.75)=>`<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon(name,size,color,stroke).replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"').replace(/xmlns="http:\/\/www.w3.org\/2000\/svg" xmlns="http:\/\/www.w3.org\/2000\/svg"/,'xmlns="http://www.w3.org/2000/svg"'))}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px"/>`
export const ICON_NAMES=Object.keys(ICONS)

export const initials=n=>String(n||'').trim().split(/\s+/).map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase()
export const t5=t=>t?String(t).slice(0,5):''
export const t12=t=>{if(!t)return '';const [h,m]=String(t).split(':').map(Number);return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`}

// awareness: [myth, fact, tamil headline]
export const MYTHS=[
  ['Donating blood makes you weak','Your body replaces the fluid within 24 hours. Most donors go back to normal work the same day.','இரத்த தானம் பலவீனத்தை உண்டாக்காது'],
  ['It hurts a lot','You feel a quick pinch for a second. The whole donation takes about 10 minutes.','வலி ஒரு நொடி மட்டுமே'],
  ['I can catch an infection','A new, sterile, single-use needle and bag is used for every donor. There is no risk of infection.','புதிய ஊசி, முழு பாதுகாப்பு'],
  ['Vegetarians cannot donate','Vegetarians with normal haemoglobin donate safely every day.','சைவ உணவாளர்களும் தானம் செய்யலாம்'],
  ['Women should not donate','Healthy women above 45 kg with normal haemoglobin can donate every 4 months.','பெண்களும் தானம் செய்யலாம்'],
  ['One donation helps only one person','One unit is split into red cells, plasma and platelets, and can help up to three patients.','ஒரு தானம், மூன்று உயிர்கள்'],
  ['If I have tattoos I can never donate','You can donate 6 to 12 months after a tattoo from a licensed studio.','டாட்டூ இருந்தாலும் பின்னர் தானம் செய்யலாம்'],
  ['People with diabetes can never donate','Donors whose diabetes is controlled with tablets or diet can usually donate. Ask the doctor at the camp.','மருத்துவர் ஆலோசனையுடன் தானம்'],
]
export const ELIGIBILITY=[['Age 18 to 65','வயது 18 முதல் 65'],['Weight 45 kg or more','எடை 45 கிலோ அல்லது அதற்கு மேல்'],['Haemoglobin 12.5 g/dL or more','ஹீமோகுளோபின் 12.5 அல்லது அதற்கு மேல்'],
  ['3 months since the last donation (men), 4 months (women)','கடைசி தானத்திலிருந்து 3 மாதம் (ஆண்), 4 மாதம் (பெண்)'],['Had a meal and slept well','நன்றாக உணவு உண்டு, உறங்கியிருக்க வேண்டும்'],['No fever, cold or antibiotics this week','இந்த வாரம் காய்ச்சல், சளி, ஆன்டிபயாடிக் இல்லை']]

// special days: key -> [title, tamil, message, icon, date hint]
export const DAYS={
  blood_donor_day:['World Blood Donor Day','உலக இரத்த தானம் செய்வோர் தினம்','Thank you to every donor who gives the gift of life. Give blood, give hope.','drop','14 June'],
  voluntary_day:['National Voluntary Blood Donation Day','தேசிய தன்னார்வ இரத்த தான தினம்','Every voluntary donor is a hero. Thank you for saving lives.','drop','1 October'],
  health_day:['World Health Day','உலக சுகாதார தினம்','Health is the greatest wealth. Let us care for ourselves and our neighbours.','doctor','7 April'],
  environment_day:['World Environment Day','உலக சுற்றுச்சூழல் தினம்','Plant a tree, save water, keep our town green.','tree','5 June'],
  sight_day:['World Sight Day','உலக பார்வை தினம்','Love your eyes. Get them checked, and pledge to donate them.','eye','October'],
  cancer_day:['World Cancer Day','உலக புற்றுநோய் தினம்','Early detection saves lives. Know the signs, get screened.','ribbon','4 February'],
  doctors_day:["National Doctors' Day",'தேசிய மருத்துவர் தினம்','Thank you, doctors, for healing with skill and kindness.','doctor','1 July'],
  teachers_day:["Teachers' Day",'ஆசிரியர் தினம்','Thank you to every teacher who lights the way.','cap','5 September'],
  womens_day:["International Women's Day",'சர்வதேச மகளிர் தினம்','Celebrating the women who lead, serve and inspire.','flower','8 March'],
  childrens_day:["Children's Day",'குழந்தைகள் தினம்','Every child deserves health, love and a bright future.','baby','14 November'],
  independence:['Happy Independence Day','இனிய சுதந்திர தின வாழ்த்துகள்','Let us serve the nation by serving its people.','flag','15 August'],
  republic:['Happy Republic Day','இனிய குடியரசு தின வாழ்த்துகள்','Proud to be Indian. Proud to serve.','flag','26 January'],
  pongal:['Happy Pongal','இனிய பொங்கல் நல்வாழ்த்துகள்','May this harvest bring joy, health and prosperity to every home.','sun','January'],
  tamil_new_year:['Happy Tamil New Year','இனிய தமிழ்ப் புத்தாண்டு நல்வாழ்த்துகள்','May the new year bring good health and happiness.','sparkles','14 April'],
  diwali:['Happy Diwali','இனிய தீபாவளி நல்வாழ்த்துகள்','May the festival of lights fill your life with joy. Celebrate safely.','sparkles','October / November'],
  christmas:['Merry Christmas','இனிய கிறிஸ்துமஸ் நல்வாழ்த்துகள்','Wishing you peace, love and joy this season.','gift','25 December'],
  eid:['Eid Mubarak','இனிய ரம்ஜான் நல்வாழ்த்துகள்','May this Eid bring peace and blessings to all.','moon',''],
  new_year:['Happy New Year','இனிய புத்தாண்டு நல்வாழ்த்துகள்','A new year of service, friendship and good health.','party','1 January'],
}
