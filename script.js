const $=id=>document.getElementById(id);
const storeKey="deliveryAI_dai001";
const defaultState={
  collectors:[{id:"c1",name:"Darren",phone:"",email:""},{id:"c2",name:"James",phone:"",email:""}],
  collections:[],
  savedAppraisals:[]
};
let state=load();

function load(){
  try{
    const loaded=JSON.parse(localStorage.getItem(storeKey))||structuredClone(defaultState);
    loaded.collectors=loaded.collectors||structuredClone(defaultState.collectors);
    loaded.collections=loaded.collections||[];
    loaded.savedAppraisals=loaded.savedAppraisals||[];

    loaded.collections.forEach(j=>{
      j.expenses=j.expenses||{train:0,taxi:0,bus:0,fuel:0,parking:0,tolls:0,other:0};
      if(j.expensesSaved && !j.expenseHistory){
        j.expenseHistory={
          savedAt:j.expensesSavedAt||new Date().toISOString(),
          agreedPrice:Number(j.agreedPrice||0),
          finalPrice:Number(j.finalPrice||0),
          moneySaved:Math.max(0,Number(j.agreedPrice||0)-Number(j.finalPrice||0)),
          expenses:structuredClone(j.expenses),
          total:Object.values(j.expenses).reduce((s,v)=>s+Number(v||0),0)
        };
      }
    });

    // One-time migration of appraisal records saved by older Delivery AI versions.
    loaded.collections.forEach(j=>{
      if(j.appraisalComplete&&j.appraisal&&!loaded.savedAppraisals.some(a=>a.legacyCollectionId===j.id)){
        loaded.savedAppraisals.push({
          id:uid("appraisal"),
          legacyCollectionId:j.id,
          sourceCollectionId:j.id,
          savedAt:j.appraisalSavedAt||j.appraisal.savedAt||new Date().toISOString(),
          registration:j.registration,
          make:j.make,
          model:j.model,
          vehicleMileage:j.vehicleMileage,
          collector:j.collector,
          collectionDate:j.collectionDate,
          collectionAddress:j.collectionAddress,
          destination:j.destination,
          contactName:j.contactName||"",
          contactPhone:j.contactPhone||"",
          contactEmail:j.contactEmail||"",
          preferredContact:j.preferredContact||"",
          salesperson:j.salesperson||"",
          collectionInstructions:j.collectionInstructions||"",
          hasSettlement:j.hasSettlement||"",
          agreedPrice:j.agreedPrice,
          finalPrice:j.finalPrice,
          vehicleJourney:structuredClone(j.vehicleJourney||null),
          appraisal:structuredClone(j.appraisal),
          testDrive:structuredClone(j.testDrive||null),
          timeline:structuredClone(j.timeline||[])
        });
      }
    });
    return loaded;
  }catch(e){return structuredClone(defaultState)}
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
function formatDuration(minutes){const mins=Math.max(0,Number(minutes||0));const h=Math.floor(mins/60),m=Math.round(mins%60);return h?`${h} hr ${m} min`:`${m} min`}
function elapsedMinutes(start){return start?Math.max(0,(Date.now()-new Date(start))/60000):0}

function getReviewSnapshot(j){
  if(!j)return null;
  if(j.reviewAppraisalId){
    return state.savedAppraisals.find(a=>a.id===j.reviewAppraisalId)||j.reviewAppraisalSnapshot||null;
  }
  return j.reviewAppraisalSnapshot||null;
}

function getReviewAppraisal(j){
  return getReviewSnapshot(j)?.appraisal||{};
}

function syncReviewSnapshot(j){
  const saved=getReviewSnapshot(j);
  if(!saved)return;
  j.reviewAppraisalSnapshot=structuredClone(saved);
}

function captureLiveAppraisal(j){
  const checks={},tyres={},testChecks={};
  document.querySelectorAll("[data-check]").forEach(x=>checks[x.dataset.check]=x.value);
  document.querySelectorAll("[data-tyre]").forEach(x=>tyres[x.dataset.tyre]=Number(x.value||0));
  document.querySelectorAll("[data-test-check]").forEach(x=>testChecks[x.dataset.testCheck]=x.value);

  const testDrive={
    ...(j.testDrive||{}),
    startMileage:Number($("testDriveStartMileage")?.value||j.testDrive?.startMileage||0),
    endMileage:Number($("testDriveEndMileage")?.value||j.testDrive?.endMileage||0),
    notes:$("testDriveNotes")?.value||j.testDrive?.notes||"",
    checks:testChecks
  };
  testDrive.distance=Math.max(0,Number(testDrive.endMileage||0)-Number(testDrive.startMileage||0));

  const appraisal={
    checks,
    tyres,
    damageParts:[...document.querySelectorAll("[data-damage].selected")].map(x=>x.dataset.damage),
    faultCodes:$("faultCodes")?.value||"",
    bodyDescription:$("bodyDescription")?.value||"",
    interiorDescription:$("interiorDescription")?.value||"",
    notes:$("appraisalNotes")?.value||"",
    mileageVerified:$("mileageVerified")?.value||"",
    mileageVerificationNote:$("mileageVerificationNote")?.value||"",
    appraisalMileage:Number($("appraisalMileage")?.value||0),
    savedAt:new Date().toISOString()
  };

  const temp={...j,appraisal,testDrive};
  appraisal.summary=appraisalStats(temp);
  return {appraisal,testDrive};
}

function createPermanentAppraisal(j,{forReview=false}={}){
  const captured=captureLiveAppraisal(j);
  const savedAt=captured.appraisal.savedAt;

  const record={
    id:uid("appraisal"),
    sourceCollectionId:j.id,
    savedAt,
    registration:j.registration,
    make:j.make,
    model:j.model,
    vehicleMileage:j.vehicleMileage,
    collector:j.collector,
    collectionDate:j.collectionDate,
    collectionAddress:j.collectionAddress,
    destination:j.destination,
    contactName:j.contactName||"",
    contactPhone:j.contactPhone||"",
    contactEmail:j.contactEmail||"",
    preferredContact:j.preferredContact||"",
    salesperson:j.salesperson||"",
    collectionInstructions:j.collectionInstructions||"",
    hasSettlement:j.hasSettlement||"",
    agreedPrice:Number(j.agreedPrice||0),
    finalPrice:Number(j.finalPrice||0),
    vehicleJourney:structuredClone(j.vehicleJourney||null),
    appraisal:structuredClone(captured.appraisal),
    testDrive:structuredClone(captured.testDrive),
    timeline:structuredClone(j.timeline||[]),
    permanent:true
  };

  state.savedAppraisals.push(record);
  j.lastSavedAppraisalId=record.id;

  if(forReview){
    j.reviewAppraisalId=record.id;
    j.reviewAppraisalSnapshot=structuredClone(record);
  }

  return record;
}

function resetLiveAppraisal(j){
  j.appraisal={checks:{},tyres:{},damageParts:[],faultCodes:"",bodyDescription:"",interiorDescription:"",notes:""};
  j.testDrive=null;
  j.appraisalStarted=false;
  j.appraisalComplete=false;
  j.appraisalSavedAt=null;
}
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
  const miles=month.reduce((s,j)=>s+Number(j.vehicleJourney?.distance||0),0);
  $("heroNetSaving").textContent=money(red-exp);
  const acceptedToday=state.collections.filter(j=>j.sellerAcceptedAt&&j.sellerAcceptedAt.slice(0,10)===today).length;
  const declinedToday=state.collections.filter(j=>j.sellerDeclinedAt&&j.sellerDeclinedAt.slice(0,10)===today).length;
  const awaitingReview=state.collections.filter(j=>j.status==="Awaiting Sales Manager Review"||j.status==="Revised Offer Requested").length;

  $("commandMetrics").innerHTML=[
    metric("Awaiting Manager Review",awaitingReview,"Collector waiting for decision","warn"),
    metric("Seller Accepted Today",acceptedToday,"Offers accepted today","good"),
    metric("Seller Declined Today",declinedToday,"Offers declined today","warn"),
    metric("No Collection Trips",month.filter(j=>j.status==="No Collection").length,`${money(month.filter(j=>j.status==="No Collection").reduce((s,j)=>s+totalExpenses(j),0))} cost this month`,"warn"),
    metric("Collections this month",completed.length,"Delivered vehicles","good"),
    metric("Travel costs this month",money(exp),`${month.filter(j=>j.expensesSaved).length} expense records saved`,"warn"),
    metric("Reductions this month",money(red),`${completed.length?money(red/completed.length):money(0)} average`,"good"),
    metric("Collector hours",`${num(hrs)} hrs`,"Clocked working time","blue"),
    metric("Vehicle miles this month",`${num(miles,0)} mi`,"Start-to-end mileage from collected vehicles","blue"),
    metric("Net saving",money(red-exp),"Reduction less travel costs","good")
  ].join("");
  $("liveCollections").innerHTML=todayJobs.length?todayJobs.map(jobRow).join(""):`<p>No collections scheduled today.</p>`;
  const stats=state.collectors.map(c=>{
    const jobs=month.filter(j=>j.collector===c.id);
    return {name:c.name,count:jobs.length,hours:jobs.reduce((s,j)=>s+hoursWorked(j),0),reduction:jobs.reduce((s,j)=>s+reduction(j),0)}
  }).sort((a,b)=>b.reduction-a.reduction);
  $("collectorSnapshot").innerHTML=stats.length?`<div class="table-wrap"><table><thead><tr><th>Collector</th><th>Cars</th><th>Hours</th><th>Reduction</th></tr></thead><tbody>${stats.map(s=>`<tr><td><strong>${s.name}</strong></td><td>${s.count}</td><td>${num(s.hours)}</td><td>${money(s.reduction)}</td></tr>`).join("")}</tbody></table></div>`:"No collectors.";
  renderPriorityAlerts();
  renderLiveCollectorBoard();
}
function renderPriorityAlerts(){
  const alertStatuses=[
    "Awaiting Sales Manager Review",
    "Seller Accepted",
    "Seller Declined",
    "Revised Offer Requested"
  ];

  const waiting=state.collections
    .filter(j=>alertStatuses.includes(j.status)&&!j.managerAlertAcknowledged)
    .sort((a,b)=>new Date(a.alertCreatedAt||a.reviewSubmittedAt||a.sellerResponseAt||a.createdAt)-new Date(b.alertCreatedAt||b.reviewSubmittedAt||b.sellerResponseAt||b.createdAt));

  $("priorityCount").textContent=`${waiting.length} waiting`;
  $("priorityAlerts").innerHTML=waiting.length?waiting.map(j=>{
    const since=j.alertCreatedAt||j.reviewSubmittedAt||j.sellerResponseAt||j.createdAt;
    const mins=Math.round(elapsedMinutes(since));
    let level="amber",title=j.status,action="Open Appraisal";

    if(j.status==="Seller Accepted"){level="green";title="🟢 SELLER ACCEPTED OFFER";action="View Result"}
    else if(j.status==="Seller Declined"){level="red";title="🔴 SELLER DECLINED OFFER";action="Review Offer"}
    else if(j.status==="Awaiting Sales Manager Review"){level=mins>20?"red":mins>10?"amber":"green";title="🚨 COLLECTOR WAITING FOR REVIEW"}
    else if(j.status==="Revised Offer Requested"){level="amber";title="🔄 REVISED OFFER REQUESTED"}

    return `<div class="priority-alert ${level}">
      <div>
        <span class="badge ${level}">${title}</span>
        <h4>${j.registration} · ${j.make||""} ${j.model||""}</h4>
        <p>${collectorName(j.collector)} · Waiting ${mins} min · Agreed price ${money(j.agreedPrice||0)}</p>
        ${j.status==="Seller Accepted"?`<p><strong>Accepted price: ${money(j.finalPrice||getReviewAppraisal(j).managerOfferPrice||j.agreedPrice||0)}</strong></p>`:""}
        ${j.status==="Seller Declined"?`<p><strong>Offer declined: ${money(getReviewAppraisal(j).managerOfferPrice||0)}</strong></p>`:""}
      </div>
      <div class="alert-actions">
        <button class="primary-btn" onclick="openManagerReview('${j.id}')">${action}</button>
        ${j.status==="Seller Accepted"?`<button class="secondary-btn" onclick="acknowledgeManagerAlert('${j.id}')">Acknowledge</button>`:""}
      </div>
    </div>`;
  }).join(""):`<div class="empty-state">No urgent actions waiting.</div>`;
}

