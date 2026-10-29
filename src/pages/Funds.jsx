import {useEffect,useMemo,useState} from 'react'
import {toast} from 'sonner'
import {motion} from 'framer-motion'
import {Plus,Search,HandCoins,Receipt,FileText,Download,MessageCircle,Ban,ArrowDownLeft,ArrowUpRight,Wallet} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../context/Auth'
import {useBrand} from '../context/Brand'
import {fmt,normPhone} from '../lib/util'
import {PageHeader,Drawer,Field,Badge,Empty,Tabs,useLive,undoToast,code,errText,todayIso,useConfirm} from '../components/ui'
import {rotaryYear,csv,iso} from '../lib/clubReports'
import {YEAR_NAME} from '../lib/year'
import {buildPdf,rs,pad,GREEN} from '../lib/docpdf'
import {inWords} from '../lib/money'
import CountUp from '../components/CountUp'
import WaSend from '../components/wa/WaSend'

const PURPOSES=['General fund','Blood donation camp','Eye donation drive','Community service','Emergency medical help','Club events','Other']
const MODES=['Cash','UPI','Bank transfer','Cheque','Card']
const CATS=['Printing and stationery','Event and meeting','Travel','Medical help','Awareness drive','Rent and hall','Gifts and mementos','Bank charges','Other']
const needsRef=m=>['UPI','Bank transfer','Cheque'].includes(m)
const emptyGift=()=>({donor_name:'',phone:'',email:'',address:'',amount:'',received_on:todayIso(),mode:'UPI',reference:'',purpose:'General fund',camp_id:'',received_by:'',anonymous:false,notes:''})
const emptyExp=()=>({spent_on:todayIso(),category:'Printing and stationery',paid_to:'',description:'',amount:'',mode:'Cash',reference:'',approved_by:''})

