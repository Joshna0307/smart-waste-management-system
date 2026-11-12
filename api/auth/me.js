import jwt from "jsonwebtoken";
import { db, send } from "../db.js";

export default async function handler(req,res) {
  const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
  if(!token) return send(res,401,{error:"Not signed in"});
  if(!process.env.JWT_SECRET) return send(res,500,{error:"Session verification is temporarily unavailable."});
  let payload;
  try {
    payload=jwt.verify(token,process.env.JWT_SECRET);
  } catch {
    return send(res,401,{error:"Session expired. Please sign in again."});
  }
  try {
    const q=await db().query("SELECT id,name,email,role FROM users WHERE id=$1",[payload.id]);
    if(!q.rowCount) return send(res,401,{error:"Account not found"});
    return send(res,200,{user:q.rows[0]});
  } catch(error) {
    console.error("session check:",error);
    return send(res,503,{error:"Could not verify your session because the database is temporarily unavailable. Please try again."});
  }
}