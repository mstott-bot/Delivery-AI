const $=id=>document.getElementById(id);
const storeKey="deliveryAI_dai001";
const defaultState={
  collectors:[{id:"c1",name:"Darren",phone:"",email:""},{id:"c2",name:"James",phone:"",email:""}],
  collections:[]
};
let state=load();

function load(){
  try{return JSON.parse(localStorage.getItem(storeKey))||structuredClone(defaultState)}
  catch(e){return structuredClone(defaultState)}
}
function save(){localStorage.setItem(storeKey,JSON.stringify(state))}
function uid(prefix="id"){return prefix+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function money(v){return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(Number(v||0))}
function num(v,d=1){return Number(v||0).toFixed(d)}
function dt(v){return v?new Date(v).toLocaleString("en-GB"):"—"}
function dateOnly(v){return v?new Date(v+"T12:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}
function collectorName(id){return state.collectors.find(c=>c.id===id)?.name||"Unassigned"}
function totalExpenses(j){return ["train","taxi","bus","fuel","parking","tolls","other"].reduce((s,k)=>s+Number(j.expenses?.[k]||0),0)}
function reduction(j){return Math.max(0,Number(j.agreedPrice||0)-Number(j.finalPrice||0))}
function hoursWorked(j){
  if(!j.clockIn)return 0;
  const end=j.clockOut?new Date(j.clockOut):new Date();
  return Math.max(0,(end-new Date(j.clockIn))/36e5);
}
function monthKey(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}

function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("page-"+page).classList.add("active");
  $("pageTitle").textContent=document.querySelector(`.nav-item[data-page="${page}"]`)?.textContent.trim()||"Delivery AI";
  renderAll();
}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showPage(b.dataset.go));

function renderAll(){
  fillCollectors();
  renderCommand();
  renderDiary();
  renderDriver();
  renderAppraisals();
  renderExpenses();
  renderHistory();
  renderReports();
  renderLeague();
  renderCollectors();
}

function metric(label,value,sub,cls="blue"){
  return `<div class="metric-card ${cls}"><span class="metric-label">${label}</span><strong>${value}</strong><small>${sub||""}</small></div>`
}

function renderCommand(){
  const now=new Date(), mk=monthKey(now), today=now.toISOString().slice(0,10);
  const month=state.collections.filter(j=>monthKey(j.collectionDate||j.createdAt)===mk);
  const todayJobs=state.collections.filter(j=>j.collectionDate===today);
  const completed=month.filter(j=>j.status==="Delivered");
  const exp=month.reduce((s,j)=>s+totalExpenses(j),0);
  const red=month.reduce((s,j)=>s+reduction(j),0);
  const hrs=month.reduce((s,j)=>s+hoursWorked(j),0);
  const miles=month.reduce((s,j)=>s+Number(j.distanceTravelled||0),0);
  $("heroNetSaving").textContent=money(red-exp);
  $("commandMetrics").innerHTML=[
    metric("Collections today",todayJobs.length,"Scheduled and active","blue"),
    metric("Collections this month",completed.length,"Delivered vehicles","good"),
    metric("Travel costs this month",money(exp),`${completed.length?money(exp/completed.length):money(0)} average`,"warn"),
    metric("Reductions this month",money(red),`${completed.length?money(red/completed.length):money(0)} average`,"good"),
    metric("Collector hours",`${num(hrs)} hrs`,"Clocked working time","blue"),
    metric("Distance travelled",`${num(miles,0)} mi`,"Completed journey mileage","blue"),
    metric("Net saving",money(red-exp),"Reduction less travel costs","good"),
    metric("Awaiting appraisal",month.filter(j=>!j.appraisalComplete).length,"Open checks","warn")
  ].join("");
  $("liveCollections").innerHTML=todayJobs.length?todayJobs.map(jobRow).join(""):`<p>No collections scheduled today.</p>`;
  const stats=state.collectors.map(c=>{
    const jobs=month.filter(j=>j.collector===c.id);
    return {name:c.name,count:jobs.length,hours:jobs.reduce((s,j)=>s+hoursWorked(j),0),reduction:jobs.reduce((s,j)=>s+reduction(j),0)}
  }).sort((a,b)=>b.reduction-a.reduction);
  $("collectorSnapshot").innerHTML=stats.length?`<div class="table-wrap"><table><thead><tr><th>Collector</th><th>Cars</th><th>Hours</th><th>Reduction</th></tr></thead><tbody>${stats.map(s=>`<tr><td><strong>${s.name}</strong></td><td>${s.count}</td><td>${num(s.hours)}</td><td>${money(s.reduction)}</td></tr>`).join("")}</tbody></table></div>`:"No collectors.";
}
function jobRow(j){
  return `<div class="job-row"><div><h4>${j.registration||"No registration"} · ${j.make||""} ${j.model||""}</h4><p>${collectorName(j.collector)} · ${j.collectionAddress||"No collection address"} → ${j.destination||"No destination"}</p></div><div><span class="badge ${j.status==="Delivered"?"green":j.status==="Cancelled"?"red":"blue"}">${j.status||"Scheduled"}</span></div></div>`
}

function renderDiary(){
  if(!$("diaryDate").value)$("diaryDate").value=new Date().toISOString().slice(0,10);
  const date=$("diaryDate").value;
  const jobs=state.collections.filter(j=>j.collectionDate===date);
  $("diaryList").innerHTML=jobs.length?jobs.map(jobRow).join(""):"<p>No collections on this date.</p>";
}
$("diaryDate").onchange=renderDiary;

function fillCollectors(){
  const opts='<option value="">Select collector</option>'+state.collectors.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  if($("collectorSelect"))$("collectorSelect").innerHTML=opts;
}
const form=$("collectionForm");
form.elements.collectionDate.value=new Date().toISOString().slice(0,10);
function updateReduction(){
  const a=Number(form.elements.agreedPrice.value||0),f=Number(form.elements.finalPrice.value||0);
  form.elements.calculatedReduction.value=(Math.max(0,a-f)).toFixed(2);
}
form.elements.agreedPrice.oninput=updateReduction;form.elements.finalPrice.oninput=updateReduction;
form.onsubmit=e=>{
  e.preventDefault();
  const x=Object.fromEntries(new FormData(form).entries());
  const job={
    id:uid("job"),createdAt:new Date().toISOString(),status:"Scheduled",
    ...x,registration:(x.registration||"").toUpperCase(),
    agreedPrice:Number(x.agreedPrice||0),finalPrice:Number(x.finalPrice||0),
    estimatedDistance:Number(x.estimatedDistance||0),
    expenses:{train:0,taxi:0,bus:0,fuel:0,parking:0,tolls:0,other:0},
    appraisal:{checks:{},tyres:{},damageParts:[],faultCodes:"",bodyDescription:"",interiorDescription:""},
    timeline:[{time:new Date().toISOString(),text:"Collection created"}]
  };
  state.collections.push(job);save();form.reset();form.elements.collectionDate.value=new Date().toISOString().slice(0,10);fillCollectors();toast("Collection created");showPage("diary");
};

function jobOptions(includeEmpty=true){
  return (includeEmpty?'<option value="">Select collection</option>':'')+state.collections.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(j=>`<option value="${j.id}">${j.registration||"No reg"} · ${collectorName(j.collector)} · ${dateOnly(j.collectionDate)}</option>`).join("");
}
function renderDriver(){
  const sel=$("driverJobSelect"),current=sel.value;
  sel.innerHTML=jobOptions();
  if(state.collections.some(j=>j.id===current))sel.value=current;
  const j=state.collections.find(x=>x.id===sel.value);
  if(!j){$("driverJobCard").innerHTML=`<div class="panel"><p>Select a collection to begin.</p></div>`;return}
  $("driverJobCard").innerHTML=`<div class="driver-card">
    <div class="driver-card-top"><p class="eyebrow">ACTIVE COLLECTION</p><h3>${j.registration} · ${j.make||""} ${j.model||""}</h3><p>${j.collectionAddress||"Collection address not entered"} → ${j.destination||"Destination not entered"}</p></div>
    <div class="driver-details">
      <div class="detail-card"><span>Status</span><strong>${j.status}</strong></div>
      <div class="detail-card"><span>Clocked hours</span><strong>${num(hoursWorked(j))} hrs</strong></div>
      <div class="detail-card"><span>Reduction</span><strong>${money(reduction(j))}</strong></div>
      <div class="detail-card"><span>Travel cost</span><strong>${money(totalExpenses(j))}</strong></div>
    </div>
    <div class="driver-actions">
      <button class="action-start" onclick="clockIn('${j.id}')">Clock In</button>
      <button class="action-step" onclick="setStatus('${j.id}','At Collection')">Arrived</button>
      <button class="action-step" onclick="setStatus('${j.id}','Appraising')">Start Appraisal</button>
      <button class="action-step" onclick="setStatus('${j.id}','Collected')">Vehicle Collected</button>
      <button class="action-step" onclick="setStatus('${j.id}','Delivered')">Delivered</button>
      <button class="action-stop" onclick="clockOut('${j.id}')">Clock Out</button>
    </div>
    <div class="panel" style="margin:0;border:0;box-shadow:none">
      <div class="form-grid three">
        <label>Starting mileage<input id="startMiles" type="number" value="${j.startMileage||""}"></label>
        <label>Finishing mileage<input id="finishMiles" type="number" value="${j.finishMileage||""}"></label>
        <label>Distance travelled<input id="distanceMiles" type="number" value="${j.distanceTravelled||""}"></label>
      </div>
      <button class="primary-btn" onclick="saveMileage('${j.id}')">Save Journey Mileage</button>
    </div>
  </div>`;
}
$("driverJobSelect").onchange=renderDriver;
window.clockIn=id=>{const j=state.collections.find(x=>x.id===id);if(!j.clockIn)j.clockIn=new Date().toISOString();j.status="Travelling";save();renderAll();toast("Collector clocked in")};
window.clockOut=id=>{const j=state.collections.find(x=>x.id===id);j.clockOut=new Date().toISOString();save();renderAll();toast("Collector clocked out")};
window.setStatus=(id,status)=>{const j=state.collections.find(x=>x.id===id);j.status=status;j.timeline.push({time:new Date().toISOString(),text:status});save();renderAll();toast("Status updated")};
window.saveMileage=id=>{const j=state.collections.find(x=>x.id===id);j.startMileage=Number($("startMiles").value||0);j.finishMileage=Number($("finishMiles").value||0);j.distanceTravelled=Number($("distanceMiles").value||Math.max(0,j.finishMileage-j.startMileage));save();renderAll();toast("Mileage saved")};

const checkItems=[
"Air conditioning working","Satellite navigation working","Bluetooth working","Lights working","Vents undamaged","Two keys present",
"Engine oil level good","Coolant level good","Front electric windows working","Rear electric windows working",
"Seat belts pulled out and checked","Electric mirrors working","Reverse camera working","All console buttons working",
"Wipers and washers working","Windscreen condition good","Engine starts correctly","Clutch and gearbox working","Brakes working","Handbrake working"
];
const damageParts=["Front bumper","Bonnet","Roof","Rear bumper","Boot","NSF wing","OSF wing","NSF door","NSR door","OSF door","OSR door","Wheels","Windscreen"];
function renderAppraisals(){
  const sel=$("appraisalJobSelect"),current=sel.value;sel.innerHTML=jobOptions();if(state.collections.some(j=>j.id===current))sel.value=current;
  const j=state.collections.find(x=>x.id===sel.value);
  if(!j){$("appraisalWorkspace").innerHTML="<p>Select a collection to complete an appraisal.</p>";return}
  const a=j.appraisal||{checks:{},tyres:{},damageParts:[]};
  $("appraisalWorkspace").innerHTML=`
  <div id="printAppraisal">
    <div class="form-section"><h4>${j.registration} · ${j.make||""} ${j.model||""}</h4>
      <div class="form-grid three">
        <label>NSF tyre tread (mm)<input data-tyre="NSF" type="number" step=".1" value="${a.tyres?.NSF||""}"></label>
        <label>NSR tyre tread (mm)<input data-tyre="NSR" type="number" step=".1" value="${a.tyres?.NSR||""}"></label>
        <label>OSF tyre tread (mm)<input data-tyre="OSF" type="number" step=".1" value="${a.tyres?.OSF||""}"></label>
        <label>OSR tyre tread (mm)<input data-tyre="OSR" type="number" step=".1" value="${a.tyres?.OSR||""}"></label>
      </div>
    </div>
    <div class="form-section"><h4>Equipment and mechanical checks</h4><div class="check-grid">
      ${checkItems.map(item=>`<div class="check-row"><span>${item}</span><select data-check="${item}"><option ${a.checks?.[item]===""?"selected":""}></option><option ${a.checks?.[item]==="Good"?"selected":""}>Good</option><option ${a.checks?.[item]==="Fault"?"selected":""}>Fault</option><option ${a.checks?.[item]==="Not fitted"?"selected":""}>Not fitted</option><option ${a.checks?.[item]==="Not checked"?"selected":""}>Not checked</option></select></div>`).join("")}
    </div></div>
    <div class="form-section"><h4>Vehicle damage map</h4><div class="damage-map">${damageParts.map(p=>`<button type="button" class="damage-part ${(a.damageParts||[]).includes(p)?"selected":""}" data-damage="${p}">${p}</button>`).join("")}</div></div>
    <div class="form-section"><h4>Diagnostics and condition descriptions</h4>
      <div class="form-grid two">
        <label>Fault codes and description<textarea id="faultCodes">${a.faultCodes||""}</textarea></label>
        <label>Bodywork condition and description<textarea id="bodyDescription">${a.bodyDescription||""}</textarea></label>
        <label>Interior cosmetic damage and description<textarea id="interiorDescription">${a.interiorDescription||""}</textarea></label>
        <label>Additional appraisal notes<textarea id="appraisalNotes">${a.notes||""}</textarea></label>
      </div>
    </div>
  </div>
  <div class="form-actions"><button class="secondary-btn" onclick="printAppraisal()">Print Appraisal</button><button class="primary-btn" onclick="saveAppraisal('${j.id}')">Save Appraisal</button></div>`;
  document.querySelectorAll("[data-damage]").forEach(b=>b.onclick=()=>b.classList.toggle("selected"));
}
$("appraisalJobSelect").onchange=renderAppraisals;
window.saveAppraisal=id=>{
  const j=state.collections.find(x=>x.id===id),checks={},tyres={};
  document.querySelectorAll("[data-check]").forEach(x=>checks[x.dataset.check]=x.value);
  document.querySelectorAll("[data-tyre]").forEach(x=>tyres[x.dataset.tyre]=Number(x.value||0));
  j.appraisal={checks,tyres,damageParts:[...document.querySelectorAll("[data-damage].selected")].map(x=>x.dataset.damage),faultCodes:$("faultCodes").value,bodyDescription:$("bodyDescription").value,interiorDescription:$("interiorDescription").value,notes:$("appraisalNotes").value};
  j.appraisalComplete=true;save();renderAll();toast("Appraisal saved");
};
window.printAppraisal=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("print-target"));$("page-appraisals").classList.add("print-target");window.print()};

