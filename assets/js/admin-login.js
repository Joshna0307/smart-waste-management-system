const form=document.querySelector("#adminLoginForm");
const message=document.querySelector("#adminLoginMessage");
async function request(url,options={}){const response=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})},credentials:"same-origin"});const data=await response.json().catch(()=>({error:"Unexpected server response"}));if(!response.ok)throw new Error(data.error||"Request failed");return data}
form.addEventListener("submit",async event=>{
 event.preventDefault();
 const button=form.querySelector("button[type=submit]");
 button.disabled=true;message.textContent="Checking administrator account…";
 try{
  const values=Object.fromEntries(new FormData(form));
  const result=await request("/api/auth/login",{method:"POST",body:JSON.stringify(values)});
  if(result.user?.role!=="admin"){
   await request("/api/auth/logout",{method:"POST"});
   throw new Error("This account does not have administrator access. Please use the user login page.");
  }
  message.style.color="#176b47";message.textContent="Admin verified. Opening dashboard…";
  window.location.replace("/");
 }catch(error){message.style.color="#b13e36";message.textContent=error.message}
 finally{button.disabled=false}
});
(async()=>{
 try{const result=await request("/api/auth/me");if(result.user?.role==="admin")window.location.replace("/");}
 catch{}
})();