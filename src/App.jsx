import {HashRouter,Routes,Route,Navigate,useLocation} from 'react-router-dom'
import {Toaster} from 'sonner'
import {AuthProvider,useAuth} from './context/Auth'
import {BrandProvider,useBrand} from './context/Brand'
import Trash from './pages/Trash'
import {ConfirmProvider,Empty,Field} from './components/ui'
import {useState} from 'react'
import {supabase} from './lib/supabase'
import {useLang} from './lib/i18n'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersPage from './pages/Users'
import Donors from './pages/Donors'
import Camps from './pages/Camps'
import Import from './pages/Import'
import CampDay from './pages/CampDay'
import Messages from './pages/Messages'
import Portal from './pages/Portal'
import Landing from './pages/Landing'
import Verify from './pages/Verify'
import Stock from './pages/Stock'
import Planning from './pages/Planning'
import Reports from './pages/Reports'
import Register from './pages/Register'
import Calendar from './pages/Calendar'
import Audit from './pages/Audit'
import SettingsPage from './pages/Settings'
import Profile from './pages/Profile'
import Members from './pages/Members'
import Meetings from './pages/Meetings'
import Afterlife from './pages/Afterlife'
import MyClub from './pages/MyClub'
import CheckIn from './pages/CheckIn'
import Certificates from './pages/Certificates'
import Funds from './pages/Funds'
import VerifyMember from './pages/VerifyMember'
import CertificateDownload from './pages/CertificateDownload'
import Privacy from './pages/Privacy'
import Projects from './pages/Projects'
import Notices from './pages/Notices'
import Directory from './pages/Directory'
import Assets from './pages/Assets'
import Trips from './pages/Trips'
import Events from './pages/Events'
import EventRegister from './pages/EventRegister'
import Impact from './pages/Impact'
import PostMaker from './pages/PostMaker'
import {ALL_NAV,allowed} from './nav'
import {Lock} from 'lucide-react'
import VoiceDock from './components/VoiceDock'

function Home(){const {profile}=useAuth();return profile.role==='donor'?<Portal/>:profile.role==='member'?<MyClub/>:<Dashboard/>}
function Need({to,children}){const {can}=useAuth(),item=ALL_NAV.find(n=>n.to===to)
  return allowed(item,can)?children:<div className="card"><Empty icon={Lock} title="You do not have access to this page">Ask an admin to give you this permission on the Users page.</Empty></div>}
function SetPassword(){
  const {setRecovery}=useAuth(),{t}=useLang(),[pw,setPw]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
  const go=async e=>{e.preventDefault();if(pw.length<8||!/(?=.*[A-Za-z])(?=.*\d)/.test(pw))return setMsg('At least 8 characters, with letters and numbers.')
    setBusy(true);const {error}=await supabase.auth.updateUser({password:pw});setBusy(false);if(error)return setMsg(error.message);setRecovery(false);location.hash='#/'}
  return <div className="grid min-h-screen place-items-center p-5"><form onSubmit={go} className="card w-full max-w-sm space-y-4"><h1 className="font-display text-2xl font-semibold text-fg">{t('Set a new password')}</h1>
    <Field label={t('New password')}><input className="input" type="password" autoComplete="new-password" autoFocus minLength={8} required value={pw} onChange={e=>setPw(e.target.value)}/></Field>
    {msg&&<p role="alert" className="text-sm text-blood">{msg}</p>}<button className="btn w-full" disabled={busy}>{busy?t('Please wait…'):t('Save password')}</button></form></div>
}
function Guard(){const {user,profile,loading,recovery,signOut}=useAuth(),loc=useLocation()
  if(recovery)return <SetPassword/>
  if(user&&profile&&profile.active===false)return <div className="grid min-h-screen place-items-center p-5"><div className="card max-w-sm text-center"><Lock className="mx-auto text-blood"/><h1 className="mt-3 font-display text-xl font-semibold text-fg">Your login is switched off</h1>
    <p className="mt-1 text-sm text-fog-muted">Ask the club admin to switch it back on.</p><button className="btn mt-4 w-full" onClick={signOut}>Sign out</button></div></div>
  if(loading)return <div className="grid min-h-screen place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-600 border-t-blood"/></div>
  if(!(user&&profile)&&!loading&&loc.pathname!=='/'){try{sessionStorage.setItem('after-login',loc.pathname+loc.search)}catch{}}
  return user&&profile?<Layout/>:<Navigate to="/login" replace/>}
const PAGES=[['/donors',Donors],['/camps',Camps],['/import',Import],['/camp-day',CampDay],['/messages',Messages],['/stock',Stock],['/planning',Planning],
  ['/reports',Reports],['/users',UsersPage],['/calendar',Calendar],['/audit',Audit],['/settings',SettingsPage],['/trash',Trash],['/members',Members],['/meetings',Meetings],['/afterlife',Afterlife],['/certificates',Certificates],['/funds',Funds],['/privacy',Privacy],['/projects',Projects],['/notices',Notices],['/directory',Directory],['/assets',Assets],['/events',Events],['/posts',PostMaker],['/trips',Trips]]
function Toasts(){const {mode}=useBrand()
  return <><VoiceDock/><Toaster position="top-center" offset={14} theme={mode} toastOptions={{style:{background:'rgb(var(--ink-800))',border:'1px solid rgb(var(--ink-600))',color:'rgb(var(--fg))',fontFamily:'Manrope, system-ui, sans-serif'}}}/></>}
export default function App(){return <BrandProvider><AuthProvider><ConfirmProvider><HashRouter><Routes>
  <Route path="/login" element={<Login/>}/>
  <Route path="/register/:campId" element={<Register/>}/>
  <Route path="/home" element={<Landing/>}/><Route path="/verify" element={<Verify/>}/><Route path="/verify/:code" element={<Verify/>}/><Route path="/member/:code" element={<VerifyMember/>}/><Route path="/certificate/:code" element={<CertificateDownload/>}/><Route path="/event/:id" element={<EventRegister/>}/><Route path="/impact" element={<Impact/>}/>
  <Route element={<Guard/>}>
    <Route index element={<Home/>}/><Route path="profile" element={<Profile/>}/><Route path="my-club" element={<MyClub/>}/><Route path="checkin/:id" element={<CheckIn/>}/>
    {PAGES.map(([to,P])=><Route key={to} path={to.slice(1)} element={<Need to={to}><P/></Need>}/>)}
  </Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></HashRouter>
  <Toasts/>
  </ConfirmProvider></AuthProvider></BrandProvider>}
