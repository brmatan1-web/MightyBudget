// MightyBudget V4 - עסקאות מקובצות לפי מועד חיוב
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxG9AtUDu-M6fVGhrRiscb6V2KyH0CMsPbc4SRk-ffh0upQ6GdYli9kq8UW8s-8nO2EzQ/exec";

let state = { dashboard: {}, cards: [], categories: [], transactions: [], lastSync: null };
let filter = "open";
let editIndex = null;

const $ = s => document.querySelector(s);
const fmt = n => "₪" + Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 });
const ICONS = { "סופר ומזון": "🛒", "ילדים": "🧸", "מסעדות ובתי קפה": "☕", "רכב ותחבורה": "🚗", "ביגוד ובית": "🏠",
  "חשמל": "⚡", "מים": "💧", "ארנונה ועירייה": "🏛️", "חופשות": "🏨", "פארם": "💊", "ביטוחים": "🛡️",
  "תקשורת ומנויים": "📱", "עמלות": "🧾", "לא מסווג": "❔" };
const icon = n => ICONS[n] || "📁";
const COLORS = ["#21aecd", "#7159e7", "#ea8f44", "#48aa83", "#d75f86"];
const api = () => localStorage.mb_api || DEFAULT_API_URL;
const pin = () => localStorage.mb_pin || "";
const TITLES = { home: "שלום, מתן", charges: "חיובים", transactions: "עסקאות", categories: "קטגוריות", accounts: "חשבונות וחיבורים", settings: "הגדרות" };

function dayMonth(iso, long) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", long ? { day: "numeric", month: "long" } : { day: "numeric", month: "numeric" });
}

function go(p) {
  document.querySelectorAll(".page, nav button").forEach(x => x.classList.remove("active"));
  document.querySelector(`[data-page="${p}"]`).classList.add("active");
  document.querySelector(`[data-target="${p}"]`).classList.add("active");
  $("#title").textContent = TITLES[p];
  scrollTo(0, 0);
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => go(b.dataset.target));
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));

async function load() {
  try {
    const r = await fetch(api() + (api().includes("?") ? "&" : "?") + "v=" + Date.now());
    const d = await r.json();
    state = {
      dashboard: d.dashboard || {},
      cards: d.cards || [],
      categories: (d.categories || []).map((c, i) => ({ ...c, spent: Number(c.spent || 0), budget: Number(c.budget || 0), icon: c.icon || icon(c.name), color: COLORS[i % COLORS.length] })),
      transactions: d.transactions || [],
      lastSync: d.lastSync
    };
    $("#apiState").textContent = "מחובר";
    render();
  } catch (e) {
    console.error(e);
    $("#apiState").textContent = "שגיאת חיבור";
    toast("לא ניתן לטעון נתונים");
  }
}

function render() { renderHome(); renderCharges(); renderTransactions(); renderCategories(); renderAccounts(); }

function renderHome() {
  const d = state.dashboard;
  $("#month").textContent = d.month || "החודש הקרוב";
  $("#confirmed").textContent = fmt(d.confirmedAmount);
  $("#forecast").textContent = fmt(d.forecastAmount);
  $("#certain").textContent = fmt(d.confirmedAmount);
  $("#estimated").textContent = fmt(d.estimatedAmount);
  $("#chargeMonth").textContent = d.month ? "חיוב " + d.month : "";
  $("#lastSync").textContent = state.lastSync ? "עודכן " + new Date(state.lastSync).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";

  const active = state.cards.filter(c => +c.amount > 0);
  $("#breakdown").innerHTML = active.length
    ? active.map(c => `<div class="line"><span>כרטיס ${c.card}</span><b>${fmt(c.amount)}</b></div>`).join("")
    : "אין חיובים שנצברו";

  const top = [...state.categories].filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 2);
  $("#topCategories").innerHTML = top.length
    ? top.map(c => `<div class="topcat"><span class="icon">${c.icon}</span><div class="main"><b>${c.name}</b><small>${c.budget ? Math.round(c.spent / c.budget * 100) + "% מהתקציב" : "ללא תקציב"}</small></div><strong>${fmt(c.spent)}</strong></div>`).join("")
    : `<p class="empty">אין הוצאות החודש</p>`;

  const recent = state.transactions.filter(t => t.status === "OPEN").slice(0, 4);
  $("#recent").innerHTML = recent.length ? recent.map(txHtml).join("") : `<p class="empty">אין עסקאות פתוחות</p>`;
}

