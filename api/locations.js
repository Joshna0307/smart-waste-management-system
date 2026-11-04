import { db, send } from "./db.js";
export default async function handler(req,res) {
 if(req.method!=="GET") return send(res,405,{error:"Method not allowed"});
 try { const r=await db().query("SELECT id,location_code,location_name,location_type,is_high_priority FROM campus_locations ORDER BY location_name"); return send(res,200,{locations:r.rows}); }
 catch(e) { console.error("locations:",e); return send(res,500,{error:"Could not load campus locations."}); }
}
