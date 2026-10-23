const v=n=>`rgb(var(--${n}) / <alpha-value>)`
export default {content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{
colors:{
  ink:{950:v('ink-950'),900:v('ink-900'),800:v('ink-800'),750:v('ink-750'),700:v('ink-700'),600:v('ink-600'),500:v('ink-500')},
  fg:v('fg'),
  brand:{DEFAULT:v('brand'),deep:v('brand-deep'),soft:v('brand-soft')},
  blood:{DEFAULT:'#F0435A',deep:'#B4233A'},
  fog:{DEFAULT:v('fog'),muted:v('fog-muted'),faint:v('fog-faint')},
  ok:'#22C55E',warn:'#F59E0B'},
fontFamily:{sans:['Manrope','system-ui','sans-serif'],display:['Sora','Manrope','system-ui','sans-serif']},
borderRadius:{panel:'14px',shell:'20px'},
boxShadow:{panel:'var(--shadow-panel)',glow:'0 0 0 1px rgb(var(--brand) / .35), 0 8px 30px -10px rgb(var(--brand) / .55)'},
keyframes:{shimmer:{'0%':{backgroundPosition:'-400px 0'},'100%':{backgroundPosition:'400px 0'}},
  beat:{'0%,100%':{transform:'scale(1)'},'14%':{transform:'scale(1.18)'},'28%':{transform:'scale(1)'},'42%':{transform:'scale(1.12)'},'70%':{transform:'scale(1)'}},
  grow:{'0%':{transform:'scaleX(0)'},'100%':{transform:'scaleX(1)'}},growY:{'0%':{transform:'scaleY(0)'},'100%':{transform:'scaleY(1)'}},
  ripple:{'0%':{transform:'scale(.6)',opacity:'.7'},'100%':{transform:'scale(2.4)',opacity:'0'}},
  fall:{'0%':{transform:'translateY(-14px) scale(.9)',opacity:'0'},'60%':{opacity:'1'},'100%':{transform:'translateY(0) scale(1)',opacity:'1'}}},
animation:{shimmer:'shimmer 1.3s linear infinite',beat:'beat 2.4s ease-in-out infinite',grow:'grow .8s cubic-bezier(.2,.7,.2,1) both',growY:'growY .7s cubic-bezier(.2,.7,.2,1) both',
  ripple:'ripple 1.8s cubic-bezier(.2,.7,.2,1) infinite',fall:'fall .7s cubic-bezier(.2,.7,.2,1) both'}}},plugins:[]}
