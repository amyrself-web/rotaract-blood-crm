import {useEffect,useRef,useState} from 'react'
// Counts a number (or the number at the start of a label like "0.4 L") up from zero.
export default function CountUp({value,ms=900}){
  const m=String(value??'').match(/^(-?\d+(?:\.(\d+))?)(.*)$/s)
  const target=m?parseFloat(m[1]):null,dec=m?.[2]?.length||0,rest=m?.[3]??''
  const [n,setN]=useState(target??0),from=useRef(0)
  useEffect(()=>{if(target===null)return
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setN(target);from.current=target;return}
    const start=performance.now(),a=from.current;let raf
    const tick=t=>{const p=Math.min(1,(t-start)/ms),e=1-Math.pow(1-p,3);setN(a+(target-a)*e);if(p<1)raf=requestAnimationFrame(tick);else from.current=target}
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[target])
  if(target===null)return value
  return <>{n.toFixed(dec)}{rest}</>
}
