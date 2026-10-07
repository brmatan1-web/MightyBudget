/* MightyBudget - אפליקציה. גרסה 1.0 */
"use strict";

const APP_VERSION = "1.2";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxG9AtUDu-M6fVGhrRiscb6V2KyH0CMsPbc4SRk-ffh0upQ6GdYli9kq8UW8s-8nO2EzQ/exec";

const ICONS = { "סופר ומזון": "🛒", "ילדים": "🧸", "מסעדות ובתי קפה": "☕", "רכב ותחבורה": "🚗", "ביגוד ובית": "🏠",
  "חשמל": "⚡", "מים": "💧", "גז": "🔥", "ארנונה ועירייה": "🏛️", "ועד בית": "🏢", "חופשות": "🏨", "פארם": "💊",
  "ביטוחים": "🛡️", "תקשורת ומנויים": "📱", "חיות מחמד": "🐾", "פנאי": "🎡", "קניות אונליין": "📦",
  "העברות": "🔁", "עמלות": "🧾", "לא מסווג": "❔" };
const COLORS = ["#21aecd", "#7159e7", "#ea8f44", "#48aa83", "#d75f86", "#3b82f6", "#c58b1c"];
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const TITLES = { charges: "חיובים", transactions: "עסקאות", categories: "קטגוריות", accounts: "חשבונות וחיבורים", settings: "הגדרות" };
const EXCLUDED_KINDS = ["חיוב כרטיס", "הכנסה"];

const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { } }
};

const ui = { page: "home", filter: "open", owner: "all", chargeDate: "", catMonth: "", loading: false };
let data = ls.get("mb_data", null);

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n, dec) => "₪" + Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: dec ? 2 : 0, minimumFractionDigits: 0 });
const apiUrl = () => ls.get("mb_api", DEFAULT_API_URL);
const pin = () => ls.get("mb_pin", "");
const icon = name => {
  const c = data && data.categories.find(x => x.name === name);
  return (c && c.icon) || ICONS[name] || "📁";
};
const colorOf = name => {
  const i = data ? data.categories.findIndex(x => x.name === name) : 0;
  return COLORS[(i < 0 ? 0 : i) % COLORS.length];
};
function dmy(iso) { return iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) : ""; }
function dayLong(iso) { return iso ? (+iso.slice(8, 10)) + " ב" + MONTHS[+iso.slice(5, 7) - 1] : ""; }
function monthName(ym, withYear) { return ym ? MONTHS[+ym.slice(5, 7) - 1] + (withYear ? " " + ym.slice(0, 4) : "") : ""; }
function daysText(n) { return n <= 0 ? "היום" : n === 1 ? "מחר" : "בעוד " + n + " ימים"; }
function users() { return (data && data.settings && data.settings.users) || ["מתן", "בת הזוג"]; }
function currentUser() { const u = users(); return u[ls.get("mb_user", 0) % u.length] || u[0]; }
function spendTx() { return data.transactions.filter(t => EXCLUDED_KINDS.indexOf(t.kind) === -1); }

// ===================== תקשורת עם השרת =====================

async function apiGet() {
  const u = apiUrl();
  const r = await fetch(u + (u.indexOf("?") === -1 ? "?" : "&") + "pin=" + encodeURIComponent(pin()) + "&t=" + Date.now());
  return r.json();
}

async function apiPost(body) {
  const r = await fetch(apiUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ pin: pin() }, body)) });
  return r.json();
}

function setData(d) {
  data = d;
  ls.set("mb_data", d);
  $("#offline").hidden = true;
  render();
}

async function load(silent) {
  if (!pin()) { showLogin(); return; }
  setLoading(true);
  try {
    const d = await apiGet();
    if (!d.ok) {
      if (d.error === "unauthorized") { showLogin("קוד הכניסה שגוי"); return; }
      if (d.error === "locked") { showLogin("יותר מדי ניסיונות. נסו שוב בעוד חצי שעה"); return; }
      throw new Error(d.error || "שגיאה");
    }
    setData(d);
  } catch (e) {
    console.error(e);
    if (data) { $("#offline").hidden = false; if (!silent) toast("לא ניתן להתחבר לשרת"); }
    else showLogin("לא ניתן להתחבר לשרת. בדקו את החיבור לאינטרנט");
  } finally { setLoading(false); }
}

async function action(body, okMsg) {
  setLoading(true);
  try {
    const d = await apiPost(body);
    if (!d.ok) throw new Error(d.error === "unauthorized" ? "קוד הכניסה שגוי" : (d.error || "השמירה נכשלה"));
    if (d.transactions) setData(d);
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    toast(e.message || "השמירה נכשלה");
    return false;
  } finally { setLoading(false); }
}

function setLoading(v) { ui.loading = v; $("#refreshBtn").classList.toggle("spin", v); }

// ===================== כניסה =====================

function showLogin(err) {
  $("#login").hidden = false;
  $("#loginErr").textContent = err || "";
  $("#pinInput").value = "";
  setTimeout(() => $("#pinInput").focus(), 100);
}

async function doLogin() {
  const p = $("#pinInput").value.trim();
  if (!p) return;
  ls.set("mb_pin", p);
  $("#loginErr").textContent = "בודק...";
  try {
    const d = await apiGet();
    if (!d.ok) { $("#loginErr").textContent = d.error === "unauthorized" ? "קוד הכניסה שגוי" : d.error === "locked" ? "יותר מדי ניסיונות. נסו שוב בעוד חצי שעה" : (d.error || "שגיאה"); ls.del("mb_pin"); return; }
    $("#login").hidden = true;
    setData(d);
  } catch (e) {
    $("#loginErr").textContent = "לא ניתן להתחבר לשרת";
  }
}

// ===================== ניווט =====================

function go(p) {
  ui.page = p;
  $$(".page").forEach(x => x.classList.toggle("active", x.dataset.page === p));
  $$("nav button").forEach(x => x.classList.toggle("active", x.dataset.target === p));
  renderHeader();
  window.scrollTo(0, 0);
}

