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
  renderAppraisalHistory();
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
    metric("Collections today",todayJobs.length,"Scheduled, active and no collection","blue"),
    metric("Collections this month",completed.length,"Delivered vehicles","good"),
    metric("No Collection Trips",month.filter(j=>j.status==="No Collection").length,`${money(month.filter(j=>j.status==="No Collection").reduce((s,j)=>s+totalExpenses(j),0))} cost this month`,"warn"),
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
  const badgeClass=j.status==="Delivered"?"green":j.status==="No Collection"||j.status==="Cancelled"?"red":"blue";
  return `<div class="job-row">
    <div><h4>${j.registration||"No registration"} · ${j.make||""} ${j.model||""}</h4><p>${collectorName(j.collector)} · ${j.collectionAddress||"No collection address"} → ${j.destination||"No destination"}</p></div>
    <div class="job-row-actions"><span class="badge ${badgeClass}">${j.status||"Scheduled"}</span><button class="ghost-btn no-print" onclick="markNoCollection('${j.id}')">No Collection</button><button class="ghost-btn danger-text no-print" onclick="deleteCollection('${j.id}')">Delete</button></div>
  </div>`
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
form.onsubmit=e=>{
  e.preventDefault();
  const x=Object.fromEntries(new FormData(form).entries());
  const job={
    id:uid("job"),createdAt:new Date().toISOString(),status:"Scheduled",
    ...x,registration:(x.registration||"").toUpperCase(),
    agreedPrice:Number(x.agreedPrice||0),finalPrice:0,hasSettlement:x.hasSettlement||"",
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
      <button class="action-step" onclick="markNoCollection('${j.id}')">No Collection</button>
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
window.markNoCollection=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;
  const reason=window.prompt("Reason for no collection (optional):",j.noCollectionReason||"");
  if(reason===null)return;
  j.status="No Collection";
  j.noCollectionReason=reason.trim();
  j.noCollectionAt=new Date().toISOString();
  j.timeline=j.timeline||[];
  j.timeline.push({time:j.noCollectionAt,text:`No Collection${j.noCollectionReason?": "+j.noCollectionReason:""}`});
  save();renderAll();toast("Marked as no collection — costs retained");
};
window.deleteCollection=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;
  if(!window.confirm(`Delete collection ${j.registration||""}? This permanently removes it from all reports.`))return;
  state.collections=state.collections.filter(x=>x.id!==id);
  save();renderAll();toast("Collection deleted");
};
window.saveMileage=id=>{const j=state.collections.find(x=>x.id===id);j.startMileage=Number($("startMiles").value||0);j.finishMileage=Number($("finishMiles").value||0);j.distanceTravelled=Number($("distanceMiles").value||Math.max(0,j.finishMileage-j.startMileage));save();renderAll();toast("Mileage saved")};

const checkItems=[
"Air conditioning working","Satellite navigation working","Bluetooth working","Lights working","Vents undamaged","Two keys present",
"Engine oil level good","Coolant level good","Front electric windows working","Rear electric windows working",
"Seat belts pulled out and checked","Electric mirrors working","Reverse camera working","All console buttons working",
"Wipers and washers working","Windscreen condition good","Engine starts correctly","Clutch and gearbox working","Handbrake working"
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

  const savedAt=new Date().toISOString();
  j.appraisal={
    checks,
    tyres,
    damageParts:[...document.querySelectorAll("[data-damage].selected")].map(x=>x.dataset.damage),
    faultCodes:$("faultCodes").value,
    bodyDescription:$("bodyDescription").value,
    interiorDescription:$("interiorDescription").value,
    notes:$("appraisalNotes").value,
    savedAt
  };
  j.appraisalComplete=true;
  j.appraisalSavedAt=savedAt;

  save();
  renderAll();
  toast("Appraisal saved permanently");
};
window.printAppraisal=()=>{
  const id=$("appraisalJobSelect").value;
  const j=state.collections.find(x=>x.id===id);
  if(j?.appraisalComplete){
    printSavedAppraisal(id);
    return;
  }
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("print-target"));
  $("page-appraisals").classList.add("print-target");
  window.print();
};


