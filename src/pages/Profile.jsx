import {useState} from 'react'
import {toast} from 'sonner'
import {Check,X} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {MODULES,ROLE_LABEL} from '../lib/access'
import {PageHeader,Field,Badge} from '../components/ui'
import {normPhone} from '../lib/util'

export default function Profile(){
  const {profile,perms,refresh}=useAuth()
  const [f,setF]=useState({full_name:profile.full_name||'',phone:profile.phone||''}),[pw,setPw]=useState({a:'',b:''}),[busy,setBusy]=useState('')
  const save=async e=>{e.preventDefault();setBusy('p')
    const {error}=await supabase.from('profiles').update({full_name:f.full_name.trim()||null,phone:normPhone(f.phone)||null}).eq('id',profile.id)
    setBusy('');if(error)return toast.error(error.message);toast.success('Profile saved');refresh()}
  const change=async e=>{e.preventDefault();if(pw.a.length<8)return toast.error('Use at least 8 characters');if(pw.a!==pw.b)return toast.error('The two passwords do not match')
    setBusy('w');const {error}=await supabase.auth.updateUser({password:pw.a});setBusy('');if(error)return toast.error(error.message);setPw({a:'',b:''});toast.success('Password changed')}
  return <div className="max-w-3xl">
    <PageHeader title="My profile" description="Your details and what you can do in the CRM."/>
    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={save} className="card space-y-4"><h2 className="font-semibold text-white">Details</h2>
        <Field label="Full name"><input className="input" value={f.full_name} onChange={e=>setF({...f,full_name:e.target.value})}/></Field>
        <Field label="Mobile"><input className="input" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field>
        <Field label="Email" hint="Ask an admin to change your sign-in email."><input className="input" value={profile.email||''} disabled/></Field>
        <button className="btn" disabled={busy==='p'}>{busy==='p'?'Saving…':'Save details'}</button></form>
      <form onSubmit={change} className="card space-y-4"><h2 className="font-semibold text-white">Change password</h2>
        <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw.a} onChange={e=>setPw({...pw,a:e.target.value})}/></Field>
        <Field label="Type it again"><input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={e=>setPw({...pw,b:e.target.value})}/></Field>
        <button className="btn" disabled={busy==='w'||!pw.a}>{busy==='w'?'Changing…':'Change password'}</button></form>
    </div>
    <div className="card mt-5"><div className="mb-4 flex flex-wrap items-center gap-2"><h2 className="mr-2 font-semibold text-white">Your access</h2>
      <Badge tone="blue">{ROLE_LABEL[profile.role]}</Badge>{profile.designation&&<Badge>{profile.designation}</Badge>}</div>
      <div className="grid gap-2 sm:grid-cols-2">{MODULES.map(([m,label])=><div key={m} className={`flex items-center gap-2 text-sm ${perms[m]?'text-fog':'text-fog-faint'}`}>
        {perms[m]?<Check size={15} className="text-ok"/>:<X size={15}/>}{label}</div>)}</div></div>
  </div>
}