window.acknowledgeManagerAlert=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;
  j.managerAlertAcknowledged=true;
  j.timeline=j.timeline||[];
  j.timeline.push({time:new Date().toISOString(),text:"Sales Manager Acknowledged Alert"});
  save();renderAll();toast("Alert acknowledged");
};

function renderLiveCollectorBoard(){
  const active=state.collections.filter(j=>j.clockIn&&!j.clockOut);
  $("liveCollectorBoard").innerHTML=active.length?`<div class="table-wrap"><table><thead><tr><th>Collector</th><th>Vehicle</th><th>Stage</th><th>Since Clock In</th></tr></thead><tbody>${active.map(j=>`<tr><td><strong>${collectorName(j.collector)}</strong></td><td>${j.registration}</td><td><span class="badge blue">${j.status}</span></td><td>${formatDuration(elapsedMinutes(j.clockIn))}</td></tr>`).join("")}</tbody></table></div>`:"<p>No collectors currently clocked in.</p>";
}
window.openManagerReview=id=>{showPage("appraisals");$("appraisalJobSelect").value=id;renderAppraisals();setTimeout(()=>document.querySelector(".manager-offer-section")?.scrollIntoView({behavior:"smooth"}),100)};
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
  const review=getReviewAppraisal(j);
  if(!j){$("driverJobCard").innerHTML=`<div class="panel"><p>Select a collection to begin.</p></div>`;return}

  const phone=(j.contactPhone||"").replace(/\s+/g,"");
  const mapsQuery=encodeURIComponent(j.collectionAddress||"");
  const smsHref=phone?`sms:${phone}`:"#";
  const telHref=phone?`tel:${phone}`:"#";
  const mailHref=j.contactEmail?`mailto:${j.contactEmail}`:"#";
  const mapsHref=j.collectionAddress?`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`:"#";

  $("driverJobCard").innerHTML=`<div class="driver-card">
    <div class="driver-card-top">
      <p class="eyebrow">ACTIVE COLLECTION</p>
      <h3>${j.registration} · ${j.make||""} ${j.model||""}</h3>
      <p>${dateOnly(j.collectionDate)} ${j.collectionTime||""} · ${collectorName(j.collector)}</p>
    </div>

    <div class="driver-contact-grid">
      <div class="driver-info-card">
        <p class="eyebrow">SELLER / CUSTOMER</p>
        <h3>${j.contactName||"Name not entered"}</h3>
        <p><strong>Telephone:</strong> ${j.contactPhone||"—"}</p>
        <p><strong>Email:</strong> ${j.contactEmail||"—"}</p>
        <p><strong>Preferred contact:</strong> ${j.preferredContact||"—"}</p>
        <div class="contact-actions">
          <a class="primary-btn ${phone?"":"disabled-link"}" href="${telHref}">📞 Call</a>
          <a class="secondary-btn ${phone?"":"disabled-link"}" href="${smsHref}">💬 Text</a>
          <a class="secondary-btn ${j.contactEmail?"":"disabled-link"}" href="${mailHref}">✉️ Email</a>
        </div>
      </div>

      <div class="driver-info-card">
        <p class="eyebrow">COLLECTION ADDRESS</p>
        <h3>${j.collectionAddress||"Address not entered"}</h3>
        <p><strong>Destination:</strong> ${j.destination||"—"}</p>
        <p><strong>Instructions:</strong> ${j.collectionInstructions||j.journeyNotes||"None entered"}</p>
        <a class="primary-btn ${j.collectionAddress?"":"disabled-link"}" target="_blank" rel="noopener" href="${mapsHref}">🧭 Navigate</a>
      </div>

      <div class="driver-info-card">
        <p class="eyebrow">PURCHASE DETAILS</p>
        <h3>${money(j.agreedPrice||0)}</h3>
        <p><strong>Settlement:</strong> ${j.hasSettlement||"Not recorded"}</p>
        <p><strong>Salesperson / buyer:</strong> ${j.salesperson||"—"}</p>
        <p><strong>Status:</strong> ${j.status}</p>
      </div>
    </div>

    <div class="driver-details">
      <div class="detail-card"><span>Status</span><strong>${j.status}</strong></div>
      <div class="detail-card"><span>Clocked hours</span><strong>${num(hoursWorked(j))} hrs</strong></div>
      <div class="detail-card"><span>Reduction</span><strong>${money(reduction(j))}</strong></div>
      <div class="detail-card"><span>Travel cost</span><strong>${money(totalExpenses(j))}</strong></div>
    </div>

    <div class="collector-offer-panel">
      <div>
        <p class="eyebrow">SALES MANAGER OFFER</p>
        <h3>${j.status==="Awaiting Sales Manager Review"?"Awaiting Sales Manager Review":(review.managerOfferStatus||"No decision sent yet")}</h3>
        <p>${j.status==="Awaiting Sales Manager Review"?"The Sales Manager has been alerted and is reviewing this appraisal.":(review.managerOfferNote||"No manager instructions have been added yet.")}</p>
      </div>
      <div class="offer-figures">
        <div><span>Approved offer</span><strong>${review.managerOfferPrice!=null?money(review.managerOfferPrice):"Awaiting review"}</strong></div>
        <div><span>Recommended reduction</span><strong>${review.managerRecommendedReduction!=null?money(review.managerRecommendedReduction):"Awaiting review"}</strong></div>
      </div>
    </div>

    ${j.status==="Offer Sent to Collector"||j.status==="Seller Declined"?`<div class="seller-response-panel">
      <button class="primary-btn" onclick="sellerAccepted('${j.id}')">Seller Accepted</button>
      <button class="secondary-btn" onclick="sellerDeclined('${j.id}')">Seller Declined</button>
      <button class="secondary-btn" onclick="requestRevisedOffer('${j.id}')">Request Revised Offer</button>
    </div>`:""}

    <div class="driver-actions">
      <button class="action-start" onclick="clockIn('${j.id}')">Clock In</button>
      <button class="action-step" onclick="setStatus('${j.id}','At Collection')">Arrived</button>
      <button class="action-step" onclick="setStatus('${j.id}','Appraising')">Start Appraisal</button>
      <button class="action-step" onclick="recordVehicleCollected('${j.id}')">Vehicle Collected</button>
      <button class="action-step" onclick="recordVehicleDelivered('${j.id}')">Delivered</button>
      <button class="action-step" onclick="markNoCollection('${j.id}')">No Collection</button>
      <button class="action-stop" onclick="clockOut('${j.id}')">Clock Out</button>
    </div>

    <div class="panel vehicle-mileage-panel" style="margin:0 18px 18px;box-shadow:none">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">VEHICLE JOURNEY</p>
          <h3>Collected Vehicle Mileage</h3>
        </div>
        <span class="badge blue">${Number(j.vehicleJourney?.distance||0).toLocaleString("en-GB")} miles</span>
      </div>
      <div class="form-grid three">
        <label>Start mileage
          <input id="vehicleStartMileage" type="number" min="0" value="${j.vehicleJourney?.startMileage??""}" placeholder="Enter when vehicle is collected">
        </label>
        <label>End mileage
          <input id="vehicleEndMileage" type="number" min="0" value="${j.vehicleJourney?.endMileage??""}" placeholder="Enter when vehicle is delivered">
        </label>
        <label>Distance travelled
          <input readonly value="${Number(j.vehicleJourney?.distance||0).toLocaleString("en-GB")} miles">
        </label>
      </div>
      <div class="mileage-timestamps">
        <span>Collected: <strong>${dt(j.vehicleJourney?.collectedAt)}</strong></span>
        <span>Delivered: <strong>${dt(j.vehicleJourney?.deliveredAt)}</strong></span>
      </div>
      <button class="primary-btn" onclick="saveVehicleJourney('${j.id}')">Save Vehicle Journey</button>
    </div>
  </div>`;
}
$("driverJobSelect").onchange=renderDriver;
window.clockIn=id=>{const j=state.collections.find(x=>x.id===id);if(!j.clockIn)j.clockIn=new Date().toISOString();j.status="Travelling";j.timeline=j.timeline||[];j.timeline.push({time:j.clockIn,text:"Clocked In"});j.timeline.push({time:new Date().toISOString(),text:"Travelling"});save();renderAll();toast("Collector clocked in — office alerted")};
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

