import jwt from "jsonwebtoken";
import { db, send } from "./db.js";

async function getUser(req){
 const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
 if(!token||!process.env.JWT_SECRET)return null;
 try{const p=jwt.verify(token,process.env.JWT_SECRET);if(!p?.id)return null;const q=await db().query("SELECT id,name,email,role FROM users WHERE id=$1",[p.id]);return q.rows[0]||null}catch{return null}
}
function validId(v){const s=String(v??"").trim();return /^[1-9][0-9]{0,17}$/.test(s)?s:null}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return send(res,405,{error:"Method not allowed"});
 const user=await getUser(req);if(!user)return send(res,401,{error:"Please sign in."});
 try{
  if(req.method==="GET" && req.query?.proof){
   if(user.role!=="admin")return send(res,403,{error:"Administrator access required."});
   const proofId=String(req.query.proof||"");
   if(!/^[1-9][0-9]{0,17}$/.test(proofId))return send(res,400,{error:"Invalid request."});
   const proof=await db().query("SELECT proof_image_data,proof_image_name FROM collection_requests WHERE id=$1",[proofId]);
   if(!proof.rowCount||!proof.rows[0].proof_image_data)return send(res,404,{error:"Proof image not found."});
   const match=proof.rows[0].proof_image_data.match(/^data:(image\\/(?:jpeg|png|webp));base64,(.+)$/);
   if(!match)return send(res,404,{error:"Proof image is invalid."});
   res.setHeader("Content-Type",match[1]);
   res.setHeader("Content-Disposition",'inline; filename="'+String(proof.rows[0].proof_image_name||"proof.jpg").replace(/["\\\\]/g,"")+'"');
   res.setHeader("Cache-Control","private, no-store");
   return res.status(200).send(Buffer.from(match[2],"base64"));
  }
  if(req.method==="GET"){
   if(user.role!=="worker")return send(res,403,{error:"Worker access required."});
   const q=await db().query(`SELECT c.id,c.waste_category,c.quantity_kg,c.notes,c.status,c.created_at,c.assigned_at,c.proof_submitted_at,
    c.proof_image_name,l.location_name,l.location_code,COALESCE(u.name,'Campus user') AS requester_name
    FROM collection_requests c JOIN campus_locations l ON l.id=c.location_id
    LEFT JOIN users u ON u.id=c.requested_by
    WHERE c.assigned_worker_id=$1 AND c.status IN ('assigned','in_progress','proof_submitted')
    ORDER BY c.assigned_at DESC,c.id DESC`,[user.id]);
   return send(res,200,{worker:user,jobs:q.rows});
  }
  if(user.role!=="worker")return send(res,403,{error:"Worker access required."});
  const body=req.body||{},id=validId(body.id),image=body.proof_image_data,name=String(body.proof_image_name||"collection-proof.jpg").slice(0,255);
  if(!id||typeof image!=="string"||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>1800000)
   return send(res,400,{error:"Upload a JPG, PNG or WEBP collection photo under 1.3 MB."});
  const client=await db().connect();
  try{
   await client.query("BEGIN");
   const current=await client.query("SELECT id,status FROM collection_requests WHERE id=$1 AND assigned_worker_id=$2 FOR UPDATE",[id,user.id]);
   if(!current.rowCount){await client.query("ROLLBACK");return send(res,404,{error:"This job is not assigned to your account."});}
   if(!["assigned","in_progress"].includes(current.rows[0].status)){await client.query("ROLLBACK");return send(res,409,{error:"This job is not waiting for collection proof."});}
   await client.query("UPDATE collection_requests SET status='proof_submitted',proof_image_data=$1,proof_image_name=$2,proof_submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$3",[image,name,id]);
   await client.query("INSERT INTO collection_request_events(request_id,changed_by,from_status,to_status,note) VALUES($1,$2,$3,'proof_submitted',$4)",[id,user.id,current.rows[0].status,"Worker submitted collection photo: "+name]);
   await client.query("COMMIT");return send(res,200,{ok:true,status:"proof_submitted"});
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
 }catch(e){console.error("worker:",e);return send(res,500,{error:"Could not process worker request."})}
}