function appraisalPrintHtml(j){
  const a=j.appraisal||{};
  const checks=Object.entries(a.checks||{});
  const tyres=a.tyres||{};
  const damages=a.damageParts||[];

  return `<div class="saved-appraisal-print">
    <div class="saved-print-title">
      <div>
        <p class="eyebrow">DELIVERY AI VEHICLE APPRAISAL</p>
        <h1>${j.registration||"No registration"} · ${j.make||""} ${j.model||""}</h1>
      </div>
      <div>
        <strong>${collectorName(j.collector)}</strong>
        <p>${dateOnly(j.collectionDate)}</p>
      </div>
    </div>

    <div class="print-summary-grid">
      <div><span>Collection address</span><strong>${j.collectionAddress||"—"}</strong></div>
      <div><span>Destination</span><strong>${j.destination||"—"}</strong></div>
      <div><span>Vehicle mileage</span><strong>${j.vehicleMileage||"—"}</strong></div>
      <div><span>Appraisal saved</span><strong>${dt(j.appraisalSavedAt||a.savedAt)}</strong></div>
    </div>

    <h3>Tyre tread depths</h3>
    <table><thead><tr><th>NSF</th><th>NSR</th><th>OSF</th><th>OSR</th></tr></thead>
      <tbody><tr><td>${tyres.NSF||0} mm</td><td>${tyres.NSR||0} mm</td><td>${tyres.OSF||0} mm</td><td>${tyres.OSR||0} mm</td></tr></tbody>
    </table>

    <h3>Equipment and vehicle checks</h3>
    <table><thead><tr><th>Check</th><th>Result</th></tr></thead>
      <tbody>${checks.map(([name,value])=>`<tr><td>${name}</td><td>${value||"Not recorded"}</td></tr>`).join("")}</tbody>
    </table>

    <h3>Selected damage areas</h3>
    <p>${damages.length?damages.join(", "):"No damage areas selected"}</p>

    <h3>Fault codes and diagnostics</h3>
    <p>${a.faultCodes||"None recorded"}</p>

    <h3>Bodywork condition</h3>
    <p>${a.bodyDescription||"No description recorded"}</p>

    <h3>Interior condition</h3>
    <p>${a.interiorDescription||"No description recorded"}</p>

    <h3>Additional notes</h3>
    <p>${a.notes||"No additional notes"}</p>
  </div>`;
}

function renderAppraisalHistory(){
  const q=($("appraisalHistorySearch")?.value||"").toLowerCase();
  const jobs=state.collections
    .filter(j=>j.appraisalComplete)
    .filter(j=>[j.registration,collectorName(j.collector),j.make,j.model,j.collectionAddress,j.destination].join(" ").toLowerCase().includes(q))
    .sort((a,b)=>new Date(b.appraisalSavedAt||b.collectionDate)-new Date(a.appraisalSavedAt||a.collectionDate));

  if(!$("appraisalHistoryList"))return;

  $("appraisalHistoryList").innerHTML=jobs.length?`<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Registration</th><th>Vehicle</th><th>Collector</th><th>Reduction</th><th>Saved</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${jobs.map(j=>`<tr>
      <td>${dateOnly(j.collectionDate)}</td>
      <td><strong>${j.registration}</strong></td>
      <td>${j.make||""} ${j.model||""}</td>
      <td>${collectorName(j.collector)}</td>
      <td>${money(reduction(j))}</td>
      <td>${dt(j.appraisalSavedAt||j.appraisal?.savedAt)}</td>
      <td class="no-print">
        <button class="ghost-btn" onclick="openSavedAppraisal('${j.id}')">Open</button>
        <button class="primary-btn" onclick="printSavedAppraisal('${j.id}')">Print</button>
      </td>
    </tr>`).join("")}</tbody>
  </table></div>`:"<p>No saved appraisals found.</p>";
}

if($("appraisalHistorySearch"))$("appraisalHistorySearch").oninput=renderAppraisalHistory;

window.openSavedAppraisal=id=>{
  showPage("appraisals");
  $("appraisalJobSelect").value=id;
  renderAppraisals();
};

