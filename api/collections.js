import jwt from "jsonwebtoken";
import { db, send } from "./db.js";

const STATUSES = ["pending","approved","assigned","proof_submitted","in_progress","collected","stored","processed","transferred","rejected"];

async function getUser(req) {
  const token=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("joy_session="))?.slice(12);
  if(!token || !process.env.JWT_SECRET) return null;
  try {
    const payload=jwt.verify(token,process.env.JWT_SECRET);
    if(!payload?.id) return null;
    const result=await db().query("SELECT id,name,role FROM users WHERE id=$1",[payload.id]);
    return result.rows[0] || null;
  } catch { return null; }
}
function validId(value) {
  const id=String(value ?? "").trim();
  return /^[1-9][0-9]{0,17}$/.test(id) ? id : null;
}
function recordStatusForRequest(status) {
  if(status==="approved") return "assigned";
  if(status==="proof_submitted") return "in_progress";
  if(status==="rejected") return "pending";
  return status;
}
export default async function handler(req,res) {
  if(!["GET","POST","PATCH"].includes(req.method)) return send(res,405,{error:"Method not allowed"});
  const u=await getUser(req);
  if(!u) return send(res,401,{error:"Please sign in."});
  try {
    if(req.method==="GET") {
      if(u.role==="worker") return send(res,403,{error:"Workers should use the Worker Dashboard."});
      const isAdmin=u.role==="admin";
      const [requests,availableRecords,workers]=await Promise.all([
        db().query(`
          SELECT c.id,c.waste_record_id,c.waste_category,c.quantity_kg,c.notes,c.status,c.created_at,c.updated_at,
            c.assigned_worker_id,c.assigned_at,c.proof_image_name,c.proof_submitted_at,
            (c.proof_image_data IS NOT NULL) AS has_proof,
            l.location_name,COALESCE(requester.name,'Former user') AS requester_name,
            worker.name AS worker_name,worker.email AS worker_email,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id',ev.id,'from_status',ev.from_status,'to_status',ev.to_status,'note',ev.note,
                'created_at',ev.created_at,'changed_by_name',COALESCE(actor.name,'Former user')
              ) ORDER BY ev.created_at,ev.id)
              FROM collection_request_events ev LEFT JOIN users actor ON actor.id=ev.changed_by
              WHERE ev.request_id=c.id
            ),'[]'::json) AS history
          FROM collection_requests c
          JOIN campus_locations l ON l.id=c.location_id
          LEFT JOIN users requester ON requester.id=c.requested_by
          LEFT JOIN users worker ON worker.id=c.assigned_worker_id
          WHERE ($1::boolean OR c.requested_by=$2)
          ORDER BY c.created_at DESC,c.id DESC LIMIT 300
        `,[isAdmin,u.id]),
        db().query(`
          SELECT w.id,w.location_id,w.waste_category,w.quantity_kg,w.collection_status,w.recorded_at,l.location_name
          FROM waste_records w JOIN campus_locations l ON l.id=w.location_id
          WHERE ($1::boolean OR w.recorded_by=$2) AND w.collection_status='pending'
            AND NOT EXISTS (SELECT 1 FROM collection_requests c WHERE c.waste_record_id=w.id
              AND c.status NOT IN ('collected','stored','processed','transferred','rejected'))
          ORDER BY w.recorded_at DESC,w.id DESC LIMIT 200
        `,[isAdmin,u.id]),
        isAdmin ? db().query("SELECT id,name,email FROM users WHERE role='worker' ORDER BY name") : Promise.resolve({rows:[]})
      ]);
      return send(res,200,{requests:requests.rows,available_records:availableRecords.rows,workers:workers.rows});
    }
    if(req.method==="POST") {
      if(u.role==="worker") return send(res,403,{error:"Workers cannot create collection requests."});
      const body=req.body||{};
      const wasteRecordId=body.waste_record_id ? validId(body.waste_record_id) : null;
      const notes=body.notes==null ? null : (typeof body.notes==="string" ? body.notes.trim() : null);
      if((body.waste_record_id && !wasteRecordId) || (body.notes!=null && typeof body.notes!=="string") || (notes&&notes.length>1000))
        return send(res,400,{error:"Check the selected waste record and keep pickup notes under 1000 characters."});
      const client=await db().connect();
      try {
        await client.query("BEGIN");
        let locationId,category,quantity;
        if(wasteRecordId) {
          const recordResult=await client.query("SELECT id,location_id,waste_category,quantity_kg,collection_status,recorded_by FROM waste_records WHERE id=$1 FOR UPDATE",[wasteRecordId]);
          if(!recordResult.rowCount){await client.query("ROLLBACK");return send(res,404,{error:"Waste record not found."});}
          const record=recordResult.rows[0];
          if(u.role!=="admin" && String(record.recorded_by)!==String(u.id)){await client.query("ROLLBACK");return send(res,404,{error:"Waste record not found."});}
          if(record.collection_status!=="pending"){await client.query("ROLLBACK");return send(res,409,{error:"This waste record is no longer waiting for collection."});}
          locationId=record.location_id;category=record.waste_category;quantity=Number(record.quantity_kg);
          const active=await client.query("SELECT id FROM collection_requests WHERE waste_record_id=$1 AND status NOT IN ('collected','stored','processed','transferred','rejected') LIMIT 1",[wasteRecordId]);
          if(active.rowCount){await client.query("ROLLBACK");return send(res,409,{error:"A collection request is already active for this waste record."});}
        } else {
          locationId=validId(body.location_id);category=String(body.waste_category||"");
          const rawQuantity=String(body.quantity_kg??"").trim();quantity=Number(rawQuantity);
          const categories=["biodegradable","recyclable","reusable","craft","residual","e_waste"];
          if(!locationId||!categories.includes(category)||!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(rawQuantity)||!Number.isFinite(quantity)||quantity<=0||quantity>100000){
            await client.query("ROLLBACK");return send(res,400,{error:"Choose a campus location and waste category, and enter a quantity greater than 0 kg."});
          }
          const location=await client.query("SELECT id FROM campus_locations WHERE id=$1",[locationId]);
          if(!location.rowCount){await client.query("ROLLBACK");return send(res,400,{error:"That campus location does not exist."});}
        }
        const inserted=await client.query("INSERT INTO collection_requests(waste_record_id,location_id,requested_by,waste_category,quantity_kg,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,waste_record_id,status,created_at",[wasteRecordId,locationId,u.id,category,quantity,notes||null]);
        const request=inserted.rows[0];
        await client.query("INSERT INTO collection_request_events(request_id,changed_by,from_status,to_status,note) VALUES($1,$2,NULL,'pending',$3)",[request.id,u.id,wasteRecordId?"Collection requested for waste record #"+wasteRecordId:"Direct campus collection request"]);
        await client.query("COMMIT");return send(res,201,{request});
      } catch(error){await client.query("ROLLBACK");if(error.code==="23505")return send(res,409,{error:"A collection request is already active for this waste record."});throw error;}
      finally{client.release();}
    }
    if(req.method==="PATCH") {
      if(u.role!=="admin") return send(res,403,{error:"Only an administrator can assign workers or approve collection proof."});
      const body=req.body||{},requestId=validId(body.id);
      if(!requestId)return send(res,400,{error:"Provide a valid request ID."});
      const client=await db().connect();
      try{
        await client.query("BEGIN");
        const current=await client.query("SELECT id,status,waste_record_id,assigned_worker_id,proof_image_data FROM collection_requests WHERE id=$1 FOR UPDATE",[requestId]);
        if(!current.rowCount){await client.query("ROLLBACK");return send(res,404,{error:"Collection request not found."});}
        const row=current.rows[0],previous=row.status;
        if(Object.prototype.hasOwnProperty.call(body,"assigned_worker_id")){
          const workerId=body.assigned_worker_id===null||body.assigned_worker_id===""?null:validId(body.assigned_worker_id);
          if(body.assigned_worker_id!==null&&body.assigned_worker_id!==""&&!workerId){await client.query("ROLLBACK");return send(res,400,{error:"Choose a valid worker."});}
          if(workerId){
            const worker=await client.query("SELECT id FROM users WHERE id=$1 AND role='worker'",[workerId]);
            if(!worker.rowCount){await client.query("ROLLBACK");return send(res,400,{error:"That account is not an active worker."});}
          }
          if(["proof_submitted","collected","stored","processed","transferred","rejected"].includes(previous)){
            await client.query("ROLLBACK");return send(res,409,{error:"This request can no longer be reassigned."});
          }
          const next=workerId?"assigned":"pending";
          await client.query("UPDATE collection_requests SET assigned_worker_id=$1,assigned_at=CASE WHEN $1::bigint IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3",[workerId,next,requestId]);
          if(row.waste_record_id)await client.query("UPDATE waste_records SET collection_status=$1 WHERE id=$2",[workerId?"assigned":"pending",row.waste_record_id]);
          await client.query("INSERT INTO collection_request_events(request_id,changed_by,from_status,to_status,note) VALUES($1,$2,$3,$4,$5)",[requestId,u.id,previous,next,workerId?"Assigned to worker #"+workerId:"Worker assignment removed"]);
          await client.query("COMMIT");return send(res,200,{request:{id:requestId,status:next,assigned_worker_id:workerId}});
        }
        const nextStatus=String(body.status||"");
        const note=body.admin_note==null?null:(typeof body.admin_note==="string"?body.admin_note.trim():null);
        if(!STATUSES.includes(nextStatus)||(body.admin_note!=null&&typeof body.admin_note!=="string")||(note&&note.length>500)){
          await client.query("ROLLBACK");return send(res,400,{error:"Provide a valid status and an optional admin note under 500 characters."});
        }
        if(nextStatus==="collected"&&(previous!=="proof_submitted"||!row.proof_image_data)){
          await client.query("ROLLBACK");return send(res,409,{error:"A worker must submit collection photo proof before you can mark this request Collected."});
        }
        if(nextStatus==="assigned"||nextStatus==="proof_submitted"){
          await client.query("ROLLBACK");return send(res,400,{error:"Use worker assignment and worker photo submission for these stages."});
        }
        if(previous===nextStatus){await client.query("COMMIT");return send(res,200,{request:{id:requestId,status:previous},unchanged:true});}
        const updated=await client.query("UPDATE collection_requests SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,status,updated_at",[nextStatus,requestId]);
        if(row.waste_record_id)await client.query("UPDATE waste_records SET collection_status=$1 WHERE id=$2",[recordStatusForRequest(nextStatus),row.waste_record_id]);
        await client.query("INSERT INTO collection_request_events(request_id,changed_by,from_status,to_status,note) VALUES($1,$2,$3,$4,$5)",[requestId,u.id,previous,nextStatus,note||null]);
        await client.query("COMMIT");return send(res,200,{request:updated.rows[0]});
      }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    }
  }catch(error){console.error("collection requests:",error);return send(res,500,{error:"Could not process collection request."});}
}
