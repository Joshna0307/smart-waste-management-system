import pg from "pg";
const { Pool } = pg;
let pool;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing in Vercel environment variables.");
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
  });
  return pool;
}
export function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json").json(data);
}
