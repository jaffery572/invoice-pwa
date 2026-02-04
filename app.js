/* Invoice Maker Lite (Beginner-friendly)
   - LocalStorage only
   - No backend
*/

const LS_KEY = "iml_invoices_v1";
const LS_BIZ = "iml_business_v1";

const el = (id) => document.getElementById(id);
const money = (n, cur) => `${cur} ${Number(n || 0).toFixed(2)}`;
const uid = () => Math.random().toString(16).slice(2, 8).toUpperCase() + "-" + Date.now().toString().slice(-5);

let state = {
  invoices: [],
  business: { name: "Your Business", phone: "", address: "", currency: "PKR" },
  currentId: null
};

// ---------- Storage ----------
function loadAll() {
  try {
    state.invoices = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { state.invoices = []; }

  try {
    state.business = JSON.parse(localStorage.getItem(LS_BIZ) || "null") || state.business;
  } catch {}
}

function saveInvoices() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.invoices));
}

function saveBusiness() {
  localStorage.setItem(LS_BIZ, JSON.stringify(state.business));
}

// ---------- Views ----------
function show(viewId) {
  ["viewHome","viewEditor","viewSettings"].forEach(v => el(v).classList.add("hidden"));
  el(viewId).classList.remove("hidden");
}

function openHome() {
  state.currentId = null;
  show("viewHome");
  renderList();
}

function openSettings() {
  el("bizName").value = state.business.name || "";
  el("bizPhone").value = state.business.phone || "";
  el("bizAddress").value = state.business.address || "";
  el("bizCurrency").value = state.business.currency || "PKR";
  show("viewSettings");
}

function openEditor(invoiceId = null) {
  show("viewEditor");
  state.currentId = invoiceId;

  // default form
  const today = new Date().toISOString().slice(0,10);
  el("invoiceDate").value = today;
  el("dueDate").value = "";
  el("clientName").value = "";
  el("clientPhone").value = "";
  el("discount").value = "0";
  el("tax").value = "0";
  el("items").innerHTML = "";

  if (invoiceId) {
    const inv = state.invoices.find(x => x.id === invoiceId);
    if (!inv) return openHome();

    el("editorTitle").textContent = "Edit Invoice";
    el("invoiceDate").value = inv.date || today;
    el("dueDate").value = inv.dueDate || "";
    el("clientName").value = inv.clientName || "";
    el("clientPhone").value = inv.clientPhone || "";
    el("discount").value = String(inv.discount || 0);
    el("tax").value = String(inv.tax || 0);

    (inv.items || []).forEach(addItemRow);
    if ((inv.items || []).length === 0) addItemRow();
  } else {
    el("editorTitle").textContent = "New Invoice";
    addItemRow();
  }

  updatePreview();
}

// ---------- Items UI ----------
function addItemRow(item = { name: "", qty: 1, rate: 0 }) {
  const row = document.createElement("div");
  row.className = "item-row";

  row.innerHTML = `
    <input class="it-name" placeholder="e.g. Logo design" value="${escapeHtml(item.name)}" />
    <input class="it-qty right" type="number" min="0" step="1" value="${Number(item.qty || 0)}" />
    <input class="it-rate right" type="number" min="0" step="0.01" value="${Number(item.rate || 0)}" />
    <input class="it-total right" type="text" value="0" disabled />
    <button class="icon-btn" title="Remove">✕</button>
  `;

  row.querySelector(".icon-btn").addEventListener("click", () => {
    row.remove();
    if (el("items").children.length === 0) addItemRow();
    updatePreview();
  });

  row.querySelectorAll("input").forEach(i => i.addEventListener("input", updatePreview));
  el("items").appendChild(row);
  updatePreview();
}

function readItemsFromUI() {
  const rows = Array.from(el("items").children);
  return rows.map(r => {
    const name = r.querySelector(".it-name").value.trim();
    const qty = Number(r.querySelector(".it-qty").value || 0);
    const rate = Number(r.querySelector(".it-rate").value || 0);
    return boastsEmpty(name, qty, rate) ? null : { name, qty, rate };
  }).filter(Boolean);
}

function boastsEmpty(name, qty, rate) {
  return (!name && qty === 0 && rate === 0);
}

function computeTotals(items, discount, taxPct) {
  const subtotal = items.reduce((sum, it) => sum + (it.qty * it.rate), 0);
  const disc = Math.max(0, Number(discount || 0));
  const taxable = Math.max(0, subtotal - disc);
  const tax = taxable * (Math.max(0, Number(taxPct || 0)) / 100);
  const grand = taxable + tax;
  return { subtotal, disc, tax, grand };
}

