import jwt from "jsonwebtoken";
import { db, send } from "./db.js";

const CATEGORIES=["biodegradable","recyclable","reusable","craft","residual","e_waste"];

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

export default async function handler(req,res) {
  if(!["GET","POST"].includes(req.method)) return send(res,405,{error:"Method not allowed"});
  const u=await getUser(req);
  if(!u) return send(res,401,{error:"Please sign in."});

  try {
    if(req.method==="GET") {
      const result=await db().query(`
        SELECT w.id,w.waste_category,w.quantity_kg,w.collection_status,w.notes,w.recorded_at,
          (w.image_data IS NOT NULL) AS has_image,l.location_name
        FROM waste_records w
        JOIN campus_locations l ON l.id=w.location_id
        WHERE ($1::boolean OR w.recorded_by=$2)
        ORDER BY w.recorded_at DESC,w.id DESC
        LIMIT 200
      `,[u.role==="admin",u.id]);
      return send(res,200,{records:result.rows});
    }

    const body=req.body||{};
    const locationId=validId(body.location_id);
    const category=String(body.waste_category||"");
    const rawQuantity=body.quantity_kg==null||String(body.quantity_kg).trim()===""?"0":String(body.quantity_kg).trim();
    const quantity=Number(rawQuantity);
    const notes=body.notes==null ? null : (typeof body.notes==="string" ? body.notes.trim() : null);
    if(!locationId || !CATEGORIES.includes(category) || !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(rawQuantity) ||
      !Number.isFinite(quantity) || quantity<0 || quantity>100000 ||
      (body.notes!=null && typeof body.notes!=="string") || (notes&&notes.length>1000)) {
      return send(res,400,{error:"Choose a location and waste category, and keep notes under 1000 characters."});
    }
    const location=await db().query("SELECT id FROM campus_locations WHERE id=$1",[locationId]);
    if(!location.rowCount) return send(res,400,{error:"That campus location does not exist."});

    let bytes=null,mime=null,name=null;
    if(body.image_data) {
      const match=typeof body.image_data==="string" && body.image_data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if(!match) return send(res,400,{error:"Upload a valid JPG, PNG or WEBP image."});
      bytes=Buffer.from(match[2],"base64");
      if(bytes.length>2*1024*1024) return send(res,413,{error:"Image must be 2 MB or smaller."});
      const valid={
        "image/jpeg":bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255,
        "image/png":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
        "image/webp":bytes.length>=12 && bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP"
      };
      if(!valid[match[1]]) return send(res,400,{error:"Image content does not match its file type."});
      mime=match[1];
      name=String(body.image_name||"report-image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,255);
    }

    const result=await db().query(
      "INSERT INTO waste_records(location_id,waste_category,quantity_kg,notes,recorded_by,image_data,image_mime,image_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,waste_category,quantity_kg,collection_status,recorded_at",
      [locationId,category,quantity,notes||null,u.id,bytes,mime,name]
    );
    return send(res,201,{record:result.rows[0]});
  } catch(error) {
    console.error("waste:",error);
    return send(res,500,{error:"Could not load or save waste records."});
  }
}
