import jwt from "jsonwebtoken";
import { db, send } from "./db.js";

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
const clean=(v,max=160)=>typeof v==="string"?v.trim().slice(0,max):"";
const validId=v=>/^[1-9][0-9]{0,17}$/.test(String(v??""))?String(v):null;

export default async function handler(req,res) {
  if(!["GET","POST"].includes(req.method)) return send(res,405,{error:"Method not allowed"});
  const user=await getUser(req);
  if(!user) return send(res,401,{error:"Please sign in."});
  try {
    if(req.method==="GET") {
      const [impact,categories,monthly,points,leaderboard,products,sales,salesMonthly]=await Promise.all([
        db().query(`SELECT
          COALESCE(SUM(quantity_kg),0) AS total_kg,
          COALESCE(SUM(quantity_kg) FILTER (WHERE waste_category IN ('recyclable','reusable','craft') AND collection_status IN ('processed','transferred')),0) AS recycled_kg,
          COUNT(*)::int AS reports
          FROM waste_records`),
        db().query("SELECT waste_category,COALESCE(SUM(quantity_kg),0) AS quantity_kg FROM waste_records GROUP BY waste_category ORDER BY waste_category"),
        db().query(`SELECT TO_CHAR(date_trunc('month',recorded_at),'Mon YYYY') AS month_label,
          COALESCE(SUM(quantity_kg),0) AS quantity_kg FROM waste_records
          WHERE recorded_at>=date_trunc('month',CURRENT_DATE)-interval '11 months'
          GROUP BY date_trunc('month',recorded_at) ORDER BY date_trunc('month',recorded_at)`),
        db().query("SELECT COALESCE(SUM(points),0)::int AS points FROM green_points WHERE user_id=$1",[user.id]),
        db().query(`SELECT u.id,u.name,COALESCE(SUM(g.points),0)::int AS points
          FROM users u JOIN green_points g ON g.user_id=u.id
          WHERE u.role='user' GROUP BY u.id,u.name ORDER BY points DESC,u.name LIMIT 10`),
        db().query(`SELECT p.id,p.product_name,p.material_used,p.description,p.price,p.stock,p.image_url,
          COALESCE(SUM(s.quantity_sold),0)::int AS units_sold
          FROM craft_products p LEFT JOIN craft_sales s ON s.product_id=p.id
          ${user.role==="admin"?"":"WHERE p.stock>0"}
          GROUP BY p.id ORDER BY p.created_at DESC,p.id DESC LIMIT 100`),
        db().query("SELECT COALESCE(SUM(sale_amount),0) AS revenue,COALESCE(SUM(expense_amount),0) AS expenses,COALESCE(SUM(sale_amount-expense_amount),0) AS profit,COALESCE(SUM(quantity_sold),0)::int AS units_sold FROM craft_sales"),
        db().query(`SELECT TO_CHAR(date_trunc('month',sold_on),'Mon YYYY') AS month_label,
          COALESCE(SUM(sale_amount-expense_amount),0) AS profit
          FROM craft_sales WHERE sold_on>=date_trunc('month',CURRENT_DATE)-interval '5 months'
          GROUP BY date_trunc('month',sold_on) ORDER BY date_trunc('month',sold_on)`)
      ]);
      const stats=impact.rows[0],recycled=Number(stats.recycled_kg);
      return send(res,200,{
        impact:{...stats,recycled_kg:recycled,co2_saved_kg:Number((recycled*0.5).toFixed(2)),co2_factor_kg_per_kg:0.5},
        categories:categories.rows,monthly:monthly.rows,points:points.rows[0].points,
        leaderboard:leaderboard.rows,products:products.rows,sales:sales.rows[0],sales_monthly:salesMonthly.rows,
        campus:"JOY University"
      });
    }
    if(user.role!=="admin") return send(res,403,{error:"Only JOY University administrators can manage the marketplace."});
    const body=req.body||{};
    if(body.action==="add_product") {
      const name=clean(body.product_name),material=clean(body.material_used),description=clean(body.description,1000);
      const price=Number(body.price),stock=Number(body.stock);
      const image=clean(body.image_url,1000);
      if(!name||!material||!Number.isFinite(price)||price<0||price>10000000||!Number.isInteger(stock)||stock<0||stock>1000000)
        return send(res,400,{error:"Enter a product name, material, valid price and whole-number stock."});
      if(image && !/^https:\/\//i.test(image)) return send(res,400,{error:"Product image URL must use HTTPS."});
      const q=await db().query(`INSERT INTO craft_products(product_name,material_used,description,price,stock,image_url,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,product_name,material_used,description,price,stock,image_url`,
        [name,material,description||null,price,stock,image||null,user.id]);
      return send(res,201,{product:q.rows[0]});
    }
    if(body.action==="record_sale") {
      const productId=validId(body.product_id),quantity=Number(body.quantity_sold),expense=Number(body.expense_amount||0);
      if(!productId||!Number.isInteger(quantity)||quantity<1||quantity>100000||!Number.isFinite(expense)||expense<0||expense>10000000)
        return send(res,400,{error:"Choose a product, enter a valid quantity and non-negative total expense."});
      const client=await db().connect();
      try {
        await client.query("BEGIN");
        const found=await client.query("SELECT id,product_name,material_used,price,stock FROM craft_products WHERE id=$1 FOR UPDATE",[productId]);
        if(!found.rowCount){await client.query("ROLLBACK");return send(res,404,{error:"Marketplace product not found."});}
        const p=found.rows[0];
        if(Number(p.stock)<quantity){await client.query("ROLLBACK");return send(res,409,{error:"Sale quantity is greater than available stock."});}
        const revenue=Number(p.price)*quantity;
        const sale=await client.query(`INSERT INTO craft_sales(product_id,product_name,material_used,quantity_sold,sale_amount,expense_amount,sold_on,notes)
          VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7) RETURNING id,quantity_sold,sale_amount,expense_amount,sold_on`,
          [p.id,p.product_name,p.material_used,quantity,revenue,expense,clean(body.notes,500)||null]);
        await client.query("UPDATE craft_products SET stock=stock-$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2",[quantity,p.id]);
        await client.query("COMMIT");
        return send(res,201,{sale:sale.rows[0],profit:Number((revenue-expense).toFixed(2))});
      } catch(error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    }
    return send(res,400,{error:"Unknown marketplace action."});
  } catch(error) {
    console.error("green campus:",error);
    return send(res,500,{error:"Could not load or update JOY Green Campus data."});
  }
}
