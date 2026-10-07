// Step 1: /api/search?q=shoes&budget=4000 -> variety of products inside the budget
const { num, serp } = require("./_lib");
module.exports = async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const budget = parseInt(req.query.budget, 10);
  if (!q || !budget) return res.status(400).json({ error: "Both q and budget are required." });
  try {
    const d = await serp({ engine: "google_shopping", q, google_domain: "google.co.in", num: "40" });
    const seen = new Set(), results = [];
    for (const it of d.shopping_results || []) {
      const price = num(it.extracted_price);
      if (!price || price > budget || !it.title) continue;
      const key = it.product_id || it.title.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ pid: it.product_id || "", token: it.immersive_product_page_token || "", title: it.title, image: it.thumbnail || "" });
      if (results.length >= 24) break;
    }
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message || "Search failed. Please try again." });
  }
};
