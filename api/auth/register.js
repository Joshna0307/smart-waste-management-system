import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, send } from "../db.js";
export default async function handler(req,res) {
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed"});
  try {
    const {name,email,password}=req.body||{};
    if(!name||!email||!password||password.length<8) return send(res,400,{error:"Enter your name, valid email and a password of at least 8 characters."});
    const hash=await bcrypt.hash(password,12);
    const q=await db().query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'user') RETURNING id,name,email,role",[name.trim(),email.trim().toLowerCase(),hash]);
    const token=jwt.sign({id:q.rows[0].id,role:q.rows[0].role},process.env.JWT_SECRET,{expiresIn:"7d"});
    res.setHeader("Set-Cookie",`joy_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    return send(res,201,{ok:true,user:q.rows[0]});
  } catch(e) {
    if(e.code==="23505") return send(res,409,{error:"This email is already registered."});
    console.error("register:",e); return send(res,500,{error:"Could not create account."});
  }
}
