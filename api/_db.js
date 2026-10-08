// Shared helpers: Upstash Redis (REST), password hashing, signed session cookie.
const crypto = require("crypto");
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(...cmd) {
  if (!URL_ || !TOKEN) throw new Error("Database is not connected. Add Upstash Redis from the Vercel Storage tab.");
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const d = await r.json();
  if (d.error) throw new Error("Database error. Please try again.");
  return d.result;
}
const hash = (pw) => new Promise((ok, no) => {
  const salt = crypto.randomBytes(16);
  crypto.scrypt(pw, salt, 64, (e, k) => (e ? no(e) : ok(salt.toString("hex") + ":" + k.toString("hex"))));
});
const verify = (pw, stored) => new Promise((ok) => {
  const [s, h] = String(stored || "").split(":");
  if (!s || !h) return ok(false);
  crypto.scrypt(pw, Buffer.from(s, "hex"), 64, (e, k) => ok(!e && crypto.timingSafeEqual(k, Buffer.from(h, "hex"))));
});
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set in Vercel environment variables.");
  return s;
};
const mac = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");
const sign = (uid) => { const p = Buffer.from(JSON.stringify({ u: uid, e: Date.now() + 30 * 864e5 })).toString("base64url"); return p + "." + mac(p); };
const sessionCookie = (uid) => `nx_s=${sign(uid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
const clearCookie = () => "nx_s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
function readSession(req) {
  try {
    const c = (req.headers.cookie || "").split(";").map((x) => x.trim()).find((x) => x.startsWith("nx_s="));
    if (!c) return null;
    const [p, m] = c.slice(5).split(".");
    if (!p || !m) return null;
    const good = mac(p);
    if (m.length !== good.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(good))) return null;
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.e > Date.now() ? d.u : null;
  } catch (e) { return null; }
}
module.exports = { redis, hash, verify, sessionCookie, clearCookie, readSession };
