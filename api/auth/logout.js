import { send } from "../db.js";
export default function handler(req,res) {
  res.setHeader("Set-Cookie","joy_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return send(res,200,{ok:true});
}
