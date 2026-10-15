export default function Soon({item}){const I=item.icon
  return <div className="card py-16 text-center"><I className="mx-auto mb-3 text-brand" size={30}/>
    <h1 className="text-xl font-semibold text-white">{item.label}</h1><p className="mt-1 text-slate-400">Planned for Phase {item.phase}</p></div>}
