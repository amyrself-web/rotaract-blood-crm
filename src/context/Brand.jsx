import {createContext,useCallback,useContext,useEffect,useState} from 'react'
import {supabase,hasSupabase} from '../lib/supabase'
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
  const [brand,setBrand]=useState(DEFAULT_BRAND)
  const [mode,setModeState]=useState(()=>document.documentElement.dataset.theme==='light'?'light':'dark')
  const refreshBrand=useCallback(async()=>{if(!hasSupabase)return;const {data,error}=await supabase.rpc('public_brand');if(!error&&data)setBrand(b=>({...b,...Object.fromEntries(Object.entries(data).filter(([,v])=>v!==null))}))},[])
  useEffect(()=>{refreshBrand()},[refreshBrand])
  useEffect(()=>{applyAccent(brand.brand_color);document.title=brand.brand_name||'Blood CRM'
    let own=null;try{own=localStorage.getItem('theme')}catch{}
    if(!own&&brand.default_theme){setModeState(brand.default_theme);if(brand.default_theme==='light')document.documentElement.dataset.theme='light';else delete document.documentElement.dataset.theme}},[brand])
  const setMode=m=>{setModeState(m);if(m==='light')document.documentElement.dataset.theme='light';else delete document.documentElement.dataset.theme;try{localStorage.setItem('theme',m)}catch{}}
  // Interface style after sign-in: 'modern' (top menu, header band, bottom tabs on phones) or 'classic' (side menu)
  const [ui,setUiState]=useState(()=>{try{return localStorage.getItem('ui')||'modern'}catch{return 'modern'}})
  const setUi=u=>{setUiState(u);try{localStorage.setItem('ui',u)}catch{}}
  return <Ctx.Provider value={{brand,setBrand,refreshBrand,mode,setMode,ui,setUi}}>{children}</Ctx.Provider>
}