window.printSavedAppraisal=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j||!j.appraisalComplete){toast("No saved appraisal found");return}

  const printWindow=window.open("","_blank");
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${j.registration} Appraisal</title>
    <link rel="stylesheet" href="style.css">
    <style>body{padding:30px;background:#fff}.saved-appraisal-print{max-width:900px;margin:auto}.saved-print-title{display:flex;justify-content:space-between;border-bottom:2px solid #172033;padding-bottom:18px;margin-bottom:20px}.print-summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}.print-summary-grid div{border:1px solid #ddd;padding:12px;border-radius:8px}.print-summary-grid span{display:block;color:#666;font-size:12px}.print-summary-grid strong{display:block;margin-top:5px}h3{margin-top:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:left}</style>
  </head><body>${appraisalPrintHtml(j)}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(()=>printWindow.print(),300);
};

window.printReports=()=>{
  const a=$("monthA").value;
  const b=$("monthB").value;
  $("printReportPeriod").textContent=`${a} compared with ${b}`;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("print-target"));
  $("page-reports").classList.add("print-target");
  window.print();
};
function renderExpenses(){
  $("expenseList").innerHTML=state.collections.length?state.collections.map(j=>`<div class="panel" style="box-shadow:none">
    <div class="panel-heading">
      <div>
        <h3>${j.registration} · ${collectorName(j.collector)}</h3>
        <p>${dateOnly(j.collectionDate)} · Settlement: ${j.hasSettlement||"Not recorded"}</p>
      </div>
      <strong>Travel: ${money(totalExpenses(j))}</strong>
    </div>

    <div class="form-section">
      <h4>Vehicle purchase and saving</h4>
      <div class="form-grid three">
        <label>Agreed purchase price (£)
          <input type="number" min="0" step=".01" data-purchase-job="${j.id}" data-purchase-key="agreedPrice" value="${j.agreedPrice||0}" oninput="previewSaving('${j.id}')">
        </label>
        <label>Final collection price (£)
          <input type="number" min="0" step=".01" data-purchase-job="${j.id}" data-purchase-key="finalPrice" value="${j.finalPrice||0}" oninput="previewSaving('${j.id}')">
        </label>
        <label>Money saved (£)
          <input type="text" id="saving_${j.id}" readonly value="${money(reduction(j))}">
        </label>
      </div>
    </div>

    <div class="form-section">
      <h4>Travel expenses</h4>
      <div class="form-grid three">
        ${["train","taxi","bus","fuel","parking","tolls","other"].map(k=>`<label>${k[0].toUpperCase()+k.slice(1)} (£)<input type="number" step=".01" data-expense-job="${j.id}" data-expense-key="${k}" value="${j.expenses?.[k]||0}"></label>`).join("")}
      </div>
    </div>

    <button class="primary-btn" onclick="saveExpenses('${j.id}')">Save Expenses & Prices</button>
  </div>`).join(""):"<p>No collections available.</p>";
}

window.previewSaving=id=>{
  const agreed=Number(document.querySelector(`[data-purchase-job="${id}"][data-purchase-key="agreedPrice"]`)?.value||0);
  const finalPrice=Number(document.querySelector(`[data-purchase-job="${id}"][data-purchase-key="finalPrice"]`)?.value||0);
  const saving=Math.max(0,agreed-finalPrice);
  const output=$("saving_"+id);
  if(output)output.value=money(saving);
};

