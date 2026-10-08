// /api/auth?action=me|signup|login|logout
const crypto = require("crypto");
const { redis, hash, verify, sessionCookie, clearCookie, readSession } = require("./_db");
const phoneOf = (v) => String(v || "").replace(/\D/g, "").slice(-10);
const pub = (u) => ({ name: u.name, email: u.email, phone: u.phone });
const bad = (res, code, error) => res.status(code).json({ error });

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const action = String(req.query.action || "");
  try {
    if (action === "me") {
      try {
        const uid = readSession(req);
        const raw = uid && (await redis("GET", "user:" + uid));
        return res.status(200).json({ user: raw ? pub(JSON.parse(raw)) : null });
      } catch (e) { return res.status(200).json({ user: null }); }
    }
    if (req.method !== "POST") return bad(res, 405, "Method not allowed.");
    const b = req.body && typeof req.body === "object" ? req.body : {};

    if (action === "logout") { res.setHeader("Set-Cookie", clearCookie()); return res.status(200).json({ ok: true }); }

    if (action === "signup") {
      const name = String(b.name || "").trim().slice(0, 60);
      const email = String(b.email || "").trim().toLowerCase();
      const phone = phoneOf(b.phone);
      const pw = String(b.password || "");
      if (name.length < 2) return bad(res, 400, "Please enter your name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return bad(res, 400, "Enter a valid email address.");
      if (!/^[6-9]\d{9}$/.test(phone)) return bad(res, 400, "Enter a valid 10-digit mobile number.");
      if (pw.length < 8 || pw.length > 100) return bad(res, 400, "Password must be 8 to 100 characters.");
      if (pw !== String(b.confirm || "")) return bad(res, 400, "Passwords do not match.");
      const id = crypto.randomUUID();
      if ((await redis("SET", "email:" + email, id, "NX")) !== "OK") return bad(res, 409, "An account with this email already exists.");
      if ((await redis("SET", "phone:" + phone, id, "NX")) !== "OK") { await redis("DEL", "email:" + email); return bad(res, 409, "An account with this number already exists."); }
      const user = { id, name, email, phone, pass: await hash(pw), created: Date.now() };
      await redis("SET", "user:" + id, JSON.stringify(user));
      res.setHeader("Set-Cookie", sessionCookie(id));
      return res.status(200).json({ user: pub(user) });
    }

    if (action === "login") {
      const ident = String(b.id || "").trim().toLowerCase().slice(0, 120);
      const pw = String(b.password || "").slice(0, 100);
      if (!ident || !pw) return bad(res, 400, "Enter your email or number and password.");
      const rl = "rl:" + ident;
      const tries = await redis("INCR", rl);
      if (tries === 1) await redis("EXPIRE", rl, 900);
      if (tries > 10) return bad(res, 429, "Too many attempts. Please try again in 15 minutes.");
      const uid = await redis("GET", ident.includes("@") ? "email:" + ident : "phone:" + phoneOf(ident));
      const raw = uid && (await redis("GET", "user:" + uid));
      const user = raw ? JSON.parse(raw) : null;
      const ok = await verify(pw, user ? user.pass : "00:00");
      if (!user || !ok) return bad(res, 401, "Incorrect email/number or password.");
      await redis("DEL", rl);
      res.setHeader("Set-Cookie", sessionCookie(user.id));
      return res.status(200).json({ user: pub(user) });
    }
    return bad(res, 400, "Unknown action.");
  } catch (e) {
    return bad(res, 500, e.message || "Something went wrong. Please try again.");
  }
};