function renderHeader() {
  $("#title").textContent = ui.page === "home" ? "שלום, " + currentUser() : TITLES[ui.page];
  $("#subtitle").textContent = ui.page === "home" ? "התקציב המשפחתי" : "MightyBudget";
  $("#userBtn").textContent = currentUser().charAt(0);
  const unseen = data ? data.alerts.filter(a => ls.get("mb_seen", []).indexOf(a.id) === -1).length : 0;
  $("#badge").hidden = !unseen;
  $("#badge").textContent = unseen > 9 ? "9+" : unseen;
}

// ===================== רינדור =====================

function render() {
  if (!data) return;
  if (!ui.catMonth) ui.catMonth = data.today.slice(0, 7);
  renderHeader();
  renderHome();
  renderCharges();
  renderTransactions();
  renderCategories();
  renderAccounts();
  renderSettings();
}

function txRow(t) {
  const charged = t.status === "CHARGED";
  const tag = t.bank ? "" : `<span class="tag ${charged ? "charged" : "open"}">${charged ? "חויב" : "יורד"} ${dmy(t.chargeDate)}</span>`;
  const inst = t.installment ? ` <span class="tag inst">תשלום ${esc(t.installment)}</span>` : "";
  return `<div class="row click${charged && !t.bank ? " dim" : ""}" data-tx="${esc(t.id)}">
    <span class="icon">${icon(t.category)}</span>
    <div class="main"><b>${esc(t.name)}</b><small>${esc(t.category || "")} • ${dmy(t.date)} • ${esc(t.card)}</small>${tag}${inst}</div>
    <div class="amt"><b>${money(t.amount, true)}</b>${t.currency && t.currency !== "ILS" ? `<small>${esc(t.currency)}</small>` : ""}</div>
  </div>`;
}

function bindTxRows(root) {
  (root || document).querySelectorAll("[data-tx]").forEach(el => el.onclick = () => openTx(el.dataset.tx));
}

// ---------- בית ----------
function renderHome() {
  const next = data.charges[0];
  const later = data.charges.slice(1, 3);
  const month = data.today.slice(0, 7);
  const spentNow = data.monthly[month] || {};
  const cats = data.categories.map(c => Object.assign({}, c, { spent: spentNow[c.name] || 0 }))
    .filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 2);
  const uncat = data.alerts.find(a => a.type === "uncat");
  const maxTrend = Math.max.apply(null, data.trend.map(t => t.total).concat([1]));
  const recent = spendTx().filter(t => t.status === "OPEN" && !t.bank).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);

  let h = "";
  if (next) {
    h += `<article class="hero" id="heroCard">
      <div class="top"><span>החיוב הקרוב • ${dayLong(next.date)}</span><span class="pill">${daysText(next.daysLeft)}</span></div>
      <div class="amount">${money(next.certain)}</div>
      ${next.estimate ? `<div class="est">ועוד כ־${money(next.estimate)} צפוי עד סגירת המחזור</div>` : `<div class="est">המחזור נסגר. זה הסכום שיירד</div>`}
      <div class="lines">${next.cards.map(c => `<div class="line"><span>כרטיס ${esc(c.card)} <small>${esc(c.owner)}</small></span><b>${money(c.certain + c.estimate)}</b></div>`).join("")}</div>
    </article>`;
  } else {
    h += `<article class="hero"><div class="top"><span>החיוב הקרוב</span></div><div class="amount">₪0</div><div class="est">אין חיובים פתוחים</div></article>`;
  }
  if (later.length) {
    h += `<div class="nextrow">${later.map(c => `<div class="mini"><small>${dayLong(c.date)}</small><b>${money(c.total)}</b><em>${money(c.certain)} ודאי</em></div>`).join("")}</div>`;
  }
  if (uncat) h += `<div class="banner" id="uncatBanner"><span>❔</span><b>${esc(uncat.title)}</b><span class="link">לסיווג ‹</span></div>`;

  h += `<div class="head"><h2>הכי הרבה החודש</h2><button data-go="categories">כל הקטגוריות</button></div>`;
  h += cats.length ? `<div class="card">${cats.map(c => catRow(c, month)).join("")}</div>` : `<div class="card"><p class="empty">אין הוצאות החודש</p></div>`;

  h += `<div class="head"><h2>הוצאות לפי חודש</h2></div><div class="card"><div class="bars">${data.trend.map(t =>
    `<div class="${t.month === month ? "cur" : ""}"><span>${Math.round(t.total / 1000) ? (t.total / 1000).toFixed(1) + "K" : ""}</span><i style="height:${Math.max(4, Math.round(t.total / maxTrend * 80))}px"></i><small>${monthName(t.month).slice(0, 3)}</small></div>`).join("")}</div></div>`;

  h += `<div class="head"><h2>עסקאות פתוחות אחרונות</h2><button data-go="transactions">לכל העסקאות</button></div>`;
  h += `<div class="card">${recent.length ? recent.map(txRow).join("") : `<p class="empty">אין עסקאות פתוחות</p>`}</div>`;

  $("#home").innerHTML = h;
  bindTxRows($("#home"));
  $$("#home [data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  const hero = $("#heroCard"); if (hero) hero.onclick = () => go("charges");
  const ub = $("#uncatBanner"); if (ub) ub.onclick = () => { setFilter("uncat"); go("transactions"); };
  $$("#home [data-cat]").forEach(el => el.onclick = () => openCategory(el.dataset.cat));
}

