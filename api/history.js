// GET /api/history -> saved searches, PUT /api/history {history:[{q,b}]} -> save (login required)
const { redis, readSession } = require("./_db");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const uid = readSession(req);
    if (!uid) return res.status(401).json({ error: "Please sign in." });
    if (req.method === "PUT") {
      const h = Array.isArray(req.body && req.body.history) ? req.body.history : [];
      const clean = h.slice(0, 30).map((x) => ({ q: String(x.q || "").slice(0, 100), b: Math.max(0, parseInt(x.b, 10) || 0) })).filter((x) => x.q);
      await redis("SET", "hist:" + uid, JSON.stringify(clean));
      return res.status(200).json({ ok: true });
    }
    const raw = await redis("GET", "hist:" + uid);
    res.status(200).json({ history: raw ? JSON.parse(raw) : [] });
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not load history." });
  }
};
