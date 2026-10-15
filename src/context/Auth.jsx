import {createContext,useContext,useEffect,useState} from 'react'
import {supabase,hasSupabase} from '../lib/supabase'
const Ctx=createContext(null)
export const useAuth=()=>useContext(Ctx)
export const ROLES=['admin','coordinator','medical','volunteer','donor']
export function AuthProvider({children}){
  const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(hasSupabase)
  const load=async u=>{if(!u){setProfile(null);return}
    const {data}=await supabase.from('profiles').select('*').eq('id',u.id).single();setProfile(data)}
  useEffect(()=>{if(!hasSupabase)return
    supabase.auth.getSession().then(async({data})=>{const u=data.session?.user??null;setUser(u);await load(u);setLoading(false)})
    const {data:sub}=supabase.auth.onAuthStateChange(async(_e,s)=>{const u=s?.user??null;setUser(u);await load(u)})
    return()=>sub.subscription.unsubscribe()},[])
  const signIn=(email,password)=>supabase.auth.signInWithPassword({email,password})
  const signUp=(email,password,full_name)=>supabase.auth.signUp({email,password,options:{data:{full_name}}})
  const signOut=()=>{if(hasSupabase)return supabase.auth.signOut();setUser(null);setProfile(null)}
  const demo=role=>{setUser({id:'demo'});setProfile({full_name:'Demo '+role,role,active:true})}
  return <Ctx.Provider value={{user,profile,loading,signIn,signUp,signOut,demo}}>{children}</Ctx.Provider>
}