export async function donationReceipt(g,brand,camps=[]){
  const camp=camps.find(c=>c.id===g.camp_id)
  return buildPdf({title:'Donation receipt',heading:`${rs(g.amount)} received with thanks`,subtitle:`From ${g.donor_name}  ·  ${fmt(g.received_on)}`,docNo:pad('DR',g.receipt_no,4),brand,
    footer:`Donation receipt ${pad('DR',g.receipt_no,4)}`,copies:['Donor copy','Office copy'],filename:`receipt-${pad('DR',g.receipt_no,4)}.pdf`,
    meta:[['Receipt no.',pad('DR',g.receipt_no,4)],['Date',fmt(g.received_on)],['Status',g.status==='cancelled'?'CANCELLED':'Paid']],
    blocks:[
      {type:'boxes',boxes:[{title:'Received from',rows:[['Name',g.donor_name],['Mobile',g.phone||'-'],['Email',g.email||'-'],['Address',g.address||'-']]},
        {title:'Payment',rows:[['Mode',g.mode],['Reference',g.reference||'-'],['Purpose',g.purpose],['Received by',g.received_by||'-']]}]},
      {type:'table',heading:'Details',columns:['#','Description','Amount'],rows:[[1,`Donation towards ${g.purpose.toLowerCase()}${camp?` (${camp.name})`:''}${g.notes?`. ${g.notes}`:''}`,rs(g.amount)]],
        opts:{columnStyles:{0:{cellWidth:10},2:{halign:'right',cellWidth:38}},foot:[['','Total received',rs(g.amount)]]}},
      {type:'text',heading:'Amount in words',text:inWords(g.amount)},
      g.status==='cancelled'?{type:'text',heading:'This receipt is cancelled',text:g.cancel_reason}:{type:'text',text:`Thank you for supporting ${brand.club_name||'our club'}. Your contribution helps us run blood donation camps, eye donation drives and community service.`},
      {type:'signatures',items:[['','Received by'],[brand.signatory_name,brand.signatory_title||'President']]}]})
}
async function expenseVoucher(x,brand){
  return buildPdf({title:'Payment voucher',heading:`${rs(x.amount)} paid to ${x.paid_to}`,subtitle:`${x.category}  ·  ${fmt(x.spent_on)}`,docNo:pad('EV',x.voucher_no,4),brand,
    footer:`Payment voucher ${pad('EV',x.voucher_no,4)}`,filename:`voucher-${pad('EV',x.voucher_no,4)}.pdf`,
    meta:[['Voucher no.',pad('EV',x.voucher_no,4)],['Date',fmt(x.spent_on)],['Status',x.status==='cancelled'?'CANCELLED':'Paid']],
    blocks:[{type:'boxes',boxes:[{title:'Paid to',rows:[['Name',x.paid_to],['Category',x.category]]},{title:'Payment',rows:[['Mode',x.mode],['Reference',x.reference||'-'],['Approved by',x.approved_by||'-']]}]},
      {type:'table',heading:'Details',columns:['#','Description','Amount'],rows:[[1,x.description||x.category,rs(x.amount)]],opts:{columnStyles:{0:{cellWidth:10},2:{halign:'right',cellWidth:38}},foot:[['','Total paid',rs(x.amount)]]}},
      {type:'text',heading:'Amount in words',text:inWords(x.amount)},
      x.status==='cancelled'?{type:'text',heading:'This voucher is cancelled',text:x.cancel_reason}:{type:'text'},
      {type:'signatures',items:[['','Received by (payee)'],[x.approved_by,'Approved by'],['','Treasurer']]}]})
}
async function accountsPdf(s,brand,P){
  const inc=s.donations+s.dues+s.sponsors,out=s.camp_expenses+s.club_expenses,bal=inc-out
  return buildPdf({title:'Accounts statement',heading:`Club accounts, ${P.label}`,subtitle:`From ${fmt(P.from)} to ${fmt(P.to)}`,docNo:`AC-${P.from.slice(2,4)}${P.to.slice(2,4)}`,brand,
    footer:`Accounts ${P.label}`,filename:`accounts-${P.from}-${P.to}.pdf`,blocks:[
      {type:'stats',items:[['Money in',rs(inc)],['Money out',rs(out),'blood'],['Balance',rs(bal)],['Donation receipts',s.donation_count]]},
      {type:'table',heading:'Money in',columns:['Source','Amount'],rows:[['Donations received',rs(s.donations)],['Membership dues',rs(s.dues)],['Camp sponsorship received',rs(s.sponsors)]],
        opts:{columnStyles:{1:{halign:'right'}},foot:[['Total money in',rs(inc)]]}},
      {type:'table',heading:'Donations by purpose',columns:['Purpose','Receipts','Amount'],rows:s.by_purpose.map(x=>[x.purpose,x.count,rs(x.amount)]),opts:{columnStyles:{1:{halign:'center'},2:{halign:'right'}}},empty:'No donations in this period.'},
      {type:'table',heading:'Money out',columns:['Category','Amount'],rows:s.expense_by_category.map(x=>[x.category,rs(x.amount)]),opts:{columnStyles:{1:{halign:'right'}},foot:[['Total money out',rs(out)]]},empty:'No expenses in this period.'},
      {type:'table',heading:'Month by month',columns:['Month','In','Out','Net'],rows:s.monthly.map(m=>[new Date(m.month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'}),rs(m.in),rs(m.out),rs(m.in-m.out)]),
        opts:{columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}}},
      {type:'totals',rows:[['Money in',rs(inc)],['Money out',rs(out)]],final:['Balance',rs(bal)],negative:bal<0,side:`Collection by mode:\n${s.by_mode.map(x=>`${x.mode}: ${rs(x.amount)}`).join('\n')||'-'}`},
      {type:'signatures',items:[['','Treasurer'],[brand.signatory2_name,brand.signatory2_title||'Secretary'],[brand.signatory_name,brand.signatory_title||'President']]}]})
}

export default function Funds(){
  const {settings}=useAuth(),{brand}=useBrand(),confirm=useConfirm(),ry=rotaryYear()
  const [view,setView]=useState('in'),[gifts,setGifts]=useState(null),[exps,setExps]=useState(null),[camps,setCamps]=useState([]),[q,setQ]=useState(''),[pf,setPf]=useState('')
  const [gf,setGf]=useState(null),[xf,setXf]=useState(null),[busy,setBusy]=useState(false),[cancel,setCancel]=useState(null),[sum,setSum]=useState(null),[pdf,setPdf]=useState('')
  const [range,setRange]=useState({from:ry.from,to:ry.to,label:ry.label})
  const load=async()=>{try{const [g,x,c]=await Promise.all([supabase.from('contributions').select('*').order('receipt_no',{ascending:false}),supabase.from('club_expenses').select('*').order('voucher_no',{ascending:false}),
      supabase.from('camps').select('id,name,camp_date,camp_no').is('deleted_at',null).order('camp_date',{ascending:false})])
    if(g.error)throw g.error;setGifts(g.data);setExps(x.data||[]);setCamps(c.data||[])}catch(e){toast.error(errText(e))}}
  const loadSum=()=>supabase.rpc('funds_summary',{p_from:range.from,p_to:range.to}).then(({data,error})=>error?toast.error(error.message):setSum(data))
  useEffect(()=>{load()},[]);useEffect(()=>{loadSum()},[range.from,range.to,view])
  useLive(['contributions','club_expenses','member_dues','sponsors','expenses'],()=>{load();loadSum()})
  const run=async(k,f)=>{setPdf(k);try{await f()}catch(e){toast.error(errText(e))}setPdf('')}
  const clean=(o,skip)=>Object.fromEntries(Object.entries(o).filter(([k])=>!skip.includes(k)).map(([k,v])=>[k,v===''?null:v]))
  const saveGift=async e=>{e.preventDefault();if(gf.phone&&!/^[6-9]\d{9}$/.test(normPhone(gf.phone)))return toast.error('Mobile number must be 10 digits')
    if(needsRef(gf.mode)&&!gf.reference.trim())return toast.error('Enter the UPI, bank or cheque reference number')
    setBusy(true);const row=clean({...gf,phone:gf.phone?normPhone(gf.phone):'',amount:Number(gf.amount)},['id','receipt_no','created_at','created_by','status','cancel_reason','member_id','donor_id','_orig'])
    const r=gf.id?await supabase.from('contributions').update(row).eq('id',gf.id).select().single():await supabase.from('contributions').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message)
    if(gf.id){const prev=clean(gf._orig,['id','receipt_no','created_at','created_by','status','cancel_reason','member_id','donor_id']);undoToast('Receipt updated',async()=>{const x=await supabase.from('contributions').update(prev).eq('id',gf.id);if(x.error)throw x.error;load()})}
    else toast.success(`Receipt ${code('DR',r.data.receipt_no,4)} saved`,{action:{label:'Download',onClick:()=>donationReceipt(r.data,brand,camps)}})
    setGf(null);load()}
  const saveExp=async e=>{e.preventDefault();setBusy(true);const row=clean({...xf,amount:Number(xf.amount)},['id','voucher_no','created_at','created_by','status','cancel_reason','_orig'])
    const r=xf.id?await supabase.from('club_expenses').update(row).eq('id',xf.id).select().single():await supabase.from('club_expenses').insert(row).select().single();setBusy(false)
    if(r.error)return toast.error(r.error.message);toast.success(xf.id?'Voucher updated':`Voucher ${code('EV',r.data.voucher_no,4)} saved`);setXf(null);load()}
  const doCancel=async e=>{e.preventDefault();const t=cancel.kind==='g'?'contributions':'club_expenses'
    const r=await supabase.from(t).update({status:'cancelled',cancel_reason:cancel.reason}).eq('id',cancel.row.id);if(r.error)return toast.error(r.error.message)
    toast.success(cancel.kind==='g'?'Receipt cancelled. It stays in the register, marked cancelled.':'Voucher cancelled');setCancel(null);setGf(null);setXf(null);load()}
  const thanks=g=>`Dear ${g.donor_name}, thank you for your donation of ${rs(g.amount)} to ${settings.club_name||brand.club_name} (receipt ${code('DR',g.receipt_no,4)}, ${fmt(g.received_on)}) towards ${g.purpose.toLowerCase()}. We are grateful for your support.`
  const shownG=(gifts||[]).filter(g=>(!pf||g.purpose===pf)&&(!q||`${code('DR',g.receipt_no,4)} ${g.donor_name} ${g.phone||''} ${g.reference||''} ${g.purpose}`.toLowerCase().includes(q.toLowerCase())))
  const shownX=(exps||[]).filter(x=>!q||`${code('EV',x.voucher_no,4)} ${x.paid_to} ${x.category} ${x.description||''}`.toLowerCase().includes(q.toLowerCase()))
  const yearIn=(gifts||[]).filter(g=>g.status==='received'&&g.received_on>=ry.from&&g.received_on<=ry.to)
  const inc=sum?sum.donations+sum.dues+sum.sponsors:0,out=sum?sum.camp_expenses+sum.club_expenses:0
  const periods={year:{...ry},month:(()=>{const d=new Date();return {from:iso(new Date(d.getFullYear(),d.getMonth(),1)),to:iso(new Date(d.getFullYear(),d.getMonth()+1,0)),label:d.toLocaleDateString('en-IN',{month:'short',year:'numeric'})}})()}
  const g1=k=>e=>setGf({...gf,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}),x1=k=>e=>setXf({...xf,[k]:e.target.value})

  return <div>
    <PageHeader title="Money donations and accounts" description="Receipts for every rupee received, vouchers for club spending, and the accounts statement."
      actions={<><button className="btn-quiet" onClick={()=>setXf(emptyExp())}><ArrowUpRight size={15}/>Record expense</button><button className="btn" onClick={()=>setGf(emptyGift())}><Plus size={16}/>New receipt</button></>}/>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card py-4"><div className="text-2xl font-semibold text-ok">{rs(yearIn.reduce((a,g)=>a+Number(g.amount),0))}</div><div className="text-xs text-fog-muted">Donations received {ry.label}</div><div className="mt-1 text-[11px] text-fog-faint">{yearIn.length} receipts</div></div>
      <div className="card py-4"><div className="text-2xl font-semibold text-fg">{sum?rs(inc):'-'}</div><div className="text-xs text-fog-muted">All money in</div><div className="mt-1 text-[11px] text-fog-faint">Donations, dues, sponsorship</div></div>
      <div className="card py-4"><div className="text-2xl font-semibold text-blood">{sum?rs(out):'-'}</div><div className="text-xs text-fog-muted">All money out</div><div className="mt-1 text-[11px] text-fog-faint">Club and camp expenses</div></div>
      <div className="card py-4"><div className={`text-2xl font-semibold ${inc-out<0?'text-blood':'text-fg'}`}>{sum?rs(inc-out):'-'}</div><div className="text-xs text-fog-muted">Balance ({range.label})</div></div></div>
    <div className="mb-3 flex flex-wrap items-center gap-3"><Tabs id="fund-tabs" value={view} onChange={setView} tabs={[['in','Donations received'],['out','Club expenses'],['acc','Accounts']]}/>
      {view!=='acc'&&<div className="relative mb-5 min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-faint"/><input className="input pl-9" placeholder="Search name, receipt, reference" value={q} onChange={e=>setQ(e.target.value)}/></div>}
      {view==='in'&&<select className="input mb-5 w-auto" aria-label="Purpose" value={pf} onChange={e=>setPf(e.target.value)}><option value="">All purposes</option>{PURPOSES.map(p=><option key={p}>{p}</option>)}</select>}
      {view==='in'&&<button className="btn-quiet mb-5" onClick={()=>csv(shownG.map(g=>({receipt:code('DR',g.receipt_no,4),date:g.received_on,name:g.donor_name,phone:g.phone,purpose:g.purpose,mode:g.mode,reference:g.reference,amount:g.amount,status:g.status,cancel_reason:g.cancel_reason})),'donations-received.csv')}><Download size={15}/>CSV</button>}
      {view==='out'&&<button className="btn-quiet mb-5" onClick={()=>csv(shownX.map(x=>({voucher:code('EV',x.voucher_no,4),date:x.spent_on,paid_to:x.paid_to,category:x.category,description:x.description,mode:x.mode,amount:x.amount,status:x.status})),'club-expenses.csv')}><Download size={15}/>CSV</button>}</div>

    {view==='in'&&(gifts===null?<div className="skeleton h-24"/>:!shownG.length?<div className="card"><Empty icon={HandCoins} title={gifts.length?'No receipts match':'No donations recorded yet'} action={!gifts.length&&<button className="btn" onClick={()=>setGf(emptyGift())}><Plus size={16}/>New receipt</button>}>Record money given to the club and give the person a receipt.</Empty></div>
    :<div className="card overflow-hidden p-0"><ul className="divide-y divide-ink-700/80">{shownG.map((g,i)=><motion.li key={g.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:Math.min(i,10)*.02}} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${g.status==='cancelled'?'bg-ink-750 text-fog-faint':'bg-ok/10 text-ok'}`}><ArrowDownLeft size={19}/></span>
      <button className="min-w-0 flex-1 text-left" onClick={()=>setGf({...emptyGift(),...Object.fromEntries(Object.entries(g).map(([k,v])=>[k,v??''])),_orig:g})}>
        <div className="flex flex-wrap items-center gap-2"><span className="code">{code('DR',g.receipt_no,4)}</span><span className={`truncate font-medium ${g.status==='cancelled'?'text-fog-faint line-through':'text-fg'}`}>{g.donor_name}</span>{g.status==='cancelled'&&<Badge tone="red">Cancelled</Badge>}</div>
        <div className="mt-0.5 truncate text-xs text-fog-faint">{fmt(g.received_on)} · {g.purpose} · {g.mode}{g.reference?` ${g.reference}`:''}</div></button>
      <span className={`font-display text-lg font-semibold tabular-nums ${g.status==='cancelled'?'text-fog-faint line-through':'text-fg'}`}>{rs(g.amount)}</span>
      <div className="flex gap-1"><button className="btn-ghost" title="Download receipt" aria-label={`Download receipt ${code('DR',g.receipt_no,4)}`} onClick={()=>run(g.id,()=>donationReceipt(g,brand,camps))} disabled={pdf===g.id}><FileText size={16}/></button>
        {g.phone&&g.status==='received'&&<WaSend className="btn-ghost" title="Thank on WhatsApp" kind="donation_thanks" refId={g.id} phone={g.phone} name={g.donor_name} text={thanks(g)}><MessageCircle size={16}/></WaSend>}</div></motion.li>)}</ul></div>)}

    {view==='out'&&(exps===null?<div className="skeleton h-24"/>:!shownX.length?<div className="card"><Empty icon={Wallet} title="No club expenses yet" action={<button className="btn" onClick={()=>setXf(emptyExp())}><Plus size={16}/>Record expense</button>}>Camp expenses are on Camp planning. Record other club spending here.</Empty></div>
    :<div className="card overflow-hidden p-0"><ul className="divide-y divide-ink-700/80">{shownX.map(x=><li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${x.status==='cancelled'?'bg-ink-750 text-fog-faint':'bg-blood/10 text-blood'}`}><ArrowUpRight size={19}/></span>
      <button className="min-w-0 flex-1 text-left" onClick={()=>setXf({...emptyExp(),...Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v??''])),_orig:x})}>
        <div className="flex flex-wrap items-center gap-2"><span className="code">{code('EV',x.voucher_no,4)}</span><span className={`truncate font-medium ${x.status==='cancelled'?'text-fog-faint line-through':'text-fg'}`}>{x.paid_to}</span>{x.status==='cancelled'&&<Badge tone="red">Cancelled</Badge>}</div>
        <div className="mt-0.5 truncate text-xs text-fog-faint">{fmt(x.spent_on)} · {x.category}{x.description?` · ${x.description}`:''}</div></button>
      <span className="font-display text-lg font-semibold tabular-nums text-fg">{rs(x.amount)}</span>
      <button className="btn-ghost" title="Download voucher" aria-label={`Download voucher ${code('EV',x.voucher_no,4)}`} onClick={()=>run(x.id,()=>expenseVoucher(x,brand))}><FileText size={16}/></button></li>)}</ul></div>)}

    {view==='acc'&&<div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3"><div className="flex-1"><h2 className="font-semibold text-fg">Accounts statement</h2><p className="text-sm text-fog-muted">Donations, dues and sponsorship in; club and camp expenses out.</p></div>
        <select className="input w-auto" aria-label="Period" onChange={e=>{const p=periods[e.target.value];if(p)setRange({from:p.from,to:p.to,label:p.label})}}><option value="year">{YEAR_NAME} {ry.label}</option><option value="month">This month</option></select>
        <input type="date" className="input w-auto" aria-label="From" value={range.from} onChange={e=>setRange({...range,from:e.target.value,label:`${e.target.value} to ${range.to}`})}/>
        <input type="date" className="input w-auto" aria-label="To" value={range.to} onChange={e=>setRange({...range,to:e.target.value,label:`${range.from} to ${e.target.value}`})}/>
        <button className="btn" disabled={!sum||!!pdf} onClick={()=>run('acc',()=>accountsPdf(sum,brand,range))}><FileText size={15}/>{pdf==='acc'?'Preparing…':'Statement PDF'}</button></div>
      {!sum?<div className="skeleton h-40"/>:<div className="grid gap-5 lg:grid-cols-2">
        <section className="card"><h3 className="mb-3 font-semibold text-fg">Money in</h3>{[['Donations received',sum.donations],['Membership dues',sum.dues],['Camp sponsorship received',sum.sponsors]].map(([l,v])=>
          <div key={l} className="flex justify-between border-b border-ink-700 py-2 text-sm"><span className="text-fog-muted">{l}</span><span className="font-semibold tabular-nums text-fg">{rs(v)}</span></div>)}
          <div className="flex justify-between pt-3 font-semibold"><span className="text-fg">Total</span><span className="tabular-nums text-ok">{rs(inc)}</span></div>
          {sum.by_purpose.length>0&&<div className="mt-4 space-y-2">{sum.by_purpose.map(x=><div key={x.purpose}><div className="flex justify-between text-xs"><span className="text-fog-muted">{x.purpose} ({x.count})</span><span className="tabular-nums text-fg">{rs(x.amount)}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700"><motion.div initial={{width:0}} animate={{width:`${Math.round(x.amount/Math.max(1,sum.donations)*100)}%`}} transition={{duration:.6}} className="h-full rounded-full bg-ok"/></div></div>)}</div>}</section>
        <section className="card"><h3 className="mb-3 font-semibold text-fg">Money out</h3>{sum.expense_by_category.length?sum.expense_by_category.map(x=>
          <div key={x.category} className="flex justify-between border-b border-ink-700 py-2 text-sm"><span className="text-fog-muted">{x.category}</span><span className="font-semibold tabular-nums text-fg">{rs(x.amount)}</span></div>):<p className="text-sm text-fog-faint">No expenses in this period.</p>}
          <div className="flex justify-between pt-3 font-semibold"><span className="text-fg">Total</span><span className="tabular-nums text-blood">{rs(out)}</span></div>
          <div className={`mt-4 flex items-center justify-between rounded-xl px-4 py-3 ${inc-out<0?'bg-blood/10':'bg-ok/10'}`}><span className="font-semibold text-fg">Balance</span><span className={`font-display text-xl font-semibold tabular-nums ${inc-out<0?'text-blood':'text-ok'}`}>{rs(inc-out)}</span></div></section>
        {sum.monthly.length>0&&<section className="card lg:col-span-2"><h3 className="mb-4 font-semibold text-fg">Month by month</h3>
          <div className="flex h-44 items-end gap-3">{sum.monthly.map(m=>{const mx=Math.max(1,...sum.monthly.flatMap(z=>[z.in,z.out]))
            return <div key={m.month} className="flex flex-1 flex-col items-center gap-1"><div className="flex h-36 w-full items-end justify-center gap-1">
              <motion.div title={`In ${rs(m.in)}`} initial={{height:0}} animate={{height:`${m.in/mx*100}%`}} transition={{duration:.6}} className="w-1/3 max-w-6 rounded-t bg-ok"/>
              <motion.div title={`Out ${rs(m.out)}`} initial={{height:0}} animate={{height:`${m.out/mx*100}%`}} transition={{duration:.6,delay:.1}} className="w-1/3 max-w-6 rounded-t bg-blood"/></div>
              <div className="text-[11px] text-fog-faint">{new Date(m.month+'-01').toLocaleDateString('en-IN',{month:'short'})}</div></div>})}</div>
          <div className="mt-3 flex gap-4 text-xs text-fog-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok"/>Money in</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blood"/>Money out</span></div></section>}
      </div>}</div>}

    <Drawer open={!!gf} onClose={()=>setGf(null)} title={gf?.id?`Receipt ${code('DR',gf.receipt_no,4)}`:'New donation receipt'} description={gf?.id?(gf.status==='cancelled'?`Cancelled: ${gf.cancel_reason}`:`Received ${fmt(gf.received_on)}`):'Fields marked * are required. The receipt number is given when you save.'}
      footer={gf&&<>{gf.id&&gf.status==='received'&&<button className="btn-quiet mr-auto text-blood" onClick={()=>setCancel({kind:'g',row:gf,reason:''})}><Ban size={15}/>Cancel receipt</button>}
        {gf.id&&<button className="btn-quiet" onClick={()=>run('g',()=>donationReceipt(gf._orig,brand,camps))}><Receipt size={15}/>Receipt PDF</button>}
        {gf.status!=='cancelled'&&<button className="btn" form="gift-form" disabled={busy}>{busy?'Saving…':gf.id?'Save changes':'Save and make receipt'}</button>}</>}>
      {gf&&<form id="gift-form" onSubmit={saveGift} className="grid gap-4 sm:grid-cols-2"><fieldset disabled={gf.status==='cancelled'} className="contents">
        <Field label="Received from" required className="sm:col-span-2" hint="Person or company name"><input className="input" required minLength={2} value={gf.donor_name} onChange={g1('donor_name')}/></Field>
        <Field label="Amount (Rs.)" required hint={gf.amount?inWords(gf.amount):undefined}><input className="input" type="number" required min="1" step="any" value={gf.amount} onChange={g1('amount')}/></Field>
        <Field label="Received on" required><input className="input" type="date" required max={todayIso()} value={gf.received_on} onChange={g1('received_on')}/></Field>
        <Field label="Mode" required><select className="input" value={gf.mode} onChange={g1('mode')}>{MODES.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference" required={needsRef(gf.mode)} hint="UPI, bank or cheque number"><input className="input" required={needsRef(gf.mode)} value={gf.reference} onChange={g1('reference')}/></Field>
        <Field label="Purpose" required><select className="input" value={gf.purpose} onChange={g1('purpose')}>{PURPOSES.map(p=><option key={p}>{p}</option>)}</select></Field>
        <Field label="For camp"><select className="input" value={gf.camp_id} onChange={g1('camp_id')}><option value="">Not for one camp</option>{camps.map(c=><option key={c.id} value={c.id}>{code('C',c.camp_no,3)} {c.name}</option>)}</select></Field>
        <Field label="Mobile"><input className="input" inputMode="numeric" value={gf.phone} onChange={g1('phone')}/></Field>
        <Field label="Email"><input className="input" type="email" value={gf.email} onChange={g1('email')}/></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={gf.address} onChange={g1('address')}/></Field>
        <Field label="Received by (club member)"><input className="input" value={gf.received_by} onChange={g1('received_by')}/></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-fog"><input type="checkbox" checked={!!gf.anonymous} onChange={g1('anonymous')}/>Keep the name private in public lists</label>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={gf.notes} onChange={g1('notes')}/></Field></fieldset>
      </form>}
    </Drawer>

    <Drawer open={!!xf} onClose={()=>setXf(null)} title={xf?.id?`Voucher ${code('EV',xf.voucher_no,4)}`:'Record club expense'} description="For spending that is not part of one camp. Camp spending goes in Camp planning."
      footer={xf&&<>{xf.id&&xf.status==='paid'&&<button className="btn-quiet mr-auto text-blood" onClick={()=>setCancel({kind:'x',row:xf,reason:''})}><Ban size={15}/>Cancel voucher</button>}
        {xf.id&&<button className="btn-quiet" onClick={()=>run('x',()=>expenseVoucher(xf._orig,brand))}><FileText size={15}/>Voucher PDF</button>}
        {xf.status!=='cancelled'&&<button className="btn" form="exp-form" disabled={busy}>{busy?'Saving…':xf.id?'Save changes':'Save'}</button>}</>}>
      {xf&&<form id="exp-form" onSubmit={saveExp} className="grid gap-4 sm:grid-cols-2"><fieldset disabled={xf.status==='cancelled'} className="contents">
        <Field label="Paid to" required className="sm:col-span-2"><input className="input" required minLength={2} value={xf.paid_to} onChange={x1('paid_to')}/></Field>
        <Field label="Amount (Rs.)" required hint={xf.amount?inWords(xf.amount):undefined}><input className="input" type="number" required min="1" step="any" value={xf.amount} onChange={x1('amount')}/></Field>
        <Field label="Date" required><input className="input" type="date" required max={todayIso()} value={xf.spent_on} onChange={x1('spent_on')}/></Field>
        <Field label="Category" required><select className="input" value={xf.category} onChange={x1('category')}>{CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Mode"><select className="input" value={xf.mode} onChange={x1('mode')}>{MODES.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference"><input className="input" value={xf.reference} onChange={x1('reference')}/></Field>
        <Field label="Approved by"><input className="input" value={xf.approved_by} onChange={x1('approved_by')}/></Field>
        <Field label="What it was for" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={xf.description} onChange={x1('description')}/></Field></fieldset>
      </form>}
    </Drawer>

    <Drawer open={!!cancel} onClose={()=>setCancel(null)} title={cancel?.kind==='g'?`Cancel receipt ${code('DR',cancel?.row.receipt_no,4)}`:`Cancel voucher ${code('EV',cancel?.row.voucher_no,4)}`}
      description="Cancelled entries stay in the register with the reason, so the numbers never have gaps."
      footer={cancel&&<><button className="btn-quiet" onClick={()=>setCancel(null)}>Keep it</button><button className="btn-danger" form="cancel-form">Cancel it</button></>}>
      {cancel&&<form id="cancel-form" onSubmit={doCancel}><Field label="Reason" required><textarea className="input min-h-[80px]" required minLength={3} value={cancel.reason} onChange={e=>setCancel({...cancel,reason:e.target.value})}/></Field></form>}
    </Drawer>
  </div>
}
