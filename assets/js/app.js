const $=s=>document.querySelector(s);const auth=$("#auth"),app=$("#app"),msg=$("#authMsg");
async function api(url,options={}){const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})},credentials:"same-origin"});const data=await r.json().catch(()=>({error:"Unexpected server response"}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#loginForm").classList.toggle("hidden",b.dataset.tab!=="login");$("#registerForm").classList.toggle("hidden",b.dataset.tab!=="register");msg.textContent=""}));
let currentUser=null;async function enter(user){if(user?.role==="worker"){try{await api("/api/auth/logout",{method:"POST"})}catch{}currentUser=null;auth.classList.remove("hidden");app.classList.add("hidden");$("#logout").classList.add("hidden");msg.textContent="This is a worker account. Please use the separate Worker sign in page.";return}currentUser=user;auth.classList.add("hidden");app.classList.remove("hidden");$("#logout").classList.remove("hidden");$("#welcomeText").textContent="Welcome, "+user.name+" · "+user.role;$("#adminModule").classList.toggle("hidden",user.role!=="admin");$("#adminModuleNav").classList.toggle("hidden",user.role!=="admin");if(user.role==="admin")showAdminPage("dashboard");document.querySelectorAll(".user-only").forEach(el=>el.classList.toggle("hidden",user.role==="admin"));if(user.role!=="admin")showUserPage("dashboard");await loadDashboard()}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();msg.textContent="Signing in…";try{const data=Object.fromEntries(new FormData(e.currentTarget));const r=await api("/api/auth/login",{method:"POST",body:JSON.stringify(data)});if(r.user?.role==="admin"){await api("/api/auth/logout",{method:"POST"});throw new Error("Admin accounts must sign in from the separate Admin login page.")}await enter(r.user)}catch(x){msg.textContent=x.message}});
$("#registerForm").addEventListener("submit",async e=>{e.preventDefault();msg.textContent="Creating account…";try{const data=Object.fromEntries(new FormData(e.currentTarget));const r=await api("/api/auth/register",{method:"POST",body:JSON.stringify(data)});await enter(r.user)}catch(x){msg.textContent=x.message}});
$("#logout").addEventListener("click",async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()});
async function loadAdminDashboard(){
 if(!currentUser||currentUser.role!=="admin")return;
 const msg=$("#adminMsg");msg.textContent="Loading campus-wide reports…";
 try{
  const data=await api("/api/admin");
  const s=data.summary;
  $("#adminWasteCount").textContent=s.waste_records;
  $("#adminWasteKg").textContent=Number(s.total_kg).toFixed(2)+" kg";
  $("#adminPending").textContent=s.pending_requests;
  $("#adminCompleted").textContent=s.completed_requests;
  $("#adminUsers").textContent=s.registered_users;
  $("#adminRecycled").textContent=Number(s.recycled_kg).toFixed(2)+" kg";
  const categories=data.categories||[],maxCat=Math.max(1,...categories.map(x=>Number(x.quantity_kg)));
  $("#adminCategoryChart").innerHTML=categories.length?categories.map(x=>'<div class="admin-bar-row"><span>'+escapeHtml(x.waste_category.replace(/_/g," "))+'</span><div class="admin-bar-track"><div class="admin-bar-fill" style="width:'+Math.max(1,Number(x.quantity_kg)/maxCat*100)+'%"></div></div><b class="admin-bar-value">'+Number(x.quantity_kg).toFixed(1)+' kg</b></div>').join(""):'<p class="muted">No waste data yet.</p>';
  const months=data.monthly||[],maxMonth=Math.max(1,...months.map(x=>Number(x.quantity_kg)));
  $("#adminMonthlyChart").innerHTML=months.length?months.map(x=>'<div class="admin-bar-row"><span>'+escapeHtml(x.month_label)+'</span><div class="admin-bar-track"><div class="admin-bar-fill" style="width:'+Math.max(1,Number(x.quantity_kg)/maxMonth*100)+'%"></div></div><b class="admin-bar-value">'+Number(x.quantity_kg).toFixed(1)+' kg</b></div>').join(""):'<p class="muted">No monthly waste data yet.</p>';
  $("#adminWasteRows").innerHTML=data.records.length?data.records.map(r=>'<tr><td>'+escapeHtml(r.location_name)+'</td><td>'+escapeHtml(r.reporter_name||"Former user")+'</td><td>'+escapeHtml(r.waste_category)+'</td><td>'+Number(r.quantity_kg).toFixed(2)+' kg</td><td>'+escapeHtml(r.collection_status)+'</td><td>'+(r.has_image?'<a href="/api/report-image?id='+encodeURIComponent(r.id)+'" target="_blank" rel="noopener">View image</a>':'—')+'</td><td>'+new Date(r.recorded_at).toLocaleDateString()+'</td></tr>').join(""):'<tr><td colspan="7">No waste reports yet.</td></tr>';
  $("#adminUserRows").innerHTML=data.users.map(u=>'<tr><td>'+escapeHtml(u.name)+'</td><td>'+escapeHtml(u.email)+'</td><td><select class="admin-role-select" data-user="'+u.id+'" data-original="'+escapeHtml(u.role)+'"><option value="user" '+(u.role==="user"?"selected":"")+'>User</option><option value="admin" '+(u.role==="admin"?"selected":"")+'>Admin</option><option value="worker" '+(u.role==="worker"?"selected":"")+'>Worker</option></select></td><td>'+new Date(u.created_at).toLocaleDateString()+'</td><td>'+(u.role==="worker"?(u.worker_verified?'<span class="worker-verified-label">Verified</span><button type="button" class="admin-worker-verify" data-user="'+u.id+'" data-verified="false">Revoke</button>':'<span class="worker-pending-label">Pending verification</span><button type="button" class="admin-worker-verify" data-user="'+u.id+'" data-verified="true">Verify worker</button>'):'—')+'</td><td><button type="button" class="admin-save-role" data-user="'+u.id+'">Save role</button></td></tr>').join("");
  $("#adminUserRows").querySelectorAll(".admin-worker-verify").forEach(button=>button.addEventListener("click",async()=>{
   button.disabled=true;msg.textContent=button.dataset.verified==="true"?"Verifying worker account…":"Revoking worker verification…";
   try{await api("/api/admin",{method:"PATCH",body:JSON.stringify({user_id:button.dataset.user,worker_verified:button.dataset.verified==="true"})});msg.textContent=button.dataset.verified==="true"?"Worker account verified. The worker can now sign in.":"Worker verification revoked.";await loadAdminDashboard()}
   catch(error){msg.textContent=error.message;button.disabled=false}
  }));
  $("#adminUserRows").querySelectorAll(".admin-save-role").forEach(button=>button.addEventListener("click",async()=>{
   const select=$("#adminUserRows").querySelector('select[data-user="'+button.dataset.user+'"]');
   button.disabled=true;msg.textContent="Updating account role…";
   try{await api("/api/admin",{method:"PATCH",body:JSON.stringify({user_id:button.dataset.user,role:select.value})});select.dataset.original=select.value;msg.textContent="User role updated successfully.";await loadAdminDashboard()}
   catch(error){select.value=select.dataset.original;msg.textContent=error.message}
   finally{button.disabled=false}
  }));
  msg.textContent="Admin data updated.";
 }catch(error){msg.textContent=error.message}
}
$("#refreshAdmin")?.addEventListener("click",loadAdminDashboard);

