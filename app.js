/* ============================================================
   StockVault — Frontend Application
   ============================================================ */
"use strict";

const API = window.location.hostname === "localhost" ? "/api" : "https://stockvault-e69m.onrender.com/api";
let currentUser = null;

/* ---- Utilities ---- */
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString("en-US");
const fmtMoney = n => "$" + Number(n).toFixed(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 3000);
}

async function api(path, opts = {}) {
  const token = localStorage.getItem("sv_token");
  const headers = { ...opts.headers };
  if (token) headers["Authorization"] = "Bearer " + token;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ---- Auth ---- */
async function checkAuth() {
  const token = localStorage.getItem("sv_token");
  if (!token) { updateAuthUI(false); return; }
  try {
    const { user } = await api("/auth/me");
    currentUser = user;
    updateAuthUI(true);
  } catch {
    localStorage.removeItem("sv_token");
    updateAuthUI(false);
  }
}

function updateAuthUI(loggedIn) {
  document.querySelectorAll(".auth-btns").forEach(el => el.classList.toggle("hidden", loggedIn));
  document.querySelectorAll(".user-menu").forEach(el => el.classList.toggle("hidden", !loggedIn));
  document.querySelectorAll(".seller-only").forEach(el => {
    el.style.display = (!loggedIn || (currentUser && currentUser.role === "buyer")) ? "none" : "";
  });
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = (!loggedIn || (currentUser && currentUser.role !== "admin")) ? "none" : "";
  });
  if (loggedIn && currentUser) {
    document.querySelectorAll("#userAvatar").forEach(el => {
      el.textContent = currentUser.name.charAt(0).toUpperCase();
    });
    document.querySelectorAll("#dropdownName").forEach(el => {
      el.textContent = currentUser.name;
    });
  }
}

function toggleUserDrop() {
  const dd = $("userDrop");
  if (dd) dd.classList.toggle("hidden");
}

function logout() {
  localStorage.removeItem("sv_token");
  currentUser = null;
  toast("Logged out");
  window.location.href = "/";
}

function requireAuth() {
  if (!currentUser) { openModal("login"); return false; }
  return true;
}

/* ---- Modal ---- */
function openModal(type, data) {
  const box = $("modalBox");
  let html = `<button class="close-x" onclick="closeModal()">✕</button>`;
  if (type === "login") {
    html += `
      <h2>Welcome Back</h2>
      <p class="sub">Log in to your StockVault account</p>
      <div class="modal-form">
        <input type="email" id="loginEmail" class="txt" placeholder="Email">
        <input type="password" id="loginPassword" class="txt" placeholder="Password">
        <button class="btn gold full" onclick="doLogin()">Log In</button>
        <p class="form-switch">Don't have an account? <a onclick="openModal('register')">Sign Up</a></p>
        <p class="form-demo">Demo: <strong>alex@demo.com</strong> / <strong>demo123</strong></p>
      </div>`;
  } else if (type === "register") {
    html += `
      <h2>Join StockVault</h2>
      <p class="sub">Create an account to start buying or selling</p>
      <div class="modal-form">
        <input type="text" id="regName" class="txt" placeholder="Full Name">
        <input type="email" id="regEmail" class="txt" placeholder="Email">
        <input type="password" id="regPassword" class="txt" placeholder="Password (min 6 chars)">
        <select id="regRole" class="sel">
          <option value="seller">I want to sell my creations</option>
          <option value="buyer">I want to buy media</option>
        </select>
        <button class="btn gold full" onclick="doRegister()">Create Account</button>
        <p class="form-switch">Already have an account? <a onclick="openModal('login')">Log In</a></p>
      </div>`;
  } else if (type === "purchase") {
    html += `
      <h2>Confirm Purchase</h2>
      <p class="sub">You're about to purchase: <strong>${esc(data.title)}</strong></p>
      <div class="purchase-details">
        <div class="purchase-row"><span>Price:</span><strong>${fmtMoney(data.price)}</strong></div>
        <div class="purchase-row"><span>Creator:</span><span>${esc(data.creator_name)}</span></div>
        <div class="purchase-row muted-row"><span>Platform fee:</span><span>${fmtMoney(data.price * 0.20)}</span></div>
      </div>
      <button class="btn gold big full" onclick="confirmPurchase('${data.id}')">Buy Now — ${fmtMoney(data.price)}</button>`;
  } else if (type === "withdraw") {
    html += `
      <h2>Withdraw Earnings</h2>
      <p class="sub">Available balance: <strong>${fmtMoney(currentBalance)}</strong></p>
      <div class="modal-form">
        <label class="form-label">Amount ($)</label>
        <input type="number" id="withdrawAmount" class="txt" min="5" step="0.01" max="${currentBalance}" value="${Math.floor(currentBalance)}">
        <label class="form-label">Payment Method</label>
        <select id="withdrawMethod" class="sel">
          <option value="paypal">PayPal</option>
          <option value="bank">Bank Transfer</option>
          <option value="upi">UPI (India)</option>
          <option value="crypto">Crypto (USDT/BTC)</option>
        </select>
        <label class="form-label">Account Details</label>
        <input type="text" id="withdrawAccount" class="txt" placeholder="Email, phone, or wallet address">
        <p class="muted" style="font-size:12px;margin:5px 0">Minimum withdrawal: $5.00. Processing: 3-5 business days.</p>
        <button class="btn gold full" onclick="doWithdraw()">Request Withdrawal</button>
      </div>`;
  }
  box.innerHTML = html;
  $("modalOverlay").classList.remove("hidden");
}

