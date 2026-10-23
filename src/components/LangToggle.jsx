import {useLang} from '../lib/i18n'

// EN / தமிழ் switch; remembered on this device
export default function LangToggle({className=''}){
  const {lang,setLang}=useLang()
  return <div role="group" aria-label="Language" className={`inline-flex rounded-full border border-ink-600 bg-ink-900/70 p-0.5 text-xs font-semibold ${className}`}>
    {[['en','EN'],['ta','தமிழ்']].map(([k,l])=><button key={k} type="button" aria-pressed={lang===k} onClick={()=>setLang(k)}
      className={`rounded-full px-2.5 py-1 transition ${lang===k?'bg-brand text-white':'text-fog-muted hover:text-fg'}`}>{l}</button>)}</div>
}
