import React from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import './index.css'
const boot=()=>createRoot(document.getElementById('root')).render(<App/>)
// email links (confirm, reset password) come back as #access_token=...; let Supabase read them before the router touches the address
const h=location.hash
if(/access_token=|error_description=/.test(h)){
  try{if(/type=recovery/.test(h))sessionStorage.setItem('recovery','1')}catch{}
  import('./lib/supabase').then(async({supabase})=>{try{await supabase?.auth.getSession()}catch{}history.replaceState(null,'',location.pathname+'#/');boot()})
}else boot()

if('serviceWorker' in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))
