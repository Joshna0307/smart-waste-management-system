import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, send } from "../db.js";
export default async function handler(req,res) {
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed"});
  try {
    const {email,password}=req.body||{};
    const q=await db().query("SELECT id,name,email,password_hash,role,worker_verified FROM users WHERE email=$1",[String(email||"").trim().toLowerCase()]);
    if(!q.rowCount||!(await bcrypt.compare(String(password||""),q.rows[0].password_hash))) return send(res,401,{error:"Invalid email or password."});
    const u=q.rows[0]; if(u.role==="worker"&&!u.worker_verified)return send(res,403,{error:"Your worker account is waiting for administrator verification. Please contact the admin."}); const token=jwt.sign({id:u.id,role:u.role},process.env.JWT_SECRET,{expiresIn:"7d"});
    res.setHeader("Set-Cookie",`joy_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    return send(res,200,{ok:true,user:{id:u.id,name:u.name,email:u.email,role:u.role}});
  } catch(e) { console.error("login:",e); return send(res,500,{error:"Login failed."}); }
}
