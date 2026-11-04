import { db, send } from "./db.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return send(res,405,{error:"Method not allowed"});
  try {
    const r = await db().query("SELECT current_database() AS database, NOW() AS server_time");
    return send(res,200,{ok:true,database:r.rows[0].database,serverTime:r.rows[0].server_time});
  } catch (e) {
    console.error("health check:",e);
    return send(res,500,{ok:false,error:"Database connection failed. Check DATABASE_URL and Neon availability."});
  }
}