window.saveExpenses=id=>{
  const j=state.collections.find(x=>x.id===id);
  j.expenses=j.expenses||{};

  document.querySelectorAll(`[data-purchase-job="${id}"]`).forEach(x=>{
    j[x.dataset.purchaseKey]=Number(x.value||0);
  });

  document.querySelectorAll(`[data-expense-job="${id}"]`).forEach(x=>{
    j.expenses[x.dataset.expenseKey]=Number(x.value||0);
  });

  save();
  renderAll();
  toast("Expenses, prices and saving saved");
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
  const expenseTotals={train:0,taxi:0,bus:0,fuel:0,parking:0,tolls:0,other:0};

  jobs.forEach(j=>{
    Object.keys(expenseTotals).forEach(k=>{
      expenseTotals[k]+=Number(j.expenses?.[k]||0);
    });
  });

  const noCollections=jobs.filter(j=>j.status==="No Collection");
  const miles=jobs.reduce((s,j)=>s+Number(j.distanceTravelled||0),0);
  const hours=jobs.reduce((s,j)=>s+hoursWorked(j),0);
  const cost=Object.values(expenseTotals).reduce((s,v)=>s+v,0);
  const red=completed.reduce((s,j)=>s+reduction(j),0);
  const collectionCount=completed.length;
  const noCollectionCost=noCollections.reduce((s,j)=>s+totalExpenses(j),0);

  return {
    jobs:collectionCount,
    noCollections:noCollections.length,
    noCollectionCost,
    miles,
    hours,
    cost,
    red,
    expenses:expenseTotals,
    avgMiles:collectionCount?miles/collectionCount:0,
    avgCost:collectionCount?cost/collectionCount:0,
    avgHours:collectionCount?hours/collectionCount:0,
    costPerMile:miles?cost/miles:0,
    net:red-cost
  };
}

function pctChange(current,comparison){
  if(!comparison)return current?100:0;
  return ((current-comparison)/comparison)*100;
}

function diffCell(current,comparison,type="money"){
  const diff=current-comparison;
  const formatted=type==="money"?money(Math.abs(diff)):
    type==="miles"?`${num(Math.abs(diff),0)} mi`:
    type==="hours"?`${num(Math.abs(diff))} hrs`:
    num(Math.abs(diff),0);

  if(diff===0)return `<span class="badge blue">No change</span>`;
  return `<span class="badge ${diff>0?"amber":"green"}">${diff>0?"+":"-"}${formatted}</span>`;
}