function renderCharges() {
  const groups = {};
  state.transactions.filter(t => t.status === "OPEN" && t.chargeDate).forEach(t => {
    groups[t.chargeDate] = groups[t.chargeDate] || {};
    groups[t.chargeDate][t.card] = (groups[t.chargeDate][t.card] || 0) + (+t.amount || 0);
  });
  const dates = Object.keys(groups).sort();
  $("#charges").innerHTML = dates.length ? dates.map(date => {
    const cards = groups[date];
    const total = Object.values(cards).reduce((s, v) => s + v, 0);
    return `<div class="charge">
      <div class="chargehead"><div><b>${dayMonth(date, true)}</b><small>${Object.keys(cards).length} כרטיסים</small></div><strong>${fmt(total)}</strong></div>
      ${Object.entries(cards).map(([c, a]) => `<div class="account"><span class="icon">💳</span><div class="main"><b>כרטיס ${c}</b></div><b>${fmt(a)}</b></div>`).join("")}
    </div>`;
  }).join("") : `<p class="empty">אין חיובים פתוחים</p>`;
}

function txHtml(t) {
  const charged = t.status === "CHARGED";
  const badge = t.chargeDate
    ? `<span class="badge ${charged ? "charged" : "open"}">${charged ? "חויב " : "יורד "}${dayMonth(t.chargeDate)}</span>`
    : "";
  return `<div class="tx${charged ? " charged" : ""}">
    <span class="icon">${icon(t.category)}</span>
    <div class="main"><b>${t.name || "עסקה"}</b><small>${t.category || "לא מסווג"} • ${t.date || ""}${t.installment ? " • תשלום " + t.installment : ""}</small>${badge}</div>
    <div class="amount"><b>${fmt(t.amount)}</b><small>${t.card || ""}</small></div>
  </div>`;
}

// עסקאות מקובצות לפי מועד החיוב
function renderTransactions() {
  let list = [...state.transactions];
  const q = $("#search").value.trim();
  if (q) list = list.filter(t => ((t.name || "") + (t.category || "")).includes(q));
  if (filter === "open") list = list.filter(t => t.status === "OPEN");
  if (filter === "charged") list = list.filter(t => t.status === "CHARGED");
  if (filter === "uncat") list = list.filter(t => !t.category || t.category === "לא מסווג");
  $("#txCount").textContent = list.length;
  $("#txTotal").textContent = fmt(list.reduce((s, t) => s + (+t.amount || 0), 0));
  if (!list.length) { $("#transactions").innerHTML = `<p class="empty">אין עסקאות</p>`; return; }

  const groups = {};
  list.forEach(t => { const k = t.chargeDate || "zz"; (groups[k] = groups[k] || []).push(t); });
  const keys = Object.keys(groups).sort();
  if (filter !== "open") keys.reverse();

  $("#transactions").innerHTML = keys.map(k => {
    const items = groups[k];
    const total = items.reduce((s, t) => s + (+t.amount || 0), 0);
    const cards = [...new Set(items.map(t => t.card))].join(" • ");
    const title = k === "zz" ? "ללא מועד חיוב" : (items[0].status === "CHARGED" ? "חויב ב־" : "יורד ב־") + dayMonth(k, true);
    return `<div class="txgroup">
      <div class="chargehead"><div><b>${title}</b><small>כרטיסים ${cards} • ${items.length} עסקאות</small></div><strong>${fmt(total)}</strong></div>
      ${items.map(txHtml).join("")}
    </div>`;
  }).join("");
}