// ---------- חיובים ----------
function renderCharges() {
  let h = `<h2 style="margin-top:4px">חיובים קרובים</h2>`;
  h += data.charges.length ? data.charges.map(c => `<div class="card charge">
      <div class="grouphead"><div><b>${dayLong(c.date)}</b><small>${daysText(c.daysLeft)}</small></div><strong>${money(c.total)}</strong></div>
      <div class="sum"><span><small>ודאי</small><b>${money(c.certain)}</b></span><span class="est"><small>צפוי להצטרף</small><b>${money(c.estimate)}</b></span></div>
      ${c.cards.map(x => `<div class="row"><span class="icon">💳</span><div class="main"><b>כרטיס ${esc(x.card)}</b><small>${esc(x.owner)}${x.count ? " • " + x.count + " עסקאות" : ""}${x.estimate ? " • צפוי עוד " + money(x.estimate) : ""}</small></div><div class="amt"><b>${money(x.certain)}</b></div></div>`).join("")}
      <div class="row click" data-charge="${c.date}"><div class="main"><b class="link">הצג את העסקאות בחיוב הזה ‹</b></div></div>
    </div>`).join("") : `<div class="card"><p class="empty">אין חיובים פתוחים</p></div>`;
  h += `<p class="muted small">ודאי = עסקאות שכבר בוצעו ותשלומים. צפוי = לפי ממוצע שלושת המחזורים האחרונים בכל כרטיס.</p>`;

  const instMonthly = data.installments.reduce((s, x) => s + x.amount, 0);
  h += `<div class="head"><h2>תשלומים פעילים</h2><span class="muted small">${data.installments.length ? money(instMonthly) + " בחודש" : ""}</span></div>`;
  h += `<div class="card">${data.installments.length ? data.installments.map(x => `<div class="row">
      <span class="icon">${icon(x.category)}</span>
      <div class="main"><b>${esc(x.name)}</b><small>תשלום ${x.current} מתוך ${x.total} • נשארו ${x.left} • עד ${monthName(x.endMonth, true)}</small></div>
      <div class="amt"><b>${money(x.amount)}</b><small>יתרה ${money(x.remainingTotal)}</small></div></div>`).join("") : `<p class="empty">אין תשלומים פעילים</p>`}</div>`;

  h += `<div class="head"><h2>חיובים קבועים</h2><span class="muted small">${data.recurring.length ? money(data.recurring.reduce((s, x) => s + x.avg, 0)) + " בחודש" : ""}</span></div>`;
  h += `<div class="card">${data.recurring.length ? data.recurring.map(x => `<div class="row">
      <span class="icon">${icon(x.category)}</span>
      <div class="main"><b>${esc(x.name)}</b><small>${esc(x.category)} • אחרון ${dmy(x.last)} • כרטיס ${esc(x.card)}</small></div>
      <div class="amt"><b>${money(x.avg)}</b><small>ממוצע</small></div></div>`).join("") : `<p class="empty">יזוהו אחרי 3 חודשים של נתונים</p>`}</div>`;

  $("#charges").innerHTML = h;
  $$("#charges [data-charge]").forEach(el => el.onclick = () => { ui.chargeDate = el.dataset.charge; setFilter("open"); go("transactions"); });
}

// ---------- עסקאות ----------
function setFilter(f) {
  ui.filter = f;
  $$("#statusChips button").forEach(b => b.classList.toggle("active", b.dataset.filter === f));
  if (data) renderTransactions();
}

function renderTransactions() {
  const owners = Array.from(new Set(data.cards.map(c => c.owner).filter(Boolean)));
  $("#ownerChips").innerHTML = owners.length > 1 ? ["all"].concat(owners).map(o =>
    `<button class="${ui.owner === o ? "active" : ""}" data-owner="${esc(o)}">${o === "all" ? "כל בני הבית" : esc(o)}</button>`).join("") : "";
  $$("#ownerChips button").forEach(b => b.onclick = () => { ui.owner = b.dataset.owner; renderTransactions(); });

  $("#chargeFilterBar").innerHTML = ui.chargeDate ? `<div class="filterbar"><span>עסקאות בחיוב של ${dayLong(ui.chargeDate)}</span><button id="clearCharge" aria-label="ביטול">×</button></div>` : "";
  if (ui.chargeDate) $("#clearCharge").onclick = () => { ui.chargeDate = ""; renderTransactions(); };

  let list = spendTx();
  const q = $("#search").value.trim();
  if (q) list = list.filter(t => (t.name + " " + t.category + " " + t.card).indexOf(q) !== -1);
  if (ui.owner !== "all") list = list.filter(t => t.owner === ui.owner);
  if (ui.chargeDate) list = list.filter(t => t.chargeDate === ui.chargeDate && !t.bank);
  if (ui.filter === "open") list = list.filter(t => t.status === "OPEN" && !t.bank);
  if (ui.filter === "charged") list = list.filter(t => t.status === "CHARGED" || t.bank);
  if (ui.filter === "uncat") list = list.filter(t => t.category === "לא מסווג");

  $("#txCount").textContent = list.length;
  $("#txTotal").textContent = money(list.reduce((s, t) => s + t.amount, 0));
  if (!list.length) { $("#transactions").innerHTML = `<div class="card"><p class="empty">אין עסקאות להצגה</p></div>`; return; }

  const groups = {};
  list.forEach(t => {
    const k = t.bank ? "b" + t.month : "c" + t.chargeDate;
    (groups[k] = groups[k] || []).push(t);
  });
  let keys = Object.keys(groups).sort((a, b) => a.slice(1) < b.slice(1) ? -1 : 1);
  if (ui.filter !== "open") keys.reverse();

  $("#transactions").innerHTML = keys.map(k => {
    const items = groups[k].sort((a, b) => a.date < b.date ? 1 : -1);
    const total = items.reduce((s, t) => s + t.amount, 0);
    const first = items[0];
    const title = k[0] === "b" ? "חשבון בנק • " + monthName(first.month, true)
      : (first.status === "CHARGED" ? "חויב ב־" : "יורד ב־") + dayLong(first.chargeDate);
    const cards = Array.from(new Set(items.map(t => t.card))).join(" • ");
    return `<div class="card"><div class="grouphead"><div><b>${title}</b><small>${esc(cards)} • ${items.length} עסקאות</small></div><strong>${money(total)}</strong></div>${items.map(txRow).join("")}</div>`;
  }).join("");
  bindTxRows($("#transactions"));
}

// ---------- קטגוריות ----------
function catRow(c, month) {
  const spent = c.spent || 0;
  const pct = c.budget ? Math.round(spent / c.budget * 100) : 0;
  const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--orange)" : colorOf(c.name);
  return `<div class="row click" data-cat="${esc(c.name)}">
    <span class="icon">${icon(c.name)}</span>
    <div class="main"><b>${esc(c.name)}</b><small>${c.budget ? pct + "% מתקציב " + money(c.budget) : "ללא תקציב" + (c.avg3 ? " • ממוצע " + money(c.avg3) : "")}</small>
      ${c.budget ? `<div class="bar"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></div>` : ""}</div>
    <div class="amt"><b>${money(spent)}</b>${c.budget ? `<small>${spent > c.budget ? "חריגה " + money(spent - c.budget) : "נותרו " + money(c.budget - spent)}</small>` : ""}</div>
  </div>`;
}