function renderReports(){
  const now=new Date();
  const thisM=monthKey(now);
  const last=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastM=monthKey(last);

  if(!$("monthA").value)$("monthA").value=thisM;
  if(!$("monthB").value)$("monthB").value=lastM;

  const monthA=$("monthA").value;
  const monthB=$("monthB").value;
  const a=monthStats(monthA);
  const b=monthStats(monthB);

  $("reportMetrics").innerHTML=[
    metric("Cars collected",a.jobs,`${a.jobs-b.jobs>=0?"+":""}${a.jobs-b.jobs} vs comparison`),
    metric("No collections",a.noCollections,`${money(a.noCollectionCost)} costs incurred`,"warn"),
    metric("Miles travelled",`${num(a.miles,0)} mi`,`${num(a.avgMiles,0)} miles per collection`),
    metric("Total travel cost",money(a.cost),`${money(a.avgCost)} per collection`,"warn"),
    metric("Average travel cost",money(a.avgCost),"Total travel cost ÷ collections","blue"),
    metric("Hours worked",`${num(a.hours)} hrs`,`${num(a.avgHours)} hrs per collection`),
    metric("Average reduction",money(a.jobs?a.red/a.jobs:0),`${money(a.red)} total money saved`,"good"),
    metric("Net saving per collection",money(a.jobs?a.net/a.jobs:0),`${money(a.net)} total net saving`,"good"),
    metric("Fuel spend",money(a.expenses.fuel),`${money(b.expenses.fuel)} comparison month`,"warn")
  ].join("");

  const expenseRows=[
    ["Train",a.expenses.train,b.expenses.train],
    ["Taxi",a.expenses.taxi,b.expenses.taxi],
    ["Bus",a.expenses.bus,b.expenses.bus],
    ["Fuel",a.expenses.fuel,b.expenses.fuel],
    ["Parking",a.expenses.parking,b.expenses.parking],
    ["Tolls",a.expenses.tolls,b.expenses.tolls],
    ["Other",a.expenses.other,b.expenses.other],
    ["Total Travel Cost",a.cost,b.cost]
  ];

  $("expenseComparison").innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Expense Type</th><th>${monthA}</th><th>${monthB}</th><th>Difference</th><th>% Change</th></tr></thead>
    <tbody>${expenseRows.map(r=>`<tr>
      <td><strong>${r[0]}</strong></td>
      <td>${money(r[1])}</td>
      <td>${money(r[2])}</td>
      <td>${diffCell(r[1],r[2],"money")}</td>
      <td>${num(pctChange(r[1],r[2]))}%</td>
    </tr>`).join("")}</tbody>
  </table></div>`;

  const comparisonRows=[
    ["Cars collected",a.jobs,b.jobs,"count"],
    ["No collections",a.noCollections,b.noCollections,"count"],
    ["No collection costs",a.noCollectionCost,b.noCollectionCost,"money"],
    ["Miles travelled",a.miles,b.miles,"miles"],
    ["Average miles per collection",a.avgMiles,b.avgMiles,"miles"],
    ["Hours worked",a.hours,b.hours,"hours"],
    ["Average hours per collection",a.avgHours,b.avgHours,"hours"],
    ["Total travel cost",a.cost,b.cost,"money"],
    ["Average travel cost per collection",a.avgCost,b.avgCost,"money"],
    ["Miles per collection",a.avgMiles,b.avgMiles,"miles"],
    ["Money saved",a.red,b.red,"money"],
    ["Average reduction",a.jobs?a.red/a.jobs:0,b.jobs?b.red/b.jobs:0,"money"],
    ["Net saving",a.net,b.net,"money"],
    ["Net saving per collection",a.jobs?a.net/a.jobs:0,b.jobs?b.net/b.jobs:0,"money"]
  ];

  $("monthComparison").innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Metric</th><th>${monthA}</th><th>${monthB}</th><th>Difference</th></tr></thead>
    <tbody>${comparisonRows.map(r=>`<tr>
      <td><strong>${r[0]}</strong></td>
      <td>${r[3]==="money"?money(r[1]):r[3]==="miles"?`${num(r[1],0)} mi`:r[3]==="hours"?`${num(r[1])} hrs`:num(r[1],0)}</td>
      <td>${r[3]==="money"?money(r[2]):r[3]==="miles"?`${num(r[2],0)} mi`:r[3]==="hours"?`${num(r[2])} hrs`:num(r[2],0)}</td>
      <td>${diffCell(r[1],r[2],r[3])}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;

  const collectorRows=state.collectors.map(c=>{
    const jobs=state.collections.filter(j=>j.collector===c.id&&monthKey(j.collectionDate||j.createdAt)===monthA);
    const delivered=jobs.filter(j=>j.status==="Delivered").length;
    const miles=jobs.reduce((s,j)=>s+Number(j.distanceTravelled||0),0);
    const travel=jobs.reduce((s,j)=>s+totalExpenses(j),0);
    const fuel=jobs.reduce((s,j)=>s+Number(j.expenses?.fuel||0),0);
    const hrs=jobs.reduce((s,j)=>s+hoursWorked(j),0);
    const red=jobs.reduce((s,j)=>s+reduction(j),0);

    return {
      name:c.name,
      cars:delivered,
      miles,
      fuel,
      travel,
      avgCost:delivered?travel/delivered:0,
      avgMiles:delivered?miles/delivered:0,
      hours:hrs,
      net:red-travel
    };
  }).sort((x,y)=>y.cars-x.cars);

  $("collectorCostTable").innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Collector</th><th>Cars</th><th>Miles</th><th>Miles/Collection</th><th>Fuel</th><th>Travel Cost</th><th>Cost/Collection</th><th>Hours</th><th>Net Saving</th></tr></thead>
    <tbody>${collectorRows.map(r=>`<tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.cars}</td>
      <td>${num(r.miles,0)} mi</td>
      <td>${num(r.avgMiles,0)} mi</td>
      <td>${money(r.fuel)}</td>
      <td>${money(r.travel)}</td>
      <td>${money(r.avgCost)}</td>
      <td>${num(r.hours)} hrs</td>
      <td>${money(r.net)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
  renderNoCollectionReport();
}
$("monthA").onchange=renderReports;
$("monthB").onchange=renderReports;

function availableReportYears(){
  const years=new Set(state.collections.map(j=>new Date((j.collectionDate||j.createdAt)+"T12:00:00").getFullYear()));
  years.add(new Date().getFullYear());
  return [...years].filter(Number.isFinite).sort((a,b)=>b-a);
}

function renderNoCollectionReport(){
  const select=$("noCollectionYear");
  if(!select)return;

  const years=availableReportYears();
  const previous=select.value;
  select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");
  if(years.includes(Number(previous)))select.value=previous;

  const year=Number(select.value||new Date().getFullYear());
  const jobs=state.collections
    .filter(j=>j.status==="No Collection")
    .filter(j=>new Date((j.collectionDate||j.createdAt)+"T12:00:00").getFullYear()===year)
    .sort((a,b)=>new Date(b.collectionDate||b.createdAt)-new Date(a.collectionDate||a.createdAt));

  const totalCost=jobs.reduce((s,j)=>s+totalExpenses(j),0);
  const totalMiles=jobs.reduce((s,j)=>s+Number(j.distanceTravelled||0),0);
  const totalHours=jobs.reduce((s,j)=>s+hoursWorked(j),0);
  const averageCost=jobs.length?totalCost/jobs.length:0;

  $("noCollectionMetrics").innerHTML=[
    metric("No Collection Trips",jobs.length,`${year} total`,"warn"),
    metric("Cost of No Collections",money(totalCost),`${money(averageCost)} average per trip`,"warn"),
    metric("Miles Travelled",`${num(totalMiles,0)} mi`,`${jobs.length?num(totalMiles/jobs.length,0):0} average per trip`,"blue"),
    metric("Hours Incurred",`${num(totalHours)} hrs`,`${jobs.length?num(totalHours/jobs.length):0} average per trip`,"blue")
  ].join("");

  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const rows=monthNames.map((name,monthIndex)=>{
    const monthJobs=jobs.filter(j=>new Date((j.collectionDate||j.createdAt)+"T12:00:00").getMonth()===monthIndex);
    const cost=monthJobs.reduce((s,j)=>s+totalExpenses(j),0);
    const miles=monthJobs.reduce((s,j)=>s+Number(j.distanceTravelled||0),0);
    const hours=monthJobs.reduce((s,j)=>s+hoursWorked(j),0);
    return {name,count:monthJobs.length,cost,miles,hours};
  });

  $("noCollectionMonthlyTable").innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Month</th><th>No Collection Trips</th><th>Cost</th><th>Miles</th><th>Hours</th><th>Average Cost/Trip</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.count}</td>
      <td>${money(r.cost)}</td>
      <td>${num(r.miles,0)} mi</td>
      <td>${num(r.hours)} hrs</td>
      <td>${money(r.count?r.cost/r.count:0)}</td>
    </tr>`).join("")}</tbody>
    <tfoot><tr><th>Year Total</th><th>${jobs.length}</th><th>${money(totalCost)}</th><th>${num(totalMiles,0)} mi</th><th>${num(totalHours)} hrs</th><th>${money(averageCost)}</th></tr></tfoot>
  </table></div>`;

  $("noCollectionDetailTable").innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Registration</th><th>Collector</th><th>Reason</th><th>Train</th><th>Taxi</th><th>Bus</th><th>Fuel</th><th>Total Cost</th><th>Miles</th><th>Hours</th></tr></thead>
    <tbody>${jobs.map(j=>`<tr>
      <td>${dateOnly(j.collectionDate)}</td>
      <td><strong>${j.registration||"—"}</strong></td>
      <td>${collectorName(j.collector)}</td>
      <td>${j.noCollectionReason||"No reason recorded"}</td>
      <td>${money(j.expenses?.train||0)}</td>
      <td>${money(j.expenses?.taxi||0)}</td>
      <td>${money(j.expenses?.bus||0)}</td>
      <td>${money(j.expenses?.fuel||0)}</td>
      <td><strong>${money(totalExpenses(j))}</strong></td>
      <td>${num(j.distanceTravelled||0,0)} mi</td>
      <td>${num(hoursWorked(j))} hrs</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

if($("noCollectionYear"))$("noCollectionYear").onchange=renderNoCollectionReport;

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
