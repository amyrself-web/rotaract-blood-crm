// The club year runs 1 July to 30 June. Its name (default "Lionism year") is set in Settings.
export let YEAR_NAME='Lionism year'
export const setYearName=n=>{YEAR_NAME=(n||'').trim()||'Lionism year'}
export const clubYearOf=d=>{const x=d?new Date(d):new Date();const y=x.getMonth()>=6?x.getFullYear():x.getFullYear()-1;return `${y}-${String(y+1).slice(2)}`}