async function loadDashboard(){try{const [locs,records]=await Promise.all([api("/api/locations"),api("/api/waste")]);const collectionLocation=$("#collectionLocation");if(collectionLocation)collectionLocation.innerHTML='<option value="">Choose campus location</option>'+locs.locations.map(l=>'<option value="'+l.id+'">'+escapeHtml(l.location_name)+'</option>').join("");$("#locations").innerHTML='<option value="">Choose location</option>'+locs.locations.map(l=>'<option value="'+l.id+'">'+l.location_name+'</option>').join("");renderCampusMap(locs.locations);renderCampusMap3D(locs.locations); renderQrDirectory(locs.locations,$("#locationList"));const adminLocationList=$("#adminLocationList");if(adminLocationList)renderQrDirectory(locs.locations,adminLocationList);applyBinQuery(locs.locations);renderRecords(records.records);$("#priority").textContent=locs.locations.filter(l=>l.is_high_priority).length;await loadCollections();if(currentUser?.role==="admin")await loadAdminDashboard()}catch(e){$("#wasteMsg").textContent=e.message}}
function renderCampusMap(locations){const group=$("#mapMarkers");if(!group)return;group.innerHTML=locations.map(l=>{const point=joyCampusPoint(l),x=point.x,y=point.y;const label=String(joyCampusLabel(l)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");return '<g class="map-marker '+(l.is_high_priority?'is-priority':'')+'" role="button" tabindex="0" aria-label="Select '+label+'" data-location="'+l.id+'"><circle class="marker-halo" cx="'+x+'" cy="'+y+'" r="3.2"/><circle class="marker-core" cx="'+x+'" cy="'+y+'" r="1.65"/><text x="'+(x+2.5)+'" y="'+(y-1.5)+'">'+label+'</text></g>'}).join("");group.querySelectorAll(".map-marker").forEach(m=>{const choose=()=>{const select=$("#locations");select.value=m.dataset.location;$("#mapMsg").textContent="Selected: "+select.options[select.selectedIndex].text;group.querySelectorAll(".map-marker").forEach(x=>x.classList.toggle("selected",x===m));if(currentUser?.role!=="admin")$("#wasteForm").scrollIntoView({behavior:"smooth",block:"center"})};m.addEventListener("click",choose);m.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose()}})})}
function renderRecords(rows){$("#count").textContent=rows.length;$("#kg").textContent=rows.reduce((a,r)=>a+Number(r.quantity_kg),0).toFixed(2);$("#records").innerHTML=rows.length?rows.map(r=>'<tr><td>'+escapeHtml(r.location_name)+'</td><td>'+escapeHtml(r.waste_category)+'</td><td>'+Number(r.quantity_kg).toFixed(2)+' kg</td><td>'+escapeHtml(r.collection_status)+'</td><td>'+(r.has_image?'<a href="/api/report-image?id='+encodeURIComponent(r.id)+'" target="_blank" rel="noopener">View image</a>':'—')+'</td><td>'+new Date(r.recorded_at).toLocaleString()+'</td></tr>').join(""):'<tr><td colspan="6">No waste records yet.</td></tr>'}
$("#wasteForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;const f=Object.fromEntries(new FormData(form));const file=$("#wasteImage")?.files?.[0];delete f.image;$("#wasteMsg").textContent="Saving report…";try{if(file){if(file.size>2*1024*1024)throw new Error("Image must be 2 MB or smaller.");f.image_data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file)});f.image_name=file.name}await api("/api/waste",{method:"POST",body:JSON.stringify(f)});$("#wasteMsg").textContent="Waste report and image saved to the cloud.";form.reset();const r=await api("/api/waste");renderRecords(r.records)}catch(x){$("#wasteMsg").textContent=x.message}});
(async()=>{try{const r=await api("/api/auth/me");await enter(r.user)}catch{}})();
function updateCollectionRecordSummary(){
 const select=$("#collectionRecord"),summary=$("#collectionRecordSummary");
 if(!select||!summary)return;
 if(!select.value){summary.textContent="Choose a waste record. Location, category and quantity are copied from that record.";return}
 const option=select.options[select.selectedIndex];
 summary.textContent=option.dataset.summary||"Selected waste record.";
}
async function loadCollections(){
 try{
  const data=await api("/api/collections");
  const bodies=[$("#collectionRows"),$("#adminCollectionRows")].filter(Boolean);
  const rows=data.requests.length?data.requests.map(r=>{
   const events=Array.isArray(r.history)?r.history:[];
   const history=events.length?'<details class="request-history"><summary>View history ('+events.length+')</summary><ol>'+events.map(event=>{
    const from=event.from_status?event.from_status.replace(/_/g," "):"submitted";
    const to=String(event.to_status||"").replace(/_/g," ");
    return '<li><b>'+escapeHtml(from)+' → '+escapeHtml(to)+'</b><small>'+escapeHtml(new Date(event.created_at).toLocaleString())+' · '+escapeHtml(event.changed_by_name||"System")+'</small>'+(event.note?'<p>'+escapeHtml(event.note)+'</p>':'')+'</li>';
   }).join("")+'</ol></details>':'<span class="muted">No history</span>';
   const action=currentUser&&currentUser.role==="admin"?'<div class="request-admin-tools">'+
    '<select class="worker-assign-select" aria-label="Assign worker"><option value="">Unassigned</option>'+(data.workers||[]).map(w=>'<option value="'+w.id+'" '+(String(w.id)===String(r.assigned_worker_id)?"selected":"")+'>'+escapeHtml(w.name)+' · '+escapeHtml(w.email)+'</option>').join("")+'</select>'+
    '<button type="button" class="worker-assign-save" data-id="'+r.id+'">Save assignment</button>'+
    (r.worker_name?'<small class="muted">Assigned to '+escapeHtml(r.worker_name)+'</small>':'')+
    (r.has_proof?'<a class="proof-link" href="/api/worker?proof='+encodeURIComponent(r.id)+'" target="_blank" rel="noopener">Review worker photo</a>':'<small class="muted">No photo proof submitted</small>')+
    (r.status==="proof_submitted"?'<button type="button" class="request-mark-collected" data-id="'+r.id+'">Approve · Mark Collected</button>':'')+
    (["pending","approved","assigned"].includes(r.status)?'<select class="request-status" data-current="'+escapeHtml(r.status)+'"><option value="pending">Pending</option><option value="rejected">Rejected</option></select><input class="request-admin-note" placeholder="Admin note"><button type="button" class="request-update" data-id="'+r.id+'">Save status</button>':'')+
    '</div>':'—';
   return '<tr><td>Request #'+r.id+'<small>'+escapeHtml(r.location_name||"Campus location")+'</small></td><td>'+escapeHtml(r.waste_category)+(r.notes?'<small class="request-note">'+escapeHtml(r.notes)+'</small>':'')+'</td><td>'+Number(r.quantity_kg).toFixed(2)+' kg</td><td><span class="request-pill '+escapeHtml(r.status)+'">'+escapeHtml(r.status.replace(/_/g," "))+'</span></td><td>'+new Date(r.created_at).toLocaleString()+'</td><td>'+history+'</td><td>'+action+'</td></tr>';
  }).join(""):'<tr><td colspan="7">No collection requests yet.</td></tr>';
  bodies.forEach(body=>{
   body.innerHTML=rows;
   const message=body.id==="adminCollectionRows"?$("#adminCollectionMsg"):$("#collectionMsg");
   body.querySelectorAll(".worker-assign-save").forEach(button=>button.addEventListener("click",async()=>{
    const row=button.closest("tr"),select=row.querySelector(".worker-assign-select");
    button.disabled=true;if(message)message.textContent="Saving worker assignment…";
    try{await api("/api/collections",{method:"PATCH",body:JSON.stringify({id:button.dataset.id,assigned_worker_id:select.value||null})});if(message)message.textContent="Worker assignment saved.";await loadCollections()}
    catch(error){if(message)message.textContent=error.message;button.disabled=false}
   }));
   body.querySelectorAll(".request-mark-collected").forEach(button=>button.addEventListener("click",async()=>{
    if(!confirm("Confirm that the worker's photo proof is acceptable and mark this request Collected?"))return;
    button.disabled=true;if(message)message.textContent="Approving collection proof…";
    try{await api("/api/collections",{method:"PATCH",body:JSON.stringify({id:button.dataset.id,status:"collected",admin_note:"Photo proof reviewed and approved by administrator."})});if(message)message.textContent="Collection approved and marked Collected.";await loadCollections()}
    catch(error){if(message)message.textContent=error.message;button.disabled=false}
   }));
   body.querySelectorAll(".request-update").forEach(button=>button.addEventListener("click",async()=>{
    const row=button.closest("tr"),select=row.querySelector(".request-status"),note=row.querySelector(".request-admin-note"),previous=select.dataset.current;
    button.disabled=true;select.disabled=true;note.disabled=true;if(message)message.textContent="Updating request…";
    try{await api("/api/collections",{method:"PATCH",body:JSON.stringify({id:button.dataset.id,status:select.value,admin_note:note.value.trim()})});if(message)message.textContent="Status saved and added to the request history.";await loadCollections()}
    catch(error){select.value=previous;if(message)message.textContent=error.message}
    finally{button.disabled=false;select.disabled=false;note.disabled=false}
   }));
  });
 }catch(error){
  [$("#collectionRows"),$("#adminCollectionRows")].filter(Boolean).forEach(body=>body.innerHTML='<tr><td colspan="7">'+escapeHtml(error.message)+'</td></tr>');
  if($("#adminCollectionMsg"))$("#adminCollectionMsg").textContent=error.message;
 }
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("#collectionForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const form=e.currentTarget,button=form.querySelector("button[type=submit]");
 const values=Object.fromEntries(new FormData(form));
 button.disabled=true;$("#collectionMsg").textContent="Submitting request…";
 try{
  await api("/api/collections",{method:"POST",body:JSON.stringify(values)});
  form.reset();await loadCollections();
  $("#collectionMsg").textContent="Collection request submitted successfully. You can track its status below.";
 }catch(error){$("#collectionMsg").textContent=error.message}
 finally{button.disabled=false}
});


// Camera-based waste item detection (COCO-SSD runs in the browser).
let wasteStream=null,wasteDetector=null;
const cameraVideo=$("#wasteCamera"),cameraCanvas=$("#wasteCanvas");
$("#startCamera").addEventListener("click",async()=>{
 const status=$("#cameraMsg");status.textContent="Starting camera…";
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable. Open this site over HTTPS in a supported browser.");
  wasteStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  cameraVideo.srcObject=wasteStream;await cameraVideo.play();
  $("#startCamera").disabled=true;$("#detectWaste").disabled=false;$("#stopCamera").disabled=false;
  status.textContent="Camera ready. Place one waste item clearly in view.";
 }catch(e){status.textContent=e.message||"Could not start camera. Please allow camera permission."}
});
$("#stopCamera").addEventListener("click",()=>{
 if(wasteStream)wasteStream.getTracks().forEach(t=>t.stop());wasteStream=null;cameraVideo.srcObject=null;
 $("#startCamera").disabled=false;$("#detectWaste").disabled=true;$("#stopCamera").disabled=true;
 $("#cameraMsg").textContent="Camera stopped.";
});
$("#detectWaste").addEventListener("click",async()=>{
 const status=$("#cameraMsg"),result=$("#cameraResult"),button=$("#detectWaste");
 if(!cameraVideo.videoWidth){status.textContent="Wait for the camera preview to appear.";return}
 button.disabled=true;status.textContent="Loading detection model…";
 try{
  if(!window.cocoSsd)throw new Error("Detection model did not load. Check your internet connection and refresh.");
  if(!wasteDetector)wasteDetector=await cocoSsd.load({base:"lite_mobilenet_v2"});
  const ctx=cameraCanvas.getContext("2d");
  cameraCanvas.width=cameraVideo.videoWidth;cameraCanvas.height=cameraVideo.videoHeight;
  ctx.drawImage(cameraVideo,0,0,cameraCanvas.width,cameraCanvas.height);
  const predictions=await wasteDetector.detect(cameraCanvas,10,0.45);
  const found=predictions.sort((a,b)=>b.score-a.score)[0];
  const file=await new Promise(resolve=>cameraCanvas.toBlob(blob=>resolve(blob),"image/jpeg",0.82));
  if(file){
   const photo=new File([file],"camera-waste-"+Date.now()+".jpg",{type:"image/jpeg"});
   const transfer=new DataTransfer();transfer.items.add(photo);$("#wasteImage").files=transfer.files;
  }
  if(!found){
   result.classList.remove("hidden");result.textContent="No clear item detected. Try moving closer with better lighting, or select the category manually.";
   status.textContent="No object detected.";return;
  }
  const label=found.class;
  const food=["banana","apple","orange","broccoli","carrot","sandwich","pizza","donut","cake"];
  const recyclable=["bottle","cup","wine glass"];
  let category="residual",explanation="This object is not confidently mapped to a waste category. Please choose manually.";
  if(food.includes(label)){category="biodegradable";explanation="Food item detected. Suggested: biodegradable / food waste."}
  else if(recyclable.includes(label)){category="recyclable";explanation="Bottle, cup or glass item detected. Suggested: recyclable (check local material rules)."}
  $("#wasteForm select[name=waste_category]").value=category;
  result.classList.remove("hidden");
  result.innerHTML="<strong>Detected:</strong> "+escapeHtml(label)+" ("+(found.score*100).toFixed(0)+"% confidence)<br><strong>Suggestion:</strong> "+escapeHtml(category.replace("_"," "))+"<br><span>"+escapeHtml(explanation)+"</span><br><small>Captured photo attached to the waste report. Please verify the suggestion before saving.</small>";
  status.textContent="Detection complete. Review the suggested category.";
 }catch(e){status.textContent=e.message||"Detection failed."}
 finally{button.disabled=false}
});


// JOY University signboard reference layout: approximate positions traced from the user's campus-map photo.
const joyCampusReference={
 B01:[62,58],B02:[36,43],B03:[20,37],B04:[23,33],B05:[27,30],B06:[31,23],B07:[39,30],B08:[45,26],
 B09:[49,32],B10:[56,28],B11:[61,38],B12:[52,43],B13:[47,48],B14:[54,46],B15:[55,41],B16:[58,38],
 B17:[51,37],B18:[76,88],B19:[72,80],B20:[74,76],B21:[71,69],B22:[82,61],B23:[88,54],B24:[92,48],
 B25:[86,39],B26:[83,34],B27:[79,29],B28:[73,25],B29:[68,31],B30:[72,91],B31:[30,82],B32:[39,65],
 HA:[10,48],HB:[16,40],HC:[14,27],HD:[96,73],HE:[93,65],HF:[98,57]
};
const joyCampusNames={
 B01:"1 Administrative Block",B02:"2 Gino Block",B03:"3 Soosai-A Block",B04:"4 Soosai-B Block",B05:"5 Selvam Block",
 B06:"6 St. Lourdes Chapel",B07:"7 Adhikaram Block",B08:"8 S.A. Raja Memorial Block",B09:"9 Ghana Prakasam Block",
 B10:"10 Annam Block",B11:"11 Grace Block",B12:"12 Celin Block",B13:"13 Joe Block",B14:"14 Arul Block",
 B15:"15 S.A. Raja Convention Hall",B16:"16 Pushpam Block",B17:"17 Mithuraj Block",B18:"18 Cricket Ground",
 B19:"19 Francis Block",B20:"20 Store & Maintenance",B21:"21 Student Activity Centre (SAC)",B22:"22 Manickam Block",
 B23:"23 Football Turf",B24:"24 JU Arena",B25:"25 Joshua Block",B26:"26 Joveena Block",B27:"27 Julliana Block",
 B28:"28 Security Office",B29:"29 Waiting Hall",B30:"30 Canteen",B31:"31 Outside Parking",B32:"32 Inside Parking",
 HA:"A Sophia Hostel",HB:"B Green Field Entrance",HC:"C Green Field Stadium",HD:"D Cecily Hostel",HE:"E Theresa Hostel",HF:"F Devasahayam Hostel"
};
function joyCampusPoint(loc){
 const p=joyCampusReference[String(loc.location_code||"").toUpperCase()];
 return p?{x:p[0],y:p[1]}:{x:Number(loc.map_x)||50,y:Number(loc.map_y)||50};
}
function joyCampusLabel(loc){return joyCampusNames[String(loc.location_code||"").toUpperCase()]||String(loc.location_name||"Campus point")}
// Interactive 3D campus map. Three.js is loaded only when the dashboard opens.
let threeMap=null,threeModulePromise=null;
function setCampusMapMode(mode){
 const is3d=mode==="3d";
 $("#campusMap3D")?.classList.toggle("hidden",!is3d);
 $("#campusMap2D")?.classList.toggle("hidden",is3d);
 $("#show3DMap")?.classList.toggle("active",is3d);
 $("#show2DMap")?.classList.toggle("active",!is3d);
 if(is3d&&threeMap?.resize)threeMap.resize();
}
$("#show3DMap")?.addEventListener("click",()=>setCampusMapMode("3d"));
$("#show2DMap")?.addEventListener("click",()=>setCampusMapMode("2d"));
async function renderCampusMap3D(locations){
 const host=$("#campusMap3D");if(!host)return;
 try{
  if(!threeModulePromise)threeModulePromise=import("https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js");
  const THREE=await threeModulePromise;
  host.innerHTML="";
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xdcebf1);scene.fog=new THREE.Fog(0xdcebf1,95,180);
  const camera=new THREE.PerspectiveCamera(42,1,0.1,300);camera.position.set(0,54,78);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x78927a,2));
  const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(-35,65,35);sun.castShadow=true;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(112,112),new THREE.MeshStandardMaterial({color:0x8dbb83,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.18;ground.receiveShadow=true;scene.add(ground);
  const campus=new THREE.Group();scene.add(campus);
  const roadMat=new THREE.MeshStandardMaterial({color:0xc9d1c9,roughness:1});
  [[0,0,5,100],[0,0,100,5],[-25,0,4,76],[26,0,4,76],[0,-25,76,4],[0,26,76,4]].forEach(([x,z,w,d])=>{const road=new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),roadMat);road.position.set(x,.01,z);campus.add(road)});
  const treeMat=new THREE.MeshStandardMaterial({color:0x397b4b}),trunkMat=new THREE.MeshStandardMaterial({color:0x79563b});
  for(let i=0;i<34;i++){const x=((i*37)%96)-48,z=((i*53)%96)-48;if(Math.abs(x)<9||Math.abs(z)<9)continue;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,1.4,7),trunkMat);trunk.position.set(x,.7,z);const crown=new THREE.Mesh(new THREE.SphereGeometry(1.05,8,7),treeMat);crown.position.set(x,1.8,z);trunk.castShadow=crown.castShadow=true;campus.add(trunk,crown)}
  const clickable=[];const labelObjects=[];
  const clamp=(v)=>Math.max(-43,Math.min(43,v));
  locations.forEach((loc,i)=>{
   const x=clamp((Number(loc.map_x)||50)-50),z=clamp((Number(loc.map_y)||50)-50);
   const name=String(loc.location_name||"Campus point");
   const lower=name.toLowerCase();
   const isHostel=lower.includes("hostel"),isFood=lower.includes("canteen")||lower.includes("food")||lower.includes("cafe"),isSac=lower.includes("sac");
   const w=isHostel?8:isFood?9:isSac?10:6.2,d=isHostel?7:isFood?8:isSac?9:6.2,h=isHostel?7.5:isFood?4.5:isSac?6:5.2;
   const color=loc.is_high_priority?0xd78a43:(isHostel?0xe8d8a8:isFood?0xd8b98c:isSac?0xc4d8e8:0xd7e2d7);
   const base=new THREE.Mesh(new THREE.BoxGeometry(w+.7,.35,d+.7),new THREE.MeshStandardMaterial({color:0x657b68}));base.position.set(x,.18,z);base.receiveShadow=true;campus.add(base);
   const building=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.85}));building.position.set(x,h/2+.35,z);building.castShadow=true;building.receiveShadow=true;building.userData.location=loc;campus.add(building);clickable.push(building);
   const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.25,.35,d+.25),new THREE.MeshStandardMaterial({color:loc.is_high_priority?0xb9672c:0x829b88}));roof.position.set(x,h+.55,z);roof.castShadow=true;campus.add(roof);
   // Floating readable name label above every 3D campus building.
   const labelCanvas=document.createElement("canvas");labelCanvas.width=1024;labelCanvas.height=256;
   const labelCtx=labelCanvas.getContext("2d");
   labelCtx.fillStyle=loc.is_high_priority?"rgba(115,55,18,.94)":"rgba(25,48,39,.92)";
   labelCtx.fillRect(12,12,1000,232);
   labelCtx.font="bold 62px Arial, sans-serif";labelCtx.textAlign="center";labelCtx.textBaseline="middle";
   labelCtx.fillStyle="#ffffff";
   let labelText=name;
   while(labelCtx.measureText(labelText).width>930&&labelText.length>12){labelText=labelText.slice(0,-1)}
   if(labelText!==name&&labelText.length>3)labelText=labelText.slice(0,-3)+"…";
   labelCtx.fillText(labelText,512,128);
   const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
   const labelMaterial=new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthTest:false,depthWrite:false});
   const nameLabel=new THREE.Sprite(labelMaterial);nameLabel.position.set(x,h+4.2,z);nameLabel.scale.set(20,5,1);nameLabel.renderOrder=1000;campus.add(nameLabel);labelObjects.push(nameLabel);
   const bin=new THREE.Mesh(new THREE.CylinderGeometry(.48,.55,1.25,12),new THREE.MeshStandardMaterial({color:loc.is_high_priority?0xe1782c:0x26865a}));bin.position.set(x+w*.65,1,z+d*.55);bin.castShadow=true;bin.userData.location=loc;campus.add(bin);clickable.push(bin);
   // Flat coloured marker disc keeps each waste point visible from above.
   const disc=new THREE.Mesh(new THREE.CircleGeometry(1.05,20),new THREE.MeshBasicMaterial({color:loc.is_high_priority?0xffa34b:0x36a66e,side:THREE.DoubleSide}));disc.rotation.x=-Math.PI/2;disc.position.set(x+w*.65,.04,z+d*.55);campus.add(disc);
  });
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let dragging=false,lastX=0,lastY=0,rotY=.35,rotX=.58,distance=88;
  camera.position.set(Math.sin(rotY)*distance,Math.sin(rotX)*distance,Math.cos(rotY)*distance);camera.lookAt(0,0,0);
  function resize(){const width=host.clientWidth||700,height=host.clientHeight||480;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()}
  resize();window.addEventListener("resize",resize);
  renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
  renderer.domElement.addEventListener("pointermove",e=>{if(!dragging)return;rotY-=(e.clientX-lastX)*.008;rotX=Math.max(.2,Math.min(1.15,rotX+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;updateCamera()});
  renderer.domElement.addEventListener("pointerup",e=>{if(!dragging)return;dragging=false;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(clickable,false);if(hits.length){const loc=hits[0].object.userData.location;if(loc)selectMapLocation(loc)}});
  renderer.domElement.addEventListener("pointercancel",()=>dragging=false);
  renderer.domElement.addEventListener("wheel",e=>{e.preventDefault();distance=Math.max(42,Math.min(125,distance+e.deltaY*.055));updateCamera()},{passive:false});
  function updateCamera(){camera.position.set(Math.sin(rotY)*distance,Math.sin(rotX)*distance,Math.cos(rotY)*distance);camera.lookAt(0,0,0)}
  let frame;function animate(){frame=requestAnimationFrame(animate);renderer.render(scene,camera)}
  animate();threeMap={resize,dispose(){cancelAnimationFrame(frame);window.removeEventListener("resize",resize);renderer.dispose()}};
 }catch(error){host.innerHTML='<div class="map-error">3D view could not load. Check your internet connection or use the 2D view. ('+escapeHtml(error.message)+')</div>'}
}
function selectMapLocation(loc){
 const select=$("#locations");if(select){select.value=String(loc.id);$("#mapMsg").textContent="Selected: "+loc.location_name+" · "+(loc.is_high_priority?"High priority collection point":"Campus collection point");}
 // Keep the map in view after a building is selected; do not jump down the page.
}


