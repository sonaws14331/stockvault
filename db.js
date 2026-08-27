const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "marketplace.db");

let db = null;
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (db) {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    }
  }, 500);
}

function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return {
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          scheduleSave();
        },
        get(...params) {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
      };
    },
    exec(sql) {
      db.run(sql);
      scheduleSave();
    },
    transaction(fn) {
      db.run("BEGIN TRANSACTION");
      try {
        fn();
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
    },
  };
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'seller',
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      subscription_tier TEXT DEFAULT 'free',
      balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT NOT NULL,
      category_id INTEGER,
      tags TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 1.0,
      file_url TEXT NOT NULL,
      thumbnail_url TEXT DEFAULT '',
      downloads INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      amount REAL NOT NULL,
      commission REAL NOT NULL,
      creator_earning REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'pro',
      amount REAL NOT NULL,
      start_date TEXT DEFAULT (datetime('now')),
      end_date TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'paypal',
      account_info TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      processed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seedCategories(d);
  ensureAdminUser(d);
  return d;
}

function ensureAdminUser(d) {
  const existing = d.prepare("SELECT id FROM users WHERE email = 'admin@stockvault.com'").get();
  if (existing) return;
  const bcrypt = require("bcryptjs");
  const { v4: uuidv4 } = require("uuid");
  const id = uuidv4();
  const hash = bcrypt.hashSync("admin123", 10);
  d.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .run(id, "Admin", "admin@stockvault.com", hash, "admin");
  console.log("Admin user created: admin@stockvault.com / admin123");
}

function seedCategories(d) {
  const count = d.prepare("SELECT COUNT(*) as c FROM categories").get();
  if (count && count.c > 0) return;

  const cats = [
    { name: "Nature", slug: "nature", icon: "🌿" },
    { name: "Business", slug: "business", icon: "💼" },
    { name: "Technology", slug: "technology", icon: "💻" },
    { name: "People", slug: "people", icon: "👥" },
    { name: "Architecture", slug: "architecture", icon: "🏛️" },
    { name: "Food", slug: "food", icon: "🍕" },
    { name: "Travel", slug: "travel", icon: "✈️" },
    { name: "Abstract", slug: "abstract", icon: "🎨" },
    { name: "Music", slug: "music", icon: "🎵" },
    { name: "Education", slug: "education", icon: "📚" },
  ];

  const ins = d.prepare("INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)");
  for (const c of cats) ins.run(c.name, c.slug, c.icon);
}

module.exports = { getDb, initDb };