function renderExpenses(){
  $("expenseList").innerHTML=state.collections.length?state.collections.map(j=>`<div class="panel" style="box-shadow:none">
    <div class="panel-heading"><div><h3>${j.registration} · ${collectorName(j.collector)}</h3><p>${dateOnly(j.collectionDate)}</p></div><strong>${money(totalExpenses(j))}</strong></div>
    <div class="form-grid three">
      ${["train","taxi","bus","fuel","parking","tolls","other"].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)} (£)<input type="number" step=".01" data-expense-job="${j.id}" data-expense-key="${k}" value="${j.expenses?.[k]||0}"></label>`).join("")}
    </div><button class="primary-btn" onclick="saveExpenses('${j.id}')">Save Expenses</button>
  </div>`).join(""):"<p>No collections available.</p>";
}
window.saveExpenses=id=>{
  const j=state.collections.find(x=>x.id===id);j.expenses=j.expenses||{};
  document.querySelectorAll(`[data-expense-job="${id}"]`).forEach(x=>j.expenses[x.dataset.expenseKey]=Number(x.value||0));
  save();renderAll();toast("Expenses saved");
};

function renderHistory(){
  const q=($("historySearch").value||"").toLowerCase();
  const jobs=state.collections.filter(j=>[j.registration,collectorName(j.collector),j.destination,j.collectionAddress].join(" ").toLowerCase().includes(q));
  $("historyList").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Registration</th><th>Collector</th><th>Status</th><th>Miles</th><th>Hours</th><th>Costs</th><th>Reduction</th></tr></thead><tbody>${jobs.map(j=>`<tr><td>${dateOnly(j.collectionDate)}</td><td><strong>${j.registration}</strong></td><td>${collectorName(j.collector)}</td><td>${j.status}</td><td>${num(j.distanceTravelled||0,0)}</td><td>${num(hoursWorked(j))}</td><td>${money(totalExpenses(j))}</td><td>${money(reduction(j))}</td></tr>`).join("")}</tbody></table></div>`;
}
$("historySearch").oninput=renderHistory;

