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
  await db().query("ALTER TABLE waste_records ADD COLUMN IF NOT EXISTS image_data BYTEA, ADD COLUMN IF NOT EXISTS image_mime VARCHAR(40), ADD COLUMN IF NOT EXISTS image_name VARCHAR(255)");
  if(req.method==="GET") {
   const r=await db().query("SELECT w.id,w.waste_category,w.quantity_kg,w.collection_status,w.notes,w.recorded_at,(w.image_data IS NOT NULL) AS has_image,l.location_name FROM waste_records w JOIN campus_locations l ON l.id=w.location_id ORDER BY w.recorded_at DESC LIMIT 200");
   return send(res,200,{records:r.rows});
  }
  if(req.method==="POST") {
   const {location_id,waste_category,quantity_kg,notes,image_data,image_name}=req.body||{};
   const allowed=["biodegradable","recyclable","reusable","craft","residual","e_waste"];
   if(!location_id||!allowed.includes(waste_category)||!Number.isFinite(Number(quantity_kg))||Number(quantity_kg)<=0) return send(res,400,{error:"Enter a location, waste type and quantity greater than zero."});
   let bytes=null,mime=null,name=null;
   if(image_data) {
    const match=typeof image_data==="string"&&image_data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(!match) return send(res,400,{error:"Upload a valid JPG, PNG or WEBP image."});
    bytes=Buffer.from(match[2],"base64");
    if(bytes.length>2*1024*1024) return send(res,413,{error:"Image must be 2 MB or smaller."});
    const valid={"image/jpeg":bytes[0]===255&&bytes[1]===216,"image/png":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),"image/webp":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"};
    if(!valid[match[1]]) return send(res,400,{error:"Image content does not match its file type."});
    mime=match[1]; name=String(image_name||"report-image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,255);
   }
   const r=await db().query("INSERT INTO waste_records(location_id,waste_category,quantity_kg,notes,recorded_by,image_data,image_mime,image_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,waste_category,quantity_kg,collection_status,recorded_at",[location_id,waste_category,quantity_kg,notes||null,u.id,bytes,mime,name]);
   return send(res,201,{record:r.rows[0]});
  }
  return send(res,405,{error:"Method not allowed"});
 } catch(e) { console.error("waste:",e); return send(res,500,{error:"Could not load or save waste records."}); }
}