// What changes from one camp type to another: words, fields, checklist, desks, materials kit and result choices.
export const CAMP_TYPES=['Blood donation','Eye checking','Food donation','Environment (plantation)','Cancer awareness','Others']
export const CANCERS=['Breast','Cervical','Oral','Lung','Prostate','Colorectal','Skin','Blood cancers (leukaemia, lymphoma)','Stomach','Liver','Thyroid','Ovarian','Childhood cancers','General awareness']
export const typeName=c=>c?.camp_type==='Others'?(c.camp_type_other||'Others'):(c?.camp_type||'Blood donation')
export const isBlood=c=>(c?.camp_type||'Blood donation')==='Blood donation'
// which records a camp keeps
export const kindOf=c=>{const t=c?.camp_type||'Blood donation';return t==='Blood donation'?'blood':t==='Food donation'?'food':t==='Environment (plantation)'?'plants':'people'}
export const takesOnline=c=>kindOf(c)==='people'||isBlood(c)

export const EYE_FINDINGS=['Normal','Refractive error (needs glasses)','Cataract','Pterygium','Glaucoma suspect','Diabetic eye check needed','Eye infection','Other']
export const EYE_ACTIONS=['Spectacles given','Spectacles to be ordered','Eye drops / medicines','Surgery referral','Referred to specialist','Advice only']
export const CANCER_SCREENS={Breast:'Breast examination',Cervical:'Cervical (VIA / Pap)',Oral:'Oral cavity check',Lung:'Lung symptom check',Prostate:'Prostate (PSA) check',Colorectal:'Colorectal symptom check',
  Skin:'Skin / mole check','Blood cancers (leukaemia, lymphoma)':'Blood test advice',Stomach:'Stomach symptom check',Liver:'Liver symptom check',Thyroid:'Thyroid (neck) check',Ovarian:'Ovarian symptom check',
  'Childhood cancers':'Child warning-signs check','General awareness':'Awareness only'}
export const FOOD_GROUPS=['Orphanage','Old age home','Hospital','Street / roadside','Slum / colony','School','Special home','Other']
export const RESULTS=[['normal','Normal'],['needs_care','Needs care'],['suspicious','Suspicious, refer']]
export const FOLLOW=[['none','No follow-up'],['pending','Follow-up pending'],['done','Followed up'],['not_reachable','Not reachable'],['declined','Declined']]

// words used on cards, camp day and posters
export const WORDS={
  blood:{people:'donors',helped:'registered',verb:'Donate blood',invite:'Blood donation camp',thanks:'to every donor and volunteer'},
  'Eye checking':{people:'people',helped:'people screened',verb:'Free eye check-up',invite:'Free eye check-up camp',thanks:'to everyone who came for the eye check-up, and to our doctors and volunteers'},
  'Cancer awareness':{people:'people',helped:'people reached',verb:'Free cancer screening and awareness',invite:'Cancer awareness and screening camp',thanks:'to everyone who joined the cancer awareness camp, and to our doctors and volunteers'},
  'Food donation':{people:'people',helped:'people fed',verb:'Food for those in need',invite:'Food donation drive',thanks:'to everyone who helped us serve food today'},
  'Environment (plantation)':{people:'saplings',helped:'saplings planted',verb:'Plant a tree with us',invite:'Tree plantation drive',thanks:'to every volunteer who planted a tree with us'},
  Others:{people:'people',helped:'people helped',verb:'Join us',invite:'Community camp',thanks:'to everyone who joined us'}}
export const words=c=>isBlood(c)?WORDS.blood:WORDS[c?.camp_type]||WORDS.Others

// type-specific fields on the camp form (kept in camps.details unless a column exists)
export const FORM={
  'Eye checking':{target:'People expected',partner:'Partner eye hospital',doctors:'Doctors / optometrists',extra:[['spectacles_stock','Spectacles in stock','number'],['surgery_partner','Hospital for cataract surgery','text']]},
  'Cancer awareness':{target:'People expected',partner:'Partner hospital',doctors:'Doctors / speakers',extra:[['screenings','Screenings offered','text'],['pamphlets','Pamphlets ready','number']]},
  'Food donation':{target:'People to serve',partner:'Food sponsor / kitchen',doctors:'',extra:[['menu','Menu / items','text'],['packets_planned','Packets planned','number']]},
  'Environment (plantation)':{target:'Saplings to plant',partner:'Partner (school / forest dept. / NGO)',doctors:'',extra:[['species','Species planned','text'],['site','Site / land owner','text'],['water','Who waters and how','text']]},
  Others:{target:'People expected',partner:'Partner organisation',doctors:'Resource persons',extra:[]},
  'Blood donation':{target:'',partner:'Partner blood bank',doctors:'Doctors and nurses',extra:[]}}

