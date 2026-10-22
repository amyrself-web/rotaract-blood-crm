export default {content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{
colors:{
  ink:{950:'#070D1A',900:'#0B1324',800:'#0E1729',750:'#121D33',700:'#1A2843',600:'#2B3D63',500:'#3E527C'},
  brand:{DEFAULT:'#4C8DFF',deep:'#2C5FD6',soft:'#9DC0FF'},
  blood:{DEFAULT:'#F0435A',deep:'#B4233A'},
  fog:{DEFAULT:'#E7EDF8',muted:'#8D9DBA',faint:'#5D6E8F'},
  ok:'#34D399',warn:'#FBBF24'},
fontFamily:{sans:['Manrope','system-ui','sans-serif'],display:['Sora','Manrope','system-ui','sans-serif']},
borderRadius:{panel:'14px',shell:'20px'},
boxShadow:{panel:'0 1px 0 rgba(255,255,255,.04) inset, 0 20px 40px -24px rgba(0,0,0,.7)',glow:'0 0 0 1px rgba(76,141,255,.35), 0 8px 30px -10px rgba(76,141,255,.55)'},
keyframes:{shimmer:{'0%':{backgroundPosition:'-400px 0'},'100%':{backgroundPosition:'400px 0'}},
  beat:{'0%,100%':{transform:'scale(1)'},'14%':{transform:'scale(1.18)'},'28%':{transform:'scale(1)'},'42%':{transform:'scale(1.12)'},'70%':{transform:'scale(1)'}},
  grow:{'0%':{transform:'scaleX(0)'},'100%':{transform:'scaleX(1)'}},growY:{'0%':{transform:'scaleY(0)'},'100%':{transform:'scaleY(1)'}}},
animation:{shimmer:'shimmer 1.3s linear infinite',beat:'beat 2.4s ease-in-out infinite',grow:'grow .8s cubic-bezier(.2,.7,.2,1) both',growY:'growY .7s cubic-bezier(.2,.7,.2,1) both'}}},plugins:[]}