function closeModal() {
  $("modalOverlay").classList.add("hidden");
}

async function doLogin() {
  try {
    const { user, token } = await api("/auth/login", {
      method: "POST",
      body: { email: $("loginEmail").value, password: $("loginPassword").value }
    });
    localStorage.setItem("sv_token", token);
    currentUser = user;
    updateAuthUI(true);
    closeModal();
    toast("Welcome back, " + user.name + "!");
  } catch (e) { toast(e.message); }
}

async function doRegister() {
  try {
    const { user, token } = await api("/auth/register", {
      method: "POST",
      body: {
        name: $("regName").value,
        email: $("regEmail").value,
        password: $("regPassword").value,
        role: $("regRole").value
      }
    });
    localStorage.setItem("sv_token", token);
    currentUser = user;
    updateAuthUI(true);
    closeModal();
    toast("Welcome to StockVault, " + user.name + "!");
  } catch (e) { toast(e.message); }
}

function esc(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---- Media Card ---- */
function mediaCard(m) {
  const typeIcons = { photo: "📷", video: "🎬", template: "🎨", audio: "🎵" };
  const typeColors = { photo: "#3ddc84", video: "#ef5b4d", template: "#3aa0e8", audio: "#f5b942" };
  return `
    <a href="/detail?id=${m.id}" class="media-card">
      <div class="media-thumb" style="background: linear-gradient(135deg, ${typeColors[m.type]}22, ${typeColors[m.type]}44)">
        <span class="media-type-badge" style="background:${typeColors[m.type]}">${typeIcons[m.type]} ${m.type}</span>
        <div class="thumb-placeholder">${typeIcons[m.type]}</div>
      </div>
      <div class="media-info">
        <h4>${esc(m.title)}</h4>
        <div class="media-meta">
          <span class="media-creator">${esc(m.creator_name || "Unknown")}</span>
          <span class="media-price">${fmtMoney(m.price)}</span>
        </div>
        <div class="media-stats-mini">
          <span>⬇️ ${fmt(m.downloads || 0)}</span>
        </div>
      </div>
    </a>`;
}

/* ---- Home Page ---- */
async function initHome() {
  await checkAuth();
  try {
    const [featured, newest, cats] = await Promise.all([
      api("/media/browse?sort=popular&limit=8"),
      api("/media/browse?sort=newest&limit=8"),
      api("/media/categories")
    ]);
    $("trendingGrid").innerHTML = featured.items.map(mediaCard).join("");
    $("newGrid").innerHTML = newest.items.map(mediaCard).join("");
    $("categoryGrid").innerHTML = cats.categories.map(c => `
      <a href="/browse?category=${c.slug}" class="category-card">
        <div class="cat-icon">${c.icon}</div>
        <div class="cat-name">${esc(c.name)}</div>
        <div class="cat-count">${c.media_count} items</div>
      </a>`).join("");
    $("statMedia").textContent = fmt(featured.total);
    $("statCreators").textContent = "50+";
    $("statDownloads").textContent = "10K+";
  } catch (e) { console.error(e); }
}

function goSearch() { window.location.href = "/browse?search=" + encodeURIComponent($("topSearch").value); }
function goHeroSearch() { window.location.href = "/browse?search=" + encodeURIComponent($("heroSearch").value); }
function quickSearch(q) { window.location.href = "/browse?search=" + encodeURIComponent(q); }

/* ---- Browse Page ---- */
async function initBrowse() {
  await checkAuth();
  const params = new URLSearchParams(window.location.search);
  if (params.get("type")) $("filterType").value = params.get("type");
  if (params.get("category")) $("filterCategory").value = params.get("category");
  if (params.get("search")) $("filterSearch").value = params.get("search");
  if (params.get("sort")) $("filterSort").value = params.get("sort");

  try {
    const { categories } = await api("/media/categories");
    const sel = $("filterCategory");
    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.slug;
      opt.textContent = c.icon + " " + c.name;
      sel.appendChild(opt);
    });
    if (params.get("category")) sel.value = params.get("category");
  } catch (e) { console.error(e); }

  applyFilters(1);
}