function renderCategories() {
  const months = Object.keys(data.monthly).sort();
  const m = ui.catMonth;
  const spent = data.monthly[m] || {};
  const list = data.categories.map(c => Object.assign({}, c, { spent: spent[c.name] || 0 }));
  list.sort((a, b) => (b.spent - a.spent) || (b.budget - a.budget));
  const totalSpent = list.reduce((s, c) => s + c.spent, 0);
  const totalBudget = list.reduce((s, c) => s + c.budget, 0);
  const pct = totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0;
  const ringColor = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--orange)" : "var(--blue)";
  const idx = months.indexOf(m);

  let h = `<div class="monthnav"><button id="mPrev" ${idx <= 0 ? "disabled" : ""}>›</button><b>${monthName(m, true)}</b><button id="mNext" ${idx >= months.length - 1 ? "disabled" : ""}>‹</button></div>`;
  h += `<div class="budgetsum">
    <div class="ring" style="background:conic-gradient(${ringColor} ${Math.min(pct, 100)}%,#e7edf4 0)"><b>${totalBudget ? pct + "%" : "—"}</b></div>
    <div class="t"><small>הוצאות החודש</small><b>${money(totalSpent)}</b><small>${totalBudget ? "מתוך תקציב " + money(totalBudget) : "לא הוגדר תקציב. לחצו על קטגוריה כדי להגדיר"}</small></div>
  </div>`;
  h += `<div class="head"><h2>לפי קטגוריה</h2><button id="addCat">＋ קטגוריה חדשה</button></div>`;
  h += `<div class="card">${list.filter(c => c.spent || c.budget).map(c => catRow(c, m)).join("") || `<p class="empty">אין הוצאות בחודש הזה</p>`}</div>`;
  const idle = list.filter(c => !c.spent && !c.budget);
  if (idle.length) h += `<details class="card" style="padding:4px 0"><summary class="row click"><div class="main"><b>קטגוריות ללא הוצאה (${idle.length})</b></div></summary>${idle.map(c => catRow(c, m)).join("")}</details>`;

  $("#categories").innerHTML = h;
  $("#mPrev").onclick = () => { if (idx > 0) { ui.catMonth = months[idx - 1]; renderCategories(); } };
  $("#mNext").onclick = () => { if (idx < months.length - 1) { ui.catMonth = months[idx + 1]; renderCategories(); } };
  $("#addCat").onclick = () => openCategory("");
  $$("#categories [data-cat]").forEach(el => el.onclick = () => openCategory(el.dataset.cat));
}

// ---------- חשבונות ----------
const PROVIDER_FORMS = {
  isracard: { name: "ישראכרט", fields: [["id", "תעודת זהות"], ["card6Digits", "6 ספרות אחרונות של הכרטיס"], ["password", "סיסמה", 1]] },
  max: { name: "מקס", fields: [["username", "שם משתמש"], ["password", "סיסמה", 1]] },
  visaCal: { name: "כאל", fields: [["username", "שם משתמש"], ["password", "סיסמה", 1]] },
  amex: { name: "אמריקן אקספרס", fields: [["id", "תעודת זהות"], ["card6Digits", "6 ספרות אחרונות של הכרטיס"], ["password", "סיסמה", 1]] },
  hapoalim: { name: "בנק הפועלים", fields: [["userCode", "קוד משתמש"], ["password", "סיסמה", 1]], otp: true },
  leumi: { name: "בנק לאומי", fields: [["username", "שם משתמש"], ["password", "סיסמה", 1]] },
  discount: { name: "בנק דיסקונט", fields: [["id", "תעודת זהות"], ["password", "סיסמה", 1], ["num", "קוד מזהה"]] },
  mercantile: { name: "בנק מרכנתיל", fields: [["id", "תעודת זהות"], ["password", "סיסמה", 1], ["num", "קוד מזהה"]] },
  mizrahi: { name: "מזרחי טפחות", fields: [["username", "שם משתמש"], ["password", "סיסמה", 1]] },
  yahav: { name: "בנק יהב", fields: [["num", "מספר משתמש"], ["nationalID", "תעודת זהות"], ["password", "סיסמה", 1]] }
};

function cardRow(c) {
  return `<div class="row click${c.removed ? " dim" : ""}" data-card="${esc(c.card)}">
    <span class="icon">${c.type === "בנק" ? "🏦" : "💳"}</span>
    <div class="main"><b>${c.type === "בנק" ? "חשבון" : "כרטיס"} ${esc(c.card)}${c.removed ? " • הוסר" : ""}</b>
      <small>${esc(c.owner || "בעלים לא הוגדרו")}${c.type === "בנק" ? "" : " • חיוב ב־" + c.chargeDay + " לחודש • " + (c.cutoff ? "חיתוך ב־" + c.cutoff : "חיתוך בסוף החודש")}</small>
      <small>${c.txCount ? "עסקה אחרונה " + dmy(c.lastTx) : "עדיין אין עסקאות"}${c.nextCharge && !c.removed ? " • חיוב הבא " + dmy(c.nextCharge) : ""}</small></div>
    <span class="muted">‹</span></div>`;
}

function syncLine() {
  const s = data.sync;
  if (!data.vault.ready) return `<div class="banner" id="setupBanner"><span>🔐</span><b>כדי להוסיף ולהסיר חשבונות מהאפליקציה, צריך הגדרה חד־פעמית</b><span class="link">להגדרה ‹</span></div>`;
  if (!s) return `<div class="info">עדיין לא התקבל דיווח מהסנכרון. הסנכרון רץ שלוש פעמים ביום, בערך ב־6:00, 13:00 ו־20:00.</div>`;
  const ok = s.status === "success";
  return `<div class="info" style="border-right:4px solid ${ok ? "var(--green)" : "var(--red)"}"><b>${ok ? "✓ הסנכרון האחרון הצליח" : "✕ הסנכרון האחרון נכשל"}</b>
    ${new Date(s.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} • ${s.accounts} חיבורים${s.fallback ? " • רץ לפי ההגדרה הישנה" : ""}
    ${ok ? "" : "<br>בדרך כלל זה קורה כשסיסמה השתנתה או פגה. אפשר להסיר את החיבור ולהוסיף אותו מחדש עם הסיסמה החדשה."}</div>`;
}