function updateArchivedVehicleJourney(j){
  (state.savedAppraisals||[]).filter(a=>a.sourceCollectionId===j.id).forEach(a=>{
    a.vehicleJourney=structuredClone(j.vehicleJourney||null);
    a.timeline=structuredClone(j.timeline||[]);
  });
  if(j.reviewAppraisalSnapshot){
    j.reviewAppraisalSnapshot.vehicleJourney=structuredClone(j.vehicleJourney||null);
    j.reviewAppraisalSnapshot.timeline=structuredClone(j.timeline||[]);
  }
}

function persistVehicleJourney(j,start,end,{logStart=false,logEnd=false}={}){
  j.vehicleJourney=j.vehicleJourney||{};
  j.timeline=j.timeline||[];

  const oldStart=Number(j.vehicleJourney.startMileage||0);
  const oldEnd=Number(j.vehicleJourney.endMileage||0);

  if(start>0){
    j.vehicleJourney.startMileage=start;
    if(logStart && (!oldStart || oldStart!==start)){
      j.timeline.push({
        time:new Date().toISOString(),
        text:`Vehicle Journey Start Mileage Saved: ${start.toLocaleString("en-GB")} miles`
      });
    }
  }

  if(end>0){
    if(!j.vehicleJourney.startMileage) throw new Error("START_REQUIRED");
    if(end<Number(j.vehicleJourney.startMileage)) throw new Error("END_LOWER");
    j.vehicleJourney.endMileage=end;
    j.vehicleJourney.distance=end-Number(j.vehicleJourney.startMileage);
    if(logEnd && (!oldEnd || oldEnd!==end)){
      j.timeline.push({
        time:new Date().toISOString(),
        text:`Vehicle Journey End Mileage Saved: ${end.toLocaleString("en-GB")} miles — Distance: ${j.vehicleJourney.distance.toLocaleString("en-GB")} miles`
      });
    }
  }else if(j.vehicleJourney.startMileage && j.vehicleJourney.endMileage){
    j.vehicleJourney.distance=Number(j.vehicleJourney.endMileage)-Number(j.vehicleJourney.startMileage);
  }

  updateArchivedVehicleJourney(j);
}

window.saveVehicleJourney=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  const start=Number($("vehicleStartMileage")?.value||0);
  const end=Number($("vehicleEndMileage")?.value||0);

  if(!start && !end){toast("Enter start or end mileage first");return}

  try{
    persistVehicleJourney(j,start,end,{logStart:start>0,logEnd:end>0});
  }catch(err){
    if(err.message==="START_REQUIRED"){toast("Enter the start mileage before the end mileage");$("vehicleStartMileage")?.focus();return}
    if(err.message==="END_LOWER"){toast("End mileage cannot be lower than start mileage");$("vehicleEndMileage")?.focus();return}
    throw err;
  }

  save();renderAll();toast("Vehicle journey mileage saved");
};

