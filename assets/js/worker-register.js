const form=document.querySelector("#workerRegisterForm");
const message=document.querySelector("#workerRegisterMessage");
form.addEventListener("submit",async e=>{
  e.preventDefault();
  const button=form.querySelector("button");
  const values=Object.fromEntries(new FormData(form));
  if(values.password!==values.confirmPassword){message.textContent="Passwords do not match.";return;}
  button.disabled=true;message.style.color="#708078";message.textContent="Submitting registration…";
  try{
    const response=await fetch("/api/auth/register",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:values.name,email:values.email,password:values.password,account_type:"worker"})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Registration failed.");
    form.reset();message.style.color="#176b47";message.textContent=data.message||"Registration submitted. Wait for admin verification.";
  }catch(error){message.style.color="#b13e36";message.textContent=error.message;}
  finally{button.disabled=false;}
});
