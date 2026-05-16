const PASS = "order@admin2024";
const LOGIN_KEY = "ot_admin";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const DB_URL = "https://order-tracker-e59a4-default-rtdb.firebaseio.com";

let isAdmin = false;
let orders = [];
let trashItems = [];
let editingKey = null;

function init() {
  showApp();
  fetchOrders();
  fetchTrash();
}

function showApp() {
  document.getElementById("setupScreen").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  if (localStorage.getItem(LOGIN_KEY) === "yes") setAdmin(true);
}

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

function fetchTrash() {
  fetch(DB_URL + "/trash.json")
    .then(r => r.json())
    .then(data => {
      trashItems = [];
      if (data) Object.entries(data).forEach(([k, v]) => trashItems.push({ fireKey: k, ...v }));
      trashItems.sort((a, b) => b.deletedAt - a.deletedAt);
      const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
      trashItems.forEach(item => {
        if (item.deletedAt < cutoff) {
          fetch(DB_URL + "/trash/" + item.fireKey + ".json", { method: "DELETE" });
        }
      });
      trashItems = trashItems.filter(item => item.deletedAt >= cutoff);
      renderTrashBadge();
    })
    .catch(() => {});
}

function renderTrashBadge() {
  const badge = document.getElementById("trashBadge");
  if (badge) badge.textContent = trashItems.length > 0 ? trashItems.length : "";
}

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

  if (editingKey) {
    fetch(DB_URL + "/orders/" + editingKey + ".json", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myId, otherId, profit, note })
    }).then(() => {
      clearForm();
      document.getElementById("addOk").textContent = "✓ Updated!";
      setTimeout(() => { document.getElementById("addOk").textContent = ""; }, 2000);
      fetchOrders();
    }).catch(() => {
      document.getElementById("addErr").textContent = "❌ Update failed.";
    });
  } else {
    fetch(DB_URL + "/orders.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myId, otherId, profit, note, date, ts: Date.now(), month, year })
    }).then(() => {
      clearForm();
      document.getElementById("addOk").textContent = "✓ Saved & synced!";
      setTimeout(() => { document.getElementById("addOk").textContent = ""; }, 2000);
      fetchOrders();
    }).catch(() => {
      document.getElementById("addErr").textContent = "❌ Save failed. Check your internet.";
    });
  }
}

function clearForm() {
  ["myId", "otherId", "profit", "note"].forEach(id => document.getElementById(id).value = "");
  editingKey = null;
  document.getElementById("saveBtn").textContent = "+ Save Order";
  document.getElementById("cancelEdit").style.display = "none";
  document.getElementById("addErr").textContent = "";
}

function startEdit(key) {
  const order = orders.find(o => o.fireKey === key);
  if (!order) return;
  editingKey = key;
  document.getElementById("myId").value = order.myId || "";
  document.getElementById("otherId").value = order.otherId || "";
  document.getElementById("profit").value = order.profit || "";
  document.getElementById("note").value = order.note || "";
  document.getElementById("saveBtn").textContent = "✓ Update Order";
  document.getElementById("cancelEdit").style.display = "inline-flex";
  document.getElementById("addCard").scrollIntoView({ behavior: "smooth" });
}

function deleteOrder(key) {
  if (!isAdmin || !confirm("Move to Trash?")) return;
  const order = orders.find(o => o.fireKey === key);
  if (!order) return;
  const trashData = { ...order, deletedAt: Date.now() };
  delete trashData.fireKey;
  fetch(DB_URL + "/trash.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trashData)
  }).then(() => {
    return fetch(DB_URL + "/orders/" + key + ".json", { method: "DELETE" });
  }).then(() => {
    fetchOrders();
    fetchTrash();
  }).catch(() => alert("Delete failed."));
}

function openTrash() {
  fetchTrash();
  document.getElementById("trashModal").style.display = "flex";
  setTimeout(renderTrashModal, 400);
}

function closeTrash() {
  document.getElementById("trashModal").style.display = "none";
}

function renderTrashModal() {
  const el = document.getElementById("trashList");
  if (!trashItems.length) {
    el.innerHTML = '<div class="empty">🗑 Trash is empty</div>';
    return;
  }
  const now = Date.now();
  el.innerHTML = trashItems.map(item => {
    const daysLeft = Math.ceil((15 * 24 * 60 * 60 * 1000 - (now - item.deletedAt)) / (24 * 60 * 60 * 1000));
    return `
    <div class="trash-row">
      <div class="trash-info">
        <div class="cell">${esc(item.myId)}</div>
        <div class="cell-dim">${item.otherId ? esc(item.otherId) : "—"}</div>
        <div class="cell-profit">৳${Math.round(item.profit || 0).toLocaleString("en-IN")}</div>
        <div class="trash-expiry">📅 ${item.date || "—"} &nbsp;·&nbsp; ⏳ ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left</div>
      </div>
      <div class="trash-actions">
        <button class="btn-restore" onclick="restoreOrder('${item.fireKey}')">↩ Restore</button>
        <button class="btn-perm-del" onclick="permDelete('${item.fireKey}')">✕ Delete</button>
      </div>
    </div>`;
  }).join("");
}

function restoreOrder(trashKey) {
  const item = trashItems.find(t => t.fireKey === trashKey);
  if (!item) return;
  const orderData = { ...item };
  delete orderData.fireKey;
  delete orderData.deletedAt;
  fetch(DB_URL + "/orders.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData)
  }).then(() => {
    return fetch(DB_URL + "/trash/" + trashKey + ".json", { method: "DELETE" });
  }).then(() => {
    fetchOrders();
    fetchTrash();
    setTimeout(renderTrashModal, 500);
  }).catch(() => alert("Restore failed."));
}

function permDelete(trashKey) {
  if (!confirm("Permanently delete? Cannot be undone.")) return;
  fetch(DB_URL + "/trash/" + trashKey + ".json", { method: "DELETE" })
    .then(() => {
      fetchTrash();
      setTimeout(renderTrashModal, 400);
    });
}

function renderAll() {
  document.getElementById("totalOrders").textContent = orders.length;
  document.getElementById("totalProfit").textContent = "৳" + Math.round(orders.reduce((s, o) => s + (o.profit || 0), 0)).toLocaleString("en-IN");
  populateYearDropdown();
  renderSummary();
  renderOrders();
}

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
      ${isAdmin ? `
        <div class="row-actions">
          <button class="btn-edit" onclick="startEdit('${o.fireKey}')" title="Edit">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-del" onclick="deleteOrder('${o.fireKey}')" title="Move to Trash">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>` : `<div></div>`}
    </div>`).join("");
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

window.addEventListener("click", function(e) {
  if (e.target === document.getElementById("trashModal")) closeTrash();
});

init();
