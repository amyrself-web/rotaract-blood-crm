import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {UserPlus,Search,ShieldCheck,KeyRound,Trash2,RotateCcw,Wand2,Users as UsersIcon} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {MODULES,ROLE_DEFAULTS,ROLE_LABEL,ROLE_HINT,DESIGNATIONS,effectivePerms} from '../lib/access'
import {PageHeader,Drawer,Field,Badge,Tabs,Toggle,Empty,useConfirm,errText,useLive,code} from '../components/ui'
import {normPhone,fmt} from '../lib/util'

const ROLES=['admin','coordinator','medical','volunteer','member','donor']
const TONE={admin:'red',coordinator:'blue',medical:'green',volunteer:'amber',member:'blue',donor:'neutral'}
const genPw=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';const r=crypto.getRandomValues(new Uint32Array(10));return 'Rc-'+[...r].map(x=>a[x%a.length]).join('')}
async function callAdmin(body){
  const {data,error}=await supabase.functions.invoke('admin-users',{body})
  if(error){let m=error.message;try{const j=await error.context?.json?.();if(j?.error)m=j.error}catch{}throw new Error(m.includes('Failed to send')?'The user control service is not reachable yet.':m)}
  if(data?.error)throw new Error(data.error);return data}

function RolePicker({value,onChange,isAdmin}){
  return <div className="grid gap-2 sm:grid-cols-2">{ROLES.map(r=>{const off=r==='admin'&&!isAdmin
    return <button type="button" key={r} disabled={off} onClick={()=>onChange(r)}
      className={`rounded-xl border p-3 text-left transition ${value===r?'border-brand bg-brand/10 ring-1 ring-brand/40':'border-ink-600 hover:border-ink-500'} disabled:opacity-40`}>
      <div className="flex items-center justify-between"><span className="font-semibold text-fg">{ROLE_LABEL[r]}</span>{value===r&&<span className="h-2 w-2 rounded-full bg-brand"/>}</div>
      <div className="mt-0.5 text-xs text-fog-muted">{ROLE_HINT[r]}</div></button>})}</div>
}

function PermGrid({role,overrides,setOverrides}){
  const eff=effectivePerms(role,overrides)
  if(role==='admin')return <p className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-sm text-fog-muted">Admins always have every module.</p>
  return <div className="space-y-1">{MODULES.map(([m,label,desc])=>{const def=ROLE_DEFAULTS[role]?.includes(m),changed=m in overrides
    return <div key={m} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-800">
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm font-medium text-fg">{label}{changed&&<Badge tone="amber">Custom</Badge>}</div>
        <div className="text-xs text-fog-faint">{desc}{` · role default: ${def?'on':'off'}`}</div></div>
      <Toggle label={label} checked={eff[m]} onChange={v=>{const o={...overrides};if(v===def)delete o[m];else o[m]=v;setOverrides(o)}}/></div>})}</div>
}

const blank={full_name:'',email:'',phone:'',role:'volunteer',designation:'',password:'',permissions:{}}

// Which donor record and member record this login is linked to. Donors see their donations; members see My club.
function LinkedRecords({pid,phone,can}){
  const [d,setD]=useState(undefined),[m,setM]=useState(undefined),[ph,setPh]=useState({donor:phone||'',member:phone||''})
  const load=async()=>{const [a,b]=await Promise.all([can('donors')?supabase.from('donors').select('id,donor_no,full_name,phone,blood_group').eq('user_id',pid).is('deleted_at',null).maybeSingle():{data:null},
    can('members')?supabase.from('members').select('id,member_no,full_name,phone,position').eq('profile_id',pid).is('deleted_at',null).maybeSingle():{data:null}]);setD(a.data);setM(b.data)}
  useEffect(()=>{load()},[pid])
  const link=async kind=>{const t=kind==='donor'?'donors':'members',col=kind==='donor'?'user_id':'profile_id',p=normPhone(ph[kind])
    if(!/^[6-9]\d{9}$/.test(p))return toast.error('Enter a 10-digit mobile number')
    const {data:row}=await supabase.from(t).select(`id,${col},full_name`).eq('phone',p).is('deleted_at',null).maybeSingle()
    if(!row)return toast.error(`No ${kind} record with this mobile number`)
    if(row[col]&&row[col]!==pid)return toast.error(`That ${kind} record is already linked to another login`)
    const r=await supabase.from(t).update({[col]:pid}).eq('id',row.id);if(r.error)return toast.error(r.error.message);toast.success(`Linked to ${row.full_name}`);load()}
  const unlink=async kind=>{const t=kind==='donor'?'donors':'members',col=kind==='donor'?'user_id':'profile_id',rec=kind==='donor'?d:m
    const r=await supabase.from(t).update({[col]:null}).eq('id',rec.id);if(r.error)return toast.error(r.error.message);toast.success('Unlinked');load()}
  const Box=({kind,rec,label,codeTxt,sub,perm})=><div className="rounded-xl border border-ink-600 p-4">
    <div className="mb-1 font-semibold text-fg">{label}</div>
    {!can(perm)?<p className="text-sm text-fog-faint">You need the {perm} permission to see this.</p>
    :rec===undefined?<div className="skeleton h-8"/>
    :rec?<div className="flex items-center gap-3"><span className="code">{codeTxt}</span><span className="flex-1 text-sm text-fg">{rec.full_name}<span className="block text-xs text-fog-faint">{sub}</span></span><button className="btn-quiet px-3 py-1.5 text-xs" onClick={()=>unlink(kind)}>Unlink</button></div>
    :<div className="flex gap-2"><input className="input" aria-label={`${label} mobile`} placeholder="Mobile number on the record" value={ph[kind]} onChange={e=>setPh({...ph,[kind]:e.target.value})}/><button className="btn-quiet" onClick={()=>link(kind)}>Link</button></div>}</div>
  return <div className="space-y-4">
    <p className="text-sm text-fog-muted">A login is separate from the donor list and the member list. Link it so the person sees their own records after signing in.</p>
    <Box kind="donor" rec={d} label="Donor record" codeTxt={d?code('D',d.donor_no):''} sub={d?`${d.blood_group||'-'} · ${d.phone}`:''} perm="donors"/>
    <Box kind="member" rec={m} label="Club member record" codeTxt={m?code('M',m.member_no,3):''} sub={m?`${m.position} · ${m.phone||''}`:''} perm="members"/>
  </div>
}

