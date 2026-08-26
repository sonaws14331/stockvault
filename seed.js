const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("./db");

async function seed() {
  const d = getDb();

  const users = [
    { name: "Alex Rivera", email: "alex@demo.com", role: "seller" },
    { name: "Sam Chen", email: "sam@demo.com", role: "seller" },
    { name: "Jordan Blake", email: "jordan@demo.com", role: "seller" },
    { name: "Maria Santos", email: "maria@demo.com", role: "seller" },
    { name: "Demo Buyer", email: "buyer@demo.com", role: "buyer" },
  ];

  const passwordHash = bcrypt.hashSync("demo123", 10);

  const userIds = [];
  const insertUser = d.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)");

  for (const u of users) {
    const id = uuidv4();
    userIds.push(id);
    insertUser.run(id, u.name, u.email, passwordHash, u.role);
  }

  const categories = d.prepare("SELECT * FROM categories").all();
  const catMap = {};
  for (const c of categories) catMap[c.slug] = c.id;

  const mediaItems = [
    { user: 0, title: "Mountain Sunrise", desc: "Beautiful golden sunrise over misty mountain peaks", type: "photo", cat: "nature", tags: "mountain,sunrise,golden,nature", price: 3.00, featured: 1, downloads: 245 },
    { user: 0, title: "Ocean Waves Aerial", desc: "Aerial view of crystal blue ocean waves crashing on shore", type: "photo", cat: "nature", tags: "ocean,waves,aerial,blue", price: 4.00, featured: 1, downloads: 189 },
    { user: 1, title: "Corporate Meeting", desc: "Professional team meeting in modern office space", type: "photo", cat: "business", tags: "business,meeting,corporate,team", price: 5.00, featured: 1, downloads: 312 },
    { user: 1, title: "Tech Startup Office", desc: "Modern tech startup workspace with exposed brick", type: "photo", cat: "technology", tags: "startup,office,tech,modern", price: 3.50, featured: 1, downloads: 156 },
    { user: 2, title: "Forest Path", desc: "Enchanted forest path with sunlight filtering through trees", type: "photo", cat: "nature", tags: "forest,path,trees,green", price: 2.50, featured: 0, downloads: 98 },
    { user: 2, title: "City Skyline Timelapse", desc: "Stunning city skyline timelapse from dusk to night", type: "video", cat: "architecture", tags: "city,skyline,timelapse,night", price: 8.00, featured: 1, downloads: 421 },
    { user: 3, title: "Abstract Gradient Pack", desc: "Set of 10 vibrant gradient backgrounds for design", type: "template", cat: "abstract", tags: "gradient,colorful,background,design", price: 6.00, featured: 1, downloads: 534 },
    { user: 3, title: "Lo-fi Beat Collection", desc: "Chill lo-fi beats perfect for background music", type: "audio", cat: "music", tags: "lofi,chill,beat,music", price: 4.50, featured: 0, downloads: 267 },
    { user: 0, title: "Cafe Lifestyle", desc: "Cozy cafe scene with warm lighting and fresh coffee", type: "photo", cat: "food", tags: "cafe,coffee,cozy,lifestyle", price: 2.00, featured: 0, downloads: 143 },
    { user: 1, title: "Minimal Presentation", desc: "Clean minimal presentation template for business", type: "template", cat: "business", tags: "presentation,minimal,business,template", price: 7.00, featured: 1, downloads: 389 },
    { user: 2, title: "Travel Vlog Intro", desc: "Dynamic travel vlog intro template with map animation", type: "video", cat: "travel", tags: "travel,vlog,intro,animation", price: 10.00, featured: 0, downloads: 76 },
    { user: 3, title: "Ambient Piano Loop", desc: "Gentle ambient piano loop for meditation or background", type: "audio", cat: "music", tags: "piano,ambient,calm,meditation", price: 3.00, featured: 0, downloads: 198 },
    { user: 0, title: "Smartphone Mockup", desc: "Realistic smartphone mockup on wooden desk", type: "template", cat: "technology", tags: "mockup,smartphone,device,realistic", price: 4.00, featured: 0, downloads: 267 },
    { user: 1, title: "Ancient Temple", desc: "Majestic ancient temple ruins at sunset", type: "photo", cat: "architecture", tags: "temple,ancient,ruins,sunset", price: 3.50, featured: 1, downloads: 201 },
    { user: 2, title: "Neon Abstract Loop", desc: "Hypnotic neon abstract animation loop", type: "video", cat: "abstract", tags: "neon,abstract,loop,animation", price: 5.00, featured: 0, downloads: 134 },
    { user: 3, title: "UI Kit Components", desc: "Complete UI kit with 50+ components for web design", type: "template", cat: "technology", tags: "ui,components,kit,webdesign", price: 12.00, featured: 1, downloads: 678 },
    { user: 0, title: "Summer Travel Montage", desc: "Vibrant summer travel video montage", type: "video", cat: "travel", tags: "summer,travel,montage,vacation", price: 7.50, featured: 0, downloads: 89 },
    { user: 1, title: "Electronic Beat Pack", desc: "High-energy electronic beats for content creators", type: "audio", cat: "music", tags: "electronic,beat,energy,pack", price: 6.00, featured: 0, downloads: 156 },
    { user: 2, title: "Portrait Collection", desc: "Diverse portrait photography collection", type: "photo", cat: "people", tags: "portrait,people,diverse,face", price: 3.00, featured: 0, downloads: 234 },
    { user: 3, title: "Educational Infographic", desc: "Clean infographic template for educational content", type: "template", cat: "education", tags: "infographic,education,template,clean", price: 5.50, featured: 0, downloads: 178 },
  ];

  const insertMedia = d.prepare(`
    INSERT INTO media (id, user_id, title, description, type, category_id, tags, price, file_url, thumbnail_url, downloads, featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const insertPurchase = d.prepare(`
    INSERT INTO purchases (id, buyer_id, media_id, amount, commission, creator_earning, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const buyerId = userIds[4];

  for (let i = 0; i < mediaItems.length; i++) {
    const m = mediaItems[i];
    const id = uuidv4();
    const placeholder = "/placeholder.svg";
    insertMedia.run(id, userIds[m.user], m.title, m.desc, m.type, catMap[m.cat], m.tags, m.price, placeholder, placeholder, m.downloads, m.featured || 0, "-" + Math.floor(Math.random() * 60) + " days");

    if (Math.random() > 0.4) {
      const amount = m.price;
      const commission = amount * 0.20;
      const earning = amount - commission;
      insertPurchase.run(uuidv4(), buyerId, id, amount, commission, earning, "-" + Math.floor(Math.random() * 30) + " days");
    }
  }

  console.log("Seed complete!");
}

module.exports = seed;

if (require.main === module) {
  const { initDb } = require("./db");
  initDb().then(() => seed()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
