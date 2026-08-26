const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");

const router = express.Router();
const COMMISSION_RATE = 0.20;

function authUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(token);
}

router.post("/purchase/:mediaId", (req, res) => {
  try {
    const buyer = authUser(req);
    if (!buyer) return res.status(401).json({ error: "Not authenticated" });

    const d = getDb();
    const media = d.prepare("SELECT * FROM media WHERE id = ? AND status = 'active'").get(req.params.mediaId);
    if (!media) return res.status(404).json({ error: "Media not found" });
    if (media.user_id === buyer.id) return res.status(400).json({ error: "Cannot buy your own media" });

    const existing = d.prepare("SELECT id FROM purchases WHERE buyer_id = ? AND media_id = ?").get(buyer.id, media.id);
    if (existing) return res.json({ message: "Already purchased", purchaseId: existing.id, downloadUrl: media.file_url });

    const amount = media.price;
    const commission = amount * COMMISSION_RATE;
    const creator_earning = amount - commission;

    const purchaseId = uuidv4();

    const txn = d.transaction(() => {
      d.prepare("INSERT INTO purchases (id, buyer_id, media_id, amount, commission, creator_earning) VALUES (?, ?, ?, ?, ?, ?)")
        .run(purchaseId, buyer.id, media.id, amount, commission, creator_earning);
      d.prepare("UPDATE media SET downloads = downloads + 1 WHERE id = ?").run(media.id);
      d.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(creator_earning, media.user_id);
    });
    txn();

    res.json({ purchaseId, downloadUrl: media.file_url, amount, commission, creator_earning });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/my-purchases", (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const d = getDb();
    const purchases = d.prepare(`
      SELECT p.*, m.title, m.type, m.thumbnail_url, m.file_url, u.name as creator_name
      FROM purchases p
      JOIN media m ON p.media_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE p.buyer_id = ? ORDER BY p.created_at DESC
    `).all(user.id);
    res.json({ purchases });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/subscribe", (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const d = getDb();

    const amount = 9.99;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    d.prepare("INSERT INTO subscriptions (id, user_id, plan, amount, end_date) VALUES (?, ?, 'pro', ?, ?)")
      .run(uuidv4(), user.id, amount, endDate.toISOString());
    d.prepare("UPDATE users SET subscription_tier = 'pro' WHERE id = ?").run(user.id);

    res.json({ message: "Subscribed to Pro", endDate: endDate.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/leaderboard", (req, res) => {
  try {
    const d = getDb();
    const top = d.prepare(`
      SELECT u.id, u.name, u.avatar, SUM(p.creator_earning) as total_earnings, COUNT(p.id) as total_sales
      FROM purchases p JOIN media m ON p.media_id = m.id JOIN users u ON m.user_id = u.id
      GROUP BY u.id ORDER BY total_earnings DESC LIMIT 10
    `).all();
    res.json({ leaderboard: top });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