let currentBrowsePage = 1;

async function applyFilters(page) {
  page = page || 1;
  currentBrowsePage = page;
  const type = $("filterType").value;
  const category = $("filterCategory").value;
  const search = $("filterSearch").value;
  const sort = $("filterSort").value;

  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  if (sort) params.set("sort", sort);
  params.set("page", page);
  params.set("limit", "12");

  try {
    const data = await api("/media/browse?" + params.toString());
    $("browseGrid").innerHTML = data.items.length
      ? data.items.map(mediaCard).join("")
      : `<div class="empty-state">No results found. Try different filters.</div>`;
    $("resultsInfo").textContent = `Showing ${data.items.length} of ${data.total} results`;
    renderPagination(data.page, data.pages);
  } catch (e) {
    $("browseGrid").innerHTML = `<div class="empty-state">Error loading results.</div>`;
  }
}

function renderPagination(current, total) {
  if (total <= 1) { $("pagination").innerHTML = ""; return; }
  let html = "";
  if (current > 1) html += `<button class="btn" onclick="applyFilters(${current - 1})">← Prev</button>`;
  html += `<span class="page-info">Page ${current} of ${total}</span>`;
  if (current < total) html += `<button class="btn" onclick="applyFilters(${current + 1})">Next →</button>`;
  $("pagination").innerHTML = html;
}

/* ---- Detail Page ---- */
async function initDetail() {
  await checkAuth();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { $("detailPage").innerHTML = "<p>No asset specified.</p>"; return; }

  try {
    const { item } = await api("/media/detail/" + id);
    const typeIcons = { photo: "📷", video: "🎬", template: "🎨", audio: "🎵" };
    const typeColors = { photo: "#3ddc84", video: "#ef5b4d", template: "#3aa0e8", audio: "#f5b942" };
    const tags = item.tags ? item.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

    $("detailPage").innerHTML = `
      <div class="detail-grid">
        <div class="detail-preview" style="background: linear-gradient(135deg, ${typeColors[item.type]}22, ${typeColors[item.type]}55)">
          <div class="detail-placeholder">${typeIcons[item.type]}</div>
          <div class="detail-type-badge" style="background:${typeColors[item.type]}">${typeIcons[item.type]} ${item.type}</div>
        </div>
        <div class="detail-sidebar">
          <h1>${esc(item.title)}</h1>
          <p class="detail-desc">${esc(item.description)}</p>
          <div class="detail-price-row">
            <span class="detail-price">${fmtMoney(item.price)}</span>
            <button class="btn gold big" onclick="startPurchase('${item.id}', '${esc(item.title)}', ${item.price}, '${esc(item.creator_name)}')">Buy & Download</button>
          </div>
          <div class="detail-stats">
            <div>⬇️ <strong>${fmt(item.downloads)}</strong> downloads</div>
            <div>📁 ${esc(item.category_name || "Uncategorized")}</div>
          </div>
          ${tags.length ? `<div class="detail-tags">${tags.map(t => `<span class="tag-pill small" onclick="window.location.href='/browse?search=${encodeURIComponent(t)}'">${esc(t)}</span>`).join("")}</div>` : ""}
          <div class="detail-creator">
            <div class="creator-avatar">${esc((item.creator_name || "U").charAt(0))}</div>
            <div>
              <div class="creator-name">${esc(item.creator_name)}</div>
              <div class="creator-bio">${esc(item.creator_bio || "Creator on StockVault")}</div>
            </div>
          </div>
        </div>
      </div>`;
  } catch (e) {
    $("detailPage").innerHTML = `<div class="empty-state">Asset not found.</div>`;
  }
}

