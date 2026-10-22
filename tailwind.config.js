export default {content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{
colors:{ink:{950:'#0B1220',900:'#0E182B',800:'#12203A',700:'#1B2D4F',600:'#27406B'},brand:'#3B82F6',blood:'#E11D48'},
fontFamily:{sans:['"Plus Jakarta Sans"','system-ui','sans-serif']},
keyframes:{
  fadeUp:{'0%':{opacity:'0',transform:'translateY(10px)'},'100%':{opacity:'1',transform:'none'}},
  fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},
  scaleIn:{'0%':{opacity:'0',transform:'scale(.96)'},'100%':{opacity:'1',transform:'none'}},
  slideIn:{'0%':{opacity:'0',transform:'translateX(-12px)'},'100%':{opacity:'1',transform:'none'}},
  shimmer:{'0%':{backgroundPosition:'-400px 0'},'100%':{backgroundPosition:'400px 0'}},
  drop:{'0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-3px)'}},
  glow:{'0%,100%':{opacity:'.35'},'50%':{opacity:'.6'}},
  grow:{'0%':{transform:'scaleX(0)'},'100%':{transform:'scaleX(1)'}},
  growY:{'0%':{transform:'scaleY(0)'},'100%':{transform:'scaleY(1)'}}},
animation:{fadeUp:'fadeUp .45s cubic-bezier(.2,.7,.2,1) both',fadeIn:'fadeIn .3s ease both',scaleIn:'scaleIn .35s cubic-bezier(.2,.7,.2,1) both',
  slideIn:'slideIn .35s cubic-bezier(.2,.7,.2,1) both',shimmer:'shimmer 1.3s linear infinite',drop:'drop 2.4s ease-in-out infinite',glow:'glow 6s ease-in-out infinite',
  grow:'grow .8s cubic-bezier(.2,.7,.2,1) both',growY:'growY .7s cubic-bezier(.2,.7,.2,1) both'}}},plugins:[]}
