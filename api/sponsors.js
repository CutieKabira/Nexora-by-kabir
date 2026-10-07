// Sponsors popup: 6 featured products. Photos come from SerpApi (cached 24h), click opens the store.
const { num, serp } = require("./_lib");
const A = "https://www.amazon.in/s?k=";
const ITEMS = [
  { name: "ASUS ROG Gaming Laptop", q: "ASUS ROG Strix gaming laptop", emoji: "💻" },
  { name: "Sony PlayStation 5", q: "Sony PlayStation 5 console", emoji: "🎮" },
  { name: "Nike Air Jordan", q: "Nike Air Jordan 1 shoes", emoji: "👟" },
  { name: "Logitech Headphones", q: "Logitech G435 wireless headset", emoji: "🎧" },
  { name: "Razer Mouse", q: "Razer DeathAdder V3 gaming mouse", emoji: "🖱️" },
  { name: "LG Smart TV", q: "LG 43 inch 4K smart TV", emoji: "📺" },
];
module.exports = async (req, res) => {
  try {
    const out = await Promise.all(ITEMS.map(async (it) => {
      let image = "";
      try {
        const d = await serp({ engine: "google_shopping", q: it.q, google_domain: "google.co.in", num: "5" });
        const hit = (d.shopping_results || []).find((x) => x.thumbnail && num(x.extracted_price));
        image = hit ? hit.thumbnail : "";
      } catch (e) {}
      return { name: it.name, emoji: it.emoji, image, url: A + encodeURIComponent(it.q) };
    }));
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({ results: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