function renderAccounts() {
  const conns = data.connections || [];
  const active = data.cards.filter(c => !c.removed);
  const removed = data.cards.filter(c => c.removed);
  let h = `<div class="head"><h2 style="margin-top:4px">חיבורים</h2><button id="addAccount">＋ הוספת חשבון</button></div>`;
  h += syncLine();
  h += conns.map(cn => {
    const cards = active.filter(c => c.connection === cn.id);
    return `<div class="card">
      <div class="grouphead click" data-conn="${esc(cn.id)}" style="cursor:pointer"><div><b>${esc(cn.providerName)}${cn.label ? " • " + esc(cn.label) : ""}</b><small>${esc(cn.owner || "")} • נוסף ${dmy(cn.createdAt.slice(0, 10))} • ${cards.length ? cards.length + (cards[0].type === "בנק" ? " חשבונות" : " כרטיסים") : "ממתין לסנכרון הראשון"}</small></div><span class="link">ניהול ‹</span></div>
      ${cards.map(cardRow).join("")}
    </div>`;
  }).join("");
  const loose = active.filter(c => !c.connection || !conns.some(cn => cn.id === c.connection));
  if (loose.length) h += `<div class="card"><div class="grouphead"><div><b>${conns.length ? "לא משויכים לחיבור" : "חשבונות מהגדרת הסנכרון הישנה"}</b><small>${conns.length ? "לחיצה על כרטיס מאפשרת לשייך אותו" : "אחרי שתוסיפו את החשבונות מהאפליקציה, ההגדרה הישנה לא תשמש יותר"}</small></div></div>${loose.map(cardRow).join("")}</div>`;
  if (removed.length) h += `<details class="card"><summary class="row click"><div class="main"><b>הוסרו (${removed.length})</b><small>ההיסטוריה נשמרת</small></div></summary>${removed.map(cardRow).join("")}</details>`;
  h += `<p class="muted small">לחיצה על כרטיס מאפשרת לעדכן בעלים, יום חיוב ויום חיתוך. החישובים מתעדכנים מיד.</p>`;
  $("#accounts").innerHTML = h;
  $("#addAccount").onclick = () => data.vault.ready ? openAddAccount() : openVaultSetup();
  const sb = $("#setupBanner"); if (sb) sb.onclick = openVaultSetup;
  $$("#accounts [data-card]").forEach(el => el.onclick = () => openCard(el.dataset.card));
  $$("#accounts [data-conn]").forEach(el => el.onclick = () => openConnection(el.dataset.conn));
}

// ---------- הגדרות ----------
function renderSettings() {
  const s = data.settings;
  const u = users();
  $("#settings").innerHTML = `
    <div class="settings-sec"><h3>בני הבית</h3>
      <div class="grid2"><label>משתמש ראשון<input id="u1" value="${esc(u[0] || "")}"></label><label>משתמש שני<input id="u2" value="${esc(u[1] || "")}"></label></div>
      <button class="secondary" id="saveUsers">שמירת שמות</button>
    </div>
    <div class="settings-sec"><h3>התראות לטלפון</h3>
      <label class="check"><input type="checkbox" id="pushOn" ${s.push ? "checked" : ""}><span>לשלוח התראות לטלפון</span></label>
      <div class="grid2"><label>עסקה גדולה מעל (₪)<input id="bigTx" type="number" inputmode="numeric" value="${s.bigTx}"></label>
      <label>תזכורת לפני חיוב (ימים)<input id="chargeDays" type="number" inputmode="numeric" value="${s.chargeDays}"></label></div>
      <button class="secondary" id="saveAlerts">שמירת הגדרות התראות</button>
      <div class="info"><b>הפעלה באייפון (פעם אחת בכל טלפון)</b>
        <ol class="steps"><li>להתקין את האפליקציה <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">ntfy</a> מה־App Store.</li>
        <li>ללחוץ על הפלוס ולהוסיף את הערוץ:</li></ol>
        <code id="topic">${esc(s.ntfyTopic || "יופיע אחרי ההתקנה")}</code>
        <button class="secondary" id="copyTopic">העתקת שם הערוץ</button>
        <button class="secondary" id="testPush">שליחת התראת בדיקה</button>
      </div>
    </div>
    <div class="settings-sec"><h3>סנכרון וחשבונות</h3>
      <p class="small">${data.vault.ready ? "מוגדר. אפשר להוסיף ולהסיר חשבונות במסך החשבונות." : "עדיין לא מוגדר."}</p>
      <button class="secondary" id="vaultBtn">${data.vault.ready ? "יצירת מפתח הצפנה חדש" : "הגדרת הסנכרון"}</button>
    </div>
    <div class="settings-sec"><h3>חיבור</h3>
      <p class="muted small">עודכן מהשרת: ${data.generatedAt ? new Date(data.generatedAt).toLocaleString("he-IL") : "—"}<br>נתונים חדשים מהסנכרון: ${data.dataChangedAt ? new Date(data.dataChangedAt).toLocaleString("he-IL") : "—"}</p>
      <details><summary class="link">מתקדם</summary>
        <label>כתובת השרת<input id="apiUrl" dir="ltr" value="${esc(apiUrl())}"></label>
        <button class="secondary" id="saveApi">שמירה</button>
      </details>
      <button class="danger" id="logout">התנתקות מהמכשיר</button>
      <p class="muted small" style="text-align:center">גרסת אפליקציה ${APP_VERSION} • שרת ${esc(data.version || "")}</p>
    </div>`;
  $("#vaultBtn").onclick = openVaultSetup;
  $("#saveUsers").onclick = () => action({ action: "saveSettings", users: [$("#u1").value.trim(), $("#u2").value.trim()].filter(Boolean) }, "נשמר");
  $("#saveAlerts").onclick = () => action({ action: "saveSettings", push: $("#pushOn").checked, bigTx: +$("#bigTx").value, chargeDays: +$("#chargeDays").value }, "נשמר");
  $("#copyTopic").onclick = () => { if (navigator.clipboard) navigator.clipboard.writeText(s.ntfyTopic || "").then(() => toast("הועתק")); };
  $("#testPush").onclick = () => action({ action: "testPush" }, "נשלחה התראת בדיקה");
  $("#saveApi").onclick = () => { ls.set("mb_api", $("#apiUrl").value.trim() || DEFAULT_API_URL); load(); };
  $("#logout").onclick = () => { if (confirm("להתנתק מהמכשיר הזה?")) { ls.del("mb_pin"); ls.del("mb_data"); data = null; showLogin(); } };
}

