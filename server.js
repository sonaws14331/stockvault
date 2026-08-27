const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { initDb, getDb } = require("./db");
const seed = require("./seed");

const authRoutes = require("./routes/auth");
const mediaRoutes = require("./routes/media");
const paymentRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/", express.static(__dirname));

initDb().then(async () => {
  const d = getDb();
  const count = d.prepare("SELECT COUNT(*) as c FROM media").get();
  if (!count || count.c === 0) {
    console.log("Seeding demo data...");
    await seed();
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/api/setup/admin", (req, res) => {
    try {
      const d = getDb();
      const existing = d.prepare("SELECT id FROM users WHERE email = 'admin@stockvault.com'").get();
      if (existing) return res.json({ message: "Admin already exists", email: "admin@stockvault.com", password: "admin123" });
      const id = uuidv4();
      const hash = bcrypt.hashSync("admin123", 10);
      d.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .run(id, "Admin", "admin@stockvault.com", hash, "admin");
      res.json({ message: "Admin created!", email: "admin@stockvault.com", password: "admin123" });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return;
    const page = req.path.replace(/^\//, "").replace(/\.html$/, "").replace(/\/$/, "") || "index";
    const filePath = path.join(__dirname, page + ".html");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(__dirname, "index.html"));
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log("StockVault running on port " + PORT);
  });
}).catch(err => {
  console.error("Failed to start:", err);
  process.exit(1);
});
