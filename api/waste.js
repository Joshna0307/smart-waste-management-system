import jwt from "jsonwebtoken";
import { db, send } from "./db.js";
async function user(req) {
 const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
 if(!token) return null;
 try { return jwt.verify(token,process.env.JWT_SECRET); } catch { return null; }
}
export default async function handler(req,res) {
 const u=await user(req); if(!u) return send(res,401,{error:"Please sign in"});
 try {
  if(req.method==="GET") {
   const r=await db().query(`SELECT w.id,w.waste_category,w.quantity_kg,w.collection_status,w.notes,w.recorded_at,l.location_name
   FROM waste_records w JOIN campus_locations l ON l.id=w.location_id ORDER BY w.recorded_at DESC LIMIT 200`);
   return send(res,200,{records:r.rows});
  }
  if(req.method==="POST") {
   const {location_id,waste_category,quantity_kg,notes}=req.body||{};
   const allowed=["biodegradable","recyclable","reusable","craft","residual","e_waste"];
   if(!location_id||!allowed.includes(waste_category)||!Number.isFinite(Number(quantity_kg))||Number(quantity_kg)<=0) return send(res,400,{error:"Enter a location, waste type and quantity greater than zero."});
   const r=await db().query("INSERT INTO waste_records(location_id,waste_category,quantity_kg,notes,recorded_by) VALUES($1,$2,$3,$4,$5) RETURNING *",[location_id,waste_category,quantity_kg,notes||null,u.id]);
   return send(res,201,{record:r.rows[0]});
  }
  return send(res,405,{error:"Method not allowed"});
 } catch(e) { console.error("waste:",e); return send(res,500,{error:"Could not load or save waste records."}); }
}
