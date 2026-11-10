import jwt from "jsonwebtoken";
import { db, send } from "./db.js";
export default async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{error:"Method not allowed"});
 const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
 if(!token||!process.env.JWT_SECRET)return send(res,401,{error:"Please sign in."});
 try{
  const payload=jwt.verify(token,process.env.JWT_SECRET);
  const user=await db().query("SELECT id,role FROM users WHERE id=$1",[payload.id]);
  if(!user.rowCount||user.rows[0].role!=="admin")return send(res,403,{error:"Administrator access required."});
  const id=String(req.query?.id||"");
  if(!/^[1-9][0-9]{0,17}$/.test(id))return send(res,400,{error:"Invalid request."});
  const q=await db().query("SELECT proof_image_data,proof_image_name FROM collection_requests WHERE id=$1",[id]);
  if(!q.rowCount||!q.rows[0].proof_image_data)return send(res,404,{error:"Proof image not found."});
  const match=q.rows[0].proof_image_data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if(!match)return send(res,404,{error:"Proof image is invalid."});
  res.setHeader("Content-Type",match[1]);res.setHeader("Content-Disposition",'inline; filename="'+String(q.rows[0].proof_image_name||"proof.jpg").replace(/["\\\\]/g,"")+'"');res.setHeader("Cache-Control","private, no-store");
  return res.status(200).send(Buffer.from(match[2],"base64"));
 }catch(e){return send(res,401,{error:"Session expired."})}
}