function startPurchase(id, title, price, creatorName) {
  if (!requireAuth()) return;
  openModal("purchase", { id, title, price, creator_name: creatorName });
}

async function confirmPurchase(mediaId) {
  try {
    const { downloadUrl } = await api("/payments/purchase/" + mediaId, { method: "POST" });
    closeModal();
    toast("Purchase successful! File ready.");
    if (downloadUrl && downloadUrl !== "/placeholder.svg") {
      window.open(downloadUrl, "_blank");
    }
  } catch (e) { toast(e.message); }
}

/* ---- Upload Page ---- */
let selectedFile = null;

function initUpload() {
  checkAuth();
  loadCategories();
  const dz = $("dropzone");
  const fi = $("fileInput");

  dz.onclick = () => fi.click();
  dz.ondragover = e => { e.preventDefault(); dz.classList.add("dragover"); };
  dz.ondragleave = () => dz.classList.remove("dragover");
  dz.ondrop = e => {
    e.preventDefault();
    dz.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  };
  fi.onchange = () => { if (fi.files.length) handleFile(fi.files[0]); };

  $("mediaPrice").addEventListener("input", updateCalc);
  updateCalc();
}

async function loadCategories() {
  try {
    const { categories } = await api("/media/categories");
    const sel = $("mediaCategory");
    sel.innerHTML = '<option value="">Select category</option>';
    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.icon + " " + c.name;
      sel.appendChild(opt);
    });
  } catch (e) { console.error(e); }
}

function handleFile(file) {
  selectedFile = file;
  $("dropzone").classList.add("hidden");
  $("filePreview").classList.remove("hidden");
  $("previewName").textContent = file.name;
  $("previewSize").textContent = (file.size / 1024 / 1024).toFixed(2) + " MB";

  if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = e => {
      $("previewThumb").innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  } else {
    const ext = file.name.split(".").pop().toLowerCase();
    const icons = { mp4: "🎬", webm: "🎬", mov: "🎬", mp3: "🎵", wav: "🎵", ogg: "🎵" };
    $("previewThumb").innerHTML = `<div class="thumb-ext">${icons[ext] || "📄"}</div>`;
  }

  const typeMap = {
    jpg: "photo", jpeg: "photo", png: "photo", gif: "photo", webp: "photo", svg: "photo",
    mp4: "video", webm: "video", mov: "video", avi: "video",
    mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
    psd: "template", ai: "template", fig: "template", sketch: "template", pdf: "template"
  };
  const autoType = typeMap[ext];
  if (autoType) $("mediaType").value = autoType;

  $("btnUpload").disabled = false;
}

function removeFile() {
  selectedFile = null;
  $("dropzone").classList.remove("hidden");
  $("filePreview").classList.add("hidden");
  $("btnUpload").disabled = true;
}

function updateCalc() {
  const price = parseFloat($("mediaPrice").value) || 0;
  $("calcPrice").textContent = price.toFixed(2);
  $("calcEarning").textContent = fmtMoney(price * 0.80);
}

async function submitUpload() {
  if (!requireAuth() || !selectedFile) return;
  const title = $("mediaTitle").value.trim();
  if (!title) { toast("Title is required"); return; }

  const fd = new FormData();
  fd.append("file", selectedFile);
  fd.append("title", title);
  fd.append("description", $("mediaDesc").value);
  fd.append("type", $("mediaType").value);
  fd.append("category_id", $("mediaCategory").value);
  fd.append("tags", $("mediaTags").value);
  fd.append("price", $("mediaPrice").value);

  $("btnUpload").disabled = true;
  $("btnUpload").textContent = "Uploading...";

  try {
    const { item } = await fetch(API + "/media/upload", {
      method: "POST",
      headers: { "Authorization": "Bearer " + localStorage.getItem("sv_token") },
      body: fd
    }).then(r => r.json());

    toast("Upload successful!");
    window.location.href = "/detail?id=" + item.id;
  } catch (e) {
    toast("Upload failed: " + e.message);
    $("btnUpload").disabled = false;
    $("btnUpload").textContent = "Upload Media";
  }
}