window.recordVehicleCollected=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  const start=Number($("vehicleStartMileage")?.value||j.vehicleJourney?.startMileage||0);
  if(!start){toast("Enter the vehicle start mileage before marking it collected");$("vehicleStartMileage")?.focus();return}

  persistVehicleJourney(j,start,Number($("vehicleEndMileage")?.value||0),{logStart:true,logEnd:false});
  j.vehicleJourney.collectedAt=j.vehicleJourney.collectedAt||new Date().toISOString();
  j.status="Collected";
  j.timeline=j.timeline||[];

  if(!j.timeline.some(t=>t.text.startsWith("Vehicle Collected — Start Mileage:"))){
    j.timeline.push({
      time:j.vehicleJourney.collectedAt,
      text:`Vehicle Collected — Start Mileage: ${start.toLocaleString("en-GB")} miles`
    });
  }

  updateArchivedVehicleJourney(j);
  save();renderAll();toast("Vehicle collected — start mileage saved");
};

window.recordVehicleDelivered=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  const start=Number($("vehicleStartMileage")?.value||j.vehicleJourney?.startMileage||0);
  const end=Number($("vehicleEndMileage")?.value||0);

  if(!start){toast("Record the vehicle start mileage first");$("vehicleStartMileage")?.focus();return}
  if(!end){toast("Enter the vehicle end mileage before marking it delivered");$("vehicleEndMileage")?.focus();return}

  try{
    persistVehicleJourney(j,start,end,{logStart:false,logEnd:true});
  }catch(err){
    if(err.message==="END_LOWER"){toast("End mileage cannot be lower than start mileage");$("vehicleEndMileage")?.focus();return}
    throw err;
  }

  j.vehicleJourney.deliveredAt=new Date().toISOString();
  j.status="Delivered";
  j.timeline=j.timeline||[];
  j.timeline.push({
    time:j.vehicleJourney.deliveredAt,
    text:`Vehicle Delivered — End Mileage: ${end.toLocaleString("en-GB")} miles — Journey Distance: ${j.vehicleJourney.distance.toLocaleString("en-GB")} miles`
  });

  updateArchivedVehicleJourney(j);
  save();renderAll();toast("Vehicle delivered — end mileage and journey distance saved");
};

