const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
                     ".mp4", ".webm", ".mov", ".avi",
                     ".mp3", ".wav", ".ogg", ".m4a",
                     ".psd", ".ai", ".fig", ".sketch", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

function authUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(token);
}

router.get("/browse", (req, res) => {
  try {
    const d = getDb();
    const { type, category, search, sort, page, limit: lim } = req.query;
    const p = parseInt(page) || 1;
    const l = Math.min(parseInt(lim) || 20, 100);
    const offset = (p - 1) * l;

    let where = "WHERE m.status = 'active'";
    const params = [];

    if (type) { where += " AND m.type = ?"; params.push(type); }
    if (category) { where += " AND c.slug = ?"; params.push(category); }
    if (search) { where += " AND (m.title LIKE ? OR m.description LIKE ? OR m.tags LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    let order = "ORDER BY m.created_at DESC";
    if (sort === "popular") order = "ORDER BY m.downloads DESC";
    else if (sort === "price_low") order = "ORDER BY m.price ASC";
    else if (sort === "price_high") order = "ORDER BY m.price DESC";

    const total = d.prepare(`SELECT COUNT(*) as c FROM media m LEFT JOIN categories c ON m.category_id = c.id ${where}`).get(...params).c;

    const items = d.prepare(`
      SELECT m.*, u.name as creator_name, u.avatar as creator_avatar, c.name as category_name, c.slug as category_slug
      FROM media m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      ${where} ${order} LIMIT ? OFFSET ?
    `).all(...params, l, offset);

    res.json({ items, total, page: p, pages: Math.ceil(total / l) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/featured", (req, res) => {
  try {
    const d = getDb();
    const items = d.prepare(`
      SELECT m.*, u.name as creator_name, u.avatar as creator_avatar, c.name as category_name
      FROM media m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.status = 'active' AND m.featured = 1
      ORDER BY m.downloads DESC LIMIT 12
    `).all();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/categories", (req, res) => {
  try {
    const d = getDb();
    const cats = d.prepare(`
      SELECT c.*, COUNT(m.id) as media_count
      FROM categories c
      LEFT JOIN media m ON c.id = m.category_id AND m.status = 'active'
      GROUP BY c.id ORDER BY c.name
    `).all();
    res.json({ categories: cats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/detail/:id", (req, res) => {
  try {
    const d = getDb();
    const item = d.prepare(`
      SELECT m.*, u.name as creator_name, u.avatar as creator_avatar, u.bio as creator_bio,
             c.name as category_name, c.slug as category_slug
      FROM media m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = ?
    `).get(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json({ item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/upload", upload.single("file"), (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { title, description, type, category_id, tags, price } = req.body;
    if (!title || !type) return res.status(400).json({ error: "Title and type are required" });

    const d = getDb();
    const id = uuidv4();
    const file_url = "/uploads/" + req.file.filename;

    d.prepare(`
      INSERT INTO media (id, user_id, title, description, type, category_id, tags, price, file_url, thumbnail_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, user.id, title, description || "", type, category_id || null, tags || "", parseFloat(price) || 2.0, file_url, file_url);

    const item = d.prepare("SELECT * FROM media WHERE id = ?").get(id);
    res.json({ item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/my-uploads", (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const d = getDb();
    const items = d.prepare(`
      SELECT m.*, c.name as category_name
      FROM media m LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.user_id = ? ORDER BY m.created_at DESC
    `).all(user.id);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/my-stats", (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const d = getDb();

    const totalUploads = d.prepare("SELECT COUNT(*) as c FROM media WHERE user_id = ?").get(user.id).c;
    const totalDownloads = d.prepare("SELECT COALESCE(SUM(downloads), 0) as c FROM media WHERE user_id = ?").get(user.id).c;
    const totalEarnings = d.prepare("SELECT COALESCE(SUM(creator_earning), 0) as c FROM purchases p JOIN media m ON p.media_id = m.id WHERE m.user_id = ?").get(user.id).c;
    const recentPurchases = d.prepare(`
      SELECT p.*, m.title, m.type
      FROM purchases p JOIN media m ON p.media_id = m.id
      WHERE m.user_id = ? ORDER BY p.created_at DESC LIMIT 10
    `).all(user.id);

    const dailyEarnings = d.prepare(`
      SELECT date(p.created_at) as day, SUM(p.creator_earning) as earnings, COUNT(*) as sales
      FROM purchases p JOIN media m ON p.media_id = m.id
      WHERE m.user_id = ? GROUP BY date(p.created_at) ORDER BY day DESC LIMIT 30
    `).all(user.id);

    res.json({ totalUploads, totalDownloads, totalEarnings, recentPurchases, dailyEarnings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const d = getDb();
    const item = d.prepare("SELECT * FROM media WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!item) return res.status(404).json({ error: "Not found or not yours" });
    d.prepare("DELETE FROM media WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
