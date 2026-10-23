import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Plus,Search,Boxes,Trash2,FileText,UserRound} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useBrand} from '../context/Brand'
import {fmt} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,useLive,undoToast,code,errText} from '../components/ui'
import {buildPdf,rs} from '../lib/docpdf'

const CATS=['Banners and printing','Medical supplies','Furniture and setup','Electronics','Stationery','Uniform','Other']
const COND={New:'green',Good:'green','Needs repair':'amber',Lost:'red',Disposed:'neutral'}
const empty={name:'',category:'Banners and printing',qty:1,condition:'Good',kept_with:'',kept_at:'',purchased_on:'',value:'',notes:''}

// Things the club owns, and who has them now
export default function Assets(){
  const {brand}=useBrand(),[rows,setRows]=useState(null),[q,setQ]=useState(''),[cat,setCat]=useState(''),[form,setForm]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>supabase.from('club_assets').select('*').is('deleted_at',null).order('category').order('asset_no').then(({data,error})=>error?toast.error(error.message):setRows(data))
  useEffect(()=>{load()},[]);useLive(['club_assets'],load)
  const list=(rows||[]).filter(a=>(!cat||a.category===cat)&&(!q||`${a.name} ${a.kept_with} ${a.kept_at}`.toLowerCase().includes(q.toLowerCase())))
  const set=f=>e=>setForm({...form,[f]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true);const {id,asset_no,created_at,created_by,deleted_at,deleted_by,...rest}=form
    const row={...Object.fromEntries(Object.entries(rest).map(([a,v])=>[a,v===''?null:v])),qty:Number(form.qty),updated_at:new Date().toISOString()}
    const r=id?await supabase.from('club_assets').update(row).eq('id',id):await supabase.from('club_assets').insert(row);setBusy(false)
    if(r.error)return toast.error(r.error.message);toast.success('Saved');setForm(null);load()}
  const del=async()=>{const id=form.id;const r=await supabase.from('club_assets').update({deleted_at:new Date().toISOString()}).eq('id',id);if(r.error)return toast.error(r.error.message);setForm(null);load()
    undoToast('Removed',async()=>{await supabase.from('club_assets').update({deleted_at:null}).eq('id',id);load()})}
  const pdf=()=>buildPdf({title:'Asset register',heading:'Club asset register',subtitle:`${rows.length} items as on ${fmt(new Date())}`,brand,footer:'Asset register',filename:'asset-register.pdf',blocks:[
    {type:'stats',items:[['Items',rows.length],['Pieces',rows.reduce((a,x)=>a+x.qty,0)],['Needs repair',rows.filter(x=>x.condition==='Needs repair').length,'blood'],['Value',rs(rows.reduce((a,x)=>a+Number(x.value||0),0))]]},
    ...CATS.filter(c=>rows.some(a=>a.category===c)).map(c=>({type:'table',heading:c,columns:['No.','Item','Qty','Condition','With','Where','Value'],
      rows:rows.filter(a=>a.category===c).map(a=>[code('A',a.asset_no,3),a.name,a.qty,a.condition,a.kept_with||'',a.kept_at||'',a.value?rs(a.value):'']),opts:{columnStyles:{2:{halign:'right'},6:{halign:'right'}}}})),
    {type:'signatures',items:[['','Checked by'],[brand.signatory2_name,brand.signatory2_title||'Secretary']]}]}).catch(e=>toast.error(errText(e)))
  return <div>
    <PageHeader eyebrow="Club" title="Club assets" description="Banners, standees, first aid kits and everything the club owns, and who has it now."
      actions={<>{rows?.length>0&&<button className="btn-quiet" onClick={pdf}><FileText size={15}/>Asset register</button>}<button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add item</button></>}/>
    <div className="mb-4 flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search item or person" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <select className="input w-auto" aria-label="Category" value={cat} onChange={e=>setCat(e.target.value)}><option value="">All categories</option>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
    {rows&&!list.length?<div className="card"><Empty icon={Boxes} title={rows.length?'Nothing matches':'No assets yet'} action={!rows.length&&<button className="btn" onClick={()=>setForm({...empty})}><Plus size={16}/>Add item</button>}>Note down every banner, standee and box, and who keeps it, so nothing goes missing between camps.</Empty></div>:
    <div className="card overflow-hidden p-0"><ul className="divide-y divide-ink-700/80">{list.map(a=><li key={a.id}><button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-800/60" onClick={()=>setForm({...empty,...Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v??'']))})}>
      <span className="code">{code('A',a.asset_no,3)}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-fg">{a.name}{a.qty>1&&<span className="ml-1.5 text-fog-muted">× {a.qty}</span>}</span><span className="block truncate text-xs text-fog-faint">{a.category}</span></span>
      {(a.kept_with||a.kept_at)&&<span className="hidden text-sm text-fog-muted sm:block"><UserRound size={13} className="mr-1 inline"/>{[a.kept_with,a.kept_at].filter(Boolean).join(' · ')}</span>}<Badge tone={COND[a.condition]}>{a.condition}</Badge></button></li>)}</ul></div>}
    <Drawer open={!!form} onClose={()=>setForm(null)} title={form?.id?`${code('A',form.asset_no,3)} · ${form.name}`:'Add item'} footer={form&&<>{form.id&&<button className="btn-quiet mr-auto text-blood" onClick={del}><Trash2 size={15}/>Remove</button>}<button className="btn-quiet" onClick={()=>setForm(null)}>Cancel</button><button className="btn" form="asset-form" disabled={busy}>Save</button></>}>
      {form&&<form id="asset-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Item" required className="sm:col-span-2"><input className="input" required minLength={2} value={form.name} onChange={set('name')}/></Field>
        <Field label="Category"><select className="input" value={form.category} onChange={set('category')}>{CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Quantity"><input type="number" min="0" className="input" value={form.qty} onChange={set('qty')}/></Field>
        <Field label="Condition"><select className="input" value={form.condition} onChange={set('condition')}>{Object.keys(COND).map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Value (Rs.)"><input type="number" min="0" className="input" value={form.value} onChange={set('value')}/></Field>
        <Field label="Kept with" hint="Who has it now"><input className="input" value={form.kept_with} onChange={set('kept_with')}/></Field>
        <Field label="Kept at"><input className="input" placeholder="Club room, member's house" value={form.kept_at} onChange={set('kept_at')}/></Field>
        <Field label="Bought on"><input type="date" className="input" value={form.purchased_on} onChange={set('purchased_on')}/></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={form.notes} onChange={set('notes')}/></Field></form>}
    </Drawer>
  </div>
}
