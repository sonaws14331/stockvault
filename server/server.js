const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { initDb, getDb } = require("./db");
const seed = require("./seed");

const authRoutes = require("./routes/auth");
const mediaRoutes = require("./routes/media");
const paymentRoutes = require("./routes/payments");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, "..");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS_DIR));

initDb().then(async () => {
  const d = getDb();
  const count = d.prepare("SELECT COUNT(*) as c FROM media").get();
  if (!count || count.c === 0) {
    console.log("No media found - seeding demo data...");
    await seed();
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/payments", paymentRoutes);

  app.use("/", express.static(ROOT_DIR));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return;
    const page = req.path.replace(/^\//, "").replace(/\.html$/, "").replace(/\/$/, "") || "index";
    const filePath = path.join(ROOT_DIR, page + ".html");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(ROOT_DIR, "index.html"));
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log("StockVault running on port " + PORT);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
