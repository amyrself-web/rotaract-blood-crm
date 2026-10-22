// Mirrors role_default_perms() in the database. The database is the real gatekeeper; this only shapes the screens.
export const MODULES=[
  ['donors','Donors','Add, edit and delete donor records'],
  ['camps','Camps','Create camps and manage registrations'],
  ['import','Import Excel','Bring donor lists in from Excel'],
  ['planning','Camp planning','Checklist, volunteers, sponsors, expenses'],
  ['campday','Camp day','Check-in, walk-ins, live board'],
  ['screening','Screening and donation','Health checks, donation records'],
  ['messages','WhatsApp and alerts','Reminders, birthdays, invites'],
  ['stock','Blood stock','See stock, hand over units'],
  ['stock_edit','Edit stock','Add, edit and discard units'],
  ['emergency','Emergency requests','Create requests, find donors'],
  ['reports','Reports','Camp reports and exports'],
  ['users','Users','Create users, roles and permissions'],
  ['audit','Audit log','See who changed what'],
  ['settings','Settings','Club details, rules, templates']]
export const ROLE_DEFAULTS={
  admin:MODULES.map(m=>m[0]),
  coordinator:['donors','camps','import','planning','campday','messages','stock','emergency','reports'],
  medical:['campday','screening','stock','stock_edit','emergency'],
  volunteer:['campday'],donor:[]}
export const ROLE_LABEL={admin:'Admin',coordinator:'Coordinator',medical:'Medical',volunteer:'Volunteer',donor:'Donor'}
export const ROLE_HINT={admin:'Everything, including users and settings',coordinator:'Runs camps, donors and messages',medical:'Screening, donations and stock',volunteer:'Camp day desk only',donor:'Own donor portal only'}
export const DESIGNATIONS={
  admin:['President','Secretary','IT admin'],
  coordinator:['Vice President','Treasurer','Camp coordinator','Joint secretary','PR and media','Club service director','Community service director'],
  medical:['Doctor','Medical officer','Nurse','Lab technician','Counsellor'],
  volunteer:['Registration desk','Screening desk','Refreshment desk','Certificate desk','Crowd control','Volunteer lead'],
  donor:['Donor','Regular donor']}
export const effectivePerms=(role,overrides={})=>Object.fromEntries(MODULES.map(([m])=>[m,role==='admin'?true:(m in (overrides||{})?!!overrides[m]:ROLE_DEFAULTS[role]?.includes(m))]))
export const DEFAULT_SETTINGS={club_name:'Sankari Rotaract Club',min_hb:12.5,min_weight:45,gap_male:90,gap_female:120,expiry_days:35,default_slot_capacity:null}
