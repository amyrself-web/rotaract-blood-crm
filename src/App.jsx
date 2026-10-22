import {HashRouter,Routes,Route,Navigate} from 'react-router-dom'
import {Toaster} from 'sonner'
import {AuthProvider,useAuth} from './context/Auth'
import {ConfirmProvider,Empty} from './components/ui'
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
import {ALL_NAV,allowed} from './nav'
import {Lock} from 'lucide-react'

function Home(){const {profile}=useAuth();return profile.role==='donor'?<Portal/>:<Dashboard/>}
function Need({to,children}){const {can}=useAuth(),item=ALL_NAV.find(n=>n.to===to)
  return allowed(item,can)?children:<div className="card"><Empty icon={Lock} title="You do not have access to this page">Ask an admin to give you this permission on the Users page.</Empty></div>}
function Guard(){const {user,profile,loading}=useAuth()
  if(loading)return <div className="grid min-h-screen place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-600 border-t-blood"/></div>
  return user&&profile?<Layout/>:<Navigate to="/login" replace/>}
const PAGES=[['/donors',Donors],['/camps',Camps],['/import',Import],['/camp-day',CampDay],['/messages',Messages],['/stock',Stock],['/planning',Planning],
  ['/reports',Reports],['/users',UsersPage],['/calendar',Calendar],['/audit',Audit],['/settings',SettingsPage]]
export default function App(){return <AuthProvider><ConfirmProvider><HashRouter><Routes>
  <Route path="/login" element={<Login/>}/>
  <Route path="/register/:campId" element={<Register/>}/>
  <Route path="/home" element={<Landing/>}/><Route path="/verify/:code" element={<Verify/>}/>
  <Route element={<Guard/>}>
    <Route index element={<Home/>}/><Route path="profile" element={<Profile/>}/>
    {PAGES.map(([to,P])=><Route key={to} path={to.slice(1)} element={<Need to={to}><P/></Need>}/>)}
  </Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></HashRouter>
  <Toaster position="bottom-right" theme="dark" toastOptions={{style:{background:'#0E1729',border:'1px solid #2B3D63',color:'#E7EDF8',fontFamily:'Manrope, system-ui, sans-serif'}}}/>
  </ConfirmProvider></AuthProvider>}
