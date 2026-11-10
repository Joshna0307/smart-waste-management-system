import jwt from "jsonwebtoken";
import { db, send } from "./db.js";
async function getUser(req){
 const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
 if(!token||!process.env.JWT_SECRET)return null;
 try{const payload=jwt.verify(token,process.env.JWT_SECRET);if(!payload?.id)return null;const result=await db().query("SELECT id,name,role FROM users WHERE id=$1",[payload.id]);return result.rows[0]||null}catch{return null}
}
function validId(v){const s=String(v??"").trim();return /^[1-9][0-9]{0,17}$/.test(s)?s:null}
export default async function handler(req,res){
 if(!["GET","PATCH"].includes(req.method))return send(res,405,{error:"Method not allowed"});
 const actor=await getUser(req);if(!actor)return send(res,401,{error:"Please sign in."});
 if(actor.role!=="admin")return send(res,403,{error:"Administrator access required."});
 try{
  if(req.method==="GET"){
   const [summary,categories,monthly,records,users]=await Promise.all([
    db().query(`SELECT
      (SELECT COUNT(*)::int FROM waste_records) AS waste_records,
      COALESCE((SELECT SUM(quantity_kg) FROM waste_records),0) AS total_kg,
      (SELECT COUNT(*)::int FROM collection_requests WHERE status IN ('pending','approved','assigned','proof_submitted','in_progress')) AS pending_requests,
      (SELECT COUNT(*)::int FROM collection_requests WHERE status IN ('collected','stored','processed','transferred')) AS completed_requests,
      (SELECT COUNT(*)::int FROM users) AS registered_users,
      COALESCE((SELECT SUM(quantity_kg) FROM waste_records WHERE waste_category IN ('recyclable','reusable','craft') OR collection_status IN ('processed','transferred')),0) AS recycled_kg`),
    db().query("SELECT waste_category,SUM(quantity_kg) AS quantity_kg FROM waste_records GROUP BY waste_category ORDER BY quantity_kg DESC"),
    db().query(`SELECT TO_CHAR(date_trunc('month',recorded_at),'Mon YYYY') AS month_label,SUM(quantity_kg) AS quantity_kg
      FROM waste_records WHERE recorded_at>=date_trunc('month',CURRENT_DATE)-interval '5 months'
      GROUP BY date_trunc('month',recorded_at) ORDER BY date_trunc('month',recorded_at)`),
    db().query(`SELECT w.id,w.waste_category,w.quantity_kg,w.collection_status,w.recorded_at,(w.image_data IS NOT NULL) AS has_image,
      l.location_name,COALESCE(u.name,'Former user') AS reporter_name FROM waste_records w
      JOIN campus_locations l ON l.id=w.location_id LEFT JOIN users u ON u.id=w.recorded_by ORDER BY w.recorded_at DESC,w.id DESC LIMIT 300`),
    db().query("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 500")
   ]);
   return send(res,200,{summary:summary.rows[0],categories:categories.rows,monthly:monthly.rows,records:records.rows,users:users.rows});
  }
  const body=req.body||{},userId=validId(body.user_id),role=String(body.role||"");
  if(!userId||!["user","admin","worker"].includes(role))return send(res,400,{error:"Choose a valid user, worker or administrator role."});
  if(String(actor.id)===userId&&role!=="admin")return send(res,400,{error:"You cannot remove your own administrator access."});
  const client=await db().connect();
  try{
   await client.query("BEGIN");
   const target=await client.query("SELECT id,role FROM users WHERE id=$1 FOR UPDATE",[userId]);
   if(!target.rowCount){await client.query("ROLLBACK");return send(res,404,{error:"User account not found."})}
   if(target.rows[0].role==="admin"&&role!=="admin"){
    const count=await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin'");
    if(Number(count.rows[0].count)<=1){await client.query("ROLLBACK");return send(res,409,{error:"At least one administrator account must remain."})}
   }
   const updated=await client.query("UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role",[role,userId]);
   await client.query("COMMIT");return send(res,200,{user:updated.rows[0]});
  }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
 }catch(error){console.error("admin:",error);return send(res,500,{error:"Could not load or update administrator data."})}
}
