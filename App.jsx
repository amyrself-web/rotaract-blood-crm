import {HashRouter,Routes,Route,Navigate} from 'react-router-dom'
import {AuthProvider,useAuth} from './context/Auth'
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
import Soon from './pages/Soon'
import {NAV} from './nav'
const LIVE=['/','/users','/donors','/camps','/import','/camp-day','/messages','/stock','/planning','/reports']
function Home(){const {profile}=useAuth();return profile.role==='donor'?<Portal/>:<Dashboard/>}
function Guard(){const {user,profile,loading}=useAuth()
  if(loading)return <div className="p-10 text-slate-400">Loading…</div>
  return user&&profile?<Layout/>:<Navigate to="/login" replace/>}
export default function App(){return <AuthProvider><HashRouter><Routes>
  <Route path="/login" element={<Login/>}/>
  <Route path="/register/:campId" element={<Register/>}/>
  <Route path="/home" element={<Landing/>}/><Route path="/verify/:code" element={<Verify/>}/>
  <Route element={<Guard/>}>
    <Route index element={<Home/>}/><Route path="users" element={<UsersPage/>}/>
    <Route path="donors" element={<Donors/>}/><Route path="camps" element={<Camps/>}/><Route path="import" element={<Import/>}/><Route path="camp-day" element={<CampDay/>}/><Route path="messages" element={<Messages/>}/><Route path="stock" element={<Stock/>}/><Route path="planning" element={<Planning/>}/><Route path="reports" element={<Reports/>}/>
    {NAV.filter(n=>!LIVE.includes(n.to)).map(n=><Route key={n.to} path={n.to.slice(1)} element={<Soon item={n}/>}/>)}
  </Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></HashRouter></AuthProvider>}
