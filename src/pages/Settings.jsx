import DataReset from '../components/DataReset'
import {useEffect,useRef,useState} from 'react'
import {toast} from 'sonner'
import {Upload,X,Check,Sun,Moon} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {useBrand,ACCENTS,applyAccent} from '../context/Brand'
import {BLOOD} from '../lib/util'
import {PageHeader,Field} from '../components/ui'

const num=v=>v===''||v===null||v===undefined?null:Number(v)
export default function SettingsPage(){
  const {settings,setSettings}=useAuth(),{brand,refreshBrand,mode,setMode}=useBrand(),file=useRef(),file2=useRef()
  const [f,setF]=useState({...settings}),[th,setTh]=useState({}),[busy,setBusy]=useState(false),[up,setUp]=useState(false),missing=!settings.id
  useEffect(()=>{supabase.from('stock_thresholds').select('*').then(({data})=>setTh(Object.fromEntries((data||[]).map(x=>[x.blood_group,x.min_units]))))},[])
  useEffect(()=>()=>applyAccent(brand.brand_color),[brand.brand_color])
  const set=k=>e=>setF({...f,[k]:e.target.value})
  const pickColor=c=>{setF({...f,brand_color:c});applyAccent(c)}
  const upload=async(e,field='logo_url')=>{const fl=e.target.files?.[0];if(!fl)return;e.target.value=''
    if(!['image/png','image/jpeg','image/webp'].includes(fl.type))return toast.error('Use a PNG, JPG or WEBP image')
    if(fl.size>2*1024*1024)return toast.error('Logo must be smaller than 2 MB')
    setUp(field);const path=`${field==='logo_url'?'logo':'intl-logo'}-${Date.now()}.${fl.name.split('.').pop().toLowerCase()}`
    const {error}=await supabase.storage.from('branding').upload(path,fl,{upsert:true,contentType:fl.type,cacheControl:'3600'})
    if(error){setUp(false);return toast.error(/row-level security|not authorized|403/i.test(error.message)?'Only people with the Settings permission can upload the logo.':error.message)}
    // save the new logo straight away so it is used everywhere without a second click
    const url=supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
    const r=await supabase.from('settings').update({[field]:url}).eq('id',1);setUp(false)
    if(r.error)return toast.error(r.error.message)
    setF(x=>({...x,[field]:url}));setSettings?.(s=>({...s,[field]:url}));refreshBrand?.()
    toast.success(field==='logo_url'?'Logo uploaded and saved. It now shows in the app, reports and certificates.':'International logo saved. It now shows on the right of reports, letters and certificates.')}
  const save=async e=>{e.preventDefault()
    if(!f.brand_name?.trim())return toast.error('Enter a CRM name')
    if(!/^#[0-9a-f]{6}$/i.test(f.brand_color||''))return toast.error('Pick a colour')
    for(const [k,l,min] of [['min_hb','Lowest Hb',5],['min_weight','Lowest weight',30],['gap_male','Gap for men',1],['gap_female','Gap for women',1],['expiry_days','Days until expiry',1]])
      if(num(f[k])===null||num(f[k])<min)return toast.error(`${l} must be at least ${min}`)
    setBusy(true)
    const row={club_name:f.club_name?.trim(),brand_name:f.brand_name.trim(),tagline:f.tagline?.trim()||null,logo_url:f.logo_url||null,intl_logo_url:f.intl_logo_url||null,intl_logo_label:f.intl_logo_label?.trim()||null,website:f.website?.trim()||null,instagram:f.instagram?.trim().replace(/^@/,'')||null,facebook:f.facebook?.trim()||null,brand_color:f.brand_color,
      address:f.address||null,contact_phone:f.contact_phone||null,contact_email:f.contact_email||null,signatory_name:f.signatory_name||null,signatory_title:f.signatory_title||null,signatory2_name:f.signatory2_name||null,signatory2_title:f.signatory2_title||null,reg_no:f.reg_no||null,default_theme:f.default_theme||'dark',
      min_hb:num(f.min_hb),min_weight:num(f.min_weight),gap_male:num(f.gap_male),gap_female:num(f.gap_female),expiry_days:num(f.expiry_days),default_slot_capacity:num(f.default_slot_capacity),year_label:f.year_label?.trim()||'Lionism year',member_subscription:num(f.member_subscription)??0,updated_at:new Date().toISOString()}
    const {data,error}=await supabase.from('settings').update(row).eq('id',1).select().single()
    if(!error){const t=await supabase.from('stock_thresholds').upsert(BLOOD.map(g=>({blood_group:g,min_units:Number(th[g]??5)})));if(t.error){setBusy(false);return toast.error(t.error.message)}}
    setBusy(false);if(error)return toast.error(error.message);setSettings({...settings,...data});await refreshBrand();toast.success('Settings saved')}
  return <><form id="settings-form" onSubmit={save} className="max-w-4xl">
    <PageHeader title="Settings" description="Brand, look and the rules the CRM uses. Confirm medical values with your partner blood bank."
      actions={<button className="btn" form="settings-form" disabled={busy||missing}>{busy?'Saving…':'Save settings'}</button>}/>
    {missing&&<div className="card mb-5 border-warn/40 text-sm text-warn">Settings are not set up in the database yet. Run supabase/v2-permissions.sql and v3 first.</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <section className="card space-y-4 md:col-span-2"><h2 className="font-semibold text-fg">Brand</h2>
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          <div className="flex gap-4">{[['logo_url','Club logo','Left side',file],['intl_logo_url','International logo','Right side of reports',file2]].map(([k,l,h,ref])=>
            <div key={k} className="flex flex-col items-center gap-2"><span className="text-xs font-medium text-fog-muted">{l}</span>
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border border-dashed border-ink-500 bg-ink-900">
                {f[k]?<img src={f[k]} alt={`${l} preview`} className="h-full w-full bg-white object-contain p-2"/>:<span className="px-3 text-center text-xs text-fog-faint">{k==='logo_url'?'No logo yet':'Not added'}</span>}</div>
              <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label={`Upload ${l}`} onChange={e=>upload(e,k)}/>
              <div className="flex gap-1"><button type="button" className="btn-quiet px-3 py-1.5 text-xs" disabled={!!up} onClick={()=>ref.current.click()}><Upload size={13}/>{up===k?'Uploading…':'Upload'}</button>
                {f[k]&&<button type="button" className="btn-ghost" title={`Remove ${l}`} aria-label={`Remove ${l}`} onClick={()=>setF({...f,[k]:null})}><X size={15}/></button>}</div>
              <span className="max-w-[7.5rem] text-center text-[11px] text-fog-faint">{h} · PNG, JPG or WEBP, up to 2 MB</span></div>)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CRM name" required hint="Shown in the menu, login page and title."><input className="input" required maxLength={40} value={f.brand_name||''} onChange={set('brand_name')}/></Field>
            <Field label="Tagline"><input className="input" maxLength={60} value={f.tagline||''} onChange={set('tagline')}/></Field>
            <Field label="Club name" required hint="Printed on certificates and reports."><input className="input" required value={f.club_name||''} onChange={set('club_name')}/></Field>
            <Field label="Club phone"><input className="input" inputMode="tel" value={f.contact_phone||''} onChange={set('contact_phone')}/></Field>
            <Field label="Club email"><input className="input" type="email" value={f.contact_email||''} onChange={set('contact_email')}/></Field>
            <Field label="Address"><input className="input" value={f.address||''} onChange={set('address')}/></Field>
            <Field label="Signed by (name)" hint="Signature line on certificates."><input className="input" value={f.signatory_name||''} onChange={set('signatory_name')}/></Field>
            <Field label="Signed by (title)"><input className="input" value={f.signatory_title||''} onChange={set('signatory_title')}/></Field>
            <Field label="Second signature (name)" hint="For example the Secretary."><input className="input" value={f.signatory2_name||''} onChange={set('signatory2_name')}/></Field>
            <Field label="Second signature (title)"><input className="input" value={f.signatory2_title||''} onChange={set('signatory2_title')}/></Field>
            <Field label="International logo caption" hint="Optional, printed under the right-side logo, e.g. Lions Clubs International."><input className="input" maxLength={60} value={f.intl_logo_label||''} onChange={set('intl_logo_label')}/></Field>
            <Field label="Website" hint="Printed on posts."><input className="input" placeholder="www.yourclub.org" value={f.website||''} onChange={set('website')}/></Field>
            <Field label="Instagram" hint="Handle, printed on posts."><input className="input" placeholder="@yourclub" value={f.instagram||''} onChange={set('instagram')}/></Field>
            <Field label="Facebook page" hint="Printed on posts."><input className="input" placeholder="facebook.com/yourclub" value={f.facebook||''} onChange={set('facebook')}/></Field>
            <Field label="Club registration no." hint="Printed on reports and certificates."><input className="input" value={f.reg_no||''} onChange={set('reg_no')}/></Field>
          </div></div></section>
      <section className="card md:col-span-2"><h2 className="mb-1 font-semibold text-fg">Look</h2><p className="mb-4 text-sm text-fog-muted">Accent colour is for everyone. Day or night is your own choice on this device.</p>
        <div className="flex flex-wrap items-center gap-3">{ACCENTS.map(([n,c])=><button type="button" key={c} onClick={()=>pickColor(c)} title={n} aria-label={n}
            className={`grid h-10 w-10 place-items-center rounded-full ring-offset-2 ring-offset-ink-800 transition ${f.brand_color?.toLowerCase()===c.toLowerCase()?'ring-2 ring-fg':''}`} style={{background:c}}>
            {f.brand_color?.toLowerCase()===c.toLowerCase()&&<Check size={16} className="text-white"/>}</button>)}
          <label className="flex items-center gap-2 text-sm text-fog-muted">Custom<input type="color" value={f.brand_color||'#4C8DFF'} onChange={e=>pickColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-ink-600 bg-transparent"/></label>
          <label className="flex items-center gap-2 text-sm text-fog-muted">Default for new devices
            <select className="input w-auto py-1.5" value={f.default_theme||'dark'} onChange={set('default_theme')}><option value="dark">Night</option><option value="light">Day</option></select></label>
          <div className="ml-auto inline-flex rounded-xl border border-ink-700 bg-ink-900 p-1">{[['dark','Night',Moon],['light','Day',Sun]].map(([m,l,I])=>
            <button type="button" key={m} onClick={()=>setMode(m)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${mode===m?'bg-ink-700 text-fg':'text-fog-muted'}`}><I size={14}/>{l}</button>)}</div></div></section>
      <section className="card space-y-4 md:col-span-2"><h2 className="font-semibold text-fg">Club year and subscription</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name of the club year" hint="The year runs July to next June, e.g. 2026-27."><input className="input" maxLength={30} placeholder="Lionism year" value={f.year_label??''} onChange={set('year_label')}/></Field>
          <Field label="Yearly member subscription (Rs.)" hint="Anything paid above this is flagged and can be moved to donation."><input className="input" type="number" min="0" value={f.member_subscription??''} onChange={set('member_subscription')}/></Field></div></section>
      <section className="card space-y-4"><h2 className="font-semibold text-fg">Camps</h2>
        <Field label="Donors per time slot" hint="Default for new camps. Leave empty for no limit."><input className="input" type="number" min="1" value={f.default_slot_capacity??''} onChange={set('default_slot_capacity')}/></Field></section>
      <section className="card space-y-4"><h2 className="font-semibold text-fg">Blood stock</h2>
        <Field label="Days until a unit expires" required hint="Applied to new units. Whole blood is usually 35 days."><input className="input" type="number" min="1" required value={f.expiry_days??''} onChange={set('expiry_days')}/></Field></section>
      <section className="card md:col-span-2"><h2 className="mb-4 font-semibold text-fg">Screening rules</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Lowest Hb (g/dL)" required><input className="input" type="number" step="0.1" min="5" required value={f.min_hb??''} onChange={set('min_hb')}/></Field>
          <Field label="Lowest weight (kg)" required><input className="input" type="number" step="0.5" min="30" required value={f.min_weight??''} onChange={set('min_weight')}/></Field>
          <Field label="Gap for men (days)" required><input className="input" type="number" min="1" required value={f.gap_male??''} onChange={set('gap_male')}/></Field>
          <Field label="Gap for women (days)" required><input className="input" type="number" min="1" required value={f.gap_female??''} onChange={set('gap_female')}/></Field></div>
        <p className="mt-3 text-xs text-fog-faint">Screening shows warnings from these numbers. The medical officer makes the final decision.</p>
        <div className="label mt-5">Low stock warning below</div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{BLOOD.map(g=><label key={g} className="tile p-2 text-center"><span className="block text-sm font-semibold text-blood">{g}</span>
          <input className="mt-1 w-full bg-transparent text-center text-lg text-fg outline-none" type="number" min="0" aria-label={`Minimum ${g}`} value={th[g]??5} onChange={e=>setTh({...th,[g]:e.target.value})}/></label>)}</div></section>
    </div></form>
    <div className="max-w-4xl"><DataReset/></div></>
}
