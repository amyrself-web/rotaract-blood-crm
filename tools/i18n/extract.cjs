const fs=require('fs'),path=require('path'),R=path.resolve(__dirname,'../..')+'/'
const parser=require(R+'node_modules/@babel/parser'),traverse=require(R+'node_modules/@babel/traverse').default
const files=[];const walk=d=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(/\.(jsx|js)$/.test(f))files.push(p)}};walk(R+'src')
const SKIP=/src\/lib\/(cards|certificate|clubReports|reports|pdf|qr|fx|supabase|offline|pulse|i18n|ta-dict|voice)\.js$/
const exact=new Map(),pats=new Map()
const code=s=>/^[a-z0-9_\-:.\/\[\]#%()=,*+?^${}|\\@!&<>;'"`~ ]*$/.test(s)&&(/[-_:\/\[\]#.]/.test(s)&&!/ [A-Z]/.test(s))
const tw=s=>s.split(/\s+/).every(w=>/^[!a-z0-9:\-\[\]\/.%#()_,'=&>~*+]+$/.test(w))&&/-|\b(flex|grid|block|hidden|inline|relative|absolute|fixed|sticky|truncate|italic|uppercase|capitalize|underline|rounded|border|shadow|transition)\b/.test(s)
const ui=s=>{s=s.trim();if(s.length<2||!/[A-Za-z]{2}/.test(s))return false
  if(/^(https?:|mailto:|tel:|#\/|\/|data:|image\/|application\/|text\/|[a-z]+\.[a-z]+$)/.test(s))return false
  if(tw(s)||code(s))return false
  if(/^[a-z][a-zA-Z0-9]*$/.test(s)&&!/^(and|or|of|to|in|at|on|by|from|for|with|left|done|sent|open|live|today|tomorrow|yesterday|registered|donated|deferred|screened|male|female|other|yes|no|none|present|absent|leave|late|active|pending|paid|unpaid)$/.test(s))return false  // identifiers
  if(/^[A-Z_0-9]+$/.test(s))return false
  if(/^[a-z_]+(\.[a-z_]+)+$/.test(s))return false
  if(/\b(select|insert|update|from|eq|order)\(/.test(s))return false
  return true}
const add=(m,k,f)=>{k=k.replace(/\s+/g,' ').trim();if(!m.has(k))m.set(k,new Set());m.get(k).add(path.relative(R,f))}
for(const f of files){if(SKIP.test(f))continue;const src=fs.readFileSync(f,'utf8');let ast
  try{ast=parser.parse(src,{sourceType:'module',plugins:['jsx']})}catch(e){console.error('parse',f,e.message);continue}
  traverse(ast,{
    JSXText(p){const s=p.node.value;if(ui(s))add(exact,s,f)},
    StringLiteral(p){const par=p.parent;if(par.type==='ImportDeclaration'||par.type==='ExportNamedDeclaration')return
      if(par.type==='JSXAttribute'&&/^(className|class|id|key|href|to|type|name|role|src|alt?Class|autoComplete|inputMode|pattern|rel|target|method|lang|dir|htmlFor|tone|size|variant|kind|icon|mode|value|accept|capture)$/.test(par.name.name))return
      if(par.type==='ObjectProperty'&&par.key===p.node)return
      if(par.type==='CallExpression'&&par.callee.type==='MemberExpression'&&/^(from|select|eq|neq|rpc|order|is|in|gt|lt|gte|lte|channel|on|getItem|setItem|removeItem|querySelector|getElementById|createElement|addEventListener|removeEventListener|invoke|match|replace|split|startsWith|endsWith|includes|padStart|toLocaleDateString|toLocaleString|getPropertyValue|setProperty|upload|download|getPublicUrl|ilike|or|not|contains|filter|range|limit|single|upsert|delete|insert|update)$/.test(par.callee.property.name||''))return
      if(ui(p.node.value))add(exact,p.node.value,f)},
    TemplateLiteral(p){const q=p.node.quasis.map(x=>x.value.cooked);if(p.parent.type==='TaggedTemplateExpression')return
      const par=p.parent;if(par.type==='JSXExpressionContainer'&&p.parentPath.parent.type==='JSXAttribute'&&/^(className|class|href|to|key|id|src)$/.test(p.parentPath.parent.name.name))return
      if(par.type==='CallExpression'&&par.callee.type==='MemberExpression'&&/^(from|select|eq|rpc|or|filter|channel|ilike|on)$/.test(par.callee.property.name||''))return
      if(q.length===1){if(ui(q[0]))add(exact,q[0],f);return}
      const lit=q.join(' ');if(!/[A-Za-z]{3}/.test(lit)||tw(lit)||code(lit))return
      if(!q.some(x=>/[A-Za-z]{2,}/.test(x)&&!tw(x)))return
      add(pats,q.map((x,i)=>i?`{${i-1}}`+x:x).join(''),f)}})}
const out={exact:[...exact].map(([k,v])=>({k,f:[...v]})),patterns:[...pats].map(([k,v])=>({k,f:[...v]}))}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,0));console.log('exact',out.exact.length,'patterns',out.patterns.length)
