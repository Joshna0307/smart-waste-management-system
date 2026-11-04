import jwt from "jsonwebtoken";
import { db, send } from "./db.js";
export default async function handler(req,res) {
 const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
 let u=null; try { if(token) u=jwt.verify(token,process.env.JWT_SECRET); } catch {}
 if(!u) return send(res,401,{error:"Please sign in."});
 if(req.method!=="GET") return send(res,405,{error:"Method not allowed"});
 try {
  const id=String(req.query?.id||""); if(!/^\d+$/.test(id)) return send(res,400,{error:"Invalid report ID."});
  const r=await db().query("SELECT image_data,image_mime,image_name,recorded_by FROM waste_records WHERE id=$1",[id]);
  if(!r.rowCount||!r.rows[0].image_data) return send(res,404,{error:"Report image not found."});
  const row=r.rows[0]; if(u.role!=="admin"&&String(row.recorded_by)!==String(u.id)) return send(res,403,{error:"You cannot view this report image."});
  res.status(200); res.setHeader("Content-Type",row.image_mime);
  res.setHeader("Content-Disposition",'inline; filename="' + String(row.image_name||"report-image").replace(/["\\\\]/g,"_") + '"');
  res.setHeader("Cache-Control","private, no-store"); return res.end(row.image_data);
 } catch(e) { console.error("report image:",e); return send(res,500,{error:"Could not load report image."}); }
}