export default function UsersPage(){
  const {user,profile,refresh,can}=useAuth(),confirm=useConfirm(),isAdmin=profile.role==='admin'
  const [rows,setRows]=useState(null),[q,setQ]=useState(''),[rf,setRf]=useState(''),[edit,setEdit]=useState(null),[tab,setTab]=useState('profile'),[busy,setBusy]=useState(false),[pw,setPw]=useState('')
  const load=()=>supabase.from('profiles').select('*').order('member_no').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[])
  useLive(['profiles'],load)
  const list=useMemo(()=>(rows||[]).filter(r=>(!rf||r.role===rf)&&(!q||`${r.full_name} ${r.email} ${r.phone} ${r.designation}`.toLowerCase().includes(q.toLowerCase()))),[rows,q,rf])
  const counts=Object.fromEntries(ROLES.map(r=>[r,(rows||[]).filter(x=>x.role===r).length]))
  const set=k=>e=>setEdit({...edit,[k]:e.target.value})
  const open=r=>{setTab('profile');setPw('');setEdit(r?{...r,permissions:r.permissions||{},_orig:r}:{...blank,password:genPw(),_new:true})}
  const [master,setMaster]=useState(null)
  useEffect(()=>{supabase.rpc('master_admin_info').then(({data})=>setMaster(data?.id||null))},[])
  const isMaster=edit&&edit.id===master
  const locked=edit&&!edit._new&&edit._orig?.role==='admin'&&!isAdmin

  const save=async()=>{
    if((edit.full_name||'').trim().length<2)return toast.error('Enter the full name')
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((edit.email||'').trim()))return toast.error('Enter a valid email')
    if((edit._new||edit.phone)&&!/^[6-9]\d{9}$/.test(normPhone(edit.phone)))return toast.error('Enter a 10-digit mobile number')
    if(edit._new&&!(edit.designation||'').trim())return toast.error('Give a title, like Treasurer or Screening desk')
