import {createContext,useCallback,useContext,useEffect,useState} from 'react'
import {supabase,hasSupabase} from '../lib/supabase'
import {effectivePerms,DEFAULT_SETTINGS} from '../lib/access'
const Ctx=createContext(null)
export const useAuth=()=>useContext(Ctx)
export const ROLES=['admin','coordinator','medical','volunteer','member','donor']
export function AuthProvider({children}){
  const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[perms,setPerms]=useState({}),[settings,setSettings]=useState(DEFAULT_SETTINGS),[loading,setLoading]=useState(hasSupabase)
  const load=useCallback(async u=>{
    if(!u){setProfile(null);setPerms({});return}
    const key='auth-cache-'+u.id,cached=()=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
    const {data,error}=await supabase.from('profiles').select('*').eq('id',u.id).single().then(r=>r,e=>({data:null,error:e}))
    // no internet (camp venue): carry on with what this device saw last time, so camp day still opens
    if(error&&(!navigator.onLine||/fetch|network|load failed/i.test(error.message||''))){const c=cached();if(c){setProfile(c.profile);setPerms(c.perms);setSettings({...DEFAULT_SETTINGS,...c.settings});return}}
    setProfile(data)
    const acc=await supabase.rpc('my_access')
    const base=!acc.error&&acc.data?.perms?acc.data.perms:effectivePerms(data?.role,data?.permissions),linked=!!acc.data?.member
    const perms={...base,_member:linked,_myclub:linked&&data?.role!=='member'};setPerms(perms)
    const s=await supabase.from('settings').select('*').eq('id',1).maybeSingle()
    if(!s.error&&s.data)setSettings({...DEFAULT_SETTINGS,...s.data})
    try{if(data)localStorage.setItem(key,JSON.stringify({profile:data,perms,settings:s.data||{}}))}catch{}},[])
  useEffect(()=>{if(!hasSupabase)return
    supabase.auth.getSession().then(async({data})=>{const u=data.session?.user??null;setUser(u);await load(u);setLoading(false)})
    const {data:sub}=supabase.auth.onAuthStateChange((e,s)=>{const u=s?.user??null;setUser(u);if(e!=='TOKEN_REFRESHED')setTimeout(()=>load(u),0)})
    return()=>sub.subscription.unsubscribe()},[load])
  useEffect(()=>{if(!hasSupabase||!user?.id||user.id==='demo')return
    const ch=supabase.channel('me-'+user.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:'id=eq.'+user.id},()=>load(user))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'settings'},()=>load(user)).subscribe()
    return()=>{supabase.removeChannel(ch)}},[user?.id,load])
  const signIn=(email,password)=>supabase.auth.signInWithPassword({email,password})
  const signUp=(email,password,full_name)=>supabase.auth.signUp({email,password,options:{data:{full_name}}})
  const signOut=()=>{if(hasSupabase)return supabase.auth.signOut();setUser(null);setProfile(null)}
  const demo=role=>{setUser({id:'demo'});setProfile({full_name:'Demo '+role,role,active:true});setPerms(effectivePerms(role))}
  const can=useCallback(m=>!!perms[m],[perms])
  return <Ctx.Provider value={{user,profile,perms,can,settings,setSettings,loading,signIn,signUp,signOut,demo,refresh:()=>load(user)}}>{children}</Ctx.Provider>
}