function monthStats(m){
  const jobs=state.collections.filter(j=>monthKey(j.collectionDate||j.createdAt)===m);
  const completed=jobs.filter(j=>j.status==="Delivered");
  return {jobs:completed.length,miles:jobs.reduce((s,j)=>s+Number(j.distanceTravelled||0),0),hours:jobs.reduce((s,j)=>s+hoursWorked(j),0),cost:jobs.reduce((s,j)=>s+totalExpenses(j),0),red:jobs.reduce((s,j)=>s+reduction(j),0)}
}
function renderReports(){
  const now=new Date(),thisM=monthKey(now),last=new Date(now.getFullYear(),now.getMonth()-1,1),lastM=monthKey(last);
  if(!$("monthA").value)$("monthA").value=thisM;if(!$("monthB").value)$("monthB").value=lastM;
  const a=monthStats($("monthA").value),b=monthStats($("monthB").value);
  $("reportMetrics").innerHTML=[
    metric("Cars collected",a.jobs,`${a.jobs-b.jobs>=0?"+":""}${a.jobs-b.jobs} vs comparison`),
    metric("Hours worked",`${num(a.hours)} hrs`,`${num(a.jobs?a.hours/a.jobs:0)} hrs per car`),
    metric("Average travel cost",money(a.jobs?a.cost/a.jobs:0),`${money(a.cost)} total`),
    metric("Average reduction",money(a.jobs?a.red/a.jobs:0),`${money(a.red)} total`)
  ].join("");
  const rows=[
    ["Cars collected",a.jobs,b.jobs],
    ["Distance travelled",`${num(a.miles,0)} mi`,`${num(b.miles,0)} mi`],
    ["Hours worked",`${num(a.hours)} hrs`,`${num(b.hours)} hrs`],
    ["Travel costs",money(a.cost),money(b.cost)],
    ["Average travel cost",money(a.jobs?a.cost/a.jobs:0),money(b.jobs?b.cost/b.jobs:0)],
    ["Reductions achieved",money(a.red),money(b.red)],
    ["Average reduction",money(a.jobs?a.red/a.jobs:0),money(b.jobs?b.red/b.jobs:0)],
    ["Net saving",money(a.red-a.cost),money(b.red-b.cost)]
  ];
  $("monthComparison").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Metric</th><th>${$("monthA").value}</th><th>${$("monthB").value}</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>`;
}
$("monthA").onchange=renderReports;$("monthB").onchange=renderReports;

function renderLeague(){
  const mk=monthKey(new Date());
  const rows=state.collectors.map(c=>{
    const jobs=state.collections.filter(j=>j.collector===c.id&&monthKey(j.collectionDate||j.createdAt)===mk);
    const red=jobs.reduce((s,j)=>s+reduction(j),0),cost=jobs.reduce((s,j)=>s+totalExpenses(j),0),hrs=jobs.reduce((s,j)=>s+hoursWorked(j),0);
    return {name:c.name,cars:jobs.filter(j=>j.status==="Delivered").length,hrs,red,avg:jobs.length?red/jobs.length:0,net:red-cost,perHour:hrs?red/hrs:0}
  }).sort((a,b)=>b.red-a.red);
  $("leagueTable").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Collector</th><th>Cars</th><th>Hours</th><th>Total Reduction</th><th>Average Reduction</th><th>Reduction / Hour</th><th>Net Saving</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><span class="badge ${i===0?"green":"blue"}">${i+1}</span></td><td><strong>${r.name}</strong></td><td>${r.cars}</td><td>${num(r.hrs)}</td><td>${money(r.red)}</td><td>${money(r.avg)}</td><td>${money(r.perHour)}</td><td>${money(r.net)}</td></tr>`).join("")}</tbody></table></div>`;
}

$("collectorForm").onsubmit=e=>{
  e.preventDefault();const x=Object.fromEntries(new FormData(e.target).entries());state.collectors.push({id:uid("collector"),...x});save();e.target.reset();renderAll();toast("Collector added");
};
function renderCollectors(){
  $("collectorList").innerHTML=state.collectors.map(c=>`<div class="job-row"><div><h4>${c.name}</h4><p>${c.phone||"No telephone"} · ${c.email||"No email"}</p></div><button class="ghost-btn" onclick="deleteCollector('${c.id}')">Remove</button></div>`).join("");
}
window.deleteCollector=id=>{if(state.collections.some(j=>j.collector===id)){toast("Collector is linked to collections");return}state.collectors=state.collectors.filter(c=>c.id!==id);save();renderAll();toast("Collector removed")};

$("todayDate").textContent=new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
renderAll();
