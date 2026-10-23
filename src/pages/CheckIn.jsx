import {useEffect,useState} from 'react'
import {Link,useParams,useSearchParams} from 'react-router-dom'
import {motion} from 'framer-motion'
import {CheckCircle2,XCircle} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {celebrate} from '../lib/fx'
import {ClaimMember} from './MyClub'
import {useLang} from '../lib/i18n'

// Opened from the meeting QR code: marks the signed-in member present.
export default function CheckIn(){
  const {id}=useParams(),[sp]=useSearchParams(),[r,setR]=useState(null)
  const {t}=useLang();const run=async()=>{setR(null);const {data,error}=await supabase.rpc('member_checkin',{p_meeting:id,p_code:sp.get('c')||''})
    if(error)return setR({error:error.message});setR(data);if(!data.already)celebrate()}
  useEffect(()=>{run()},[id])
  if(!r)return <div className="grid min-h-[40vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-600 border-t-brand"/></div>
  if(r.error?.includes('not linked'))return <ClaimMember onDone={run}/>
  return <div className="mx-auto max-w-md"><motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="card text-center">
    <motion.span initial={{scale:0,rotate:-40}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:260,damping:14}}
      className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-white ${r.error?'bg-blood':'bg-ok'}`}>{r.error?<XCircle size={30}/>:<CheckCircle2 size={30}/>}</motion.span>
    <h1 className="mt-4 font-display text-2xl font-semibold text-fg">{r.error?'Could not check you in':r.already?'Already checked in':`Marked ${r.status}`}</h1>
    <p className="mt-1 text-sm text-fog-muted">{r.error||r.title}</p>
    <Link to="/" className="btn mt-5 w-full">{t('Go to my page')}</Link></motion.div></div>
}