// ===================== חלונות =====================

function openSheet(title, html) {
  $("#sheetTitle").textContent = title;
  $("#sheetBody").innerHTML = html;
  $("#overlay").classList.add("show");
  $("#sheet").classList.add("show");
  $("#sheet").scrollTop = 0;
}
function closeSheet() { $("#overlay").classList.remove("show"); $("#sheet").classList.remove("show"); }

function openTx(id) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  const names = data.categories.map(c => c.name);
  if (names.indexOf(t.category) === -1 && t.category) names.push(t.category);
  openSheet("עריכת עסקה", `
    <div class="info"><b>${esc(t.name)}</b>${money(t.amount, true)} • ${dmy(t.date)} • כרטיס ${esc(t.card)}${t.owner ? " (" + esc(t.owner) + ")" : ""}<br>
      ${t.bank ? "חשבון בנק" : (t.status === "CHARGED" ? "חויב ב־" : "יורד ב־") + dayLong(t.chargeDate)}${t.installment ? " • תשלום " + esc(t.installment) : ""}</div>
    <label>קטגוריה<select id="txCat">${names.map(n => `<option ${n === t.category ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <label>או קטגוריה חדשה<input id="txNewCat" placeholder="למשל: מתנות"></label>
    <label class="check"><input type="checkbox" id="txAll" checked><span>להחיל על כל העסקאות מ־<b>${esc(t.name)}</b>, כולל עסקאות עתידיות</span></label>
    <button class="primary" id="txSave" style="margin-top:16px">שמירה</button>`);
  $("#txSave").onclick = async () => {
    const category = $("#txNewCat").value.trim() || $("#txCat").value;
    closeSheet();
    await action({ action: "setCategory", id: t.id, category, merchant: t.name, applyToMerchant: $("#txAll").checked }, "הקטגוריה עודכנה");
  };
}

function openCategory(name) {
  const c = data.categories.find(x => x.name === name) || { name: "", budget: 0, icon: "" };
  const isNew = !name;
  const month = ui.catMonth || data.today.slice(0, 7);
  const tx = isNew ? [] : spendTx().filter(t => t.category === name && t.month === month).sort((a, b) => a.date < b.date ? 1 : -1);
  openSheet(isNew ? "קטגוריה חדשה" : name, `
    ${isNew ? "" : `<div class="info">${monthName(month, true)}: <b style="display:inline">${money((data.monthly[month] || {})[name] || 0)}</b>${c.avg3 ? " • ממוצע 3 חודשים " + money(c.avg3) : ""}</div>`}
    <label>שם<input id="cName" value="${esc(c.name)}"></label>
    <div class="grid2"><label>תקציב חודשי (₪)<input id="cBudget" type="number" inputmode="numeric" value="${c.budget || ""}" placeholder="ללא"></label>
    <label>אייקון<input id="cIcon" value="${esc(c.icon || ICONS[c.name] || "")}" placeholder="📁"></label></div>
    <button class="primary" id="cSave" style="margin-top:16px">שמירה</button>
    ${isNew || name === "לא מסווג" ? "" : `<button class="danger" id="cDel">מחיקת הקטגוריה</button>`}
    ${tx.length ? `<h2>עסקאות ב${monthName(month)}</h2><div class="card">${tx.map(txRow).join("")}</div>` : ""}`);
  $("#cSave").onclick = async () => {
    const nn = $("#cName").value.trim();
    if (!nn) { toast("חסר שם"); return; }
    closeSheet();
    await action({ action: "saveCategory", oldName: name, name: nn, budget: +$("#cBudget").value || 0, icon: $("#cIcon").value.trim() }, "נשמר");
  };
  const del = $("#cDel");
  if (del) del.onclick = async () => {
    if (!confirm("למחוק את הקטגוריה? העסקאות שלה יחזרו לסיווג אוטומטי")) return;
    closeSheet();
    await action({ action: "deleteCategory", name }, "הקטגוריה נמחקה");
  };
  bindTxRows($("#sheetBody"));
}

function openCard(id) {
  const c = data.cards.find(x => x.card === id);
  if (!c) return;
  const owners = Array.from(new Set(users().concat(["משותף"], c.owner ? [c.owner] : [])));
  openSheet((c.type === "בנק" ? "חשבון " : "כרטיס ") + id, `
    <div class="info">${esc(c.providerName)} • ${c.txCount} עסקאות${c.lastTx ? " • אחרונה " + dmy(c.lastTx) : ""}</div>
    <label>בעלים<select id="kOwner">${owners.map(o => `<option ${o === c.owner ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
    <label>סוג<select id="kType"><option value="כרטיס" ${c.type !== "בנק" ? "selected" : ""}>כרטיס אשראי</option><option value="בנק" ${c.type === "בנק" ? "selected" : ""}>חשבון בנק</option></select></label>
    <div class="grid2"><label>יום חיוב בחודש<input id="kDay" type="number" inputmode="numeric" min="1" max="31" value="${c.chargeDay}"></label>
    <label>יום חיתוך<input id="kCut" type="number" inputmode="numeric" min="0" max="31" value="${c.cutoff}"></label></div>
    <p class="muted small">יום חיתוך 0 = כל עסקאות החודש יורדות בחודש הבא. לדוגמה, אם החיוב ב־10 וכולל עסקאות עד ה־8, יום החיתוך הוא 8.</p>
    ${(data.connections || []).length ? `<label>שייך לחיבור<select id="kConn"><option value="">ללא</option>${data.connections.map(cn => `<option value="${esc(cn.id)}" ${cn.id === c.connection ? "selected" : ""}>${esc(cn.providerName)}${cn.owner ? " • " + esc(cn.owner) : ""}${cn.label ? " • " + esc(cn.label) : ""}</option>`).join("")}</select></label>` : ""}
    <label class="check"><input type="checkbox" id="kRemoved" ${c.removed ? "checked" : ""}><span>להסתיר מהרשימות (הכרטיס הוסר או בוטל)</span></label>
    <button class="primary" id="kSave" style="margin-top:14px">שמירה</button>`);
  $("#kSave").onclick = async () => {
    closeSheet();
    const conn = document.querySelector("#kConn") ? $("#kConn").value : c.connection;
    await action({ action: "saveCard", card: id, owner: $("#kOwner").value, type: $("#kType").value, chargeDay: +$("#kDay").value, cutoff: +$("#kCut").value, connection: conn, removed: $("#kRemoved").checked }, "הכרטיס עודכן");
  };
}

// ===================== הצפנה =====================
// פרטי הכניסה מוצפנים כאן, בטלפון, לפני שהם יוצאים ממנו. השרת לא יכול לפענח אותם.

const b64 = buf => { let s = ""; new Uint8Array(buf).forEach(x => s += String.fromCharCode(x)); return btoa(s); };
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

async function encryptForVault(obj, publicKeyB64) {
  const pub = await crypto.subtle.importKey("spki", unb64(publicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, await crypto.subtle.exportKey("raw", aes));
  return btoa(JSON.stringify({ v: 1, k: b64(wrapped), iv: b64(iv), c: b64(ct) }));
}

async function makeVaultKeys() {
  const kp = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  return { pub: b64(await crypto.subtle.exportKey("spki", kp.publicKey)), priv: b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey)) };
}

function copyText(t, msg) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast(msg || "הועתק"), () => toast("ההעתקה נכשלה"));
}