const checkItems=[
"Air conditioning working","Satellite navigation working","Bluetooth working","Lights working","Vents undamaged","Two keys present",
"Engine oil level good","Coolant level good","Front electric windows working","Rear electric windows working",
"Seat belts pulled out and checked","Electric mirrors working","Reverse camera working","All console buttons working",
"Wipers and washers working","Windscreen condition good","Engine starts correctly","Clutch and gearbox working","Handbrake working"
];
const testDriveItems=["Engine performance","Gearbox operation","Clutch operation","Steering","Suspension","Braking performance","Vehicle tracks straight","Unusual noises","Warning lights during drive","Parking sensors","Cruise control","Reverse camera","General driving condition"];
const damageParts=["Front bumper","Bonnet","Roof","Rear bumper","Boot","NSF wing","OSF wing","NSF door","NSR door","OSF door","OSR door","Wheels","Windscreen"];
function startTestDrive(id){const j=state.collections.find(x=>x.id===id);if(!j)return;j.testDrive=j.testDrive||{checks:{}};if(!j.testDrive.start)j.testDrive.start=new Date().toISOString();j.testDrive.startMileage=Number($("testDriveStartMileage")?.value||0);j.status="Test Drive";j.timeline=j.timeline||[];j.timeline.push({time:j.testDrive.start,text:"Test Drive Started"});save();renderAll();toast("Test drive started")}
function finishTestDrive(id){const j=state.collections.find(x=>x.id===id);if(!j?.testDrive?.start){toast("Start the test drive first");return}j.testDrive.end=new Date().toISOString();j.testDrive.endMileage=Number($("testDriveEndMileage")?.value||0);j.testDrive.distance=Math.max(0,j.testDrive.endMileage-Number(j.testDrive.startMileage||0));j.testDrive.durationMinutes=Math.max(0,(new Date(j.testDrive.end)-new Date(j.testDrive.start))/60000);j.testDrive.notes=$("testDriveNotes")?.value||"";j.testDrive.checks={};document.querySelectorAll("[data-test-check]").forEach(x=>j.testDrive.checks[x.dataset.testCheck]=x.value);j.status="Appraising";j.timeline.push({time:j.testDrive.end,text:"Test Drive Finished"});save();renderAll();toast("Test drive completed")}
function countFaultCodes(text){if(!text)return 0;const m=text.toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/g);return m?new Set(m).size:0}
function appraisalStats(j){const a=j.appraisal||{};const all={...(a.checks||{}),...(j.testDrive?.checks||{})};const v=Object.values(all);const good=v.filter(x=>x==="Good").length,faults=v.filter(x=>x==="Fault").length,notChecked=v.filter(x=>x==="Not checked").length,notFitted=v.filter(x=>x==="Not fitted").length,codes=countFaultCodes(a.faultCodes||"");const damage=(a.damageParts||[]).length;const tyrePenalty=Object.values(a.tyres||{}).filter(x=>Number(x)>0&&Number(x)<3).length*5;const score=Math.max(0,Math.round(100-faults*8-codes*5-notChecked*2-damage*2-tyrePenalty));const label=score>=95?"Excellent":score>=80?"Good":score>=65?"Fair":score>=45?"Poor":"Very Poor";const stars=score>=95?5:score>=80?4:score>=65?3:score>=45?2:1;return{good,faults,notChecked,notFitted,codes,score,label,stars}}
function applyCheckColour(sel){const row=sel.closest(".check-row");if(!row)return;row.classList.remove("status-good","status-fault","status-amber","status-white");if(sel.value==="Good")row.classList.add("status-good");else if(sel.value==="Fault")row.classList.add("status-fault");else if(sel.value==="Not checked")row.classList.add("status-amber");else if(sel.value==="Not fitted")row.classList.add("status-white")}
function updateAppraisalSummary(){const job=state.collections.find(x=>x.id===$("appraisalJobSelect")?.value);if(!job)return;const checks={};document.querySelectorAll("[data-check]").forEach(x=>checks[x.dataset.check]=x.value);const testChecks={};document.querySelectorAll("[data-test-check]").forEach(x=>testChecks[x.dataset.testCheck]=x.value);const temp={...job,appraisal:{...(job.appraisal||{}),checks,faultCodes:$("faultCodes")?.value||job.appraisal?.faultCodes||""},testDrive:{...(job.testDrive||{}),checks:testChecks}};const s=appraisalStats(temp);$("appraisalSummary").innerHTML=`<div class="summary-chip good">🟢 <strong>${s.good}</strong><span>Good</span></div><div class="summary-chip fault">🔴 <strong>${s.faults}</strong><span>Faults</span></div><div class="summary-chip amber">🟠 <strong>${s.notChecked}</strong><span>Not Checked</span></div><div class="summary-chip white">⚪ <strong>${s.notFitted}</strong><span>Not Fitted</span></div><div class="summary-chip code">💻 <strong>${s.codes}</strong><span>Fault Codes</span></div><div class="summary-score"><strong>${"★".repeat(s.stars)}${"☆".repeat(5-s.stars)} ${s.score}%</strong><span>${s.label}</span></div>`}
function renderAppraisals(){
  const sel=$("appraisalJobSelect"),current=sel.value;sel.innerHTML=jobOptions();if(state.collections.some(j=>j.id===current))sel.value=current;
  const j=state.collections.find(x=>x.id===sel.value);
  if(!j){$("appraisalWorkspace").innerHTML="<p>Select a collection to complete an appraisal.</p>";return}
  const reviewMode=["Awaiting Sales Manager Review","Revised Offer Requested","Seller Declined","Seller Accepted","Offer Sent to Collector","Collection Approved"].includes(j.status)&&!!getReviewSnapshot(j);
  const reviewSnapshot=getReviewSnapshot(j);
  const a=reviewMode?(reviewSnapshot?.appraisal||{}):(j.appraisal||{checks:{},tyres:{},damageParts:[]});
  const td=reviewMode?(reviewSnapshot?.testDrive||null):j.testDrive;
  $("appraisalWorkspace").innerHTML=`
  <div id="printAppraisal">
    <div class="appraisal-summary" id="appraisalSummary"></div>
    <div class="form-section test-drive-section"><div class="panel-heading"><div><p class="eyebrow">ROAD TEST</p><h4>Test Drive</h4></div><span class="badge blue">${td?.end?"Completed":td?.start?"In progress":"Not started"}</span></div><div class="form-grid three"><label>Start mileage<input id="testDriveStartMileage" type="number" value="${td?.startMileage||""}"></label><label>Finish mileage<input id="testDriveEndMileage" type="number" value="${td?.endMileage||""}"></label><label>Distance<input id="testDriveDistance" readonly value="${td?.distance||0} miles"></label></div><div class="form-actions"><button type="button" class="secondary-btn" onclick="startTestDrive('${j.id}')">Start Test Drive</button><button type="button" class="primary-btn" onclick="finishTestDrive('${j.id}')">Finish Test Drive</button></div><div class="test-drive-meta"><span>Started: <strong>${dt(td?.start)}</strong></span><span>Finished: <strong>${dt(td?.end)}</strong></span><span>Duration: <strong>${formatDuration(td?.durationMinutes||0)}</strong></span></div><div class="check-grid">${testDriveItems.map(item=>`<div class="check-row"><span>${item}</span><select data-test-check="${item}"><option></option><option ${td?.checks?.[item]==="Good"?"selected":""}>Good</option><option ${td?.checks?.[item]==="Fault"?"selected":""}>Fault</option><option ${td?.checks?.[item]==="Not fitted"?"selected":""}>Not fitted</option><option ${td?.checks?.[item]==="Not checked"?"selected":""}>Not checked</option></select></div>`).join("")}</div><label>Test drive notes<textarea id="testDriveNotes">${td?.notes||""}</textarea></label></div>
    <div class="form-section"><h4>${j.registration} · ${j.make||""} ${j.model||""}</h4>
      <div class="form-grid three">
        <label>Mileage verified against dashboard?
          <select id="mileageVerified">
            <option value="">Select</option>
            <option value="Yes" ${a.mileageVerified==="Yes"?"selected":""}>Yes</option>
            <option value="No" ${a.mileageVerified==="No"?"selected":""}>No</option>
          </select>
        </label>
        <label>Verification reason / note
          <input id="mileageVerificationNote" value="${a.mileageVerificationNote||""}" placeholder="Required if mileage cannot be verified">
        </label>
        <label>Dashboard mileage at appraisal
          <input id="appraisalMileage" type="number" min="0" value="${a.appraisalMileage||j.vehicleMileage||""}">
        </label>
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

    ${["Awaiting Sales Manager Review","Revised Offer Requested","Seller Declined","Seller Accepted","Offer Sent to Collector","Collection Approved"].includes(j.status)?`
    <div class="form-section manager-offer-section">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">SALES MANAGER REVIEW</p>
          <h4>Commercial Decision</h4>
        </div>
        <span class="badge ${j.status==="Awaiting Sales Manager Review"?"amber":"blue"}">${j.status}</span>
      </div>
      <div class="form-grid three">
        <label>Original agreed purchase price (£)
          <input id="managerAgreedPrice" type="number" step=".01" value="${j.agreedPrice||0}" readonly>
        </label>
        <label>Recommended reduction (£)
          <input id="managerRecommendedReduction" type="number" min="0" step=".01" value="${a.managerRecommendedReduction||0}" oninput="updateManagerOffer('${j.id}')">
        </label>
        <label>Approved offer price (£)
          <input id="managerOfferPrice" type="text" value="${money(a.managerOfferPrice??j.agreedPrice??0)}" readonly>
        </label>
      </div>
      <div class="form-grid two">
        <label>Sales manager note
          <textarea id="managerOfferNote" placeholder="Reason for revised offer or instructions to collector">${a.managerOfferNote||""}</textarea>
        </label>
        <label>Decision
          <select id="managerOfferStatus">
            <option value="">Select</option>
            <option value="Accept Agreed Price" ${a.managerOfferStatus==="Accept Agreed Price"?"selected":""}>Accept Agreed Price</option>
            <option value="Reduce Offer" ${a.managerOfferStatus==="Reduce Offer"?"selected":""}>Reduce Offer</option>
            <option value="Reject Vehicle" ${a.managerOfferStatus==="Reject Vehicle"?"selected":""}>Reject Vehicle</option>
          </select>
        </label>
      </div>
      <div class="manager-decision-actions">
        <button type="button" class="secondary-btn" onclick="managerAcceptAgreed('${j.id}')">Accept Agreed Price</button>
        <button type="button" class="secondary-btn" onclick="setManagerReduction('${j.id}',100)">+£100</button>
        <button type="button" class="secondary-btn" onclick="setManagerReduction('${j.id}',250)">+£250</button>
        <button type="button" class="secondary-btn" onclick="setManagerReduction('${j.id}',500)">+£500</button>
        <button type="button" class="secondary-btn" onclick="setManagerReduction('${j.id}',750)">+£750</button>
        <button type="button" class="secondary-btn" onclick="setManagerReduction('${j.id}',1000)">+£1,000</button>
        <button type="button" class="secondary-btn danger-text" onclick="managerRejectVehicle('${j.id}')">Reject Vehicle</button>
      </div>
      <button type="button" class="primary-btn" onclick="saveManagerOffer('${j.id}')">Send Decision to Collector</button>
    </div>`:`
    <div class="form-section manager-review-locked">
      <p class="eyebrow">SALES MANAGER REVIEW</p>
      <h4>Not yet submitted for review</h4>
      <p>Complete the appraisal and press <strong>Submit for Sales Manager Review</strong>. No reduction or approved offer will be created until then.</p>
    </div>`}
  </div>
  <div class="form-actions">
    ${reviewMode?`
      <button class="secondary-btn" onclick="printReviewAppraisal('${j.id}')">Print Saved Appraisal</button>
    `:`
      <button class="secondary-btn danger-text" onclick="deleteAppraisal('${j.id}')">Delete Unsaved Draft</button>
      <button class="secondary-btn" onclick="printAppraisal()">Print Draft</button>
      <button class="secondary-btn" onclick="submitForReview('${j.id}')">Save & Submit for Sales Manager Review</button>
      <button class="primary-btn" onclick="saveAppraisal('${j.id}')">Save Appraisal Permanently</button>
    `}
  </div>`;
  document.querySelectorAll("[data-damage]").forEach(b=>b.onclick=()=>{b.classList.toggle("selected");updateAppraisalSummary()});document.querySelectorAll("[data-check],[data-test-check]").forEach(sel=>{applyCheckColour(sel);sel.addEventListener("change",()=>{applyCheckColour(sel);updateAppraisalSummary()})});if($("faultCodes"))$("faultCodes").addEventListener("input",updateAppraisalSummary);updateAppraisalSummary();
}
$("appraisalJobSelect").onchange=renderAppraisals;

window.updateManagerOffer=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;
  const reduction=Number($("managerRecommendedReduction")?.value||0);
  const offer=Math.max(0,Number(j.agreedPrice||0)-reduction);
  if($("managerOfferPrice"))$("managerOfferPrice").value=money(offer);
};

window.setManagerReduction=(id,amount)=>{
  if($("managerRecommendedReduction"))$("managerRecommendedReduction").value=amount;
  if($("managerOfferStatus"))$("managerOfferStatus").value=amount>0?"Reduce Offer":"Accept Agreed Price";
  updateManagerOffer(id);
};