export const CHECKLIST={
  'Blood donation':['Permission letter obtained','Partner blood bank confirmed','Doctors and nurses confirmed','Poster and banners printed','Registration QR shared','Refreshments arranged','Volunteers briefed','Certificates printed','Sound system and seating arranged','Medical equipment checked'],
  'Eye checking':['Partner eye hospital confirmed','Doctors / optometrists confirmed','Venue with good light and a dark room','Vision charts and torch ready','Registration QR shared','Spectacles stock and frames ready','Surgery referral hospital and transport fixed','Poster and banners printed','Volunteers briefed','Token slips and forms printed'],
  'Cancer awareness':['Partner hospital confirmed','Doctors / speakers confirmed','Separate screening room for women','Projector and sound for the talk','Pamphlets printed (Tamil and English)','Registration QR shared','Referral hospital agreed for suspicious cases','Poster and banners printed','Volunteers briefed'],
  'Food donation':['Places and people count confirmed','Food ordered / kitchen booked','Packets, plates and water ready','Vehicle arranged','Permission from homes / shelters','Hygiene: gloves, caps, sanitiser','Volunteers briefed','Photos and consent'],
  'Environment (plantation)':['Land and permission confirmed','Saplings ordered','Pits dug','Tools: spades, gloves, buckets','Water source and guardians fixed','Tree guards / fencing','Name boards / tags','Volunteers briefed'],
  Others:['Permission obtained','Partner confirmed','Poster and banners printed','Registration QR shared','Volunteers briefed','Refreshments arranged']}
export const DESKS={
  'Blood donation':['Registration','Screening','Donation','Refreshment','Certificate','Crowd control'],
  'Eye checking':['Registration','Vision test','Doctor','Spectacles','Referral desk','Crowd control'],
  'Cancer awareness':['Registration','Awareness talk','Screening','Referral desk','Pamphlets','Crowd control'],
  'Food donation':['Packing','Loading','Distribution','Counting','Photos'],
  'Environment (plantation)':['Saplings','Digging','Planting','Watering','Tagging','Photos'],
  Others:['Registration','Activity','Crowd control','Refreshment','Photos']}
export const EXPENSES=['Refreshments','Printing','Banners','Transport','Sound system','Certificates','Spectacles','Medicines','Food','Saplings','Tools','Other']

// a starting materials kit: [item, category, qty, unit, source]
export const KITS={
  'Eye checking':[['Flex banner','Banners and printing',1,'nos','To buy'],['Standee with registration QR','Banners and printing',1,'nos','To buy'],['Vision charts (Snellen)','Medical supplies',2,'nos','Partner'],
    ['Torch and ophthalmoscope','Medical supplies',2,'nos','Partner'],['Trial lens set','Medical supplies',1,'set','Partner'],['Ready spectacles (+1.0 to +3.0)','Medical supplies',100,'pairs','To buy'],
    ['Eye drops','Medical supplies',50,'nos','Partner'],['Patient forms','Banners and printing',200,'nos','To buy'],['Token slips','Banners and printing',200,'nos','To buy'],['Chairs','Furniture and setup',30,'nos','Borrowed'],
    ['Tables','Furniture and setup',4,'nos','Borrowed'],['Drinking water','Refreshments',5,'cans','To buy']],
  'Cancer awareness':[['Flex banner','Banners and printing',1,'nos','To buy'],['Pamphlets (Tamil and English)','Banners and printing',500,'nos','To buy'],['Projector and screen','Furniture and setup',1,'nos','Borrowed'],
    ['Sound system','Furniture and setup',1,'set','Borrowed'],['Examination table and screen','Medical supplies',2,'nos','Partner'],['Gloves and swabs','Medical supplies',2,'boxes','Partner'],
    ['Patient forms','Banners and printing',200,'nos','To buy'],['Chairs','Furniture and setup',60,'nos','Borrowed'],['Drinking water','Refreshments',5,'cans','To buy']],
  'Food donation':[['Food packets','Refreshments',200,'nos','To buy'],['Water bottles','Refreshments',200,'nos','To buy'],['Carry bags / boxes','Furniture and setup',10,'nos','To buy'],
    ['Gloves, caps and sanitiser','Medical supplies',1,'set','To buy'],['Vehicle','Furniture and setup',1,'nos','To buy'],['Club banner','Banners and printing',1,'nos','Club stock']],
  'Environment (plantation)':[['Saplings','Furniture and setup',100,'nos','To buy'],['Spades and crowbars','Furniture and setup',10,'nos','Borrowed'],['Gloves','Medical supplies',30,'pairs','To buy'],
    ['Buckets and water cans','Furniture and setup',10,'nos','Borrowed'],['Tree guards','Furniture and setup',100,'nos','To buy'],['Manure / soil mix','Furniture and setup',20,'bags','To buy'],
    ['Name tags','Banners and printing',100,'nos','To buy'],['Club banner','Banners and printing',1,'nos','Club stock'],['Drinking water','Refreshments',5,'cans','To buy']],
  Others:[['Flex banner','Banners and printing',1,'nos','To buy'],['Registration forms','Banners and printing',100,'nos','To buy'],['Chairs','Furniture and setup',30,'nos','Borrowed'],['Drinking water','Refreshments',5,'cans','To buy']]}