// ===================== הגדרה חד-פעמית של הכספת =====================

function openVaultSetup() {
  const again = data.vault.ready;
  openSheet("חיבור הסנכרון לאפליקציה", `
    <div class="info">ההגדרה נעשית פעם אחת. אחריה מוסיפים ומסירים חשבונות רק מהאפליקציה.
      <br><br><b>איך זה מאובטח</b>הסיסמאות מוצפנות בטלפון. השרת בגוגל שומר רק טקסט מוצפן שהוא לא יכול לקרוא. מפתח הפענוח נשמר רק בסודות של גיטהאב.</div>
    ${again ? `<div class="info" style="border-right:4px solid var(--red)"><b>שימו לב</b>יצירת מפתח חדש מוחקת את כל החיבורים הקיימים, וצריך להוסיף אותם מחדש.</div>` : ""}
    <button class="primary" id="vGen">יצירת מפתח הצפנה</button>
    <div id="vOut"></div>`);
  $("#vGen").onclick = async () => {
    if (again && !confirm("למחוק את כל החיבורים וליצור מפתח חדש?")) return;
    $("#vGen").disabled = true; $("#vGen").textContent = "יוצר מפתח...";
    try {
      const keys = await makeVaultKeys();
      const r = await apiPost({ action: "setupVault", publicKey: keys.pub, force: again });
      if (!r.ok) throw new Error(r.error === "unauthorized" ? "קוד הכניסה שגוי" : r.error);
      const link = btoa(JSON.stringify({ u: apiUrl(), t: r.token, k: keys.priv }));
      keys.priv = "";
      $("#vGen").remove();
      $("#vOut").innerHTML = `
        <h2>שלב 1: סוד חדש בגיטהאב</h2>
        <ol class="steps"><li>במאגר הסנכרון בגיטהאב: <code>Settings → Secrets and variables → Actions</code></li>
          <li>לוחצים <code>New repository secret</code></li>
          <li>בשם כותבים <code>MB_LINK</code></li>
          <li>בתוכן מדביקים את מה שמעתיקים בכפתור הבא, ושומרים</li></ol>
        <button class="primary" id="vCopyLink">העתקת התוכן לסוד</button>
        <h2>שלב 2: קובץ הסנכרון</h2>
        <ol class="steps"><li>במאגר הסנכרון פותחים את <code>.github/workflows/scrape.yml</code> ולוחצים על העיפרון</li>
          <li>מוחקים את כל התוכן ומדביקים את מה שמעתיקים בכפתור הבא</li>
          <li>לוחצים <code>Commit changes</code></li></ol>
        <button class="primary" id="vCopyYml">העתקת קובץ הסנכרון</button>
        <h2>שלב 3: להוסיף חשבונות</h2>
        <p class="small">סוגרים את החלון ולוחצים "הוספת חשבון". אחרי שכל החשבונות נוספו, הם יחליפו את ההגדרה הישנה בסנכרון הבא.</p>
        <div class="info"><b>חשוב</b>התוכן של שלב 1 הוא מפתח הפענוח. לא לשמור אותו בשום מקום אחר ולא לשלוח אותו לאף אחד. אחרי שסוגרים את החלון הוא נמחק מהטלפון.</div>
        <button class="secondary" id="vDone">סיימתי</button>`;
      $("#vCopyLink").onclick = () => copyText(link, "הועתק. להדביק בסוד MB_LINK");
      $("#vCopyYml").onclick = async () => {
        try { const t = await (await fetch("scrape.yml?t=" + Date.now())).text(); copyText(t, "קובץ הסנכרון הועתק"); }
        catch (e) { toast("לא ניתן לטעון את קובץ הסנכרון"); }
      };
      $("#vDone").onclick = () => { closeSheet(); load(); };
    } catch (e) {
      toast(e.message || "שגיאה");
      $("#vGen").disabled = false; $("#vGen").textContent = "יצירת מפתח הצפנה";
    }
  };
}

// ===================== הוספה והסרה של חשבונות =====================

