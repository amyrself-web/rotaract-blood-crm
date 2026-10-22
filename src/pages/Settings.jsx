import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {BLOOD} from '../lib/util'
import {PageHeader,Field} from '../components/ui'

export default function SettingsPage(){
  const {settings,setSettings}=useAuth()
  const [f,setF]=useState(settings),[th,setTh]=useState({}),[busy,setBusy]=useState(false),missing=!settings.id
  useEffect(()=>{supabase.from('stock_thresholds').select('*').then(({data})=>setTh(Object.fromEntries((data||[]).map(x=>[x.blood_group,x.min_units]))))},[])
  const set=k=>e=>setF({...f,[k]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true)
    const num=k=>f[k]===''||f[k]===null?null:Number(f[k])
    const row={club_name:f.club_name,min_hb:num('min_hb'),min_weight:num('min_weight'),gap_male:num('gap_male'),gap_female:num('gap_female'),expiry_days:num('expiry_days'),default_slot_capacity:num('default_slot_capacity'),updated_at:new Date().toISOString()}
    const {data,error}=await supabase.from('settings').update(row).eq('id',1).select().single()
    if(!error){const ups=BLOOD.map(g=>({blood_group:g,min_units:Number(th[g]??5)}));const t=await supabase.from('stock_thresholds').upsert(ups);if(t.error){setBusy(false);return toast.error(t.error.message)}}
    setBusy(false);if(error)return toast.error(error.message);setSettings({...settings,...data});toast.success('Settings saved')}
  return <form onSubmit={save} className="max-w-4xl">
    <PageHeader title="Settings" description="Rules the CRM uses for screening, stock and camps. Confirm medical values with your partner blood bank."
      actions={<button className="btn" disabled={busy||missing}>{busy?'Saving…':'Save settings'}</button>}/>
    {missing&&<div className="card mb-5 border-warn/40 text-sm text-warn">Settings are not set up in the database yet. Run supabase/v2-permissions.sql first.</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <section className="card space-y-4"><h2 className="font-semibold text-white">Club</h2>
        <Field label="Club name" hint="Shown on reports and messages."><input className="input" value={f.club_name||''} onChange={set('club_name')}/></Field></section>
      <section className="card space-y-4"><h2 className="font-semibold text-white">Camps</h2>
        <Field label="Donors per time slot" hint="Default for new camps. Leave empty for no limit."><input className="input" type="number" min="1" value={f.default_slot_capacity??''} onChange={set('default_slot_capacity')}/></Field></section>
      <section className="card md:col-span-2"><h2 className="mb-4 font-semibold text-white">Screening rules</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Lowest Hb (g/dL)"><input className="input" type="number" step="0.1" value={f.min_hb??''} onChange={set('min_hb')}/></Field>
          <Field label="Lowest weight (kg)"><input className="input" type="number" step="0.5" value={f.min_weight??''} onChange={set('min_weight')}/></Field>
          <Field label="Gap for men (days)"><input className="input" type="number" value={f.gap_male??''} onChange={set('gap_male')}/></Field>
          <Field label="Gap for women (days)"><input className="input" type="number" value={f.gap_female??''} onChange={set('gap_female')}/></Field></div>
        <p className="mt-3 text-xs text-fog-faint">Screening shows warnings from these numbers. The medical officer makes the final decision.</p></section>
      <section className="card md:col-span-2"><h2 className="mb-4 font-semibold text-white">Blood stock</h2>
        <Field label="Days until a unit expires" hint="Applied to new units. Whole blood is usually 35 days." className="max-w-xs"><input className="input" type="number" min="1" value={f.expiry_days??''} onChange={set('expiry_days')}/></Field>
        <div className="label mt-5">Low stock warning below</div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{BLOOD.map(g=><label key={g} className="tile p-2 text-center"><span className="block text-sm font-semibold text-blood">{g}</span>
          <input className="mt-1 w-full bg-transparent text-center text-lg text-white outline-none" type="number" min="0" value={th[g]??5} onChange={e=>setTh({...th,[g]:e.target.value})}/></label>)}</div></section>
    </div></form>
}
