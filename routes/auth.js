const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");

const router = express.Router();

router.post("/register", (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    const d = getDb();
    const existing = d.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    d.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, email, hash, role || "seller");
    const user = d.prepare("SELECT id, name, email, role, avatar, bio, subscription_tier, balance, created_at FROM users WHERE id = ?").get(id);
    res.json({ user, token: id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const d = getDb();
    const user = d.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const { password_hash, ...safe } = user;
    res.json({ user: safe, token: user.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/me", (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const d = getDb();
    const user = d.prepare("SELECT id, name, email, role, avatar, bio, subscription_tier, balance, created_at FROM users WHERE id = ?").get(token);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/me", (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const { name, bio, avatar } = req.body;
    const d = getDb();
    if (name !== undefined) d.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, token);
    if (bio !== undefined) d.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, token);
    if (avatar !== undefined) d.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, token);
    const user = d.prepare("SELECT id, name, email, role, avatar, bio, subscription_tier, balance, created_at FROM users WHERE id = ?").get(token);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