function openAddAccount() {
  const owners = Array.from(new Set(users().concat(["משותף"])));
  openSheet("הוספת חשבון", `
    <label>ספק<select id="aProv">${Object.keys(PROVIDER_FORMS).map(k => `<option value="${k}">${PROVIDER_FORMS[k].name}</option>`).join("")}</select></label>
    <div class="grid2"><label>של מי<select id="aOwner">${owners.map(o => `<option>${esc(o)}</option>`).join("")}</select></label>
    <label>כינוי (לא חובה)<input id="aLabel" placeholder="למשל: כרטיס משפחתי"></label></div>
    <div id="aFields"></div>
    <div id="aOtp"></div>
    <div class="info small">🔐 הפרטים מוצפנים בטלפון לפני השליחה. אף אחד, כולל השרת של האפליקציה, לא יכול לקרוא אותם.</div>
    <button class="primary" id="aSave">הוספה</button>`);
  const draw = () => {
    const f = PROVIDER_FORMS[$("#aProv").value] || PROVIDER_FORMS.isracard;
    $("#aFields").innerHTML = f.fields.map(x => `<label>${x[1]}<input id="af_${x[0]}" ${x[2] ? 'type="password"' : 'inputmode="text"'} autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr"></label>`).join("");
    $("#aOtp").innerHTML = f.otp ? `<div class="info" style="border-right:4px solid var(--orange)"><b>שימו לב</b>הבנק הזה מבקש לפעמים קוד SMS בכניסה ממכשיר חדש. אם יתבקש קוד, הסנכרון של החשבון הזה ייכשל ותופיע התראה.</div>` : "";
  };
  $("#aProv").onchange = draw;
  draw();
  $("#aSave").onclick = async () => {
    const companyId = $("#aProv").value;
    const f = PROVIDER_FORMS[companyId];
    const creds = { companyId };
    for (const x of f.fields) {
      const v = $("#af_" + x[0]).value.trim();
      if (!v) { toast("חסר: " + x[1]); return; }
      creds[x[0]] = v;
    }
    $("#aSave").disabled = true; $("#aSave").textContent = "מצפין ושומר...";
    try {
      const blob = await encryptForVault(creds, data.vault.publicKey);
      f.fields.forEach(x => { const el = $("#af_" + x[0]); if (el) el.value = ""; });
      closeSheet();
      await action({ action: "addAccount", companyId, owner: $("#aOwner").value, label: $("#aLabel").value.trim(), blob }, f.name + " נוסף. העסקאות יופיעו אחרי הסנכרון הבא");
    } catch (e) {
      toast("ההצפנה נכשלה");
      $("#aSave").disabled = false; $("#aSave").textContent = "הוספה";
    }
  };
}

function openConnection(id) {
  const cn = data.connections.find(x => x.id === id);
  if (!cn) return;
  const cards = data.cards.filter(c => !c.removed && (c.connection === id || (!c.connection && (c.provider === cn.companyId || !c.provider))));
  openSheet(cn.providerName + (cn.label ? " • " + cn.label : ""), `
    <div class="info">${esc(cn.owner || "")} • נוסף ב־${dmy(cn.createdAt.slice(0, 10))}</div>
    <h2>החלפת סיסמה</h2>
    <p class="small">אם הסיסמה השתנתה: מסירים את החיבור ומוסיפים אותו מחדש עם הסיסמה החדשה. ההיסטוריה נשמרת.</p>
    <h2>הסרת החיבור</h2>
    <p class="small">הסנכרון יפסיק למשוך עסקאות מהחשבון הזה, והפרטים המוצפנים יימחקו. עסקאות קודמות נשארות.</p>
    ${cards.length ? `<p class="small">כרטיסים להסתיר מהרשימות:</p>${cards.map(c => `<label class="check"><input type="checkbox" class="hideCard" value="${esc(c.card)}" ${c.connection === id ? "checked" : ""}><span>${c.type === "בנק" ? "חשבון" : "כרטיס"} ${esc(c.card)} ${esc(c.owner ? "• " + c.owner : "")}</span></label>`).join("")}` : ""}
    <button class="danger" id="cnDel" style="margin-top:10px">הסרת החיבור</button>`);
  $("#cnDel").onclick = async () => {
    if (!confirm("להסיר את החיבור ל" + cn.providerName + "?")) return;
    const hideCards = $$("#sheetBody .hideCard").filter(x => x.checked).map(x => x.value);
    closeSheet();
    await action({ action: "deleteAccount", id, hideCards }, "החיבור הוסר");
  };
}

function openAlerts() {
  const seen = ls.get("mb_seen", []);
  const al = data ? data.alerts : [];
  openSheet("התראות", al.length ? `<div class="card">${al.map(a => `<div class="row alert ${a.level}${a.type === "uncat" ? " click" : ""}" data-alert="${esc(a.type)}">
      <div class="main"><b style="white-space:normal">${seen.indexOf(a.id) === -1 ? "• " : ""}${esc(a.title)}</b><small style="white-space:normal">${esc(a.body)}</small></div></div>`).join("")}</div>`
    : `<p class="empty">אין התראות כרגע</p>`);
  ls.set("mb_seen", Array.from(new Set(seen.concat(al.map(a => a.id)))).slice(-400));
  renderHeader();
  $$("#sheetBody [data-alert='uncat']").forEach(el => el.onclick = () => { closeSheet(); setFilter("uncat"); go("transactions"); });
}

function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}

// ===================== אירועים =====================

function init() {
  $$("nav button").forEach(b => b.onclick = () => go(b.dataset.target));
  $$("#statusChips button").forEach(b => b.onclick = () => setFilter(b.dataset.filter));
  $("#search").oninput = () => renderTransactions();
  $("#refreshBtn").onclick = () => load();
  $("#bellBtn").onclick = openAlerts;
  $("#userBtn").onclick = () => { ls.set("mb_user", (ls.get("mb_user", 0) + 1) % users().length); renderHeader(); toast("שלום, " + currentUser()); };
  $("#overlay").onclick = closeSheet;
  $("#sheetClose").onclick = closeSheet;
  $("#loginBtn").onclick = doLogin;
  $("#pinInput").onkeydown = e => { if (e.key === "Enter") doLogin(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && pin()) load(true); });

  if (data && pin()) render();
  load(true);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
}

init();