function catHtml(c, i) {
  const p = c.budget ? Math.round(c.spent / c.budget * 100) : 0;
  return `<div class="row" data-i="${i}">
    <span class="icon">${c.icon}</span>
    <div class="main"><b>${c.name}</b><small>${fmt(c.spent)} הוצאה • ${c.budget ? "תקציב " + fmt(c.budget) : "ללא תקציב"}</small>
      <div class="bar"><i style="width:${Math.min(100, p)}%;background:${p >= 100 ? "#dc4f5c" : c.color}"></i></div></div>
    <div class="amount"><b>${c.budget ? fmt(Math.max(0, c.budget - c.spent)) : "—"}</b><small>${c.budget ? "נותרו" : "ערוך"}</small></div>
  </div>`;
}
function renderCategories() {
  $("#categories").innerHTML = state.categories.length ? state.categories.map(catHtml).join("") : `<p class="empty">אין קטגוריות</p>`;
  document.querySelectorAll("[data-i]").forEach(x => x.onclick = () => openCat(+x.dataset.i));
}

function renderAccounts() {
  $("#accounts").innerHTML = state.cards.length ? `<div class="connection">
    <div class="provider"><span class="icon">💳</span><div class="main"><b>ישראכרט</b><small>מחובר • ${state.cards.length} כרטיסים</small></div></div>
    ${state.cards.map(c => `<div class="account"><span class="icon">💳</span><div class="main"><b>כרטיס ${c.card}</b><small>${c.owner || ""} • יום חיוב ${c.chargeDay || "—"} • חיתוך ${c.cutoffDay || "סוף חודש"}</small></div></div>`).join("")}
  </div>` : `<p class="empty">אין חשבונות מחוברים</p>`;
}

function openSheet(id) { $("#overlay").classList.add("show"); $("#" + id).classList.add("show"); }
function closeSheets() { $("#overlay").classList.remove("show"); document.querySelectorAll(".sheet").forEach(s => s.classList.remove("show")); }

function openCat(i = null) {
  editIndex = i;
  const c = i === null ? { name: "", budget: "", icon: "📁" } : state.categories[i];
  $("#modalTitle").textContent = i === null ? "הוספת קטגוריה" : "עריכת קטגוריה";
  $("#catName").value = c.name;
  $("#catBudget").value = c.budget || "";
  $("#catIcon").value = c.icon;
  openSheet("categoryModal");
}

async function saveCat() {
  const old = editIndex === null ? "" : state.categories[editIndex].name;
  const item = { name: $("#catName").value.trim(), budget: +$("#catBudget").value || 0, icon: $("#catIcon").value || "📁" };
  if (!item.name) return;
  if (editIndex === null) state.categories.push({ ...item, spent: 0, color: COLORS[state.categories.length % COLORS.length] });
  else Object.assign(state.categories[editIndex], item);
  render(); closeSheets();
  if (!pin()) { toast("נשמר במכשיר בלבד. להגדרת קוד: הגדרות"); return; }
  try {
    await fetch(api(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "saveCategory", pin: pin(), category: item, oldName: old }) });
    toast("נשמר");
  } catch (e) { console.warn(e); toast("השמירה לגיליון נכשלה"); }
}

function toast(m) { $("#toast").textContent = m; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 2000); }

document.querySelectorAll(".chips button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".chips button").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); filter = b.dataset.filter; renderTransactions();
});
$("#search").oninput = renderTransactions;
$("#addCategory").onclick = () => openCat();
$("#saveCategory").onclick = saveCat;
$("#addAccount").onclick = () => toast("חיבור חשבון מתוך האפליקציה יתווסף בהמשך");
$("#connectionSettings").onclick = () => { $("#apiUrl").value = api(); $("#apiPin").value = pin(); openSheet("apiModal"); };
$("#saveApi").onclick = () => { localStorage.mb_api = $("#apiUrl").value.trim(); localStorage.mb_pin = $("#apiPin").value; closeSheets(); load(); };
$("#overlay").onclick = closeSheets;
document.querySelectorAll(".x").forEach(b => b.onclick = closeSheets);

load();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