// User module page navigation. All original form IDs and API handlers stay intact.
function showUserPage(page){
 const nav=$("#userModuleNav");
 if(!nav)return;
 nav.classList.remove("hidden");
 nav.querySelectorAll("[data-user-page]").forEach(button=>button.classList.toggle("active",button.dataset.userPage===page));
 document.querySelectorAll("[data-user-page-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.userPagePanel===page));
 if(page==="green")loadGreenCampus();
}
$("#userModuleNav")?.addEventListener("click",event=>{
 const button=event.target.closest("[data-user-page]");
 if(!button)return;
 showUserPage(button.dataset.userPage);
 if(button.dataset.userPage==="map"&&threeMap?.resize)threeMap.resize();
});


// Admin module page navigation.
function showAdminPage(page){const nav=$("#adminModuleNav");if(!nav)return;nav.classList.remove("hidden");nav.querySelectorAll("[data-admin-page]").forEach(button=>button.classList.toggle("active",button.dataset.adminPage===page));document.querySelectorAll("[data-admin-page-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.adminPagePanel===page));if(page==="sustainability")loadGreenCampus();}
$("#adminModuleNav")?.addEventListener("click",event=>{const button=event.target.closest("[data-admin-page]");if(!button)return;showAdminPage(button.dataset.adminPage);});


/* JOY University Green Campus: impact, student points, marketplace and QR bins. */
let greenCampusData=null;
function renderBars(host,rows,labelKey,valueKey,suffix=" kg"){
 if(!host)return;
 const list=rows||[],max=Math.max(1,...list.map(x=>Number(x[valueKey]||0)));
 host.innerHTML=list.length?list.map(x=>'<div class="admin-bar-row"><span>'+escapeHtml(x[labelKey])+'</span><div class="admin-bar-track"><div class="admin-bar-fill" style="width:'+Math.max(1,Number(x[valueKey]||0)/max*100)+'%"></div></div><b class="admin-bar-value">'+Number(x[valueKey]||0).toFixed(1)+suffix+'</b></div>').join(""):'<p class="muted">No data recorded yet.</p>';
}
function productCard(p){
 const image=typeof p.image_url==="string"&&/^https:\/\//i.test(p.image_url)?'<img loading="lazy" src="'+escapeHtml(p.image_url)+'" alt="'+escapeHtml(p.product_name)+'">':"";
 return '<article class="product-card">'+image+'<h3>'+escapeHtml(p.product_name)+'</h3><p>'+escapeHtml(p.description||"Made from reusable campus materials.")+'</p><p><b>Material:</b> '+escapeHtml(p.material_used)+'</p><div class="product-meta"><span>₹'+Number(p.price).toFixed(2)+'</span><span>'+Number(p.stock)+' available</span></div></article>';
}
async function loadGreenCampus(){
 try{
  const d=await api("/api/waste?view=green-campus");greenCampusData=d;
  const impact=d.impact||{},total=Number(impact.total_kg||0),recycled=Number(impact.recycled_kg||0),co2=Number(impact.co2_saved_kg||0);
  const put=(id,value)=>{const el=$("#"+id);if(el)el.textContent=value};
  put("greenTotal",total.toFixed(2)+" kg");put("greenRecycled",recycled.toFixed(2)+" kg");put("greenCo2",co2.toFixed(2)+" kg");put("myGreenPoints",Number(d.points||0).toLocaleString("en-IN"));
  put("greenAdminTotal",total.toFixed(2)+" kg");put("greenAdminRecycled",recycled.toFixed(2)+" kg");put("greenAdminCo2",co2.toFixed(2)+" kg");
  const sales=d.sales||{};put("greenAdminProfit","₹"+Number(sales.profit||0).toFixed(2));
  const leaderboard=$("#greenLeaderboard");
  if(leaderboard)leaderboard.innerHTML=d.leaderboard?.length?d.leaderboard.map((u,i)=>'<div class="leader-row"><span><i class="leader-rank">'+(i+1)+'</i><span class="leader-name">'+escapeHtml(u.name)+'</span></span><b class="leader-points">'+Number(u.points).toLocaleString("en-IN")+' pts</b></div>').join(""):'<p class="muted">No Green Points awarded yet. Points appear after an approved recycling pickup.</p>';
  renderBars($("#greenCategoryChart"),(d.categories||[]).map(x=>({...x,waste_category:String(x.waste_category).replace(/_/g," ")})),"waste_category","quantity_kg");
  renderBars($("#greenMonthlyChart"),d.monthly||[],"month_label","quantity_kg");
  const products=d.products||[];
  if($("#greenProducts"))$("#greenProducts").innerHTML=products.length?products.map(productCard).join(""):'<p class="muted">No recycled craft products have been listed yet.</p>';
  if($("#adminCraftProducts"))$("#adminCraftProducts").innerHTML=products.length?products.map(productCard).join(""):'<p class="muted">No products yet. Add the first recycled craft product above.</p>';
  const select=$("#craftSaleProduct");
  if(select)select.innerHTML='<option value="">Choose product</option>'+products.filter(p=>Number(p.stock)>0).map(p=>'<option value="'+p.id+'">'+escapeHtml(p.product_name)+' · '+Number(p.stock)+' available</option>').join("");
  const profitRows=(d.sales_monthly||[]).map(x=>({...x,profit:Number(x.profit||0)}));
  renderBars($("#craftProfitChart"),profitRows,"month_label","profit"," ₹");
 }catch(error){
  ["greenLeaderboard","greenProducts","adminCraftProducts"].forEach(id=>{const el=$("#"+id);if(el)el.innerHTML='<p class="message">'+escapeHtml(error.message)+'</p>'});
 }
}
function downloadGreenCsv(){
 if(!greenCampusData){alert("Please wait for the sustainability data to load.");return}
 const d=greenCampusData,rows=[
  ["JOY University Sustainability Report"],["Generated",new Date().toLocaleString()],
  ["Total waste recorded (kg)",d.impact.total_kg],["Verified recycled/reused waste (kg)",d.impact.recycled_kg],
  ["Estimated CO2 avoided (kg)",d.impact.co2_saved_kg],["CO2 estimate factor (kg per kg recycled)",d.impact.co2_factor_kg_per_kg],
  [],["Waste category","Quantity (kg)"],...(d.categories||[]).map(x=>[x.waste_category,x.quantity_kg]),
  [],["Month","Waste quantity (kg)"],...(d.monthly||[]).map(x=>[x.month_label,x.quantity_kg]),
  [],["Craft sales revenue (INR)",d.sales.revenue],["Craft sales expenses (INR)",d.sales.expenses],["Craft sales profit (INR)",d.sales.profit],
  [],["Green champion","Points"],...(d.leaderboard||[]).map(x=>[x.name,x.points])
 ];
 const csv=rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="joy-university-sustainability-report.csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
$("#downloadGreenReport")?.addEventListener("click",downloadGreenCsv);
$("#downloadAdminGreenReport")?.addEventListener("click",downloadGreenCsv);
$("#craftProductForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),msg=$("#craftProductMsg");
 const values=Object.fromEntries(new FormData(form));button.disabled=true;msg.textContent="Adding product…";
 try{await api("/api/waste",{method:"POST",body:JSON.stringify({...values,action:"add_product"})});form.reset();msg.textContent="Product added to the JOY marketplace.";await loadGreenCampus()}
 catch(error){msg.textContent=error.message}finally{button.disabled=false}
});
$("#craftSaleForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector("button[type=submit]"),msg=$("#craftSaleMsg");
 const values=Object.fromEntries(new FormData(form));button.disabled=true;msg.textContent="Saving sale…";
 try{await api("/api/waste",{method:"POST",body:JSON.stringify({...values,action:"record_sale"})});form.reset();msg.textContent="Sale recorded and product stock updated.";await loadGreenCampus()}
 catch(error){msg.textContent=error.message}finally{button.disabled=false}
});
let campusLocationsForQr=[];
function renderQrDirectory(locations,host){
 if(!host)return;campusLocationsForQr=locations||[];host.classList.add("qr-directory");
 host.innerHTML=campusLocationsForQr.map(l=>'<article class="qr-location"><canvas data-qr-code="'+escapeHtml(l.location_code)+'"></canvas><b>'+escapeHtml(l.location_name)+'</b><small>Bin ID: '+escapeHtml(l.location_code)+'</small><span class="'+(l.is_high_priority?"priority":"muted")+'">'+(l.is_high_priority?"High priority bin":"Campus collection bin")+'</span></article>').join("");
 host.querySelectorAll("canvas[data-qr-code]").forEach(canvas=>{
  const code=canvas.dataset.qrCode,url=new URL("/",window.location.origin);url.searchParams.set("bin",code);
  if(window.QRCode?.toCanvas)QRCode.toCanvas(canvas,url.toString(),{width:112,margin:1,errorCorrectionLevel:"M"}).catch(()=>{});
 });
}
function selectScannedBin(code){
 const match=campusLocationsForQr.find(l=>String(l.location_code).toLowerCase()===String(code).toLowerCase());
 if(!match){$("#binScannerMsg").textContent="This QR code is not registered as a JOY University campus bin.";return false}
 const wasteSelect=$("#locations"),requestSelect=$("#collectionLocation");
 if(wasteSelect)wasteSelect.value=String(match.id);if(requestSelect)requestSelect.value=String(match.id);
 $("#binScannerMsg").textContent="Selected "+match.location_name+". Opening the collection request form…";
 showUserPage("requests");return true;
}
function applyBinQuery(locations){
 campusLocationsForQr=locations||[];
 if(currentUser?.role==="admin")return;
 const code=new URLSearchParams(window.location.search).get("bin");
 if(!code)return;
 const match=campusLocationsForQr.find(l=>String(l.location_code).toLowerCase()===code.toLowerCase());
 if(match){if($("#locations"))$("#locations").value=String(match.id);if($("#collectionLocation"))$("#collectionLocation").value=String(match.id);showUserPage("requests");}
}
let binScannerStream=null,binScannerDetector=null;
async function stopBinScanner(){
 if(binScannerStream)binScannerStream.getTracks().forEach(t=>t.stop());binScannerStream=null;
 const video=$("#binScannerVideo");if(video){video.pause();video.srcObject=null;video.classList.remove("active")}
 $("#startBinScanner").disabled=false;$("#stopBinScanner").disabled=true;
}
$("#startBinScanner")?.addEventListener("click",async()=>{
 const message=$("#binScannerMsg"),video=$("#binScannerVideo");
 try{
  if(!("BarcodeDetector" in window))throw new Error("QR scanning is not supported in this browser. Open the QR link with your phone camera instead.");
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable. Use the website over HTTPS.");
  binScannerDetector=new BarcodeDetector({formats:["qr_code"]});
  binScannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  video.srcObject=binScannerStream;video.classList.add("active");await video.play();
  $("#startBinScanner").disabled=true;$("#stopBinScanner").disabled=false;message.textContent="Point the camera at a JOY University bin QR code.";
  const scan=async()=>{
   if(!binScannerStream)return;
   try{const codes=await binScannerDetector.detect(video);if(codes.length){const raw=codes[0].rawValue;let code=raw;try{code=new URL(raw).searchParams.get("bin")||raw}catch{}if(selectScannedBin(code)){await stopBinScanner();return}}}catch{}
   if(binScannerStream)requestAnimationFrame(scan);
  };
  requestAnimationFrame(scan);
 }catch(error){message.textContent=error.message;await stopBinScanner()}
});
$("#stopBinScanner")?.addEventListener("click",stopBinScanner);
