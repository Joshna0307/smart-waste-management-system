const $=s=>document.querySelector(s);const auth=$("#auth"),app=$("#app"),msg=$("#authMsg");
async function api(url,options={}){const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})},credentials:"same-origin"});const data=await r.json().catch(()=>({error:"Unexpected server response"}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#loginForm").classList.toggle("hidden",b.dataset.tab!=="login");$("#registerForm").classList.toggle("hidden",b.dataset.tab!=="register");msg.textContent=""}));
let currentUser=null;async function enter(user){currentUser=user;auth.classList.add("hidden");app.classList.remove("hidden");$("#logout").classList.remove("hidden");$("#welcomeText").textContent="Welcome, "+user.name+" · "+user.role;await loadDashboard()}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();msg.textContent="Signing in…";try{const data=Object.fromEntries(new FormData(e.currentTarget));const r=await api("/api/auth/login",{method:"POST",body:JSON.stringify(data)});await enter(r.user)}catch(x){msg.textContent=x.message}});
$("#registerForm").addEventListener("submit",async e=>{e.preventDefault();msg.textContent="Creating account…";try{const data=Object.fromEntries(new FormData(e.currentTarget));const r=await api("/api/auth/register",{method:"POST",body:JSON.stringify(data)});await enter(r.user)}catch(x){msg.textContent=x.message}});
$("#logout").addEventListener("click",async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()});
async function loadDashboard(){try{const [locs,records]=await Promise.all([api("/api/locations"),api("/api/waste")]);$("#locations").innerHTML='<option value="">Choose location</option>'+locs.locations.map(l=>'<option value="'+l.id+'">'+l.location_name+'</option>').join("");renderCampusMap(locs.locations);$("#locationList").innerHTML=locs.locations.map(l=>'<div class="loc"><b>'+l.location_name+'</b><span class="'+(l.is_high_priority?"priority":"muted")+'">'+(l.is_high_priority?"High priority":"Collection point")+'</span></div>').join("");$("#collectionLocation").innerHTML=$("#locations").innerHTML;renderRecords(records.records);$("#priority").textContent=locs.locations.filter(l=>l.is_high_priority).length;await loadCollections()}catch(e){$("#wasteMsg").textContent=e.message}}
function renderCampusMap(locations){const group=$("#mapMarkers");if(!group)return;group.innerHTML=locations.map(l=>{const x=Number(l.map_x)||50,y=Number(l.map_y)||50;const label=String(l.location_name).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");return '<g class="map-marker '+(l.is_high_priority?'is-priority':'')+'" role="button" tabindex="0" aria-label="Select '+label+'" data-location="'+l.id+'"><circle class="marker-halo" cx="'+x+'" cy="'+y+'" r="3.2"/><circle class="marker-core" cx="'+x+'" cy="'+y+'" r="1.65"/><text x="'+(x+2.5)+'" y="'+(y-1.5)+'">'+label+'</text></g>'}).join("");group.querySelectorAll(".map-marker").forEach(m=>{const choose=()=>{const select=$("#locations");select.value=m.dataset.location;$("#mapMsg").textContent="Selected: "+select.options[select.selectedIndex].text;group.querySelectorAll(".map-marker").forEach(x=>x.classList.toggle("selected",x===m));$("#wasteForm").scrollIntoView({behavior:"smooth",block:"center"})};m.addEventListener("click",choose);m.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose()}})})}
function renderRecords(rows){$("#count").textContent=rows.length;$("#kg").textContent=rows.reduce((a,r)=>a+Number(r.quantity_kg),0).toFixed(2);$("#records").innerHTML=rows.length?rows.map(r=>'<tr><td>'+escapeHtml(r.location_name)+'</td><td>'+escapeHtml(r.waste_category)+'</td><td>'+Number(r.quantity_kg).toFixed(2)+' kg</td><td>'+escapeHtml(r.collection_status)+'</td><td>'+(r.has_image?'<a href="/api/report-image?id='+encodeURIComponent(r.id)+'" target="_blank" rel="noopener">View image</a>':'—')+'</td><td>'+new Date(r.recorded_at).toLocaleString()+'</td></tr>').join(""):'<tr><td colspan="6">No waste records yet.</td></tr>'}
$("#wasteForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget;const f=Object.fromEntries(new FormData(form));const file=$("#wasteImage")?.files?.[0];delete f.image;$("#wasteMsg").textContent="Saving report…";try{if(file){if(file.size>2*1024*1024)throw new Error("Image must be 2 MB or smaller.");f.image_data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file)});f.image_name=file.name}await api("/api/waste",{method:"POST",body:JSON.stringify(f)});$("#wasteMsg").textContent="Waste report and image saved to the cloud.";form.reset();const r=await api("/api/waste");renderRecords(r.records)}catch(x){$("#wasteMsg").textContent=x.message}});
(async()=>{try{const r=await api("/api/auth/me");await enter(r.user)}catch{}})();
async function loadCollections(){
 try{
  const data=await api("/api/collections");
  const body=$("#collectionRows");
  if(!data.requests.length){body.innerHTML='<tr><td colspan="7">No collection requests yet.</td></tr>';return}
  const options=["pending","approved","in_progress","collected","rejected"];
  body.innerHTML=data.requests.map(r=>{
   const events=Array.isArray(r.history)?r.history:[];
   const history=events.length
    ?'<details class="request-history"><summary>View history ('+events.length+')</summary><ol>'+events.map(event=>{
      const from=event.from_status?event.from_status.replace(/_/g," "):"submitted";
      const to=String(event.to_status||"").replace(/_/g," ");
      const when=new Date(event.created_at).toLocaleString();
      return '<li><b>'+escapeHtml(from)+' → '+escapeHtml(to)+'</b><small>'+escapeHtml(when)+' · '+escapeHtml(event.changed_by_name||"System")+'</small>'+(event.note?'<p>'+escapeHtml(event.note)+'</p>':'')+'</li>';
     }).join("")+'</ol></details>'
    :'<span class="muted">No history</span>';
   const action=currentUser&&currentUser.role==="admin"
    ?'<select class="request-status" data-id="'+escapeHtml(r.id)+'" data-current="'+escapeHtml(r.status)+'" aria-label="Update request status">'+options.map(s=>'<option value="'+s+'" '+(s===r.status?'selected':'')+'>'+s.replace(/_/g," ")+'</option>').join("")+'</select>'
    :'Admin only';
   return '<tr><td>'+escapeHtml(r.location_name)+'</td><td>'+escapeHtml(r.waste_category)+(r.notes?'<small class="request-note">'+escapeHtml(r.notes)+'</small>':'')+'</td><td>'+Number(r.quantity_kg).toFixed(2)+' kg</td><td><span class="request-pill '+escapeHtml(r.status)+'">'+escapeHtml(String(r.status).replace(/_/g," "))+'</span></td><td>'+new Date(r.created_at).toLocaleString()+'</td><td>'+history+'</td><td>'+action+'</td></tr>';
  }).join("");
  body.querySelectorAll(".request-status").forEach(select=>select.addEventListener("change",async()=>{
   const previous=select.dataset.current;
   select.disabled=true;
   $("#collectionMsg").textContent="Updating request…";
   try{
    await api("/api/collections",{method:"PATCH",body:JSON.stringify({id:select.dataset.id,status:select.value})});
    $("#collectionMsg").textContent="Status updated and added to request history.";
    await loadCollections();
   }catch(error){
    select.value=previous;
    $("#collectionMsg").textContent=error.message;
   }finally{select.disabled=false}
  }));
 }catch(error){$("#collectionRows").innerHTML='<tr><td colspan="7">'+escapeHtml(error.message)+'</td></tr>'}
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("#collectionForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const form=e.currentTarget,button=form.querySelector("button");
 const values=Object.fromEntries(new FormData(form));
 button.disabled=true;
 $("#collectionMsg").textContent="Submitting request…";
 try{
  await api("/api/collections",{method:"POST",body:JSON.stringify(values)});
  form.reset();
  await loadCollections();
  $("#collectionMsg").textContent="Collection request submitted. Its status history is now available below.";
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
