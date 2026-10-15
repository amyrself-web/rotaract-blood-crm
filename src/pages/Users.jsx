import {useEffect,useState} from 'react'
import {supabase,hasSupabase} from '../lib/supabase'
import {useAuth,ROLES} from '../context/Auth'
export default function UsersPage(){
  const {profile}=useAuth(),[rows,setRows]=useState([]),[err,setErr]=useState('')
  useEffect(()=>{if(hasSupabase)supabase.from('profiles').select('*').order('created_at').then(({data,error})=>error?setErr(error.message):setRows(data))
    else setRows([{id:'1',full_name:'Demo user',role:'donor',active:true}])},[])
  if(profile.role!=='admin')return <div className="card">Only admins can manage users.</div>
  const update=async(id,patch)=>{if(hasSupabase){const {error}=await supabase.from('profiles').update(patch).eq('id',id);if(error)return setErr(error.message)}
    setRows(r=>r.map(x=>x.id===id?{...x,...patch}:x))}
  return <div><h1 className="h1">Users and roles</h1>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
      <thead className="text-left text-slate-400"><tr><th className="p-3 font-medium">Name</th><th className="font-medium">Role</th><th className="font-medium">Active</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.id} className="border-t border-ink-700">
        <td className="p-3">{r.full_name||'No name'}</td>
        <td><select className="input w-auto py-1 capitalize" value={r.role} onChange={e=>update(r.id,{role:e.target.value})}>{ROLES.map(x=><option key={x}>{x}</option>)}</select></td>
        <td><input type="checkbox" checked={r.active} onChange={e=>update(r.id,{active:e.target.checked})}/></td></tr>)}</tbody>
    </table></div></div>
}