window.managerAcceptAgreed=id=>{
  if($("managerRecommendedReduction"))$("managerRecommendedReduction").value=0;
  if($("managerOfferStatus"))$("managerOfferStatus").value="Accept Agreed Price";
  updateManagerOffer(id);
};

window.managerRejectVehicle=id=>{
  if($("managerOfferStatus"))$("managerOfferStatus").value="Reject Vehicle";
  if($("managerRecommendedReduction"))$("managerRecommendedReduction").value=0;
  updateManagerOffer(id);
};

window.saveManagerOffer=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  if(!["Awaiting Sales Manager Review","Revised Offer Requested","Seller Declined"].includes(j.status)){
    toast("Appraisal must be submitted for manager review first");
    return;
  }

  const decision=$("managerOfferStatus")?.value||"";
  if(!decision){toast("Choose a Sales Manager decision first");return}

  const reduction=decision==="Accept Agreed Price"?0:Number($("managerRecommendedReduction")?.value||0);
  const agreed=Number(j.agreedPrice||0);
  const offer=decision==="Reject Vehicle"?0:Math.max(0,agreed-reduction);

  const saved=getReviewSnapshot(j);
  if(!saved){toast("No permanently saved appraisal is available for review");return}
  saved.appraisal=saved.appraisal||{};
  saved.appraisal.managerRecommendedReduction=reduction;
  saved.appraisal.managerOfferPrice=offer;
  saved.appraisal.managerOfferNote=$("managerOfferNote")?.value||"";
  saved.appraisal.managerOfferStatus=decision;
  saved.appraisal.managerOfferUpdatedAt=new Date().toISOString();
  j.reviewAppraisalSnapshot=structuredClone(saved);

  j.timeline=j.timeline||[];

  if(decision==="Reject Vehicle"){
    j.status="No Collection";
    j.noCollectionReason=saved.appraisal.managerOfferNote||"Rejected by Sales Manager";
    j.noCollectionAt=saved.appraisal.managerOfferUpdatedAt;
    j.timeline.push({time:j.noCollectionAt,text:"Sales Manager Rejected Vehicle — No Collection"});
    j.managerAlertAcknowledged=false;
    j.alertCreatedAt=j.noCollectionAt;
    save();renderAll();toast("Vehicle rejected — marked No Collection");
    return;
  }

  j.status="Offer Sent to Collector";
  j.offerSentAt=saved.appraisal.managerOfferUpdatedAt;
  j.managerAlertAcknowledged=true;
  j.timeline.push({time:j.offerSentAt,text:`Sales Manager Decision Sent: ${money(offer)} (${money(reduction)} reduction)`});
  save();renderAll();toast("Decision sent to collector");
};

window.saveAppraisal=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  if(getReviewSnapshot(j)){
    toast("This appraisal has already been saved and cannot be deleted or overwritten");
    return;
  }

  const record=createPermanentAppraisal(j);
  j.timeline=j.timeline||[];
  j.timeline.push({time:record.savedAt,text:`Appraisal Permanently Saved (${record.id})`});

  resetLiveAppraisal(j);
  j.status=j.clockIn?"At Collection":"Appraisal Not Started";

  save();
  renderAll();
  toast("Appraisal saved permanently — live form refreshed");
};

window.submitForReview=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  if(getReviewSnapshot(j)){
    toast("A saved appraisal is already under review for this collection");
    return;
  }

  const record=createPermanentAppraisal(j,{forReview:true});
  j.status="Awaiting Sales Manager Review";
  j.reviewSubmittedAt=new Date().toISOString();
  j.alertCreatedAt=j.reviewSubmittedAt;
  j.managerAlertAcknowledged=false;
  j.timeline=j.timeline||[];
  j.timeline.push({time:record.savedAt,text:`Appraisal Permanently Saved (${record.id})`});
  j.timeline.push({time:j.reviewSubmittedAt,text:"Saved Appraisal Submitted for Sales Manager Review"});

  resetLiveAppraisal(j);
  save();
  renderAll();
  toast("Appraisal saved permanently — Sales Manager alerted");
};

window.sellerAccepted=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;
  const a=getReviewAppraisal(j);

  j.finalPrice=Number(a.managerOfferPrice??j.agreedPrice??0);
  j.status="Seller Accepted";
  j.sellerAcceptedAt=new Date().toISOString();
  j.sellerResponseAt=j.sellerAcceptedAt;
  j.alertCreatedAt=j.sellerAcceptedAt;
  j.managerAlertAcknowledged=false;
  j.timeline=j.timeline||[];
  j.timeline.push({time:j.sellerAcceptedAt,text:`Seller Accepted Offer: ${money(j.finalPrice)}`});

  const saved=getReviewSnapshot(j);
  if(saved){
    saved.finalPrice=j.finalPrice;
    saved.timeline=structuredClone(j.timeline);
    saved.appraisal=saved.appraisal||{};
    saved.appraisal.sellerOutcome="Accepted";
    saved.appraisal.sellerOutcomeAt=j.sellerAcceptedAt;
    j.reviewAppraisalSnapshot=structuredClone(saved);
  }

  save();renderAll();toast("Seller accepted — Sales Manager notified");
};

window.sellerDeclined=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;
  const a=getReviewAppraisal(j);

  j.status="Seller Declined";
  j.sellerDeclinedAt=new Date().toISOString();
  j.sellerResponseAt=j.sellerDeclinedAt;
  j.alertCreatedAt=j.sellerDeclinedAt;
  j.managerAlertAcknowledged=false;
  j.timeline=j.timeline||[];
  j.timeline.push({time:j.sellerDeclinedAt,text:`Seller Declined Offer: ${money(a.managerOfferPrice||0)}`});

  const saved=getReviewSnapshot(j);
  if(saved){
    saved.timeline=structuredClone(j.timeline);
    saved.appraisal=saved.appraisal||{};
    saved.appraisal.sellerOutcome="Declined";
    saved.appraisal.sellerOutcomeAt=j.sellerDeclinedAt;
    j.reviewAppraisalSnapshot=structuredClone(saved);
  }

  save();renderAll();toast("Seller declined — Sales Manager notified");
};

window.requestRevisedOffer=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  j.status="Revised Offer Requested";
  j.reviewSubmittedAt=new Date().toISOString();
  j.alertCreatedAt=j.reviewSubmittedAt;
  j.managerAlertAcknowledged=false;
  j.timeline=j.timeline||[];
  j.timeline.push({time:j.reviewSubmittedAt,text:"Revised Offer Requested"});

  const saved=getReviewSnapshot(j);
  if(saved){saved.timeline=structuredClone(j.timeline);j.reviewAppraisalSnapshot=structuredClone(saved)}

  save();renderAll();toast("Revised offer requested — Sales Manager alerted");
};

window.deleteAppraisal=id=>{
  const j=state.collections.find(x=>x.id===id);
  if(!j)return;

  if(getReviewSnapshot(j)||j.lastSavedAppraisalId){
    toast("Saved appraisals are permanent and cannot be deleted");
    return;
  }

  const hasDraft=
    Object.values(j.appraisal?.checks||{}).some(Boolean) ||
    Object.values(j.appraisal?.tyres||{}).some(v=>Number(v)>0) ||
    (j.appraisal?.damageParts||[]).length ||
    j.appraisal?.faultCodes ||
    j.appraisal?.bodyDescription ||
    j.appraisal?.interiorDescription ||
    j.appraisal?.notes ||
    j.testDrive;

  if(!hasDraft){toast("There is no unsaved appraisal draft to delete");return}

  if(!window.confirm(`Delete the unsaved appraisal draft for ${j.registration||"this vehicle"}? Saved appraisal records can never be deleted.`))return;

  resetLiveAppraisal(j);
  j.status=j.clockIn?"At Collection":"Appraisal Not Started";
  j.timeline=j.timeline||[];
  j.timeline.push({time:new Date().toISOString(),text:"Unsaved Appraisal Draft Deleted"});

  save();renderAll();toast("Unsaved appraisal draft deleted");
};

