import {LayoutDashboard,Users,CalendarDays,ClipboardCheck,MessageCircle,Droplets,BarChart3,ShieldCheck,Upload,ClipboardList,CalendarRange,History,Settings2,Tent,Trash2} from 'lucide-react'
// perm: module needed to see the page (null = everyone signed in)
export const NAV=[
 {group:'Overview',items:[
  {to:'/',label:'Dashboard',desc:'Today at a glance',icon:LayoutDashboard,perm:null},
  {to:'/calendar',label:'Calendar',desc:'Camps, birthdays and tasks',icon:CalendarRange,perm:['camps','campday','planning']}]},
 {group:'Camp work',items:[
  {to:'/camps',label:'Camps',desc:'Create camps and share QR',icon:Tent,perm:['camps']},
  {to:'/camp-day',label:'Camp day',desc:'Check-in, screening, bags',icon:ClipboardCheck,perm:['campday','screening']},
  {to:'/planning',label:'Camp planning',desc:'Tasks, team and money',icon:ClipboardList,perm:['planning']},
  {to:'/stock',label:'Blood stock',desc:'Units, issues, emergencies',icon:Droplets,perm:['stock','emergency']}]},
 {group:'People',items:[
  {to:'/donors',label:'Donors',desc:'Everyone in the CRM',icon:Users,perm:['donors']},
  {to:'/import',label:'Import Excel',desc:'Bring donors from a sheet',icon:Upload,perm:['import']},
  {to:'/messages',label:'WhatsApp and alerts',desc:'Invites, birthdays, reminders',icon:MessageCircle,perm:['messages']}]},
 {group:'Admin',items:[
  {to:'/reports',label:'Reports',desc:'PDF report, receipts, CSV',icon:BarChart3,perm:['reports']},
  {to:'/users',label:'Users and roles',desc:'Logins and permissions',icon:ShieldCheck,perm:['users']},
  {to:'/audit',label:'Audit log',desc:'Every change, with undo',icon:History,perm:['audit']},
  {to:'/trash',label:'Recycle bin',desc:'Restore deleted records',icon:Trash2,perm:['donors','camps','emergency']},
  {to:'/settings',label:'Settings',desc:'Brand, logo and rules',icon:Settings2,perm:['settings']}]}]
export const ALL_NAV=NAV.flatMap(g=>g.items)
export const allowed=(item,can)=>!item.perm||item.perm.some(can)
