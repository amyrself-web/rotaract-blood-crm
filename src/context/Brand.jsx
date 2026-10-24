import {createContext,useCallback,useContext,useEffect,useState} from 'react'
import {supabase,hasSupabase} from '../lib/supabase'
import {usePulse} from '../lib/pulse'
export const DEFAULT_BRAND={brand_name:'Rotaract Blood',tagline:'Sankari donor CRM',logo_url:null,brand_color:'#4C8DFF',club_name:'Sankari Rotaract Club',
  address:'',contact_phone:'',contact_email:'',signatory_name:'',signatory_title:'President'}
export const ACCENTS=[['Ocean blue','#4C8DFF'],['Crimson','#E11D48'],['Teal','#0EA5A4'],['Violet','#7C5CFF'],['Emerald','#10B981'],['Saffron','#F59E0B']]
const Ctx=createContext(null)
export const useBrand=()=>useContext(Ctx)
const rgb=h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]}
const mix=(c,t,a)=>c.map((v,i)=>Math.round(v+(t[i]-v)*a))
export const hexToRgb=rgb
export function applyAccent(hex){if(!/^#[0-9a-f]{6}$/i.test(hex||''))return;const c=rgb(hex),r=document.documentElement.style
  r.setProperty('--brand',c.join(' '));r.setProperty('--brand-deep',mix(c,[0,0,0],.25).join(' '));r.setProperty('--brand-soft',mix(c,[255,255,255],.45).join(' '))}
export function BrandProvider({children}){
  // last known brand is kept on this device so the right name and logo show from the first paint
  const [brand,setBrandState]=useState(()=>{try{return {...DEFAULT_BRAND,...JSON.parse(localStorage.getItem('brand-cache')||'{}')}}catch{return DEFAULT_BRAND}})
  const setBrand=v=>setBrandState(b=>{const n=typeof v==='function'?v(b):v;try{localStorage.setItem('brand-cache',JSON.stringify(n))}catch{}return n})
  const [mode,setModeState]=useState(()=>document.documentElement.dataset.theme==='light'?'light':'dark')
  const refreshBrand=useCallback(async()=>{if(!hasSupabase)return;const {data,error}=await supabase.rpc('public_brand');if(!error&&data)setBrand({...DEFAULT_BRAND,...Object.fromEntries(Object.entries(data).filter(([,v])=>v!==null&&v!==''))})},[])
  useEffect(()=>{refreshBrand()},[refreshBrand])
  // everyone, signed in or not, sees a new name, logo or colour as soon as Settings are saved
  usePulse(refreshBrand)
  useEffect(()=>{applyAccent(brand.brand_color);document.title=[brand.brand_name,brand.club_name!==brand.brand_name&&brand.club_name].filter(Boolean).join(' · ')||'Blood donation CRM'
    // browser tab icon follows the club logo
    let l=document.querySelector("link[rel~='icon']");if(!l){l=document.createElement('link');l.rel='icon';document.head.appendChild(l)}
    l.href=brand.logo_url||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%23E11D48'/%3E%3Cpath d='M50 18C50 18 26 48 26 63a24 24 0 0 0 48 0C74 48 50 18 50 18z' fill='white'/%3E%3C/svg%3E"
    let own=null;try{own=localStorage.getItem('theme')}catch{}
    if(!own&&brand.default_theme){setModeState(brand.default_theme);if(brand.default_theme==='light')document.documentElement.dataset.theme='light';else delete document.documentElement.dataset.theme}},[brand])
  const setMode=m=>{setModeState(m);if(m==='light')document.documentElement.dataset.theme='light';else delete document.documentElement.dataset.theme;try{localStorage.setItem('theme',m)}catch{}}
  // Interface style after sign-in: 'modern' (top menu, header band, bottom tabs on phones) or 'classic' (side menu)
  const [ui,setUiState]=useState(()=>{try{return localStorage.getItem('ui')||'modern'}catch{return 'modern'}})
  const setUi=u=>{setUiState(u);try{localStorage.setItem('ui',u)}catch{}}
  return <Ctx.Provider value={{brand,setBrand,refreshBrand,mode,setMode,ui,setUi}}>{children}</Ctx.Provider>
}
