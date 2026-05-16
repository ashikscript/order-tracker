const PASS = "order@admin2024";
const DB_KEY = "ot_db_url";
const LOGIN_KEY = "ot_admin";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let isAdmin = false;
let orders = [];
let DB_URL = "";

/* ── INIT ── */
function init() {
  const s = localStorage.getItem(DB_KEY);
  if (s) { DB_URL = s; showApp(); fetchOrders(); }
  else document.getElementById("setupScreen").style.display = "flex";
}

/* ── SETUP ── */
function saveSetup() {
  const url = document.getElementById("dbUrl").value.trim().replace(/\/$/, "");
  const eEl = document.getElementById("setupErr");
  const hEl = document.getElementById("setupHint");
  eEl.textContent = ""; hEl.textContent = "";
  if (!url.startsWith("https://")) {
    eEl.textContent = "Please enter a valid https:// URL."; return;
  }
  hEl.textContent = "Checking connection...";
  fetch(url + "/orders.json")
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(() => {
      DB_URL = url;
      localStorage.setItem(DB_KEY, url);
      hEl.textContent = "";
      showApp(); fetchOrders();
    })
    .catch(() => {
      hEl.textContent = "";
      eEl.textContent = "❌ URL not working. Please check Firebase console.";
    });
}

function showApp() {
  document.getElementById("setupScreen").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  if (localStorage.getItem(LOGIN_KEY) === "yes") setAdmin(true);
}

/* ── SYNC ── */
function setSyncStatus(s) {
  const el = document.getElementById("syncStatus");
  if (s === "ok") el.innerHTML = '<div class="dot"></div><span>Live</span>';
  else if (s === "syncing") el.innerHTML = '<span style="color:var(--text3)">Syncing...</span>';
  else el.innerHTML = '<span style="color:var(--red)">⚠ Offline</span>';
}

function fetchOrders() {
  setSyncStatus("syncing");
  fetch(DB_URL + "/orders.json")
    .then(r => r.json())
    .then(data => {
      orders = [];
      if (data) Object.entries(data).forEach(([k, v]) => orders.push({ fireKey: k, ...v }));
      orders.sort((a, b) => b.ts - a.ts);
      setSyncStatus("ok");
      renderAll();
    })
    .catch(() => setSyncStatus("err"));
}

/* ── AUTH ── */
function setAdmin(on) {
  isAdmin = on;
  if (on) {
    document.getElementById("lockCard").style.display = "none";
    document.getElementById("addCard").style.display = "block";
    document.getElementById("authBadge").innerHTML = "✓ Admin <span style='opacity:.55;font-size:10px'>· Logout</span>";
    document.getElementById("authBadge").className = "badge badge-admin";
  } else {
    document.getElementById("addCard").style.display = "none";
    document.getElementById("lockCard").style.display = "block";
    document.getElementById("authBadge").textContent = "🔒 Locked";
    document.getElementById("authBadge").className = "badge badge-locked";
    document.getElementById("passInput").value = "";
  }
  renderOrders();
}

function tryLogin() {
  if (document.getElementById("passInput").value === PASS) {
    localStorage.setItem(LOGIN_KEY, "yes");
    document.getElementById("passErr").textContent = "";
    setAdmin(true);
  } else {
    document.getElementById("passErr").textContent = "❌ Wrong password!";
  }
}

function handleBadgeClick() {
  if (!isAdmin) return;
  if (!confirm("Logout from this device?")) return;
  localStorage.removeItem(LOGIN_KEY);
  setAdmin(false);
}

/* ── SAVE / DELETE ── */
function saveOrder() {
  const myId = document.getElementById("myId").value.trim();
  const otherId = document.getElementById("otherId").value.trim();
  const profit = parseFloat(document.getElementById("profit").value) || 0;
  const note = document.getElementById("note").value.trim();
  if (!myId) { document.getElementById("addErr").textContent = "My Site Order ID is required!"; return; }
  document.getElementById("addErr").textContent = "";
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  const month = now.getMonth();
  const year = now.getFullYear();
  fetch(DB_URL + "/orders.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ myId, otherId, profit, note, date, ts: Date.now(), month, year })
  }).then(() => {
    ["myId", "otherId", "profit", "note"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("addOk").textContent = "✓ Saved & synced!";
    setTimeout(() => { document.getElementById("addOk").textContent = ""; }, 2000);
    fetchOrders();
  }).catch(() => {
    document.getElementById("addErr").textContent = "❌ Save failed. Check your internet.";
  });
}

function deleteOrder(key) {
  if (!isAdmin || !confirm("Delete this order?")) return;
  fetch(DB_URL + "/orders/" + key + ".json", { method: "DELETE" })
    .then(() => fetchOrders())
    .catch(() => alert("Delete failed."));
}

/* ── RENDER ── */
function renderAll() {
  document.getElementById("totalOrders").textContent = orders.length;
  document.getElementById("totalProfit").textContent = "৳" + Math.round(orders.reduce((s, o) => s + (o.profit || 0), 0)).toLocaleString("en-IN");
  populateYearDropdown();
  renderSummary();
  renderOrders();
}

/* ── SUMMARY ── */
function populateYearDropdown() {
  const years = [...new Set(orders.map(o => o.year || new Date(o.ts).getFullYear()))].sort((a, b) => b - a);
  const sel = document.getElementById("summaryYear");
  const cur = sel.value;
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  if (cur && years.includes(Number(cur))) sel.value = cur;
}

