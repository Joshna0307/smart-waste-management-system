import jwt from "jsonwebtoken";
import { db, send } from "./db.js";

const CATEGORIES = ["biodegradable","recyclable","reusable","craft","residual","e_waste"];
const STATUSES = ["pending","approved","in_progress","collected","rejected"];

async function getUser(req) {
  const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
  if(!token) return null;
  try {
    const payload=jwt.verify(token,process.env.JWT_SECRET);
    if(!payload?.id) return null;
    // Read the current role from PostgreSQL so a stale JWT cannot retain admin access.
    const result=await db().query("SELECT id,name,role FROM users WHERE id=$1",[payload.id]);
    return result.rows[0] || null;
  } catch { return null; }
}

function validId(value) {
  const id=String(value ?? "").trim();
  return /^[1-9][0-9]{0,17}$/.test(id) ? id : null;
}

function validQuantity(value) {
  const raw=String(value ?? "").trim();
  if(!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(raw)) return null;
  const quantity=Number(raw);
  return Number.isFinite(quantity) && quantity>0 && quantity<=100000 ? quantity : null;
}

export default async function handler(req,res) {
  if(!["GET","POST","PATCH"].includes(req.method)) return send(res,405,{error:"Method not allowed"});
  const u=await getUser(req);
  if(!u) return send(res,401,{error:"Please sign in."});

  try {
    if(req.method==="GET") {
      const isAdmin=u.role==="admin";
      const result=await db().query(`
        SELECT c.id,c.waste_category,c.quantity_kg,c.notes,c.status,c.created_at,c.updated_at,
          l.location_name,COALESCE(requester.name,'Former user') AS requester_name,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id',ev.id,
              'from_status',ev.from_status,
              'to_status',ev.to_status,
              'note',ev.note,
              'created_at',ev.created_at,
              'changed_by_name',COALESCE(actor.name,'Former user')
            ) ORDER BY ev.created_at,ev.id)
            FROM collection_request_events ev
            LEFT JOIN users actor ON actor.id=ev.changed_by
            WHERE ev.request_id=c.id
          ),'[]'::json) AS history
        FROM collection_requests c
        JOIN campus_locations l ON l.id=c.location_id
        LEFT JOIN users requester ON requester.id=c.requested_by
        WHERE ($1::boolean OR c.requested_by=$2)
        ORDER BY c.created_at DESC,c.id DESC
        LIMIT 300
      `,[isAdmin,u.id]);
      return send(res,200,{requests:result.rows});
    }

    if(req.method==="POST") {
      const body=req.body||{};
      const locationId=validId(body.location_id);
      const quantity=validQuantity(body.quantity_kg);
      const category=String(body.waste_category||"");
      const notes=body.notes==null ? null : (typeof body.notes==="string" ? body.notes.trim() : null);
      if(!locationId || !CATEGORIES.includes(category) || quantity===null || (body.notes!=null && typeof body.notes!=="string") || (notes&&notes.length>1000)) {
        return send(res,400,{error:"Choose a valid campus location and waste type, enter a quantity from 0.01 to 100000 kg (up to 2 decimals), and keep notes under 1000 characters."});
      }
      const location=await db().query("SELECT id FROM campus_locations WHERE id=$1",[locationId]);
      if(!location.rowCount) return send(res,400,{error:"That campus location does not exist."});

      const client=await db().connect();
      try {
        await client.query("BEGIN");
        const inserted=await client.query(
          "INSERT INTO collection_requests(location_id,requested_by,waste_category,quantity_kg,notes) VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at",
          [locationId,u.id,category,quantity,notes||null]
        );
        const request=inserted.rows[0];
        await client.query(
          "INSERT INTO collection_request_events(request_id,changed_by,from_status,to_status,note) VALUES($1,$2,NULL,'pending','Request submitted')",
          [request.id,u.id]
        );
        await client.query("COMMIT");
        return send(res,201,{request});
      } catch(error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    if(req.method==="PATCH") {
      if(u.role!=="admin") return send(res,403,{error:"Only an administrator can update request status."});
      const body=req.body||{};
      const requestId=validId(body.id);
      const nextStatus=String(body.status||"");
      const note=body.admin_note==null ? null : (typeof body.admin_note==="string" ? body.admin_note.trim() : null);
      if(!requestId || !STATUSES.includes(nextStatus) || (body.admin_note!=null && typeof body.admin_note!=="string") || (note&&note.length>500)) {
        return send(res,400,{error:"Provide a valid request ID, status, and an optional note under 500 characters."});
      }

      const client=await db().connect();
      try {
        await client.query("BEGIN");
        const current=await client.query("SELECT id,status FROM collection_requests WHERE id=$1 FOR UPDATE",[requestId]);
        if(!current.rowCount) {
          await client.query("ROLLBACK");
          return send(res,404,{error:"Collection request not found."});
        }
        const previous=current.rows[0].status;
        if(previous===nextStatus) {
          await client.query("COMMIT");
          return send(res,200,{request:{id:requestId,status:previous},unchanged:true});
        }
        const updated=await client.query(
          "UPDATE collection_requests SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,status,updated_at",
          [nextStatus,requestId]
        );
        await client.query(
          "INSERT INTO collection_request_events(request_id,changed_by,from_status,to_status,note) VALUES($1,$2,$3,$4,$5)",
          [requestId,u.id,previous,nextStatus,note||null]
        );
        await client.query("COMMIT");
        return send(res,200,{request:updated.rows[0]});
      } catch(error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } catch(error) {
    console.error("collection requests:",error);
    return send(res,500,{error:"Could not process collection request."});
  }
}