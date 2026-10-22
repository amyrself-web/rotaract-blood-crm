import {LayoutDashboard,Users,CalendarDays,ClipboardCheck,MessageCircle,Droplets,BarChart3,ShieldCheck,Upload,ClipboardList,CalendarRange,History,Settings2,Tent} from 'lucide-react'
// perm: module needed to see the page (null = everyone signed in)
export const NAV=[
 {group:'Overview',items:[
  {to:'/',label:'Dashboard',icon:LayoutDashboard,perm:null},
  {to:'/calendar',label:'Calendar',icon:CalendarRange,perm:['camps','campday','planning']}]},
 {group:'Camp work',items:[
  {to:'/camps',label:'Camps',icon:Tent,perm:['camps']},
  {to:'/camp-day',label:'Camp day',icon:ClipboardCheck,perm:['campday','screening']},
  {to:'/planning',label:'Camp planning',icon:ClipboardList,perm:['planning']},
  {to:'/stock',label:'Blood stock',icon:Droplets,perm:['stock','emergency']}]},
 {group:'People',items:[
  {to:'/donors',label:'Donors',icon:Users,perm:['donors']},
  {to:'/import',label:'Import Excel',icon:Upload,perm:['import']},
  {to:'/messages',label:'WhatsApp and alerts',icon:MessageCircle,perm:['messages']}]},
 {group:'Admin',items:[
  {to:'/reports',label:'Reports',icon:BarChart3,perm:['reports']},
  {to:'/users',label:'Users and roles',icon:ShieldCheck,perm:['users']},
  {to:'/audit',label:'Audit log',icon:History,perm:['audit']},
  {to:'/settings',label:'Settings',icon:Settings2,perm:['settings']}]}]
export const ALL_NAV=NAV.flatMap(g=>g.items)
export const allowed=(item,can)=>!item.perm||item.perm.some(can)
