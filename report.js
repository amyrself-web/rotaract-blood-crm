const inr=n=>'Rs. '+Number(n||0).toLocaleString('en-IN')
export async function reportPdf(r,fmt){
  const {jsPDF}=await import('jspdf'),doc=new jsPDF({unit:'mm',format:'a4'});let y=22
  const line=(s,size=11,bold=false,gap=7)=>{doc.setFont('helvetica',bold?'bold':'normal').setFontSize(size).setTextColor(11,18,32);doc.text(String(s),20,y);y+=gap}
  line('Sankari Rotaract Club',11,true,6);line('Blood Donation Camp Report',20,true,10)
  line(r.camp.name,14,true);line(`${fmt(r.camp.date)}${r.camp.venue?', '+r.camp.venue:''}`,11,false,12)
  line('Donors',13,true)
  ;[['Registered',r.registered],['Arrived',r.arrived],['Donated',r.donated],['Deferred',r.deferred],['No-show',r.no_show],['First-time donors',r.first_time],['Repeat donors',r.donated-r.first_time],['Blood collected',(r.volume_ml/1000).toFixed(2)+' L']].forEach(([a,b])=>line(`${a}: ${b}`))
  if(r.camp.target)line(`Target: ${r.camp.target} donors (${Math.round(r.donated/r.camp.target*100)}% achieved)`)
  y+=4;line('Donated by blood group',13,true);line(Object.entries(r.by_group).map(([g,n])=>`${g}: ${n}`).join('   ')||'None',11,false,12)
  line('Team',13,true);line(`Volunteers: ${r.volunteers} (${r.volunteers_present} present)`);line(`Tasks completed: ${r.tasks_done} of ${r.tasks_total}`,11,false,12)
  line('Money',13,true);if(r.camp.budget)line(`Budget: ${inr(r.camp.budget)}`)
  line(`Sponsorship received: ${inr(r.sponsors_received)} (pledged ${inr(r.sponsors_pledged)})`);line(`Expenses: ${inr(r.expenses)}`);line(`Balance: ${inr(r.sponsors_received-r.expenses)}`)
  doc.save(`camp-report-${r.camp.name.replace(/\W+/g,'-').toLowerCase()}.pdf`)
}
