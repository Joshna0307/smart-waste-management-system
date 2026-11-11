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

async function greenCampusData(user,res) {
 const [impact,categories,monthly,points,leaderboard,products,sales,salesMonthly]=await Promise.all([
  db().query(`SELECT COALESCE(SUM(quantity_kg),0) AS total_kg,
   COALESCE(SUM(quantity_kg) FILTER (WHERE waste_category IN ('recyclable','reusable','craft') AND collection_status IN ('processed','transferred')),0) AS recycled_kg,
   COUNT(*)::int AS reports FROM waste_records`),
  db().query("SELECT waste_category,COALESCE(SUM(quantity_kg),0) AS quantity_kg FROM waste_records GROUP BY waste_category ORDER BY waste_category"),
  db().query(`SELECT TO_CHAR(date_trunc('month',recorded_at),'Mon YYYY') AS month_label,COALESCE(SUM(quantity_kg),0) AS quantity_kg FROM waste_records WHERE recorded_at>=date_trunc('month',CURRENT_DATE)-interval '11 months' GROUP BY date_trunc('month',recorded_at) ORDER BY date_trunc('month',recorded_at)`),
  db().query("SELECT COALESCE(SUM(points),0)::int AS points FROM green_points WHERE user_id=$1",[user.id]),
  db().query(`SELECT u.id,u.name,COALESCE(SUM(g.points),0)::int AS points FROM users u JOIN green_points g ON g.user_id=u.id WHERE u.role='user' GROUP BY u.id,u.name ORDER BY points DESC,u.name LIMIT 10`),
  db().query(`SELECT p.id,p.product_name,p.material_used,p.description,p.price,p.stock,p.image_url,COALESCE(SUM(s.quantity_sold),0)::int AS units_sold FROM craft_products p LEFT JOIN craft_sales s ON s.product_id=p.id ${user.role==="admin"?"":"WHERE p.stock>0"} GROUP BY p.id ORDER BY p.created_at DESC,p.id DESC LIMIT 100`),
  db().query("SELECT COALESCE(SUM(sale_amount),0) AS revenue,COALESCE(SUM(expense_amount),0) AS expenses,COALESCE(SUM(sale_amount-expense_amount),0) AS profit,COALESCE(SUM(quantity_sold),0)::int AS units_sold FROM craft_sales"),
  db().query(`SELECT TO_CHAR(date_trunc('month',sold_on),'Mon YYYY') AS month_label,COALESCE(SUM(sale_amount-expense_amount),0) AS profit FROM craft_sales WHERE sold_on>=date_trunc('month',CURRENT_DATE)-interval '5 months' GROUP BY date_trunc('month',sold_on) ORDER BY date_trunc('month',sold_on)`)
 ]);
 const stats=impact.rows[0],recycled=Number(stats.recycled_kg);
 return send(res,200,{impact:{...stats,recycled_kg:recycled,co2_saved_kg:Number((recycled*0.5).toFixed(2)),co2_factor_kg_per_kg:0.5},categories:categories.rows,monthly:monthly.rows,points:points.rows[0].points,leaderboard:leaderboard.rows,products:products.rows,sales:sales.rows[0],sales_monthly:salesMonthly.rows,campus:"JOY University"});
}
async function craftOrdersData(user,res) {
 const admin=user.role==='admin';
 const q=await db().query(`SELECT o.id,o.user_id,u.name AS student_name,o.product_id,p.product_name,o.quantity,o.unit_price,o.total_amount,o.payment_method,o.payment_status,o.status,o.created_at FROM craft_orders o JOIN users u ON u.id=o.user_id JOIN craft_products p ON p.id=o.product_id ${admin?'':'WHERE o.user_id=$1'} ORDER BY o.created_at DESC,o.id DESC LIMIT 200`,admin?[]:[user.id]);
 return send(res,200,{orders:q.rows});
}
async function placeCraftOrder(body,user,res) {
 const productId=validId(body.product_id),quantity=Number(body.quantity),method=String(body.payment_method||'');
 if(!productId||!Number.isInteger(quantity)||quantity<1||quantity>100||!['upi','card','net_banking','cash_on_pickup'].includes(method))return send(res,400,{error:'Choose a valid product, quantity and payment method.'});
 const client=await db().connect();
 try {
  await client.query('BEGIN');
  const found=await client.query('SELECT id,product_name,price,stock FROM craft_products WHERE id=$1 FOR UPDATE',[productId]);
  if(!found.rowCount){await client.query('ROLLBACK');return send(res,404,{error:'Craft product not found.'});}
  const p=found.rows[0],stock=Number(p.stock),price=Number(p.price);
  if(stock<quantity){await client.query('ROLLBACK');return send(res,409,{error:'Only '+stock+' item(s) are currently available.'});}
  const total=Number((price*quantity).toFixed(2)),paymentStatus=method==='cash_on_pickup'?'pay_on_pickup':'demo_pending';
  const order=await client.query("INSERT INTO craft_orders(user_id,product_id,quantity,unit_price,total_amount,payment_method,payment_status,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id,quantity,unit_price,total_amount,payment_method,payment_status,status,created_at",[user.id,p.id,quantity,price,total,method,paymentStatus]);
  await client.query('UPDATE craft_products SET stock=stock-$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[quantity,p.id]);
  await client.query('COMMIT');
  return send(res,201,{order:order.rows[0],product_name:p.product_name,remaining_stock:stock-quantity});
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
async function greenCampusAction(body,user,res) {
 if(body.action==="place_order"){if(user.role!=="user")return send(res,403,{error:"Student login is required."});return await placeCraftOrder(body,user,res);}
 if(user.role!=="admin")return send(res,403,{error:"Only JOY University administrators can manage the marketplace."});
 const clean=(v,max=160)=>typeof v==="string"?v.trim().slice(0,max):"";
 const valid=(v)=>/^[1-9][0-9]{0,17}$/.test(String(v??""))?String(v):null;
 if(body.action==="update_order_status"){
  const orderId=valid(body.order_id),status=clean(body.status,24);
  if(!orderId||!["confirmed","ready","completed","cancelled"].includes(status))return send(res,400,{error:"Choose a valid order and status."});
  const q=await db().query("UPDATE craft_orders SET status=$1 WHERE id=$2 RETURNING id,status",[status,orderId]);
  if(!q.rowCount)return send(res,404,{error:"Order not found."});
  return send(res,200,{order:q.rows[0]});
 }
 if(body.action==="add_product"){
  const name=clean(body.product_name),material=clean(body.material_used),description=clean(body.description,1000),price=Number(body.price),stock=Number(body.stock),image=clean(body.image_url,1000);
  if(!name||!material||!Number.isFinite(price)||price<0||price>10000000||!Number.isInteger(stock)||stock<0||stock>1000000)return send(res,400,{error:"Enter a product name, material, valid price and whole-number stock."});
  if(image&&!/^https:\/\//i.test(image))return send(res,400,{error:"Product image URL must use HTTPS."});
  const q=await db().query(`INSERT INTO craft_products(product_name,material_used,description,price,stock,image_url,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,product_name,material_used,description,price,stock,image_url`,[name,material,description||null,price,stock,image||null,user.id]);
  return send(res,201,{product:q.rows[0]});
 }
 if(body.action==="record_sale"){
  const productId=valid(body.product_id),quantity=Number(body.quantity_sold),expense=Number(body.expense_amount||0);
  if(!productId||!Number.isInteger(quantity)||quantity<1||quantity>100000||!Number.isFinite(expense)||expense<0||expense>10000000)return send(res,400,{error:"Choose a product, enter a valid quantity and non-negative total expense."});
  const client=await db().connect();
  try{
   await client.query("BEGIN");
   const found=await client.query("SELECT id,product_name,material_used,price,stock FROM craft_products WHERE id=$1 FOR UPDATE",[productId]);
   if(!found.rowCount){await client.query("ROLLBACK");return send(res,404,{error:"Marketplace product not found."});}
   const p=found.rows[0];if(Number(p.stock)<quantity){await client.query("ROLLBACK");return send(res,409,{error:"Sale quantity is greater than available stock."});}
   const revenue=Number(p.price)*quantity;
   const sale=await client.query(`INSERT INTO craft_sales(product_id,product_name,material_used,quantity_sold,sale_amount,expense_amount,sold_on,notes) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7) RETURNING id,quantity_sold,sale_amount,expense_amount,sold_on`,[p.id,p.product_name,p.material_used,quantity,revenue,expense,clean(body.notes,500)||null]);
   await client.query("UPDATE craft_products SET stock=stock-$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2",[quantity,p.id]);
   await client.query("COMMIT");return send(res,201,{sale:sale.rows[0],profit:Number((revenue-expense).toFixed(2))});
  }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
 }
 return send(res,400,{error:"Unknown marketplace action."});
}

export default async function handler(req,res) {
  if(!["GET","POST"].includes(req.method)) return send(res,405,{error:"Method not allowed"});
  const u=await getUser(req);
  if(!u) return send(res,401,{error:"Please sign in."});

  try {
    if(req.method==="GET") {
      if(req.query?.view==="green-campus") return await greenCampusData(u,res);
      if(req.query?.view==="craft-orders") return await craftOrdersData(u,res);
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
    if(["add_product","record_sale","place_order","update_order_status"].includes(body.action)) return await greenCampusAction(body,u,res);
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
