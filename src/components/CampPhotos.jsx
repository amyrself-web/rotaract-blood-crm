// Camp photos from Google Drive. Paste a shared folder link (Anyone with the link: Viewer) or photo links, one per line.
// Folders show as Google's own photo grid; single photos show as thumbnails. Nothing is copied or uploaded.
import {Images,ExternalLink} from 'lucide-react'

export function parsePhotos(text){
  const out={folders:[],files:[],other:[]}
  for(const raw of String(text||'').split(/[\s,]+/).map(s=>s.trim()).filter(Boolean)){
    if(!/^https?:\/\//i.test(raw))continue
    const folder=raw.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/)
    const file=raw.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)||raw.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:.*&)?id=([\w-]{10,})/)
    if(folder)out.folders.push(folder[1]);else if(file)out.files.push(file[1]);else out.other.push(raw)}
  return out}
export const hasPhotos=t=>{const p=parsePhotos(t);return p.folders.length+p.files.length+p.other.length>0}
export const thumb=(id,w=800)=>`https://drive.google.com/thumbnail?id=${id}&sz=w${w}`

export default function CampPhotos({links,title,compact=false,max=12}){
  const p=parsePhotos(links);if(!p.folders.length&&!p.files.length&&!p.other.length)return null
  return <div className="space-y-3">
    {title&&<div className="flex items-center gap-2 text-sm font-semibold text-fg"><Images size={16} className="text-brand"/>{title}</div>}
    {p.files.length>0&&<div className={`grid gap-2 ${compact?'grid-cols-3 sm:grid-cols-4':'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>{p.files.slice(0,max).map(id=>
      <a key={id} href={`https://drive.google.com/file/d/${id}/view`} target="_blank" rel="noreferrer" className="group block aspect-[4/3] overflow-hidden rounded-xl bg-ink-800 ring-1 ring-ink-700">
        <img src={thumb(id,compact?400:800)} alt="Camp photo" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/></a>)}</div>}
    {p.folders.slice(0,compact?1:3).map(id=><div key={id} className="overflow-hidden rounded-xl ring-1 ring-ink-700">
      <iframe title="Camp photos" src={`https://drive.google.com/embeddedfolderview?id=${id}#grid`} loading="lazy" className={`w-full bg-white ${compact?'h-56':'h-80'}`}/>
      <a href={`https://drive.google.com/drive/folders/${id}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 bg-ink-800 py-2 text-xs text-brand hover:underline"><ExternalLink size={12}/>Open all photos</a></div>)}
    {p.other.map(u=><a key={u} href={u} target="_blank" rel="noreferrer" className="btn-quiet inline-flex"><Images size={15}/>See the photos</a>)}
  </div>}
