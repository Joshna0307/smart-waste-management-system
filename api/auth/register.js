import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, send } from "../db.js";

export default async function handler(req,res) {
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed"});
  try {
    const {name,email,password,account_type}=req.body||{};
    const cleanName=String(name||"").trim();
    const cleanEmail=String(email||"").trim().toLowerCase();
    const cleanPassword=String(password||"");
    if(cleanName.length<2||cleanName.length>100||!/^\S+@\S+\.\S+$/.test(cleanEmail)||cleanEmail.length>254||cleanPassword.length<8||cleanPassword.length>72)
      return send(res,400,{error:"Enter your name, a valid email and a password of 8 to 72 characters."});
    const hash=await bcrypt.hash(cleanPassword,12);
    if(account_type==="worker") {
      const q=await db().query(
        "INSERT INTO users(name,email,password_hash,role,worker_verified) VALUES($1,$2,$3,'worker',FALSE) RETURNING id,name,email,role",
        [cleanName,cleanEmail,hash]
      );
      return send(res,201,{ok:true,pending_verification:true,message:"Worker registration submitted. Please wait for administrator verification.",user:q.rows[0]});
    }
    const q=await db().query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'user') RETURNING id,name,email,role",
      [cleanName,cleanEmail,hash]
    );
    const token=jwt.sign({id:q.rows[0].id,role:q.rows[0].role},process.env.JWT_SECRET,{expiresIn:"7d"});
    res.setHeader("Set-Cookie",`joy_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    return send(res,201,{ok:true,user:q.rows[0]});
  } catch(e) {
    if(e.code==="23505") return send(res,409,{error:"This email is already registered."});
    console.error("register:",e); return send(res,500,{error:"Could not create account."});
  }
}
