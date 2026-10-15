import {useMemo,useState} from 'react'
import readXlsxFile from 'read-excel-file/browser'
import Papa from 'papaparse'
import {supabase} from '../lib/supabase'
import {FIELDS,HINTS,clean} from '../lib/importer'
const allPhones=async()=>{let out=[],from=0;for(;;){const {data,error}=await supabase.from('donors').select('phone').range(from,from+999);if(error)throw error;out=out.concat(data.map(x=>x.phone));if(data.length<1000)return out;from+=1000}}
export default function Import(){
  const [rows,setRows]=useState(null),[file,setFile]=useState(''),[map,setMap]=useState({}),[existing,setExisting]=useState(new Set()),[res,setRes]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const onFile=async e=>{const f=e.target.files[0];if(!f)return;setErr('');setRes(null);setRows(null)
    try{let data
      if(/\.csv$/i.test(f.name))data=await new Promise((ok,no)=>Papa.parse(f,{skipEmptyLines:true,complete:r=>ok(r.data),error:no}))
      else if(/\.xlsx$/i.test(f.name))data=(await readXlsxFile(f))[0]?.data||[]
      else return setErr('Choose an .xlsx or .csv file. For an old .xls file, open it in Excel and save as .xlsx first.')
      if(data.length<2)return setErr('The file has no data rows.')
      setExisting(new Set(await allPhones()));setFile(f.name);setRows(data)
      const hdr=data[0].map(h=>String(h??'')),m={};FIELDS.forEach(([k])=>{const i=hdr.findIndex(h=>HINTS[k].test(h));m[k]=i<0?'':i});setMap(m)
    }catch(x){setErr('Could not read this file: '+(x.message||x))}}
  const {ok,bad}=useMemo(()=>rows?clean(rows,map,existing):{ok:[],bad:[]},[rows,map,existing])
  const run=async()=>{setBusy(true);setErr('');let n=0
    for(let i=0;i<ok.length;i+=200){const chunk=ok.slice(i,i+200).map(r=>({...r,source:'import: '+file}))
      const {data,error}=await supabase.from('donors').upsert(chunk,{onConflict:'phone',ignoreDuplicates:true}).select('id')
      if(error){setErr(error.message);break}n+=data.length}
    setBusy(false);setRes({n,bad});setRows(null)}
  const dl=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([Papa.unparse(res.bad)],{type:'text/csv'}));a.download='skipped-rows.csv';a.click()}
  return <div><h1 className="h1">Import donors from Excel</h1>
    {err&&<p className="mb-3 text-sm text-blood">{err}</p>}
    {res&&<div className="card mb-5"><h2 className="font-semibold text-white">{res.n} donors imported</h2>
      <p className="mt-1 text-sm text-slate-400">{res.bad.length} rows skipped. Imported donors are marked consent pending: the WhatsApp button stays off until they agree to be contacted.</p>
      {res.bad.length>0&&<button className="btn mt-3" onClick={dl}>Download skipped rows</button>}</div>}
    <div className="card mb-5"><p className="mb-3 text-sm text-slate-400">Upload an .xlsx or .csv file. The first row must hold the column names. Nothing is saved until you press Import.</p>
      <input type="file" accept=".xlsx,.csv" onChange={onFile} className="text-sm"/></div>
    {rows&&<>
      <div className="card mb-5"><h2 className="mb-3 font-semibold text-white">Match your columns</h2>
        <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(([k,label,req])=><label key={k} className="text-sm text-slate-400">{label}{req&&' (required)'}
          <select className="input mt-1" value={map[k]} onChange={e=>setMap({...map,[k]:e.target.value===''?'':+e.target.value})}>
            <option value="">Not in my file</option>{rows[0].map((h,i)=><option key={i} value={i}>{String(h??`Column ${i+1}`)}</option>)}</select></label>)}</div></div>
      <div className="card mb-5"><h2 className="font-semibold text-white">{ok.length} ready to import, {bad.length} will be skipped</h2>
        {ok.length>0&&<div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th className="py-1 font-medium">Name</th><th className="font-medium">Mobile</th><th className="font-medium">Group</th><th className="font-medium">Area</th><th className="font-medium">Last donation</th></tr></thead>
          <tbody>{ok.slice(0,5).map(r=><tr key={r.phone} className="border-t border-ink-700"><td className="py-1">{r.full_name}</td><td>{r.phone}</td><td>{r.blood_group||'-'}</td><td>{r.area||'-'}</td><td>{r.last_donation||'-'}</td></tr>)}</tbody></table><p className="mt-1 text-xs text-slate-500">First 5 rows shown.</p></div>}
        {bad.length>0&&<div className="mt-4 text-sm"><div className="mb-1 text-slate-400">Skipped rows (first 6):</div>{bad.slice(0,6).map(b=><div key={b.row} className="text-slate-300">Row {b.row}: {b.name||'no name'} · {b.reason}</div>)}</div>}
        <button className="btn mt-4" disabled={busy||!ok.length} onClick={run}>{busy?'Importing…':`Import ${ok.length} donors`}</button></div></>}
  </div>
}
