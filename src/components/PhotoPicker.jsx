import {useRef,useState} from 'react'
import {toast} from 'sonner'
import {Camera,Trash2} from 'lucide-react'
import {supabase} from '../lib/supabase'

// shrink to at most 600 px and save as JPEG, so a phone photo of 4 MB becomes about 80 KB
async function shrink(file){
  const img=await createImageBitmap(file),k=Math.min(1,600/Math.max(img.width,img.height))
  const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height)
  return new Promise(res=>c.toBlob(res,'image/jpeg',0.86))
}

// self=true: the logged-in member sets their own photo (uses set_my_photo); otherwise staff update members.photo_url
export function PhotoPicker({member,self=false,onSaved}){
  const inp=useRef(),[busy,setBusy]=useState(false),url=member.photo_url||''
  const setUrl=async u=>{const r=self?await supabase.rpc('set_my_photo',{p_url:u}):await supabase.from('members').update({photo_url:u}).eq('id',member.id);if(r.error)throw r.error}
  const pick=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return
    if(!/^image\/(png|jpeg|webp)$/.test(f.type))return toast.error('Choose a JPG, PNG or WebP photo')
    setBusy(true);try{const blob=await shrink(f),path=`${member.id}/photo-${Date.now()}.jpg`
      const up=await supabase.storage.from('member-photos').upload(path,blob,{contentType:'image/jpeg',upsert:true});if(up.error)throw up.error
      const u=supabase.storage.from('member-photos').getPublicUrl(path).data.publicUrl;await setUrl(u);toast.success('Photo saved');onSaved?.(u)}
    catch(err){toast.error(/row-level security/i.test(err.message)?'You do not have permission to upload this photo':err.message)}setBusy(false)}
  const clear=async()=>{setBusy(true);try{await setUrl(null);onSaved?.('')}catch(err){toast.error(err.message)}setBusy(false)}
  return <div className="tile flex items-center gap-4 p-4">
    <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-700 text-fog-faint">{url?<img src={url} alt="Member photo" className="h-full w-full object-cover"/>:<Camera size={22}/>}</div>
    <div className="flex-1"><div className="font-medium text-fg">Photo</div><div className="text-xs text-fog-muted">A clear passport-style face photo. It is printed on the ID card.</div>
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="btn-quiet" disabled={busy} onClick={()=>inp.current.click()}><Camera size={15}/>{busy?'Saving…':url?'Change photo':'Upload photo'}</button>
        {url&&<button type="button" className="btn-ghost text-fog-faint hover:text-blood" disabled={busy} onClick={clear} aria-label="Remove photo"><Trash2 size={15}/></button>}</div></div>
    <input ref={inp} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Photo file" onChange={pick}/>
  </div>
}
