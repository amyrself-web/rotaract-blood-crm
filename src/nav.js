import {LayoutDashboard,Users,CalendarDays,ClipboardCheck,MessageCircle,Droplets,BarChart3,ShieldCheck,Upload} from 'lucide-react'
const staff=['admin','coordinator'],all=['admin','coordinator','medical','volunteer','donor']
export const NAV=[
{to:'/',label:'Dashboard',icon:LayoutDashboard,roles:all,phase:1},
{to:'/donors',label:'Donors',icon:Users,roles:staff,phase:2},
{to:'/camps',label:'Camps',icon:CalendarDays,roles:staff,phase:2},
{to:'/import',label:'Import Excel',icon:Upload,roles:staff,phase:2},
{to:'/camp-day',label:'Camp day',icon:ClipboardCheck,roles:['admin','coordinator','medical','volunteer'],phase:3},
{to:'/messages',label:'WhatsApp and alerts',icon:MessageCircle,roles:staff,phase:4},
{to:'/stock',label:'Blood stock',icon:Droplets,roles:['admin','coordinator','medical'],phase:6},
{to:'/reports',label:'Reports',icon:BarChart3,roles:staff,phase:8},
{to:'/users',label:'Users and roles',icon:ShieldCheck,roles:['admin'],phase:1}]
