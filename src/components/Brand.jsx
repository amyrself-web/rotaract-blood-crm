import {motion} from 'framer-motion'
import {Droplet,Sun,Moon} from 'lucide-react'
import {useBrand} from '../context/Brand'
export function Logo({size=40,className=''}){
  const {brand}=useBrand()
  if(brand.logo_url)return <img src={brand.logo_url} alt="" style={{width:size,height:size}} className={`shrink-0 rounded-xl bg-white object-contain p-1 ${className}`}/>
  return <span style={{width:size,height:size}} className={`relative grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blood to-blood-deep text-white shadow-[0_8px_24px_-8px_rgba(240,67,90,.8)] ${className}`}>
    <Droplet size={size*.48} fill="currentColor" className="animate-beat"/></span>
}
export function BrandMark({collapsed,size=40}){
  const {brand}=useBrand()
  return <div className="flex min-w-0 items-center gap-3"><Logo size={size}/>
    {!collapsed&&<div className="min-w-0"><div className="truncate font-display text-[15px] font-semibold leading-tight text-fg">{brand.brand_name}</div>
      {brand.tagline&&<div className="truncate text-xs text-fog-faint">{brand.tagline}</div>}</div>}</div>
}
export function ThemeToggle({className=''}){
  const {mode,setMode}=useBrand(),light=mode==='light'
  return <button onClick={()=>setMode(light?'dark':'light')} className={`btn-ghost relative overflow-hidden ${className}`} aria-label={light?'Switch to night theme':'Switch to day theme'} title={light?'Night theme':'Day theme'}>
    <motion.span key={mode} initial={{rotate:-90,scale:.4,opacity:0}} animate={{rotate:0,scale:1,opacity:1}} transition={{type:'spring',stiffness:300,damping:18}} className="grid">
      {light?<Moon size={18}/>:<Sun size={18}/>}</motion.span></button>
}