function populateMonthDropdown(year) {
  const sel = document.getElementById("summaryMonth");
  if (!sel) return;
  // Only show months that have data
  const yearOrders = orders.filter(o => (o.year || new Date(o.ts).getFullYear()) === year);
  const usedMonths = [...new Set(yearOrders.map(o => o.month !== undefined ? o.month : new Date(o.ts).getMonth()))].sort((a, b) => a - b);
  const curMonth = parseInt(sel.value);
  sel.innerHTML = usedMonths.length
    ? usedMonths.map(m => `<option value="${m}">${MONTHS[m]}</option>`).join("")
    : `<option value="">No data</option>`;
  if (usedMonths.includes(curMonth)) sel.value = curMonth;
}

function onYearChange() {
  const year = parseInt(document.getElementById("summaryYear").value) || new Date().getFullYear();
  populateMonthDropdown(year);
  renderSummary();
}

function renderSummary() {
  const type = document.getElementById("summaryType").value;
  const year = parseInt(document.getElementById("summaryYear").value) || new Date().getFullYear();
  const el = document.getElementById("summaryContent");
  const monthSelWrap = document.getElementById("monthSelWrap");

  if (type === "monthly") {
    monthSelWrap.style.display = "block";
    populateMonthDropdown(year);
    const month = parseInt(document.getElementById("summaryMonth").value);
    if (isNaN(month)) { el.innerHTML = '<div class="empty">No data for this year</div>'; return; }
    const yearOrders = orders.filter(o => (o.year || new Date(o.ts).getFullYear()) === year);
    const monthOrders = yearOrders.filter(o => (o.month !== undefined ? o.month : new Date(o.ts).getMonth()) === month);
    const monthProfit = monthOrders.reduce((s, o) => s + (o.profit || 0), 0);
    const yearProfit = yearOrders.reduce((s, o) => s + (o.profit || 0), 0);
    el.innerHTML = `
      <div class="summary-total">
        <div class="summary-total-label">${MONTHS[month]} ${year}</div>
        <div class="summary-total-val">৳${Math.round(monthProfit).toLocaleString("en-IN")}</div>
        <div style="font-size:11px;color:var(--green);margin-top:2px">${monthOrders.length} orders</div>
      </div>
      <div class="summary-item" style="margin-top:8px">
        <div class="summary-item-label">Full Year ${year}</div>
        <div class="summary-item-val">৳${Math.round(yearProfit).toLocaleString("en-IN")}</div>
        <div class="summary-item-sub">${yearOrders.length} orders</div>
      </div>`;
  } else {
    monthSelWrap.style.display = "none";
    const years = [...new Set(orders.map(o => o.year || new Date(o.ts).getFullYear()))].sort((a, b) => b - a);
    if (!years.length) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
    const yearData = years.map(y => ({
      year: y,
      profit: orders.filter(o => (o.year || new Date(o.ts).getFullYear()) === y).reduce((s, o) => s + (o.profit || 0), 0),
      count: orders.filter(o => (o.year || new Date(o.ts).getFullYear()) === y).length
    }));
    const allTotal = orders.reduce((s, o) => s + (o.profit || 0), 0);
    el.innerHTML = `
      <div class="summary-total">
        <div class="summary-total-label">All Time Total</div>
        <div class="summary-total-val">৳${Math.round(allTotal).toLocaleString("en-IN")}</div>
        <div style="font-size:11px;color:var(--green);margin-top:2px">${orders.length} orders</div>
      </div>
      <div class="summary-grid">
        ${yearData.map(y => `
          <div class="summary-item">
            <div class="summary-item-label">${y.year}</div>
            <div class="summary-item-val">৳${Math.round(y.profit).toLocaleString("en-IN")}</div>
            <div class="summary-item-sub">${y.count} orders</div>
          </div>`).join("")}
      </div>`;
  }
}

/* ── EXPORT EXCEL ── */
function exportExcel() {
  if (!orders.length) { alert("No orders to export."); return; }
  const rows = [["My Order ID", "Other Order ID", "Profit (৳)", "Note", "Date"]];
  orders.forEach(o => rows.push([o.myId || "", o.otherId || "", o.profit || 0, o.note || "", o.date || ""]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── ORDERS TABLE ── */
function renderOrders() {
  const q = document.getElementById("searchBox").value.trim().toLowerCase();
  let list = q ? orders.filter(o => (o.myId + " " + o.otherId + " " + o.note).toLowerCase().includes(q)) : orders;
  const show = list.slice(0, 5);
  const el = document.getElementById("orderList");
  const cEl = document.getElementById("orderCount");
  if (!show.length) { el.innerHTML = '<div class="empty">No orders found</div>'; cEl.textContent = ""; return; }
  cEl.textContent = list.length > 5 ? `Showing 5 of ${list.length}` : `${list.length} orders`;
  el.innerHTML =
    `<div class="tbl-head">
      <div class="tbl-hcell">My Order</div>
      <div class="tbl-hcell">Other Order</div>
      <div class="tbl-hcell">Profit</div>
      <div class="tbl-hcell">Date</div>
      <div></div>
    </div>` +
    show.map(o => `
    <div class="order-row">
      <div>
        <div class="cell">${esc(o.myId)}</div>
        ${o.note ? `<div class="sub-note">${esc(o.note)}</div>` : ""}
      </div>
      <div class="cell-dim">${o.otherId ? esc(o.otherId) : "—"}</div>
      <div class="cell-profit">৳${Math.round(o.profit || 0).toLocaleString("en-IN")}</div>
      <div class="cell-date">${o.date || "—"}</div>
      ${isAdmin ? `<button class="btn-del" onclick="deleteOrder('${o.fireKey}')">✕</button>` : `<div></div>`}
    </div>`).join("");
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

init();