/* ---- Dashboard Page ---- */
async function initDashboard() {
  await checkAuth();
  if (!currentUser) { toast("Please log in first"); return; }

  try {
    const [stats, uploadsData] = await Promise.all([
      api("/media/my-stats"),
      api("/media/my-uploads")
    ]);

    $("dashUploads").textContent = fmt(stats.totalUploads);
    $("dashDownloads").textContent = fmt(stats.totalDownloads);
    $("dashEarnings").textContent = fmtMoney(stats.totalEarnings);

    try {
      const { user } = await api("/auth/me");
      $("dashBalance").textContent = fmtMoney(user.balance);
    } catch {}

    if (stats.recentPurchases.length) {
      $("salesList").innerHTML = stats.recentPurchases.map(p => `
        <div class="sale-row">
          <div class="sale-info">
            <span class="sale-type-badge">${p.type}</span>
            <span class="sale-title">${esc(p.title)}</span>
          </div>
          <div class="sale-amount">+${fmtMoney(p.creator_earning)}</div>
          <div class="sale-date">${new Date(p.created_at).toLocaleDateString()}</div>
        </div>`).join("");
    }

    if (uploadsData.items.length) {
      $("uploadsList").innerHTML = uploadsData.items.map(m => `
        <div class="upload-row">
          <div class="upload-info">
            <span class="sale-type-badge">${m.type}</span>
            <a href="/detail?id=${m.id}" class="sale-title">${esc(m.title)}</a>
          </div>
          <div class="upload-stats">
            <span>⬇️ ${fmt(m.downloads)}</span>
            <span>${fmtMoney(m.price)}</span>
          </div>
        </div>`).join("");
    }

    if (stats.dailyEarnings.length) {
      const max = Math.max(...stats.dailyEarnings.map(d => d.earnings), 1);
      $("earningsChart").innerHTML = stats.dailyEarnings.slice(0, 14).reverse().map(d => {
        const pct = (d.earnings / max * 100).toFixed(0);
        return `
          <div class="chart-bar-row">
            <span class="chart-label">${new Date(d.day).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
            <span class="chart-value">${fmtMoney(d.earnings)} (${d.sales})</span>
          </div>`;
      }).join("");
    }

    loadWithdrawals();
  } catch (e) { console.error(e); toast("Error loading dashboard"); }
}

/* ---- Withdrawals ---- */
let currentBalance = 0;

async function openWithdrawModal() {
  if (!requireAuth()) return;
  try {
    const { user } = await api("/auth/me");
    currentBalance = user.balance;
  } catch {}
  if (currentBalance < 5) {
    toast("Minimum withdrawal is $5.00. Your balance: " + fmtMoney(currentBalance));
    return;
  }
  openModal("withdraw");
}

async function doWithdraw() {
  const amount = parseFloat($("withdrawAmount").value);
  const method = $("withdrawMethod").value;
  const account = $("withdrawAccount").value.trim();

  if (!amount || amount < 5) { toast("Minimum withdrawal is $5.00"); return; }
  if (amount > currentBalance) { toast("Amount exceeds your balance"); return; }
  if (!account) { toast("Enter your account details"); return; }

  try {
    const result = await api("/payments/withdraw", {
      method: "POST",
      body: { amount, method, account_info: account }
    });
    closeModal();
    toast(result.message);
    $("dashBalance").textContent = fmtMoney(result.newBalance);
  } catch (e) { toast(e.message); }
}

async function loadWithdrawals() {
  try {
    const { withdrawals } = await api("/payments/my-withdrawals");
    if (withdrawals.length) {
      $("withdrawalsList").innerHTML = withdrawals.map(w => {
        const statusColors = { pending: "#f5b942", processing: "#3aa0e8", completed: "#3ddc84", rejected: "#ef5b4d" };
        const statusColor = statusColors[w.status] || "#8892a8";
        return `
          <div class="sale-row">
            <div class="sale-info">
              <span class="sale-type-badge" style="background:${statusColor}33;color:${statusColor}">${w.status}</span>
              <span class="sale-title">${fmtMoney(w.amount)} via ${w.method}</span>
            </div>
            <div class="sale-date">${new Date(w.created_at).toLocaleDateString()}</div>
          </div>`;
      }).join("");
    }
  } catch (e) { console.error(e); }
}

/* ---- Global close handlers ---- */
document.addEventListener("click", e => {
  const ud = $("userDrop");
  if (ud && !ud.classList.contains("hidden") && !e.target.closest(".user-avatar") && !e.target.closest(".user-dropdown")) {
    ud.classList.add("hidden");
  }
});

if (window.location.search.includes("?id=") === false && $("topSearch")) {
  $("topSearch").addEventListener("keydown", e => { if (e.key === "Enter") goSearch(); });
}
