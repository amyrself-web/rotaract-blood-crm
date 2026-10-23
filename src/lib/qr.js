// QR codes with the club logo in the middle. High error correction (H, up to 30% damage) lets the logo
// cover the centre and the code still scans. Rounded dots, with corner "eyes" in a darker shade of the brand colour.
import QRCode from 'qrcode'
import {logoImage,withBrand} from './docpdf'

const DROP=new Path2D('M50 14C50 14 24 47 24 64a26 26 0 0 0 52 0C76 47 50 14 50 14z')
const hex=h=>{const m=String(h||'').replace('#','');const s=m.length===3?m.replace(/./g,c=>c+c):m;return /^[0-9a-f]{6}$/i.test(s)?[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)):null}
// darken the brand colour towards navy so the eyes stay dark enough for any phone camera
const eyeColour=c=>{const a=hex(c)||[76,141,255],b=[11,19,36];return `rgb(${a.map((v,i)=>Math.round(v*.55+b[i]*.45)).join(',')})`}
const rr=(x,y,w,h,r)=>{const p=new Path2D();p.roundRect(x,y,w,h,r);return p}
const loadImg=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src})
const cache=new Map()

export function brandQr(text,brand,{size=640,quiet=2,dark='#0B1324'}={}){
  const b=withBrand(brand),key=[text,b.logo_url,b.brand_color,size,quiet,dark].join('|')
  if(!cache.has(key))cache.set(key,draw(text,b,size,quiet,dark).catch(e=>{cache.delete(key);throw e}))
  return cache.get(key)
}

async function draw(text,b,size,quiet,dark){
  const q=QRCode.create(String(text),{errorCorrectionLevel:'H'}),n=q.modules.size,on=(r,c)=>q.modules.data[r*n+c]
  const cell=Math.max(2,Math.floor(size/(n+quiet*2))),W=cell*(n+quiet*2),o=quiet*cell
  const cv=document.createElement('canvas');cv.width=cv.height=W;const g=cv.getContext('2d')
  g.fillStyle='#fff';g.fillRect(0,0,W,W)
  // centre area kept clear for the logo: about 22% of the code width, always an odd number of modules
  let box=Math.floor(n*.22);if(box%2===0)box++;const b0=(n-box)/2,b1=b0+box
  const finder=(r,c)=>(r<7&&c<7)||(r<7&&c>=n-7)||(r>=n-7&&c<7)
  g.fillStyle=dark
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    if(!on(r,c)||finder(r,c)||(r>=b0-1&&r<b1+1&&c>=b0-1&&c<b1+1))continue
    const s=cell*.9,d=(cell-s)/2;g.fill(rr(o+c*cell+d,o+r*cell+d,s,s,s*.32))}
  // the three corner eyes
  const eye=eyeColour(b.brand_color)
  for(const [r,c] of [[0,0],[0,n-7],[n-7,0]]){const x=o+c*cell,y=o+r*cell
    g.fillStyle=dark;g.fill(rr(x,y,7*cell,7*cell,cell*2.2));g.fillStyle='#fff';g.fill(rr(x+cell,y+cell,5*cell,5*cell,cell*1.5))
    g.fillStyle=eye;g.fill(rr(x+2*cell,y+2*cell,3*cell,3*cell,cell*1.1))}
  // white plate with the logo (or a red blood drop when no logo is set)
  const pw=box*cell,px=o+b0*cell
  g.save();g.shadowColor='rgba(11,19,36,.18)';g.shadowBlur=cell*1.2;g.fillStyle='#fff';g.fill(rr(px,px,pw,pw,pw*.24));g.restore()
  g.strokeStyle=eye;g.lineWidth=Math.max(1.5,cell*.35);g.stroke(rr(px+cell*.5,px+cell*.5,pw-cell,pw-cell,pw*.2))
  const lg=b.logo_url?await logoImage(b.logo_url):null,inner=pw-cell*2.4
  if(lg){const img=await loadImg(lg.data),k=Math.min(inner/lg.w,inner/lg.h),w=lg.w*k,h=lg.h*k;g.drawImage(img,px+(pw-w)/2,px+(pw-h)/2,w,h)}
  else{const k=inner/100;g.save();g.translate(px+(pw-inner)/2,px+(pw-inner)/2);g.scale(k,k);g.fillStyle='#E11D48';g.fill(DROP);g.restore()}
  return cv.toDataURL('image/png')
}