window.printReviewAppraisal=id=>{
  const j=state.collections.find(x=>x.id===id);
  const saved=getReviewSnapshot(j);
  if(!saved){toast("No saved appraisal available");return}
  printSavedAppraisal(saved.id);
};

window.printAppraisal=()=>{
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("print-target"));
  $("page-appraisals").classList.add("print-target");
  window.print();
};


function printStatusClass(value){
  if(value==="Good")return "print-good";
  if(value==="Fault")return "print-fault";
  if(value==="Not checked")return "print-amber";
  if(value==="Not fitted")return "print-white";
  return "";
}

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
      <div><span>Seller / customer</span><strong>${j.contactName||"—"}</strong></div>
      <div><span>Telephone</span><strong>${j.contactPhone||"—"}</strong></div>
      <div><span>Collection address</span><strong>${j.collectionAddress||"—"}</strong></div>
      <div><span>Destination</span><strong>${j.destination||"—"}</strong></div>
      <div><span>Vehicle mileage</span><strong>${j.vehicleMileage||"—"}</strong></div>
      <div><span>Appraisal saved</span><strong>${dt(j.savedAt||j.appraisalSavedAt||a.savedAt)}</strong></div>
    </div>

    <h3>Vehicle Mileage & Journey</h3>
    <table>
      <tbody>
        <tr><th>Mileage verified</th><td>${a.mileageVerified||"Not recorded"}</td></tr>
        <tr><th>Verification note</th><td>${a.mileageVerificationNote||"—"}</td></tr>
        <tr><th>Dashboard mileage at appraisal</th><td>${a.appraisalMileage?Number(a.appraisalMileage).toLocaleString("en-GB")+" miles":"—"}</td></tr>
        <tr><th>Collection start mileage</th><td>${j.vehicleJourney?.startMileage?Number(j.vehicleJourney.startMileage).toLocaleString("en-GB")+" miles":"—"}</td></tr>
        <tr><th>Delivery end mileage</th><td>${j.vehicleJourney?.endMileage?Number(j.vehicleJourney.endMileage).toLocaleString("en-GB")+" miles":"—"}</td></tr>
        <tr><th>Vehicle journey distance</th><td>${j.vehicleJourney?.distance!=null?Number(j.vehicleJourney.distance).toLocaleString("en-GB")+" miles":"—"}</td></tr>
      </tbody>
    </table>

    <h3>Tyre tread depths</h3>
    <table><thead><tr><th>NSF</th><th>NSR</th><th>OSF</th><th>OSR</th></tr></thead>
      <tbody><tr><td>${tyres.NSF||0} mm</td><td>${tyres.NSR||0} mm</td><td>${tyres.OSF||0} mm</td><td>${tyres.OSR||0} mm</td></tr></tbody>
    </table>

    <h3>Equipment and vehicle checks</h3>
    <table class="print-status-table"><thead><tr><th>Check</th><th>Result</th></tr></thead>
      <tbody>${checks.map(([name,value])=>`<tr class="${printStatusClass(value)}"><td>${name}</td><td><strong>${value||"Not recorded"}</strong></td></tr>`).join("")}</tbody>
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

    <h3>Test Drive</h3>
    <table><tbody>
      <tr><th>Started</th><td>${dt(j.testDrive?.start)}</td></tr>
      <tr><th>Finished</th><td>${dt(j.testDrive?.end)}</td></tr>
      <tr><th>Duration</th><td>${formatDuration(j.testDrive?.durationMinutes||0)}</td></tr>
      <tr><th>Distance</th><td>${j.testDrive?.distance||0} miles</td></tr>
      <tr><th>Notes</th><td>${j.testDrive?.notes||"None recorded"}</td></tr>
    </tbody></table>
    ${Object.keys(j.testDrive?.checks||{}).length?`<table class="print-status-table" style="margin-top:10px">
      <thead><tr><th>Test-drive check</th><th>Result</th></tr></thead>
      <tbody>${Object.entries(j.testDrive.checks).map(([name,value])=>`<tr class="${printStatusClass(value)}"><td>${name}</td><td><strong>${value||"Not recorded"}</strong></td></tr>`).join("")}</tbody>
    </table>`:""}
    <h3>Journey Timeline</h3><table><thead><tr><th>Time</th><th>Event</th></tr></thead><tbody>${(j.timeline||[]).map(t=>`<tr><td>${dt(t.time)}</td><td>${t.text}</td></tr>`).join("")}</tbody></table><h3>Sales Manager Offer</h3>
    <table>
      <tbody>
        <tr><th>Agreed purchase price</th><td>${money(j.agreedPrice||0)}</td></tr>
        <tr><th>Approved offer price</th><td>${money(a.managerOfferPrice||0)}</td></tr>
        <tr><th>Recommended reduction</th><td>${money(a.managerRecommendedReduction||0)}</td></tr>
        <tr><th>Offer status</th><td>${a.managerOfferStatus||"Not reviewed"}</td></tr>
        <tr><th>Manager note</th><td>${a.managerOfferNote||"No note recorded"}</td></tr>
        <tr><th>Last updated</th><td>${dt(a.managerOfferUpdatedAt)}</td></tr>
      </tbody>
    </table>
  </div>`;
}

function renderAppraisalHistory(){
  const q=($("appraisalHistorySearch")?.value||"").toLowerCase();
  const records=(state.savedAppraisals||[])
    .filter(a=>[a.registration,collectorName(a.collector),a.make,a.model,a.collectionAddress,a.destination].join(" ").toLowerCase().includes(q))
    .sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));

  if(!$("appraisalHistoryList"))return;

  $("appraisalHistoryList").innerHTML=records.length?`<div class="table-wrap"><table>
    <thead><tr><th>Saved</th><th>Registration</th><th>Vehicle</th><th>Collector</th><th>Agreed Price</th><th>Status</th><th class="no-print">Actions</th></tr></thead>
    <tbody>${records.map(a=>`<tr>
      <td>${dt(a.savedAt)}</td>
      <td><strong>${a.registration||"—"}</strong></td>
      <td>${a.make||""} ${a.model||""}</td>
      <td>${collectorName(a.collector)}</td>
      <td>${money(a.agreedPrice||0)}</td>
      <td><span class="badge green">Permanent</span></td>
      <td class="no-print">
        <button class="ghost-btn" onclick="openSavedAppraisal('${a.id}')">Open</button>
        <button class="primary-btn" onclick="printSavedAppraisal('${a.id}')">Print</button>
      </td>
    </tr>`).join("")}</tbody>
  </table></div>`:"<p>No permanently saved appraisals found.</p>";
}

if($("appraisalHistorySearch"))$("appraisalHistorySearch").oninput=renderAppraisalHistory;

window.openSavedAppraisal=id=>{
  const a=state.savedAppraisals.find(x=>x.id===id);
  if(!a){toast("Saved appraisal not found");return}

  showPage("appraisals");
  $("appraisalWorkspace").innerHTML=`
    <div class="saved-record-banner">
      <div><p class="eyebrow">PERMANENT SAVED APPRAISAL</p><h3>${a.registration} · ${a.make||""} ${a.model||""}</h3><p>Saved ${dt(a.savedAt)}. This record is read-only and cannot be deleted.</p></div>
      <button class="primary-btn" onclick="printSavedAppraisal('${a.id}')">Print Saved Appraisal</button>
    </div>
    ${appraisalPrintHtml(a)}
  `;
};

window.printSavedAppraisal=id=>{
  const a=state.savedAppraisals.find(x=>x.id===id);
  if(!a){toast("Saved appraisal not found");return}

  const printWindow=window.open("","_blank");
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${a.registration} Appraisal</title>
    <link rel="stylesheet" href="style.css">
    <style>body{padding:30px;background:#fff}.saved-appraisal-print{max-width:900px;margin:auto}.saved-print-title{display:flex;justify-content:space-between;border-bottom:2px solid #172033;padding-bottom:18px;margin-bottom:20px}.print-summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}.print-summary-grid div{border:1px solid #ddd;padding:12px;border-radius:8px}.print-summary-grid span{display:block;color:#666;font-size:12px}.print-summary-grid strong{display:block;margin-top:5px}h3{margin-top:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:left}
      .print-good td{background:#dff5e9!important;color:#155f3d!important}
      .print-fault td{background:#fde3e6!important;color:#8d1e2d!important}
      .print-amber td{background:#fff0c7!important;color:#765500!important}
      .print-white td{background:#fff!important;color:#172033!important}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    </style>
  </head><body>${appraisalPrintHtml(a)}</body></html>`);
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
  const outstanding=state.collections.filter(j=>!j.expensesSaved);

  $("expenseList").innerHTML=outstanding.length?outstanding.map(j=>`<div class="panel" style="box-shadow:none">
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

    <button class="primary-btn" onclick="saveExpenses('${j.id}')">Save Expenses & Move to History</button>
  </div>`).join(""):`<div class="empty-state"><h3>All expenses saved</h3><p>Saved expense records are available in Collection History.</p></div>`;
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
  if(!j)return;
  j.expenses=j.expenses||{};

  document.querySelectorAll(`[data-purchase-job="${id}"]`).forEach(x=>{
    j[x.dataset.purchaseKey]=Number(x.value||0);
  });

  document.querySelectorAll(`[data-expense-job="${id}"]`).forEach(x=>{
    j.expenses[x.dataset.expenseKey]=Number(x.value||0);
  });

  j.expensesSaved=true;
  j.expensesSavedAt=new Date().toISOString();
  j.expenseHistory={
    savedAt:j.expensesSavedAt,
    agreedPrice:Number(j.agreedPrice||0),
    finalPrice:Number(j.finalPrice||0),
    moneySaved:reduction(j),
    expenses:structuredClone(j.expenses),
    total:totalExpenses(j)
  };

  j.timeline=j.timeline||[];
  j.timeline.push({
    time:j.expensesSavedAt,
    text:`Expenses Saved — Total Travel Cost: ${money(totalExpenses(j))}`
  });

  // Keep permanent appraisal archive in sync with the final job costs.
  (state.savedAppraisals||[]).filter(a=>a.sourceCollectionId===j.id).forEach(a=>{
    a.expenseHistory=structuredClone(j.expenseHistory);
    a.finalPrice=j.finalPrice;
    a.timeline=structuredClone(j.timeline);
  });

  save();
  renderAll();
  toast("Expenses saved and moved to Collection History");
};

