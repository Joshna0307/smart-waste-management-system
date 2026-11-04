import jwt from "jsonwebtoken";
import { db, send } from "./db.js";

async function getUser(req) {
  const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
  if(!token) return null;
  try { return jwt.verify(token,process.env.JWT_SECRET); } catch { return null; }
}

export default async function handler(req,res) {
  const u=await getUser(req);
  if(!u) return send(res,401,{error:"Please sign in."});
  try {
    await db().query(`CREATE TABLE IF NOT EXISTS collection_requests (
      id BIGSERIAL PRIMARY KEY,
      location_id BIGINT NOT NULL REFERENCES campus_locations(id),
      requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      waste_category VARCHAR(30) NOT NULL CHECK (waste_category IN ('biodegradable','recyclable','reusable','craft','residual','e_waste')),
      quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','in_progress','collected','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    if(req.method==="GET") {
      const admin=u.role==="admin";
      const r=await db().query(`SELECT c.id,c.waste_category,c.quantity_kg,c.notes,c.status,c.created_at,
        l.location_name,COALESCE(us.name,'Former user') AS requester_name
        FROM collection_requests c
        JOIN campus_locations l ON l.id=c.location_id
        LEFT JOIN users us ON us.id=c.requested_by
        ${admin?"":"WHERE c.requested_by=$1"}
        ORDER BY c.created_at DESC LIMIT 300`,admin?[]:[u.id]);
      return send(res,200,{requests:r.rows});
    }
    if(req.method==="POST") {
      const {location_id,waste_category,quantity_kg,notes}=req.body||{};
      const allowed=["biodegradable","recyclable","reusable","craft","residual","e_waste"];
      if(!location_id||!allowed.includes(waste_category)||!Number.isFinite(Number(quantity_kg))||Number(quantity_kg)<=0)
        return send(res,400,{error:"Choose a location and waste type, and enter a quantity greater than zero."});
      const r=await db().query(`INSERT INTO collection_requests(location_id,requested_by,waste_category,quantity_kg,notes)
        VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at`,
        [location_id,u.id,waste_category,quantity_kg,notes||null]);
      return send(res,201,{request:r.rows[0]});
    }
    if(req.method==="PATCH") {
      if(u.role!=="admin") return send(res,403,{error:"Only an administrator can update request status."});
      const {id,status}=req.body||{};
      const allowed=["pending","approved","in_progress","collected","rejected"];
      if(!id||!allowed.includes(status)) return send(res,400,{error:"Invalid request or status."});
      const r=await db().query("UPDATE collection_requests SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,status",[status,id]);
      if(!r.rowCount) return send(res,404,{error:"Collection request not found."});
      return send(res,200,{request:r.rows[0]});
    }
    return send(res,405,{error:"Method not allowed"});
  } catch(e) {
    console.error("collection requests:",e);
    return send(res,500,{error:"Could not process collection request."});
  }
}