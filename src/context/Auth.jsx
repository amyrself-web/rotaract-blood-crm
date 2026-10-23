import {createContext,useCallback,useContext,useEffect,useState} from 'react'
import {supabase,hasSupabase} from '../lib/supabase'
import {effectivePerms,DEFAULT_SETTINGS} from '../lib/access'
const Ctx=createContext(null)
export const useAuth=()=>useContext(Ctx)
export const ROLES=['admin','coordinator','medical','volunteer','donor']
export function AuthProvider({children}){
  const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[perms,setPerms]=useState({}),[settings,setSettings]=useState(DEFAULT_SETTINGS),[loading,setLoading]=useState(hasSupabase)
  const load=useCallback(async u=>{
    if(!u){setProfile(null);setPerms({});return}
    const {data}=await supabase.from('profiles').select('*').eq('id',u.id).single();setProfile(data)
    const acc=await supabase.rpc('my_access')
    setPerms(!acc.error&&acc.data?.perms?acc.data.perms:effectivePerms(data?.role,data?.permissions))
    const s=await supabase.from('settings').select('*').eq('id',1).maybeSingle()
    if(!s.error&&s.data)setSettings({...DEFAULT_SETTINGS,...s.data})},[])
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