// ---------- Preview ----------
function updatePreview() {
  // Business
  el("pvBizName").textContent = state.business.name || "Your Business";
  el("pvBizPhone").textContent = state.business.phone ? `Phone: ${state.business.phone}` : "";
  el("pvBizAddress").textContent = state.business.address || "";

  const items = readItemsFromUI();
  const discount = Number(el("discount").value || 0);
  const taxPct = Number(el("tax").value || 0);

  const t = computeTotals(items, discount, taxPct);
  const cur = state.business.currency || "PKR";

  // Update item rows totals + preview table
  const uiRows = Array.from(el("items").children);
  uiRows.forEach(r => {
    const qty = Number(r.querySelector(".it-qty").value || 0);
    const rate = Number(r.querySelector(".it-rate").value || 0);
    r.querySelector(".it-total").value = money(qty * rate, cur);
  });

  el("subtotalVal").textContent = money(t.subtotal, cur);
  el("discountVal").textContent = money(t.disc, cur);
  el("taxVal").textContent = money(t.tax, cur);
  el("grandVal").textContent = money(t.grand, cur);

  // Invoice meta
  const inv = state.currentId ? state.invoices.find(x => x.id === state.currentId) : null;
  el("pvInvId").textContent = inv ? inv.id : "(not saved yet)";
  el("pvDate").textContent = el("invoiceDate").value || "—";
  el("pvDue").textContent = el("dueDate").value || "—";
  el("pvStatus").textContent = inv ? (inv.status || "unpaid") : "unpaid";

  // Client
  el("pvClient").textContent = el("clientName").value.trim() || "—";
  el("pvClientPhone").textContent = el("clientPhone").value.trim() ? `Phone: ${el("clientPhone").value.trim()}` : "";

  // Table
  const tbody = el("pvItems");
  tbody.innerHTML = "";
  items.forEach(it => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it.name)}</td>
      <td class="right">${Number(it.qty || 0)}</td>
      <td class="right">${money(it.rate, cur)}</td>
      <td class="right">${money(it.qty * it.rate, cur)}</td>
    `;
    tbody.appendChild(tr);
  });

  el("pvSubtotal").textContent = money(t.subtotal, cur);
  el("pvDiscount").textContent = money(t.disc, cur);
  el("pvTax").textContent = money(t.tax, cur);
  el("pvGrand").textContent = money(t.grand, cur);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---------- CRUD ----------
function saveCurrentInvoice() {
  const clientName = el("clientName").value.trim();
  if (!clientName) {
    alert("Client name is required.");
    return;
  }

  const items = readItemsFromUI();
  if (items.length === 0) {
    alert("Please add at least one item.");
    return;
  }

  const discount = Number(el("discount").value || 0);
  const tax = Number(el("tax").value || 0);
  const totals = computeTotals(items, discount, tax);

  const payload = {
    id: state.currentId || uid(),
    date: el("invoiceDate").value || new Date().toISOString().slice(0,10),
    dueDate: el("dueDate").value || "",
    clientName,
    clientPhone: el("clientPhone").value.trim(),
    items,
    discount,
    tax,
    totals,
    currency: state.business.currency || "PKR",
    status: (state.currentId ? (state.invoices.find(x => x.id === state.currentId)?.status || "unpaid") : "unpaid"),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (state.currentId) {
    const idx = state.invoices.findIndex(x => x.id === state.currentId);
    state.invoices[idx] = { ...state.invoices[idx], ...payload, updatedAt: Date.now() };
  } else {
    state.invoices.unshift(payload);
    state.currentId = payload.id;
  }

  saveInvoices();
  updatePreview();
  alert("Saved!");
}

function deleteCurrentInvoice() {
  if (!state.currentId) return;
  const ok = confirm("Delete this invoice?");
  if (!ok) return;

  state.invoices = state.invoices.filter(x => x.id !== state.currentId);
  saveInvoices();
  openHome();
}

function togglePaid() {
  if (!state.currentId) return alert("Save invoice first.");
  const inv = state.invoices.find(x => x.id === state.currentId);
  if (!inv) return;

  inv.status = (inv.status === "paid") ? "unpaid" : "paid";
  inv.updatedAt = Date.now();
  saveInvoices();
  updatePreview();
  renderList();
}

// ---------- List ----------
function renderList() {
  const list = el("invoiceList");
  const empty = el("emptyState");

  const q = (el("searchBox").value || "").toLowerCase().trim();
  const st = el("statusFilter").value;

  let items = [...state.invoices];

  if (st !== "all") items = items.filter(x => (x.status || "unpaid") === st);
  if (q) items = items.filter(x =>
    (x.clientName || "").toLowerCase().includes(q) ||
    (x.id || "").toLowerCase().includes(q)
  );

  list.innerHTML = "";
  if (items.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  items.forEach(inv => {
    const cur = inv.currency || state.business.currency || "PKR";
    const grand = inv.totals?.grand ?? 0;
    const div = document.createElement("div");
    div.className = "item-card";

    div.innerHTML = `
      <div class="item-left">
        <div><b>${escapeHtml(inv.clientName || "Client")}</b> <span class="small">(${inv.id})</span></div>
        <div class="small">Date: ${inv.date || "—"} ${inv.dueDate ? `• Due: ${inv.dueDate}` : ""}</div>
        <span class="badge ${inv.status === "paid" ? "paid" : "unpaid"}">${inv.status === "paid" ? "Paid" : "Unpaid"}</span>
      </div>
      <div class="item-right">
        <div><b>${money(grand, cur)}</b></div>
        <div class="small">${(inv.items || []).length} item(s)</div>
        <div style="margin-top:8px">
          <button class="btn">Open</button>
        </div>
      </div>
    `;

    div.querySelector("button").addEventListener("click", () => openEditor(inv.id));
    list.appendChild(div);
  });
}

// ---------- Actions ----------
function printInvoice() {
  // Print CSS already hides everything except invoice
  window.print();
}

function whatsappShare() {
  const inv = state.currentId ? state.invoices.find(x => x.id === state.currentId) : null;
  if (!inv) return alert("Save invoice first.");

  const cur = inv.currency || state.business.currency || "PKR";
  const grand = inv.totals?.grand ?? 0;

  const msg =
`Invoice ${inv.id}
Client: ${inv.clientName}
Total: ${money(grand, cur)}
Date: ${inv.date}${inv.dueDate ? ` | Due: ${inv.dueDate}` : ""}

