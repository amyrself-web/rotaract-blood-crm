// Small celebratory and feedback effects in the CRM's colours. All respect "reduce motion".
const calm=()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const brand=()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--brand').trim().split(/\s+/).map(Number);return v.length===3?'#'+v.map(x=>x.toString(16).padStart(2,'0')).join(''):'#4C8DFF'}
export async function celebrate(){
  if(calm())return
  const {default:confetti}=await import('canvas-confetti')
  const colors=['#F0435A','#B4233A','#FF8796',brand(),'#ffffff']
  const drop=confetti.shapeFromPath?confetti.shapeFromPath({path:'M12 2C12 2 4 11 4 16a8 8 0 0 0 16 0c0-5-8-14-8-14z'}):undefined
  const opts={colors,shapes:drop?[drop,'circle']:['circle'],scalar:1.1,ticks:180,disableForReducedMotion:true}
  confetti({...opts,particleCount:70,spread:75,startVelocity:38,origin:{x:.5,y:.7}})
  setTimeout(()=>confetti({...opts,particleCount:40,spread:110,startVelocity:25,origin:{x:.5,y:.6}}),180)
}
