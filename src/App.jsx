import {HashRouter,Routes,Route,Navigate} from 'react-router-dom'
import {AuthProvider,useAuth} from './context/Auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersPage from './pages/Users'
import Soon from './pages/Soon'
import {NAV} from './nav'
function Guard(){const {user,profile,loading}=useAuth()
  if(loading)return <div className="p-10 text-slate-400">Loading…</div>
  return user&&profile?<Layout/>:<Navigate to="/login" replace/>}
export default function App(){return <AuthProvider><HashRouter><Routes>
  <Route path="/login" element={<Login/>}/>
  <Route element={<Guard/>}>
    <Route index element={<Dashboard/>}/><Route path="users" element={<UsersPage/>}/>
    {NAV.filter(n=>n.phase>1).map(n=><Route key={n.to} path={n.to.slice(1)} element={<Soon item={n}/>}/>)}
  </Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></HashRouter></AuthProvider>}
