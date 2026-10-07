// Step 2: /api/sellers?token=...&q=product+title&budget=4000 -> websites selling that product
const { canon, trust, num, direct, serp } = require("./_lib");
const MIN = 6; // try more sources until we have at least this many stores

module.exports = async (req, res) => {
  const title = String(req.query.q || "").trim().slice(0, 150);
  const token = String(req.query.token || "");
  const budget = parseInt(req.query.budget, 10) || 0;
  if (!title) return res.status(400).json({ error: "Product is required." });

  const best = new Map(); // one cheapest offer per store
  const add = (site, price, link, rating, reviews) => {
    const l = direct(link, site, title);
    if (!price || !l) return;
    const row = { site, price, link: l, rating: rating || 0, trust: trust(site, rating, reviews) };
    const old = best.get(site);
    if (!old || row.price < old.price) best.set(site, row);
  };
  const shopping = async (q) => {
    try {
      const d = await serp({ engine: "google_shopping", q, google_domain: "google.co.in", num: "40" });
      for (const it of d.shopping_results || []) add(canon(it.source), num(it.extracted_price), it.link || it.product_link, it.rating, it.reviews);
    } catch (e) {}
  };

  try {
    // Source 1: the product's own store list (all stores)
    if (token) {
      for (const extra of [{ more_stores: "true" }, {}]) {
        try {
          const d = await serp({ engine: "google_immersive_product", page_token: token, ...extra });
          const stores = (d.product_results && d.product_results.stores) || [];
          stores.forEach((s) => add(canon(s.name), num(s.extracted_price || s.price), s.link, s.rating, s.reviews));
          if (stores.length) break;
        } catch (e) {}
      }
    }
    // Source 2: search the full title
    if (best.size < MIN) await shopping(title);
    // Source 3: search a shorter version of the title (finds more similar offers)
    if (best.size < MIN) {
      const short = title.split(/\s+/).slice(0, 6).join(" ");
      if (short !== title) await shopping(short);
    }
    if (!best.size) return res.status(200).json({ results: [] });

    // Stores inside the budget first, others after (marked as above budget)
    const rows = [...best.values()].map((r) => ({ ...r, over: !!budget && r.price > budget }));
    rows.sort((a, b) => a.over - b.over || b.trust - a.trust);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({ results: rows.slice(0, 15) });
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not load stores. Please try again." });
  }
};
