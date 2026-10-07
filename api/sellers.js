// Step 2: /api/sellers?token=...&q=product+title&budget=4000 -> websites selling that product
const { canon, trust, num, direct, serp } = require("./_lib");
module.exports = async (req, res) => {
  const title = String(req.query.q || "").trim().slice(0, 150);
  const token = String(req.query.token || "");
  const budget = parseInt(req.query.budget, 10) || 0;
  if (!title) return res.status(400).json({ error: "Product is required." });
  try {
    let rows = [];
    if (token) {
      try {
        const d = await serp({ engine: "google_immersive_product", page_token: token });
        rows = ((d.product_results && d.product_results.stores) || []).map((s) => ({
          site: canon(s.name), price: num(s.extracted_price || s.price), link: s.link, rating: s.rating, reviews: s.reviews,
        }));
      } catch (e) { rows = []; }
    }
    if (!rows.length) {
      const d = await serp({ engine: "google_shopping", q: title, google_domain: "google.co.in", num: "40" });
      rows = (d.shopping_results || []).map((it) => ({
        site: canon(it.source), price: num(it.extracted_price), link: it.link || it.product_link, rating: it.rating, reviews: it.reviews,
      }));
    }
    const best = new Map();
    for (const r of rows) {
      const link = direct(r.link, r.site, title);
      if (!r.price || !link) continue;
      const row = { site: r.site, price: r.price, link, rating: r.rating || 0, trust: trust(r.site, r.rating, r.reviews) };
      const old = best.get(r.site);
      if (!old || row.price < old.price) best.set(r.site, row);
    }
    let list = [...best.values()];
    const inBudget = list.filter((r) => !budget || r.price <= budget);
    if (inBudget.length) list = inBudget;
    list.sort((a, b) => b.trust - a.trust);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({ results: list.slice(0, 10) });
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not load stores. Please try again." });
  }
};