setBusy(true)
    try{
      if(edit._new){
        const res=await callAdmin({action:'create',email:edit.email,password:edit.password,full_name:edit.full_name,phone:normPhone(edit.phone)||null,role:edit.role,designation:edit.designation||null,permissions:edit.permissions})
        // link the new login to the donor / member record with the same mobile number, if there is one free
        const p=normPhone(edit.phone),linked=[]
        if(res?.id&&p){if(can('donors')){const {data}=await supabase.from('donors').update({user_id:res.id}).eq('phone',p).is('user_id',null).is('deleted_at',null).select('donor_no');if(data?.length)linked.push(code('D',data[0].donor_no))}
          if(can('members')){const {data}=await supabase.from('members').update({profile_id:res.id}).eq('phone',p).is('profile_id',null).is('deleted_at',null).select('member_no');if(data?.length)linked.push(code('M',data[0].member_no,3))}}
        if(linked.length)toast.success(`Linked to ${linked.join(' and ')} by mobile number`)
        toast.success(`${edit.full_name||edit.email} added`,{description:'Share the email and password with them privately.'})
      }else{
        const o=edit._orig
        if(edit.email.trim().toLowerCase()!==(o.email||'')){await callAdmin({action:'update_email',user_id:o.id,email:edit.email})}
        const {error}=await supabase.from('profiles').update({full_name:edit.full_name||null,phone:normPhone(edit.phone)||null,role:edit.role,designation:edit.designation||null,permissions:edit.role==='admin'?{}:edit.permissions,active:edit.active}).eq('id',o.id)
        if(error)throw error
        toast.success('Changes saved')
        if(o.id===user.id)refresh()
      }
      setEdit(null);load()
    }catch(e){toast.error(errText(e))}finally{setBusy(false)}}

  const resetPw=async()=>{if(pw.length<8)return toast.error('Password must be at least 8 characters');setBusy(true)
    try{await callAdmin({action:'reset_password',user_id:edit.id,password:pw});toast.success('Password changed',{description:'Share the new password with them privately.'});setPw('')}catch(e){toast.error(errText(e))}finally{setBusy(false)}}
  const remove=async()=>{if(!await confirm({title:`Delete ${edit.full_name||edit.email}?`,body:'Their login is removed for good. Donor records and camp history stay.',action:'Delete user'}))return
    setBusy(true);try{await callAdmin({action:'delete',user_id:edit.id});toast.success('User deleted');setEdit(null);load()}catch(e){toast.error(errText(e))}finally{setBusy(false)}}
  const toggleActive=async r=>{const {error}=await supabase.from('profiles').update({active:!r.active}).eq('id',r.id)
    if(error)return toast.error(error.message);toast.success(r.active?`${r.full_name||r.email} can no longer sign in to the CRM`:`${r.full_name||r.email} is active again`);load()}

  return <div>
    <PageHeader title="Users and roles" description="Create logins, give each person a role and title, and switch individual modules on or off."
      actions={<button className="btn" onClick={()=>open(null)}><UserPlus size={16}/>Add user</button>}/>
    <div className="mb-4 flex flex-wrap gap-2">
      <button onClick={()=>setRf('')} className={`chip ${!rf?'border-brand/50 text-fg':''}`}>All {(rows||[]).length}</button>
      {ROLES.map(r=><button key={r} onClick={()=>setRf(rf===r?'':r)} className={`chip ${rf===r?'border-brand/50 text-fg':''}`}>{ROLE_LABEL[r]} {counts[r]}</button>)}</div>
    <div className="card overflow-hidden p-0">
      <div className="border-b border-ink-700 p-3"><div className="relative max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/>
        <input className="input pl-9" placeholder="Search name, email, phone, title" value={q} onChange={e=>setQ(e.target.value)}/></div></div>
      <div className="overflow-x-auto"><table className="table"><thead><tr><th>Person</th><th>Role</th><th>Title</th><th>Access</th><th>Active</th><th/></tr></thead>
        <tbody>{rows===null?[0,1,2].map(i=><tr key={i}><td colSpan="6"><div className="skeleton h-8 w-full"/></td></tr>)
        :list.map(r=>{const custom=Object.keys(r.permissions||{}).length
          return <tr key={r.id} className="cursor-pointer" onClick={()=>open(r)}>
          <td><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-700 text-sm font-semibold text-fg">{(r.full_name||r.email||'?')[0].toUpperCase()}</span>
            <div className="min-w-0"><div className="truncate font-medium text-fg">{r.full_name||'No name'}{r.id===user.id&&<span className="ml-2 text-xs text-fog-faint">you</span>}</div><div className="truncate text-xs text-fog-faint"><span className="code mr-1.5">{code('U',r.member_no,3)}</span>{r.email||'-'}</div></div></div></td>
          <td><Badge tone={TONE[r.role]}>{ROLE_LABEL[r.role]}</Badge></td><td className="text-fog-muted">{r.designation||'-'}</td>
          <td className="text-fog-muted">{r.role==='admin'?'Everything':custom?`${custom} custom`:'Role default'}</td>
          <td onClick={e=>e.stopPropagation()}><Toggle label="Active" checked={r.active} disabled={r.id===user.id||(r.role==='admin'&&!isAdmin)} onChange={()=>toggleActive(r)}/></td>
          <td className="text-right text-sm text-brand">Edit</td></tr>})}
        </tbody></table>
        {rows&&!list.length&&<Empty icon={UsersIcon} title="No users match">Try a different search or role.</Empty>}</div></div>

    <Drawer open={!!edit} onClose={()=>setEdit(null)} width="max-w-xl" title={edit?._new?'Add user':edit?.full_name||edit?.email}
      description={edit?._new?'They can sign in as soon as you save.':`Joined ${fmt(edit?.created_at)}${locked?' · only an admin can change this account':''}`}
      footer={edit&&<>{!edit._new&&tab==='security'?null:<><button className="btn-quiet" onClick={()=>setEdit(null)}>Cancel</button>
        <button className="btn" disabled={busy||locked||(edit._new&&(!edit.email||edit.password.length<8))} onClick={save}>{busy?'Saving…':edit._new?'Create user':'Save changes'}</button></>}</>}>
      {edit&&<>
        {!edit._new&&<Tabs id="user-tabs" value={tab} onChange={setTab} tabs={[['profile','Profile'],['access','Role and access'],['links','Linked records'],['security','Security']]}/>}
        {(edit._new||tab==='profile')&&<div className="space-y-4">
          <Field label="Full name" required><input required className="input" value={edit.full_name||''} onChange={set('full_name')} disabled={locked}/></Field>
          <Field label="Email" hint={edit._new?'Used to sign in.':'Changing it changes their sign-in email.'} required><input required className="input" type="email" value={edit.email||''} onChange={set('email')} disabled={locked}/></Field>
          <Field label="Mobile" required={edit._new}><input required={edit._new} className="input" value={edit.phone||''} onChange={set('phone')} disabled={locked}/></Field>
          <Field label="Title (sub-role)" hint="Pick one or type your own, like Treasurer or Screening desk." required>
            <input required className="input" list="designations" value={edit.designation||''} onChange={set('designation')} disabled={locked}/>
            <datalist id="designations">{(DESIGNATIONS[edit.role]||[]).map(d=><option key={d} value={d}/>)}</datalist></Field>
          {edit._new&&<><Field label="Role"><RolePicker value={edit.role} isAdmin={isAdmin} onChange={r=>setEdit({...edit,role:r,permissions:{}})}/></Field>
            <Field label="Password" hint="At least 8 characters. Share it privately; they can change it in My profile.">
              <div className="flex gap-2"><input className="input font-mono" value={edit.password} onChange={set('password')}/><button type="button" className="btn-quiet" title="Generate" onClick={()=>setEdit({...edit,password:genPw()})}><Wand2 size={15}/></button></div></Field></>}
        </div>}
        {!edit._new&&tab==='access'&&<div className="space-y-5">
          <Field label="Role"><RolePicker value={edit.role} isAdmin={isAdmin} onChange={r=>setEdit({...edit,role:r,permissions:{}})}/></Field>
          <div><div className="mb-2 flex items-center justify-between"><span className="label mb-0">Modules</span>
            {Object.keys(edit.permissions).length>0&&<button className="flex items-center gap-1 text-xs text-brand" onClick={()=>setEdit({...edit,permissions:{}})}><RotateCcw size={12}/>Back to role defaults</button>}</div>
            <PermGrid role={edit.role} overrides={edit.permissions} setOverrides={p=>setEdit({...edit,permissions:p})}/></div>
        </div>}
        {!edit._new&&tab==='links'&&<LinkedRecords pid={edit.id} phone={edit.phone} can={can}/>}
        {!edit._new&&tab==='security'&&<div className="space-y-6">
          <div className="rounded-xl border border-ink-600 p-4"><div className="mb-3 flex items-center gap-2 font-semibold text-fg"><KeyRound size={16}/>Set a new password</div>
            <div className="flex gap-2"><input className="input font-mono" placeholder="New password" value={pw} onChange={e=>setPw(e.target.value)} disabled={locked}/>
              <button className="btn-quiet" title="Generate" onClick={()=>setPw(genPw())} disabled={locked}><Wand2 size={15}/></button></div>
            <button className="btn mt-3" disabled={busy||locked||pw.length<8} onClick={resetPw}>Change password</button></div>
          <div className="flex items-center justify-between rounded-xl border border-ink-600 p-4"><div><div className="font-semibold text-fg">Can sign in</div><div className="text-sm text-fog-muted">Switch off to block access without deleting.</div></div>
            <Toggle label="Can sign in" checked={edit.active} disabled={edit.id===user.id||locked||isMaster} onChange={v=>setEdit({...edit,active:v})}/></div>
          {edit.active!==edit._orig.active&&<button className="btn" onClick={save} disabled={busy}>Save</button>}
          <div className="rounded-xl border border-blood/35 bg-blood/5 p-4"><div className="flex items-center gap-2 font-semibold text-fg"><Trash2 size={16} className="text-blood"/>Delete user</div>
            <p className="mt-1 text-sm text-fog-muted">Removes their login. Donor records and history stay.</p>
            <button className="btn-danger mt-3" disabled={busy||edit.id===user.id||locked||isMaster} onClick={remove}>Delete user</button></div>
          {isMaster&&<p className="flex items-center gap-2 text-xs text-ok"><ShieldCheck size={13}/>This is the master admin. It always stays an active admin and can never be deleted.</p>}
          {edit.id===user.id&&<p className="flex items-center gap-2 text-xs text-fog-faint"><ShieldCheck size={13}/>You cannot block or delete your own account.</p>}
        </div>}
      </>}
    </Drawer>
  </div>
}