Sent via Invoice Maker Lite`;

  const phone = (inv.clientPhone || "").replace(/\D/g,""); // digits only
  const encoded = encodeURIComponent(msg);

  // If phone exists, use direct chat; otherwise open share chooser
  const url = phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, "_blank");
}

// ---------- Settings ----------
function saveSettingsFromUI() {
  state.business.name = el("bizName").value.trim() || "Your Business";
  state.business.phone = el("bizPhone").value.trim();
  state.business.address = el("bizAddress").value.trim();
  state.business.currency = el("bizCurrency").value;
  saveBusiness();
  alert("Settings saved!");
  openHome();
}

function resetAllData() {
  const ok = confirm("This will delete ALL invoices + settings. Continue?");
  if (!ok) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_BIZ);
  loadAll();
  openHome();
}

// ---------- Event wiring ----------
function wire() {
  el("btnNew").addEventListener("click", () => openEditor(null));
  el("btnSettings").addEventListener("click", openSettings);
  el("btnCloseSettings").addEventListener("click", openHome);
  el("btnSaveSettings").addEventListener("click", saveSettingsFromUI);
  el("btnResetAll").addEventListener("click", resetAllData);

  el("btnCancelEditor").addEventListener("click", openHome);
  el("btnAddItem").addEventListener("click", () => addItemRow());

  ["clientName","clientPhone","invoiceDate","dueDate","discount","tax"].forEach(id=>{
    el(id).addEventListener("input", updatePreview);
    el(id).addEventListener("change", updatePreview);
  });

  el("btnSaveInvoice").addEventListener("click", saveCurrentInvoice);
  el("btnDelete").addEventListener("click", deleteCurrentInvoice);
  el("btnMarkPaid").addEventListener("click", togglePaid);
  el("btnPrint").addEventListener("click", printInvoice);
  el("btnWhatsApp").addEventListener("click", whatsappShare);

  el("searchBox").addEventListener("input", renderList);
  el("statusFilter").addEventListener("change", renderList);

  // Install hint
  setTimeout(()=> el("installHint").classList.remove("hidden"), 1200);
}

// ---------- Init ----------
loadAll();
wire();
openHome();