function renderHistory(){
  const q=($("historySearch").value||"").toLowerCase();
  const jobs=state.collections
    .filter(j=>[j.registration,collectorName(j.collector),j.destination,j.collectionAddress,j.contactName].join(" ").toLowerCase().includes(q))
    .sort((a,b)=>new Date(b.collectionDate||b.createdAt)-new Date(a.collectionDate||a.createdAt));

  $("historyList").innerHTML=jobs.length?jobs.map(j=>{
    const e=j.expenseHistory?.expenses||j.expenses||{};
    const hasSavedExpenses=!!j.expensesSaved;
    return `<div class="history-job-card">
      <div class="history-job-summary">
        <div>
          <p class="eyebrow">${dateOnly(j.collectionDate)}</p>
          <h3>${j.registration||"No registration"} · ${j.make||""} ${j.model||""}</h3>
          <p>${collectorName(j.collector)} · ${j.status||"Scheduled"} · ${j.contactName||"No customer name"}</p>
        </div>
        <div class="history-summary-figures">
          <div><span>Vehicle Miles</span><strong>${Number(j.vehicleJourney?.distance||0).toLocaleString("en-GB")} mi</strong></div>
          <div><span>Travel Cost</span><strong>${money(totalExpenses(j))}</strong></div>
          <div><span>Reduction</span><strong>${money(reduction(j))}</strong></div>
        </div>
      </div>

      <div class="history-detail-grid">
        <div><span>Start Mileage</span><strong>${j.vehicleJourney?.startMileage?Number(j.vehicleJourney.startMileage).toLocaleString("en-GB"):"—"}</strong></div>
        <div><span>End Mileage</span><strong>${j.vehicleJourney?.endMileage?Number(j.vehicleJourney.endMileage).toLocaleString("en-GB"):"—"}</strong></div>
        <div><span>Hours</span><strong>${num(hoursWorked(j))} hrs</strong></div>
        <div><span>Expense Status</span><strong>${hasSavedExpenses?"Saved "+dt(j.expensesSavedAt):"Outstanding"}</strong></div>
      </div>

      ${hasSavedExpenses?`
      <div class="saved-expense-history">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">SAVED EXPENSE RECORD</p>
            <h4>Expense Breakdown</h4>
          </div>
          <span class="badge green">${money(totalExpenses(j))} total</span>
        </div>
        <div class="expense-history-grid">
          <div><span>Train</span><strong>${money(e.train||0)}</strong></div>
          <div><span>Taxi</span><strong>${money(e.taxi||0)}</strong></div>
          <div><span>Bus</span><strong>${money(e.bus||0)}</strong></div>
          <div><span>Fuel</span><strong>${money(e.fuel||0)}</strong></div>
          <div><span>Parking</span><strong>${money(e.parking||0)}</strong></div>
          <div><span>Tolls</span><strong>${money(e.tolls||0)}</strong></div>
          <div><span>Other</span><strong>${money(e.other||0)}</strong></div>
          <div><span>Agreed Price</span><strong>${money(j.expenseHistory?.agreedPrice||j.agreedPrice||0)}</strong></div>
          <div><span>Final Price</span><strong>${money(j.expenseHistory?.finalPrice||j.finalPrice||0)}</strong></div>
          <div><span>Money Saved</span><strong>${money(j.expenseHistory?.moneySaved||reduction(j))}</strong></div>
        </div>
      </div>`:""}

      ${j.noCollectionReason?`<div class="history-note"><strong>No Collection Reason:</strong> ${j.noCollectionReason}</div>`:""}
    </div>`;
  }).join(""):`<p>No collection history found.</p>`;
}

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
  const vehicleMiles=jobs.reduce((s,j)=>s+Number(j.vehicleJourney?.distance||0),0);
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
    vehicleMiles,
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
    metric("Vehicle miles driven",`${num(a.vehicleMiles,0)} mi`,"Collected-car journey mileage","blue"),
    metric("Vehicle miles driven",`${num(a.vehicleMiles,0)} mi`,`${a.jobs?num(a.vehicleMiles/a.jobs,0):0} miles per collected vehicle`),
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
    ["Vehicle miles driven",a.vehicleMiles,b.vehicleMiles,"miles"],
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
    const vehicleMiles=jobs.reduce((s,j)=>s+Number(j.vehicleJourney?.distance||0),0);
    const miles=jobs.reduce((s,j)=>s+Number(j.distanceTravelled||0),0);
    const travel=jobs.reduce((s,j)=>s+totalExpenses(j),0);
    const fuel=jobs.reduce((s,j)=>s+Number(j.expenses?.fuel||0),0);
    const hrs=jobs.reduce((s,j)=>s+hoursWorked(j),0);
    const red=jobs.reduce((s,j)=>s+reduction(j),0);

    return {
      name:c.name,
      cars:delivered,
      vehicleMiles,
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
    <thead><tr><th>Collector</th><th>Cars</th><th>Vehicle Miles</th><th>Travel Miles</th><th>Miles/Collection</th><th>Fuel</th><th>Travel Cost</th><th>Cost/Collection</th><th>Hours</th><th>Net Saving</th></tr></thead>
    <tbody>${collectorRows.map(r=>`<tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.cars}</td>
      <td>${num(r.vehicleMiles,0)} mi</td>
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
