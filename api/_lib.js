const NAMES = ["Amazon", "Flipkart", "Myntra", "Ajio", "Croma", "Reliance Digital", "Tata CLiQ", "Nykaa", "Snapdeal", "Meesho"];
const BASE = { amazon: 92, flipkart: 90, myntra: 90, ajio: 88, "tata cliq": 88, croma: 90, "reliance digital": 90, nykaa: 90, snapdeal: 75, meesho: 72 };
const STORE = {
  Amazon: "https://www.amazon.in/s?k=", Flipkart: "https://www.flipkart.com/search?q=", Myntra: "https://www.myntra.com/",
  Ajio: "https://www.ajio.com/search/?text=", Croma: "https://www.croma.com/searchB?q=",
  "Reliance Digital": "https://www.reliancedigital.in/search?q=", "Tata CLiQ": "https://www.tatacliq.com/search/?searchCategory=all&text=",
  Nykaa: "https://www.nykaa.com/search/result/?q=", Snapdeal: "https://www.snapdeal.com/search?keyword=", Meesho: "https://www.meesho.com/search?q=",
};
const canon = (src) => {
  const s = String(src || "").toLowerCase().replace("tatacliq", "tata cliq");
  return NAMES.find((n) => s.includes(n.toLowerCase())) || String(src || "Store");
};
const trust = (site, rating, reviews) => {
  let t = BASE[site.toLowerCase()] ?? 60;
  if (rating) t += Math.max(-9, Math.min(9, (rating - 3.5) * 6));
  if (reviews > 500) t += 3;
  return Math.round(Math.max(20, Math.min(98, t)));
};
const num = (v) => Number(v) || parseFloat(String(v || "").replace(/[^\d.]/g, "")) || 0;
const isGoogle = (u) => { try { return /(^|\.)google\./.test(new URL(u).hostname); } catch (e) { return true; } };
// Direct store link if we have one; otherwise the store's own search page. Never Google.
const direct = (link, site, title) => {
  if (link && !isGoogle(link)) return link;
  return STORE[site] ? STORE[site] + encodeURIComponent(title) : null;
};
async function serp(params) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set in Vercel environment variables.");
  const u = new URL("https://serpapi.com/search.json");
  Object.entries({ gl: "in", hl: "en", ...params, api_key: key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const d = await (await fetch(u)).json();
  if (d.error && !/hasn't returned any results/i.test(d.error)) throw new Error("SerpApi: " + d.error);
  return d;
}
module.exports = { canon, trust, num, direct, serp };
