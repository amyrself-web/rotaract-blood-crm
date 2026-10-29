import {LayoutDashboard,Users,CalendarDays,ClipboardCheck,MessageCircle,Droplets,BarChart3,ShieldCheck,Upload,ClipboardList,CalendarRange,History,Settings2,Tent,Trash2,IdCard,Presentation,Eye,UserRoundCheck,Award,HandCoins,ShieldCheck as Shield,FolderHeart,Megaphone,Building2,Boxes,PartyPopper,Bus,ImagePlus} from 'lucide-react'
// perm: module needed to see the page (null = everyone signed in)
export const NAV=[
 {group:'Overview',items:[
  {to:'/',label:'Dashboard',desc:'Today at a glance',icon:LayoutDashboard,perm:null},
  {to:'/my-club',label:'My club',desc:'Your meetings, attendance and dues',icon:UserRoundCheck,perm:['_myclub']},
  {to:'/calendar',label:'Calendar',desc:'Camps, birthdays and tasks',icon:CalendarRange,perm:['camps','campday','planning','meetings']}]},
 {group:'Camp work',items:[
  {to:'/camps',label:'Camps',desc:'Create camps and share QR',icon:Tent,perm:['camps']},
  {to:'/camp-day',label:'Camp day',desc:'Check-in, screening, bags',icon:ClipboardCheck,perm:['campday','screening']},
  {to:'/planning',label:'Camp planning',desc:'Tasks, team and money',icon:ClipboardList,perm:['planning']},
  {to:'/certificates',label:'Certificates',desc:'Who got which certificate',icon:Award,perm:['reports','campday','screening']},
  {to:'/directory',label:'Hospitals and blood banks',desc:'Who to call',icon:Building2,perm:['emergency','stock','camps','afterlife']},
  {to:'/stock',label:'Blood stock',desc:'Units, issues, emergencies',icon:Droplets,perm:['stock','emergency']}]},
 {group:'People',items:[
  {to:'/donors',label:'Donors',desc:'Everyone in the CRM',icon:Users,perm:['donors']},
  {to:'/import',label:'Bulk import',desc:'Excel / CSV for every module, with undo',icon:Upload,perm:['import','donors','members','camps','meetings','campday']},
  {to:'/messages',label:'WhatsApp and alerts',desc:'Invites, birthdays, reminders',icon:MessageCircle,perm:['messages']},
  {to:'/posts',label:'Post maker',desc:'Images for WhatsApp and Instagram',icon:ImagePlus,perm:['messages','camps']},
  {to:'/afterlife',label:'Eye and body donation',desc:'Pledges and donations after death',icon:Eye,perm:['afterlife']}]},
 {group:'Club',items:[
  {to:'/members',label:'Members',desc:'Member records, dues, history',icon:IdCard,perm:['members']},
  {to:'/meetings',label:'Meetings',desc:'Weekly and monthly, attendance, minutes',icon:Presentation,perm:['meetings']},
  {to:'/projects',label:'Service projects',desc:'Projects, volunteer hours',icon:FolderHeart,perm:['members']},
  {to:'/notices',label:'Notice board',desc:'Announcements and polls for members',icon:Megaphone,perm:['meetings']},
  {to:'/events',label:'Club events',desc:'Guest list, passes, registration',icon:PartyPopper,perm:['meetings','members']},
  {to:'/trips',label:'Club trips',desc:'Trips, collections and expenses',icon:Bus,perm:['funds','members']},
  {to:'/assets',label:'Club assets',desc:'Banners, kits and who has them',icon:Boxes,perm:['planning','funds']},
  {to:'/funds',label:'Money and accounts',desc:'Donation receipts, expenses, accounts',icon:HandCoins,perm:['funds']}]},
 {group:'Admin',items:[
  {to:'/reports',label:'Reports',desc:'PDF report, receipts, CSV',icon:BarChart3,perm:['reports']},
  {to:'/users',label:'Users and roles',desc:'Logins and permissions',icon:ShieldCheck,perm:['users']},
  {to:'/audit',label:'Audit log',desc:'Every change, with undo',icon:History,perm:['audit']},
  {to:'/privacy',label:'Privacy and backup',desc:'Data requests, consent, backups',icon:Shield,perm:['settings']},
  {to:'/trash',label:'Recycle bin',desc:'Restore deleted records',icon:Trash2,perm:['donors','camps','emergency','members','meetings','afterlife','funds']},
  {to:'/settings',label:'Settings',desc:'Brand, logo and rules',icon:Settings2,perm:['settings']}]}]
export const ALL_NAV=NAV.flatMap(g=>g.items)
export const allowed=(item,can)=>!item.perm||item.perm.some(can)
