const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");

const router = express.Router();

function authAdmin(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(token);
  if (!user || user.role !== "admin") return null;
  return user;
}

router.get("/stats", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    const totalUsers = d.prepare("SELECT COUNT(*) as c FROM users").get().c;
    const totalMedia = d.prepare("SELECT COUNT(*) as c FROM media").get().c;
    const totalSales = d.prepare("SELECT COUNT(*) as c FROM purchases").get().c;
    const totalRevenue = d.prepare("SELECT COALESCE(SUM(commission), 0) as c FROM purchases").get().c;
    const totalEarnings = d.prepare("SELECT COALESCE(SUM(amount), 0) as c FROM purchases").get().c;
    const pendingWithdrawals = d.prepare("SELECT COALESCE(SUM(amount), 0) as c FROM withdrawals WHERE status = 'pending'").get().c;
    const completedWithdrawals = d.prepare("SELECT COALESCE(SUM(amount), 0) as c FROM withdrawals WHERE status = 'completed'").get().c;
    const totalBalance = d.prepare("SELECT COALESCE(SUM(balance), 0) as c FROM users").get().c;
    res.json({ totalUsers, totalMedia, totalSales, totalRevenue, totalEarnings, pendingWithdrawals, completedWithdrawals, totalBalance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/withdrawals", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    const status = req.query.status || "all";
    let query = `
      SELECT w.*, u.name as user_name, u.email as user_email
      FROM withdrawals w JOIN users u ON w.user_id = u.id
    `;
    if (status !== "all") query += ` WHERE w.status = '${status}'`;
    query += " ORDER BY w.created_at DESC";
    const withdrawals = d.prepare(query).all();
    res.json({ withdrawals });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/withdrawals/:id/approve", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    const withdrawal = d.prepare("SELECT * FROM withdrawals WHERE id = ?").get(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== "pending") return res.status(400).json({ error: "Already processed" });
    d.prepare("UPDATE withdrawals SET status = 'completed', processed_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ message: "Withdrawal approved and completed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/withdrawals/:id/reject", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    const withdrawal = d.prepare("SELECT * FROM withdrawals WHERE id = ?").get(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== "pending") return res.status(400).json({ error: "Already processed" });
    d.transaction(() => {
      d.prepare("UPDATE withdrawals SET status = 'rejected', processed_at = datetime('now') WHERE id = ?").run(req.params.id);
      d.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(withdrawal.amount, withdrawal.user_id);
    })();
    res.json({ message: "Withdrawal rejected. Balance refunded." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/users", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    const users = d.prepare("SELECT id, name, email, role, balance, created_at FROM users ORDER BY created_at DESC").all();
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/media", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    const media = d.prepare(`
      SELECT m.*, u.name as creator_name, u.email as creator_email
      FROM media m JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `).all();
    res.json({ media });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/media/:id/feature", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    d.prepare("UPDATE media SET featured = 1 WHERE id = ?").run(req.params.id);
    res.json({ message: "Media featured" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/media/:id/hide", (req, res) => {
  try {
    const admin = authAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });
    const d = getDb();
    d.prepare("UPDATE media SET status = 'hidden' WHERE id = ?").run(req.params.id);
    res.json({ message: "Media hidden" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
