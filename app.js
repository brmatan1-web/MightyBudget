/* MightyBudget - אפליקציה. גרסה 2.0 */
"use strict";
const APP_VERSION = "2.0";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxG9AtUDu-M6fVGhrRiscb6V2KyH0CMsPbc4SRk-ffh0upQ6GdYli9kq8UW8s-8nO2EzQ/exec";
const UNCAT = "לא מסווג";
const ICONS = { "סופר ומזון": "🛒", "ילדים": "🧸", "מסעדות ובתי קפה": "☕", "רכב ותחבורה": "🚗", "ביגוד ובית": "🏠", "אלקטרוניקה": "💻",
  "חשמל": "⚡", "מים": "💧", "גז": "🔥", "ארנונה ועירייה": "🏛️", "ועד בית": "🏢", "חופשות": "🏨", "פארם": "💊",
  "ביטוחים": "🛡️", "תקשורת ומנויים": "📱", "חיות מחמד": "🐾", "פנאי": "🎡", "קניות אונליין": "📦", "שכר דירה ומשכנתא": "🔑",
  "העברות": "🔁", "עמלות": "🧾", "הכנסה": "💰" };
const COLORS = ["#21aecd", "#7159e7", "#ea8f44", "#48aa83", "#d75f86", "#3b82f6", "#c58b1c"];
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const TITLES = { charges: "חיובים", transactions: "עסקאות", budget: "תקציב", savings: "חיסכון", accounts: "חשבונות", settings: "הגדרות" };
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { } }
};
const ui = { page: "home", filter: "open", owner: "all", chargeDate: "", cardFilter: "", catMonth: "", budgetTab: "cats", loading: false };
let data = ls.get("mb_data", null);
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n, dec) => "₪" + Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: dec ? 2 : 0, minimumFractionDigits: 0 });
const apiUrl = () => ls.get("mb_api", DEFAULT_API_URL);
const pin = () => ls.get("mb_pin", "");
const icon = name => {
  if (name === UNCAT) return "❔";
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
function users() { const u = (data && data.settings && data.settings.users) || ["מתן", "ליאל"]; return u.filter(Boolean); }
function me() { return ls.get("mb_me", ""); }
function catList() { return data.categories.map(c => c.name).filter(n => n !== UNCAT); }
function catSpent(name, ym) { return ((data.monthly[ym] || {})[name]) || 0; }
const isSpend = t => t.kind === "הוצאה";

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
  if (!me() && !ui.askedMe) { ui.askedMe = true; chooseMe(); }
}
const errText = e => e === "unauthorized" ? "קוד הכניסה שגוי" : e === "locked" ? "יותר מדי ניסיונות. נסו שוב בעוד חצי שעה" : (e || "שגיאה");
async function load(silent) {
  if (!pin()) { showLogin(); return; }
  setLoading(true);
  try {
    const d = await apiGet();
    if (!d.ok) {
      if (d.error === "unauthorized" || d.error === "locked") { showLogin(errText(d.error)); return; }
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
    if (!d.ok) throw new Error(errText(d.error) || "השמירה נכשלה");
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
    if (!d.ok) { $("#loginErr").textContent = errText(d.error); ls.del("mb_pin"); return; }
    $("#login").hidden = true;
    setData(d);
  } catch (e) {
    $("#loginErr").textContent = "לא ניתן להתחבר לשרת";
  }
}

// ===================== ניווט =====================
function go(p) {
  ui.page = p;
  document.body.dataset.page = p;
  $$(".page").forEach(x => x.classList.toggle("active", x.dataset.page === p));
  $$("nav button").forEach(x => x.classList.toggle("active", x.dataset.target === p));
  $("#menu").hidden = true;
  renderHeader();
  window.scrollTo(0, 0);
}
function renderHeader() {
  $("#title").textContent = ui.page === "home" ? "שלום, " + (me() || users()[0] || "") : TITLES[ui.page];
  $("#subtitle").textContent = ui.page === "home" ? "התקציב המשפחתי" : "MightyBudget";
  $("#userBtn").textContent = (me() || users()[0] || "מ").charAt(0);
  const seen = ls.get("mb_seen", []);
  const unseen = data ? data.alerts.filter(a => seen.indexOf(a.id) === -1).length : 0;
  $("#badge").hidden = !unseen;
  $("#badge").textContent = unseen > 9 ? "9+" : unseen;
}
function toggleMenu() {
  const m = $("#menu");
  m.hidden = !m.hidden;
  if (m.hidden) return;
  m.innerHTML = `<button data-m="accounts">🏦 חשבונות וחיבורים</button><button data-m="settings">⚙️ הגדרות</button><button data-m="me">👤 מי אני: ${esc(me() || "לא נבחר")}</button>`;
  $$("#menu [data-m]").forEach(b => b.onclick = () => { m.hidden = true; b.dataset.m === "me" ? chooseMe() : go(b.dataset.m); });
}
function chooseMe() {
  if (!data) return;
  openSheet("מי אתם?", `<div class="who">${users().map(u => `<button class="secondary" data-me="${esc(u)}">${esc(u)}</button>`).join("")}</div>`);
  $$("#sheetBody [data-me]").forEach(b => b.onclick = () => { ls.set("mb_me", b.dataset.me); closeSheet(); renderHeader(); });
}

// ===================== רינדור =====================
function render() {
  if (!data) return;
  if (!ui.catMonth) ui.catMonth = data.month.ym;
  renderHeader();
  renderBanner();
  renderHome(); renderCharges(); renderTransactions(); renderBudget(); renderSavings(); renderAccounts(); renderSettings();
}
function renderBanner() {
  const bad = data.version && String(data.version).split(".")[0] !== APP_VERSION.split(".")[0];
  const el = $("#verbar");
  el.hidden = !bad;
  if (bad) el.textContent = "גרסת האפליקציה והקוד בגוגל לא תואמות. צריך לעדכן את אחד מהם.";
}
function bindTxRows(root) {
  (root || document).querySelectorAll("[data-tx]").forEach(el => el.onclick = () => openTx(el.dataset.tx));
}
function srcTag(t) {
  if (!t.manual) return t.installment ? `<span class="tag inst">תשלום ${esc(t.installment)}</span>` : "";
  return `<span class="tag manual">${t.upcoming ? "צפוי" : t.recurring ? "חוזר" : "ידני"}</span>`;
}
function txRow(t) {
  const inc = t.kind === "הכנסה", unc = t.category === UNCAT;
  const sub = t.manual ? [t.category && !inc ? esc(t.category) : "", dmy(t.date), esc(t.owner)].filter(Boolean).join(" • ")
    : [unc ? "" : esc(t.category), dmy(t.date), esc(t.card)].filter(Boolean).join(" • ");
  return `<div class="row click${t.upcoming ? " dim" : ""}" data-tx="${esc(t.id)}">
    <span class="icon${unc ? " mute" : ""}">${t.manual ? (inc ? "💰" : icon(t.category)) : icon(t.category)}</span>
    <div class="main"><b>${esc(t.name)}</b><small>${sub}</small>${srcTag(t)}</div>
    <div class="amt${inc ? " pos" : ""}"><b>${inc ? "+" : ""}${money(t.amount, true)}</b>${t.currency && t.currency !== "ILS" ? `<small>${esc(t.currency)}</small>` : ""}</div>
  </div>`;
}
function statusTag(c) { return `<span class="tag ${c.closed ? "final" : "sofar"}">${c.closed ? "סופי" : "עד כה"}</span>`; }
function emptyCard(msg, btn, id) { return `<div class="card empty"><p>${msg}</p>${btn ? `<button class="primary small" id="${id}">${btn}</button>` : ""}</div>`; }

// ---------- בית ----------
function renderHome() {
  const next = data.charges[0], m = data.month;
  const cats = data.categories.filter(c => c.name !== UNCAT).map(c => ({ c: c, spent: catSpent(c.name, m.ym) })).filter(x => x.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 2);
  const attn = data.alerts.filter(a => a.level === "danger" || a.level === "warn").slice(0, 3);
  let h = "";
  if (next) {
    const shown = next.cards.filter(c => c.certain > 0);
    h += `<article class="hero" id="heroCard">
      <div class="top"><span>החיוב הקרוב • ${dayLong(next.date)}</span><span class="pill">${daysText(next.daysLeft)}</span></div>
      <div class="amount">${money(next.certain)} ${statusTag(next)}</div>
      ${!next.closed && next.estimate > 0 ? `<div class="est">ועוד כ־${money(next.estimate)} צפוי</div>` : ""}
      ${shown.length ? `<div class="lines">${shown.slice(0, 3).map(c => `<div class="line"><span>כרטיס ${esc(c.card)} <small>${esc(c.owner)}</small></span><b>${money(c.certain)}</b></div>`).join("")}${shown.length > 3 ? `<div class="line"><small>ועוד ${shown.length - 3} כרטיסים</small></div>` : ""}</div>` : ""}
    </article>`;
  } else h += `<article class="hero"><div class="top"><span>החיוב הקרוב</span></div><div class="amount">₪0</div><div class="est">אין חיובים קרובים</div></article>`;
  h += `<div class="card monthrow"><div><small>הוצאות ${monthName(m.ym)}</small><b>${money(m.spent)}</b></div>${m.income ? `<div><small>הכנסות</small><b>${money(m.income)}</b></div><div><small>נשאר</small><b class="${m.left < 0 ? "neg" : "pos"}">${money(m.left)}</b></div>` : `<div class="addinc"><button class="link" id="homeAddInc">＋ הוספת הכנסה</button></div>`}</div>`;
  if (attn.length) h += `<div class="card attn">${attn.map(a => `<div class="row ${a.level}" data-bell="1"><div class="main"><b style="white-space:normal">${esc(a.title)}</b><small style="white-space:normal">${esc(a.body)}</small></div></div>`).join("")}</div>`;
  if (cats.length) h += `<div class="head"><h2>הכי הרבה החודש</h2><button data-go="budget">לתקציב</button></div><div class="card">${cats.map(x => catRow(x.c, m.ym)).join("")}</div>`;
  $("#home").innerHTML = h;
  $$("#home [data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  $$("#home [data-cat]").forEach(el => el.onclick = () => openCategory(el.dataset.cat));
  $$("#home [data-bell]").forEach(el => el.onclick = openAlerts);
  const hero = $("#heroCard"); if (hero) hero.onclick = () => go("charges");
  const ai = $("#homeAddInc"); if (ai) ai.onclick = () => openAddTx({ type: "income", recurring: true });
}

// ---------- חיובים ----------
function renderCharges() {
  let h = "";
  h += data.charges.length ? data.charges.map(c => `<div class="card charge">
      <div class="grouphead"><div><b>${dayLong(c.date)}</b><small>${daysText(c.daysLeft)}</small></div><div class="big"><strong>${money(c.certain)}</strong> ${statusTag(c)}</div></div>
      ${!c.closed && c.estimate > 0 ? `<div class="estline">ועוד כ־${money(c.estimate)} צפוי</div>` : ""}
      ${c.cards.map(x => `<div class="row click" data-ccard="${esc(c.date + "|" + x.card)}"><span class="icon">💳</span><div class="main"><b>כרטיס ${esc(x.card)}</b><small>${esc(x.owner)}${x.count ? " • " + x.count + " עסקאות" : ""}</small></div><div class="amt"><b>${money(x.certain)}</b></div></div>`).join("")}
      ${typeof c.balanceAfter === "number" ? `<div class="estline ${c.balanceAfter < 0 ? "neg" : ""}">יתרה צפויה אחרי החיוב: ${money(c.balanceAfter)}</div>` : ""}
    </div>`).join("") : emptyCard("אין חיובים קרובים");
  const b = data.balance;
  h += `<div class="card"><div class="row click" id="balRow"><span class="icon">🏦</span><div class="main"><b>${b ? "יתרה בעו״ש " + money(b.amount) : "הוספת יתרה בעו״ש"}</b><small>${b ? "עודכן ב־" + dayLong(b.date) : "כדי לראות יתרה צפויה אחרי כל חיוב"}</small></div><span class="link">${b ? "עדכון" : "הוספה"}</span></div></div>`;
  $("#charges").innerHTML = h;
  $$("#charges [data-ccard]").forEach(el => el.onclick = () => { const p = el.dataset.ccard.split("|"); openChargeCard(p[0], p[1]); });
  $("#balRow").onclick = openBalance;
}
function openChargeCard(date, card) {
  const list = data.transactions.filter(t => t.source === "credit" && t.chargeDate === date && t.card === card && isSpend(t));
  const by = {}; list.forEach(t => by[t.category] = (by[t.category] || 0) + t.amount);
  const rows = Object.keys(by).sort((a, b) => by[b] - by[a]);
  openSheet("כרטיס " + card + " • " + dayLong(date), `<div class="card">${rows.length ? rows.map(n => `<div class="row"><span class="icon${n === UNCAT ? " mute" : ""}">${icon(n)}</span><div class="main"><b>${n === UNCAT ? "אחר" : esc(n)}</b></div><div class="amt"><b>${money(by[n])}</b></div></div>`).join("") : '<p class="empty">אין עסקאות</p>'}</div>
    <button class="secondary" id="ccShow">הצגת העסקאות</button>`);
  $("#ccShow").onclick = () => { closeSheet(); ui.chargeDate = date; ui.cardFilter = card; setFilter("open"); go("transactions"); };
}
function openBalance() {
  const b = data.balance;
  openSheet("יתרה בעו״ש", `<label>היתרה היום (₪)<input id="balAmt" type="number" inputmode="decimal" value="${b ? b.amount : ""}"></label>
    <button class="primary" id="balSave" style="margin-top:16px">שמירה</button>${b ? '<button class="danger" id="balClear">הסרת היתרה</button>' : ""}`);
  $("#balSave").onclick = async () => { const v = $("#balAmt").value; if (v === "") { toast("חסר סכום"); return; } closeSheet(); await action({ action: "saveBalance", amount: +v }, "נשמר"); };
  const c = $("#balClear"); if (c) c.onclick = async () => { closeSheet(); await action({ action: "saveBalance", amount: null }, "היתרה הוסרה"); };
}

// ---------- עסקאות ----------
function setFilter(f) {
  ui.filter = f;
  $$("#statusChips button").forEach(b => b.classList.toggle("active", b.dataset.filter === f));
  if (data) renderTransactions();
}
function renderTransactions() {
  const us = users();
  $("#ownerSel").innerHTML = ["all"].concat(us).map(o => `<option value="${esc(o)}" ${ui.owner === o ? "selected" : ""}>${o === "all" ? "כולם" : esc(o)}</option>`).join("");
  $("#chargeFilterBar").innerHTML = ui.chargeDate ? `<div class="filterbar"><span>${ui.cardFilter ? "כרטיס " + esc(ui.cardFilter) + " • " : ""}חיוב של ${dayLong(ui.chargeDate)}</span><button id="clearCharge" aria-label="ביטול">×</button></div>` : "";
  if (ui.chargeDate) $("#clearCharge").onclick = () => { ui.chargeDate = ""; ui.cardFilter = ""; renderTransactions(); };
  let list = data.transactions.filter(t => t.kind === "הוצאה" || t.kind === "הכנסה");
  const q = $("#search").value.trim();
  if (q) list = list.filter(t => (t.name + " " + t.category + " " + t.card + " " + (t.note || "")).indexOf(q) !== -1);
  if (ui.owner !== "all") list = list.filter(t => t.owner === ui.owner);
  if (ui.chargeDate) list = list.filter(t => t.chargeDate === ui.chargeDate && t.source === "credit" && (!ui.cardFilter || t.card === ui.cardFilter));
  const f = ui.filter;
  if (f === "open") list = list.filter(t => t.status === "OPEN" && t.kind === "הוצאה");
  if (f === "charged") list = list.filter(t => t.status === "CHARGED");
  if (f === "manual") list = list.filter(t => t.manual);
  if (f === "uncat") list = list.filter(t => t.category === UNCAT);
  const sum = list.filter(isSpend).reduce((s, t) => s + t.amount, 0);
  $("#txCount").textContent = list.length ? list.length + " עסקאות • " + money(sum) : "";
  if (!list.length) { $("#transactions").innerHTML = emptyCard(f === "uncat" ? "אין עסקאות לא מסווגות" : "אין עסקאות להצגה"); return; }
  const groups = {};
  list.forEach(t => { const k = t.manual ? "m|" + t.month : "c|" + t.chargeDate; (groups[k] = groups[k] || []).push(t); });
  const keys = Object.keys(groups).sort((a, b) => a.slice(2) < b.slice(2) ? -1 : 1);
  if (f !== "open") keys.reverse();
  $("#transactions").innerHTML = keys.map(k => {
    const items = groups[k].sort((a, b) => a.date < b.date ? 1 : -1);
    const total = items.filter(isSpend).reduce((s, t) => s + t.amount, 0), first = items[0];
    const title = k[0] === "m" ? "ידני • " + monthName(first.month, true) : (first.status === "CHARGED" ? "חויב ב־" : "יורד ב־") + dayLong(first.chargeDate);
    const cards = k[0] === "m" ? "" : Array.from(new Set(items.map(t => t.card))).join(" • ") + " • ";
    return `<div class="card"><div class="grouphead"><div><b>${title}</b><small>${esc(cards)}${items.length} עסקאות</small></div>${total > 0 ? `<strong>${money(total)}</strong>` : ""}</div>${items.map(txRow).join("")}</div>`;
  }).join("");
  bindTxRows($("#transactions"));
}

// ---------- תקציב ----------
function catRow(c, ym) {
  const spent = catSpent(c.name, ym), b = c.budget || 0, pct = b ? Math.round(spent / b * 100) : 0;
  const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--orange)" : colorOf(c.name);
  return `<div class="row click" data-cat="${esc(c.name)}"><span class="icon">${icon(c.name)}</span>
    <div class="main"><b>${esc(c.name)}</b><small>${b ? pct + "% מתוך " + money(b) : "ללא תקציב"}</small>${b ? `<div class="bar"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></div>` : ""}</div>
    <div class="amt"><b>${money(spent)}</b>${b ? `<small class="${spent > b ? "neg" : ""}">${spent > b ? "חריגה " + money(spent - b) : "נותרו " + money(b - spent)}</small>` : ""}</div></div>`;
}
function renderBudget() {
  const tab = ui.budgetTab;
  let h = `<div class="seg"><button data-tab="cats" class="${tab === "cats" ? "active" : ""}">קטגוריות</button><button data-tab="fixed" class="${tab === "fixed" ? "active" : ""}">קבועות</button></div>`;
  h += tab === "cats" ? budgetCats() : budgetFixed();
  $("#budget").innerHTML = h;
  $$("#budget [data-tab]").forEach(b => b.onclick = () => { ui.budgetTab = b.dataset.tab; renderBudget(); });
  $$("#budget [data-cat]").forEach(el => el.onclick = () => openCategory(el.dataset.cat));
  $$("#budget [data-fx]").forEach(el => el.onclick = () => openManual(el.dataset.fx, ""));
  const mp = $("#mPrev"), mn = $("#mNext"), ac = $("#addCat"), af = $("#addFixed"), un = $("#uncatRow");
  const months = Object.keys(data.monthly).sort(), idx = months.indexOf(ui.catMonth);
  if (mp) mp.onclick = () => { if (idx > 0) { ui.catMonth = months[idx - 1]; renderBudget(); } };
  if (mn) mn.onclick = () => { if (idx < months.length - 1) { ui.catMonth = months[idx + 1]; renderBudget(); } };
  if (ac) ac.onclick = () => openCategory("");
  if (af) af.onclick = () => openAddTx({ type: "expense", recurring: true });
  if (un) un.onclick = () => { setFilter("uncat"); go("transactions"); };
}
function budgetCats() {
  const months = Object.keys(data.monthly).sort(), m = ui.catMonth, idx = months.indexOf(m);
  const real = data.categories.filter(c => c.name !== UNCAT);
  const withB = real.filter(c => c.budget > 0);
  const totalB = withB.reduce((s, c) => s + c.budget, 0), spentB = withB.reduce((s, c) => s + catSpent(c.name, m), 0);
  const pct = totalB ? Math.round(spentB / totalB * 100) : 0;
  const ringColor = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--orange)" : "var(--blue)";
  const list = real.filter(c => catSpent(c.name, m) > 0 || c.budget > 0).sort((a, b) => {
    const pa = a.budget ? catSpent(a.name, m) / a.budget : -1, pb = b.budget ? catSpent(b.name, m) / b.budget : -1;
    return pa !== pb ? pb - pa : catSpent(b.name, m) - catSpent(a.name, m);
  });
  const unc = catSpent(UNCAT, m);
  let h = `<div class="monthnav"><button id="mPrev" ${idx <= 0 ? "disabled" : ""}>›</button><b>${monthName(m, true)}</b><button id="mNext" ${idx >= months.length - 1 ? "disabled" : ""}>‹</button></div>`;
  h += totalB ? `<div class="budgetsum"><div class="ring" style="background:conic-gradient(${ringColor} ${Math.min(pct, 100)}%,#e7edf4 0)"><b>${pct}%</b></div><div class="t"><small>הוצאות בקטגוריות עם תקציב</small><b>${money(spentB)}</b><small>מתוך ${money(totalB)}</small></div></div>`
    : `<div class="card empty"><p>לחצו על קטגוריה כדי להגדיר לה תקציב</p></div>`;
  h += `<div class="head"><h2>קטגוריות</h2><button id="addCat">＋ קטגוריה חדשה</button></div>`;
  h += `<div class="card">${list.map(c => catRow(c, m)).join("") || '<p class="empty">אין הוצאות בחודש הזה</p>'}</div>`;
  if (unc > 0) h += `<div class="card"><div class="row click" id="uncatRow"><span class="icon mute">❔</span><div class="main"><b>לא מסווג</b></div><div class="amt"><b>${money(unc)}</b></div><span class="muted">‹</span></div></div>`;
  return h;
}
function budgetFixed() {
  const f = data.fixed;
  let h = `<div class="card monthrow"><div><small>הוצאות קבועות בחודש</small><b>${money(f.total)}</b></div></div>`;
  h += `<div class="head"><h2>קבועות</h2><button id="addFixed">＋ הוספה</button></div>`;
  h += `<div class="card">${f.items.length ? f.items.map(x => `<div class="row${x.source === "manual" ? " click" : ""}" ${x.source === "manual" ? `data-fx="${esc(x.id)}"` : ""}><span class="icon">${icon(x.category)}</span><div class="main"><b>${esc(x.name)}</b><small>${esc(x.category)}${x.day ? " • ב־" + x.day + " בחודש" : ""}${x.source === "manual" ? " • ידני" : ""}</small></div><div class="amt"><b>${money(x.amount)}</b></div></div>`).join("") : '<p class="empty">עוד אין הוצאות קבועות</p>'}</div>`;
  if (data.installments.length) {
    h += `<div class="head"><h2>תשלומים</h2><span class="muted small">${money(data.installments.reduce((s, x) => s + x.amount, 0))} בחודש</span></div><div class="card">${data.installments.map(x => `<div class="row"><span class="icon">${icon(x.category)}</span><div class="main"><b>${esc(x.name)}</b><small>תשלום ${x.current} מתוך ${x.total} • עד ${monthName(x.endMonth, true)}</small></div><div class="amt"><b>${money(x.amount)}</b><small>יתרה ${money(x.remainingTotal)}</small></div></div>`).join("")}</div>`;
  }
  return h;
}

// ---------- חיסכון ----------
function renderSavings() {
  const s = data.savings;
  let h = "";
  if (s.forecast === null) {
    h += emptyCard("הוסיפו משכורת כדי לראות כמה צפוי להישאר החודש", "＋ הוספת הכנסה", "svAddInc");
  } else {
    const ok = s.target > 0 ? s.diff >= 0 : s.forecast >= 0;
    h += `<div class="card saveHero"><small>צפוי להישאר ב${monthName(data.month.ym)}</small><div class="amount ${s.forecast < 0 ? "neg" : ""}">${money(s.forecast)}</div>
      ${s.target > 0 ? `<div class="status ${ok ? "pos" : "neg"}">${ok ? "מעל היעד ב־" + money(s.diff) : "חסרים " + money(-s.diff) + " ליעד"}</div>` : ""}
      <button class="link" id="svTarget">${s.target > 0 ? "יעד חודשי " + money(s.target) + " • שינוי" : "הגדרת יעד חיסכון חודשי"}</button></div>`;
  }
  const incomes = data.manual.filter(i => i.type === "income" && i.recurring);
  if (incomes.length) h += `<div class="head"><h2>הכנסות</h2><span class="muted small">ממוצע ${money(s.incomeAvg)}</span></div><div class="card">${incomes.map(i => { const r = (i.recent || []).filter(x => x > 0); return `<div class="row click" data-inc="${esc(i.id)}"><span class="icon">💰</span><div class="main"><b>${esc(i.name)}</b><small>ב־${i.day} בחודש${i.paused ? " • מושהה" : ""}</small></div><div class="amt"><b>${money(r.length ? r.reduce((a, b) => a + b, 0) / r.length : i.amount)}</b></div></div>`; }).join("")}</div>`;
  if (s.catSave.length) h += `<div class="head"><h2>חיסכון מהתקציב</h2></div><div class="card">${s.catSave.map(c => `<div class="row"><span class="icon">${icon(c.name)}</span><div class="main"><b>${esc(c.name)}</b><small>יעד לחסוך ${money(c.saveTarget)}</small></div><div class="amt"><b class="${c.free >= c.saveTarget ? "pos" : ""}">${money(c.free)}</b><small>פנוי</small></div></div>`).join("")}</div>`;
  h += `<div class="head"><h2>היעדים שלכם</h2><button id="addGoal">＋ יעד חדש</button></div>`;
  h += s.goals.length ? s.goals.map(g => `<div class="card goal click" data-goal="${esc(g.id)}"><div class="row"><div class="main"><b>${esc(g.name)}</b><small>${money(g.saved)} מתוך ${money(g.target)}</small><div class="bar"><i style="width:${Math.min(100, g.pct)}%;background:var(--green)"></i></div></div><div class="amt"><b>${g.pct}%</b></div></div></div>`).join("") : emptyCard("אין יעדי חיסכון. למשל חופשה או קרן חירום");
  $("#savings").innerHTML = h;
  const a = $("#svAddInc"); if (a) a.onclick = () => openAddTx({ type: "income", recurring: true });
  const t = $("#svTarget"); if (t) t.onclick = openTarget;
  $("#addGoal").onclick = () => openGoal("");
  $$("#savings [data-goal]").forEach(el => el.onclick = () => openGoal(el.dataset.goal));
  $$("#savings [data-inc]").forEach(el => el.onclick = () => openManual(el.dataset.inc, ""));
}
function openTarget() {
  openSheet("יעד חיסכון חודשי", `<label>סכום (₪)<input id="tgtAmt" type="number" inputmode="numeric" value="${data.savings.target || ""}"></label><button class="primary" id="tgtSave" style="margin-top:16px">שמירה</button>`);
  $("#tgtSave").onclick = async () => { closeSheet(); await action({ action: "saveSettings", savingsTarget: +$("#tgtAmt").value || 0 }, "נשמר"); };
}
function openGoal(id) {
  const g = data.savings.goals.find(x => x.id === id) || { name: "", target: "", monthly: "", deadline: "" };
  const isNew = !id;
  openSheet(isNew ? "יעד חדש" : g.name, `
    ${isNew ? "" : `<div class="info"><b>${money(g.saved)} מתוך ${money(g.target)}</b>${g.pct}% • נשארו ${money(Math.max(0, g.target - g.saved))}</div>
      <div class="grid2"><label>הפקדה (₪)<input id="gDep" type="number" inputmode="decimal"></label><button class="primary" id="gDepBtn" style="margin-top:31px">הוספה</button></div>`}
    <label>שם<input id="gName" value="${esc(g.name)}" placeholder="למשל: חופשה"></label>
    <div class="grid2"><label>סכום היעד (₪)<input id="gTarget" type="number" inputmode="numeric" value="${g.target}"></label><label>הפקדה חודשית (₪)<input id="gMonthly" type="number" inputmode="numeric" value="${g.monthly || ""}" placeholder="לא חובה"></label></div>
    <label>תאריך יעד (לא חובה)<input id="gDate" type="date" value="${esc(g.deadline || "")}"></label>
    <button class="primary" id="gSave" style="margin-top:16px">שמירה</button>${isNew ? "" : '<button class="danger" id="gDel">מחיקת היעד</button>'}`);
  $("#gSave").onclick = async () => {
    if (!$("#gName").value.trim()) { toast("חסר שם"); return; }
    closeSheet(); await action({ action: "saveGoal", id: id, name: $("#gName").value, target: $("#gTarget").value, monthly: $("#gMonthly").value, deadline: $("#gDate").value }, "נשמר");
  };
  const d = $("#gDepBtn"); if (d) d.onclick = async () => { const v = +$("#gDep").value; if (!v) { toast("חסר סכום"); return; } closeSheet(); await action({ action: "addDeposit", goalId: id, amount: v }, "ההפקדה נוספה"); };
  const x = $("#gDel"); if (x) x.onclick = async () => { if (!confirm("למחוק את היעד?")) return; closeSheet(); await action({ action: "deleteGoal", id: id }, "היעד נמחק"); };
}

// ---------- חשבונות ----------
function cardRow(c) {
  const bank = c.type === "בנק";
  return `<div class="row click${c.removed ? " dim" : ""}" data-card="${esc(c.card)}">
    <span class="icon">${bank ? "🏦" : "💳"}</span>
    <div class="main"><b>${bank ? "חשבון" : "כרטיס"} ${esc(c.card)}${c.removed ? " • הוסר" : ""}</b>
      <small>${esc(c.owner || "בעלים לא הוגדרו")}${bank ? "" : " • חיוב ב־" + c.chargeDay}${c.txCount ? " • עסקה אחרונה " + dmy(c.lastTx) : " • אין עסקאות"}</small></div>
    <span class="muted">‹</span></div>`;
}
function syncLine() {
  const s = data.sync;
  if (!data.vault.ready) return `<div class="banner" id="setupBanner"><span>🔐</span><b>כדי להוסיף ולהסיר חשבונות מהאפליקציה צריך הגדרה חד־פעמית</b><span class="link">להגדרה ‹</span></div>`;
  if (!s) return `<div class="info">עדיין לא התקבל דיווח מהסנכרון</div>`;
  const ok = s.status === "success";
  return `<div class="info" style="border-right:4px solid ${ok ? "var(--green)" : "var(--red)"}"><b>${ok ? "✓ הסנכרון האחרון הצליח" : "✕ הסנכרון האחרון נכשל"}</b>
    ${new Date(s.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} • ${s.accounts} חיבורים${ok ? "" : "<br>אם הסיסמה השתנתה, מסירים את החיבור ומוסיפים אותו מחדש"}</div>`;
}
function renderAccounts() {
  const conns = data.connections || [], active = data.cards.filter(c => !c.removed), removed = data.cards.filter(c => c.removed);
  let h = `<button class="link back" data-go="home">‹ חזרה</button><div class="head"><h2 style="margin-top:4px">חיבורים</h2><button id="addAccount">＋ הוספת חשבון</button></div>`;
  h += syncLine();
  h += conns.map(cn => {
    const cards = active.filter(c => c.connection === cn.id);
    return `<div class="card"><div class="grouphead click" data-conn="${esc(cn.id)}" style="cursor:pointer"><div><b>${esc(cn.providerName)}${cn.label ? " • " + esc(cn.label) : ""}</b><small>${esc(cn.owner || "")} • ${cards.length ? cards.length + (cards[0].type === "בנק" ? " חשבונות" : " כרטיסים") : "ממתין לסנכרון הראשון"}</small></div><span class="link">ניהול ‹</span></div>${cards.map(cardRow).join("")}</div>`;
  }).join("");
  const loose = active.filter(c => !c.connection || !conns.some(cn => cn.id === c.connection));
  if (loose.length) h += `<div class="card"><div class="grouphead"><div><b>${conns.length ? "לא משויכים לחיבור" : "כרטיסים"}</b><small>לחיצה על כרטיס מאפשרת לשייך אותו ולעדכן פרטים</small></div></div>${loose.map(cardRow).join("")}</div>`;
  if (removed.length) h += `<details class="card"><summary class="row click"><div class="main"><b>הוסרו (${removed.length})</b></div></summary>${removed.map(cardRow).join("")}</details>`;
  $("#accounts").innerHTML = h;
  $("#addAccount").onclick = () => data.vault.ready ? openAddAccount() : openVaultSetup();
  const sb = $("#setupBanner"); if (sb) sb.onclick = openVaultSetup;
  $$("#accounts [data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  $$("#accounts [data-card]").forEach(el => el.onclick = () => openCard(el.dataset.card));
  $$("#accounts [data-conn]").forEach(el => el.onclick = () => openConnection(el.dataset.conn));
}

// ---------- הגדרות ----------
function renderSettings() {
  const s = data.settings, u = users();
  $("#settings").innerHTML = `<button class="link back" data-go="home">‹ חזרה</button>
    <div class="settings-sec"><h3>בני הבית</h3>
      <div class="grid2"><label>ראשון<input id="u1" value="${esc(u[0] || "")}"></label><label>שני<input id="u2" value="${esc(u[1] || "")}"></label></div>
      <button class="secondary" id="saveUsers">שמירת שמות</button>
      <button class="secondary" id="whoBtn">מי משתמש בטלפון הזה: ${esc(me() || "לא נבחר")}</button></div>
    <div class="settings-sec"><h3>התראות</h3>
      <label class="check"><input type="checkbox" id="pushOn" ${s.push ? "checked" : ""}><span>לשלוח התראות לטלפון</span></label>
      <div class="grid2"><label>עסקה גדולה מעל (₪)<input id="bigTx" type="number" inputmode="numeric" value="${s.bigTx}"></label>
      <label>תזכורת לפני חיוב (ימים)<input id="chargeDays" type="number" inputmode="numeric" value="${s.chargeDays}"></label></div>
      <button class="secondary" id="saveAlerts">שמירה</button>
      <details><summary class="link">התקנה באייפון</summary>
        <ol class="steps"><li>להתקין את <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">ntfy</a> מה־App Store</li><li>ללחוץ על הפלוס ולהוסיף את הערוץ</li></ol>
        <button class="secondary" id="showTopic">הצגת שם הערוץ</button><code id="topic" hidden>${esc(s.ntfyTopic || "")}</code>
        <button class="secondary" id="copyTopic">העתקת שם הערוץ</button>
        <button class="secondary" id="testPush">שליחת התראת בדיקה</button></details></div>
    <div class="settings-sec"><h3>סנכרון</h3>
      <button class="secondary" id="vaultBtn">${data.vault.ready ? "יצירת מפתח הצפנה חדש" : "הגדרת הסנכרון"}</button></div>
    <div class="settings-sec"><h3>מידע</h3>
      <p class="muted small">עודכן מהשרת: ${data.generatedAt ? new Date(data.generatedAt).toLocaleString("he-IL") : "—"}<br>נתונים חדשים מהסנכרון: ${data.dataChangedAt ? new Date(data.dataChangedAt).toLocaleString("he-IL") : "—"}</p>
      <details><summary class="link">מתקדם</summary><label>כתובת השרת<input id="apiUrl" dir="ltr" value="${esc(apiUrl())}"></label><button class="secondary" id="saveApi">שמירה</button></details>
      <button class="danger" id="logout">התנתקות מהמכשיר</button>
      <p class="muted small" style="text-align:center">אפליקציה ${APP_VERSION} • שרת ${esc(data.version || "")}</p></div>`;
  $("#vaultBtn").onclick = openVaultSetup;
  $("#whoBtn").onclick = chooseMe;
  $("#saveUsers").onclick = () => action({ action: "saveSettings", users: [$("#u1").value.trim(), $("#u2").value.trim()].filter(Boolean) }, "נשמר");
  $("#saveAlerts").onclick = () => action({ action: "saveSettings", push: $("#pushOn").checked, bigTx: +$("#bigTx").value, chargeDays: +$("#chargeDays").value }, "נשמר");
  $("#showTopic").onclick = () => { $("#topic").hidden = !$("#topic").hidden; };
  $("#copyTopic").onclick = () => copyText(s.ntfyTopic || "", "הועתק");
  $("#testPush").onclick = () => action({ action: "testPush" }, "נשלחה התראת בדיקה");
  $("#saveApi").onclick = () => { ls.set("mb_api", $("#apiUrl").value.trim() || DEFAULT_API_URL); load(); };
  $("#logout").onclick = () => { if (confirm("להתנתק מהמכשיר הזה?")) { ls.del("mb_pin"); ls.del("mb_data"); ls.del("mb_me"); data = null; showLogin(); } };
  $$("#settings [data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
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
function ownerOptions(sel) { return Array.from(new Set(users().concat(["משותף"]))).map(o => `<option ${o === sel ? "selected" : ""}>${esc(o)}</option>`).join(""); }
function openTx(id) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  if (t.manual) { openManual(t.manualId, t.ym); return; }
  const names = catList();
  if (t.category !== UNCAT && names.indexOf(t.category) === -1) names.push(t.category);
  openSheet("עריכת עסקה", `
    <div class="info"><b>${esc(t.name)}</b>${money(t.amount, true)} • ${dmy(t.date)} • כרטיס ${esc(t.card)}<br>${t.status === "CHARGED" ? "חויב ב־" : "יורד ב־"}${dayLong(t.chargeDate)}${t.installment ? " • תשלום " + esc(t.installment) : ""}</div>
    <label>קטגוריה<select id="txCat">${t.category === UNCAT ? `<option value="">בחירה</option>` : ""}${names.map(n => `<option ${n === t.category ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <label>או קטגוריה חדשה<input id="txNewCat" placeholder="למשל: מתנות"></label>
    <label class="check"><input type="checkbox" id="txAll" checked><span>להחיל על כל העסקאות מ־<b>${esc(t.name)}</b>, גם בעתיד</span></label>
    <div class="grid2"><label>בעלים<select id="txOwner">${ownerOptions(t.owner)}</select></label><label>הערה<input id="txNote" value="${esc(t.note)}" placeholder="לא חובה"></label></div>
    <label class="check"><input type="checkbox" id="txOne" ${t.oneOff ? "checked" : ""}><span>הוצאה חד־פעמית. לא תיכלל בממוצעים ובהוצאות קבועות</span></label>
    <button class="primary" id="txSave" style="margin-top:16px">שמירה</button>`);
  $("#txSave").onclick = async () => {
    const category = $("#txNewCat").value.trim() || $("#txCat").value;
    const body = { action: "setTx", id: t.id, merchant: t.name, owner: $("#txOwner").value, note: $("#txNote").value, oneOff: $("#txOne").checked };
    if (category && category !== t.category) { body.category = category; body.applyToMerchant = $("#txAll").checked; }
    closeSheet();
    await action(body, "נשמר");
  };
}
function openCategory(name) {
  const c = data.categories.find(x => x.name === name) || { name: "", budget: 0, icon: "", alertAt: 80, saveTarget: 0 };
  const isNew = !name, ym = ui.catMonth || data.month.ym;
  const tx = isNew ? [] : data.transactions.filter(t => t.category === name && t.month === ym && isSpend(t)).sort((a, b) => a.date < b.date ? 1 : -1);
  const opts = [[0, "בלי התראה"], [70, "70%"], [80, "80%"], [90, "90%"], [100, "100% בלבד"]];
  openSheet(isNew ? "קטגוריה חדשה" : name, `
    ${isNew ? "" : `<div class="info">${monthName(ym, true)}: <b style="display:inline">${money(catSpent(name, ym))}</b></div>`}
    <label>שם<input id="cName" value="${esc(c.name)}"></label>
    <div class="grid2"><label>תקציב חודשי (₪)<input id="cBudget" type="number" inputmode="numeric" value="${c.budget || ""}" placeholder="ללא"></label>
    <label>אייקון<input id="cIcon" value="${esc(c.icon || ICONS[c.name] || "")}" placeholder="📁"></label></div>
    <div class="grid2"><label>התראה ב־<select id="cAlert">${opts.map(o => `<option value="${o[0]}" ${+c.alertAt === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></label>
    <label>לחסוך מהתקציב (₪)<input id="cSave" type="number" inputmode="numeric" value="${c.saveTarget || ""}" placeholder="לא חובה"></label></div>
    <button class="primary" id="cSaveBtn" style="margin-top:16px">שמירה</button>
    ${isNew || name === UNCAT ? "" : '<button class="danger" id="cDel">מחיקת הקטגוריה</button>'}
    ${tx.length ? `<h2>עסקאות ב${monthName(ym)}</h2><div class="card">${tx.map(txRow).join("")}</div>` : ""}`);
  $("#cSaveBtn").onclick = async () => {
    const nn = $("#cName").value.trim();
    if (!nn) { toast("חסר שם"); return; }
    closeSheet();
    await action({ action: "saveCategory", oldName: name, name: nn, budget: +$("#cBudget").value || 0, icon: $("#cIcon").value.trim(), alertAt: +$("#cAlert").value, saveTarget: +$("#cSave").value || 0 }, "נשמר");
  };
  const del = $("#cDel");
  if (del) del.onclick = async () => {
    if (!confirm("למחוק את הקטגוריה? העסקאות שלה יחזרו לסיווג אוטומטי")) return;
    closeSheet();
    await action({ action: "deleteCategory", name: name }, "הקטגוריה נמחקה");
  };
  bindTxRows($("#sheetBody"));
}
// הוספת עסקה ידנית
function openAddTx(opt) {
  opt = opt || {};
  const st = { type: opt.type || "expense" };
  openSheet("הוספת עסקה", `
    <div class="seg"><button data-type="expense">הוצאה</button><button data-type="income">הכנסה</button></div>
    <label>שם<input id="mName" placeholder="למשל: גן"></label>
    <div class="grid2"><label>סכום (₪)<input id="mAmt" type="number" inputmode="decimal"></label><label>תאריך<input id="mDate" type="date" value="${data.today}"></label></div>
    <label id="mCatWrap">קטגוריה<select id="mCat">${catList().map(n => `<option>${esc(n)}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" id="mRec" ${opt.recurring ? "checked" : ""}><span>חוזר כל חודש</span></label>
    <label id="mDayWrap">ביום בחודש<input id="mDay" type="number" inputmode="numeric" min="1" max="31" value="${+data.today.slice(8, 10)}"></label>
    <label id="mRecentWrap">סכומים בחודשים האחרונים, לממוצע (לא חובה)<input id="mRecent" placeholder="למשל: 17000, 19000, 18000"></label>
    <button class="primary" id="mSave" style="margin-top:16px">הוספה</button>`);
  const sync = () => {
    $$("#sheetBody [data-type]").forEach(b => b.classList.toggle("active", b.dataset.type === st.type));
    $("#mCatWrap").hidden = st.type === "income";
    $("#mDayWrap").hidden = !$("#mRec").checked;
    $("#mRecentWrap").hidden = !($("#mRec").checked && st.type === "income");
  };
  $$("#sheetBody [data-type]").forEach(b => b.onclick = () => { st.type = b.dataset.type; sync(); });
  $("#mRec").onchange = sync; $("#mDate").onchange = () => { if ($("#mDate").value) $("#mDay").value = +$("#mDate").value.slice(8, 10); };
  sync();
  $("#mSave").onclick = async () => {
    const name = $("#mName").value.trim(), amount = +$("#mAmt").value;
    if (!name) { toast("חסר שם"); return; }
    if (!(amount > 0)) { toast("חסר סכום"); return; }
    const rec = $("#mRec").checked;
    const body = { action: "saveManual", type: st.type, name: name, amount: amount, date: $("#mDate").value || data.today, category: st.type === "expense" ? $("#mCat").value : "" };
    if (rec) body.recurring = { day: +$("#mDay").value || 1 };
    if (rec && st.type === "income") body.recent = $("#mRecent").value.split(/[,\s]+/).map(Number).filter(x => x > 0);
    closeSheet();
    await action(body, rec ? "נוסף, יופיע בכל חודש" : "נוסף");
  };
}
function openManual(id, ym) {
  const it = data.manual.find(x => x.id === id);
  if (!it) return;
  const cur = ym || data.month.ym, income = it.type === "income";
  const occ = data.transactions.find(t => t.manualId === id && t.ym === cur);
  const amt = occ ? occ.amount : it.amount;
  openSheet(it.name, `
    <label>שם<input id="eName" value="${esc(it.name)}"></label>
    <div class="grid2"><label>סכום (₪)<input id="eAmt" type="number" inputmode="decimal" value="${amt}"></label>
    ${it.recurring ? `<label>ביום בחודש<input id="eDay" type="number" inputmode="numeric" min="1" max="31" value="${it.day}"></label>` : `<label>תאריך<input id="eDate" type="date" value="${esc(it.date)}"></label>`}</div>
    ${income ? "" : `<label>קטגוריה<select id="eCat">${catList().map(n => `<option ${n === it.category ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`}
    ${it.recurring ? `<div class="seg"><button data-scope="month" class="active">רק ${monthName(cur)}</button><button data-scope="all">מעכשיו ואילך</button></div>` : ""}
    <button class="primary" id="eSave" style="margin-top:16px">שמירה</button>
    ${it.recurring ? `<button class="secondary" id="eSkip">דילוג על ${monthName(cur)}</button><button class="secondary" id="ePause">${it.paused ? "חידוש" : "השהיה"}</button>` : ""}
    <button class="danger" id="eDel">מחיקה</button>`);
  const st = { scope: "month" };
  $$("#sheetBody [data-scope]").forEach(b => b.onclick = () => { st.scope = b.dataset.scope; $$("#sheetBody [data-scope]").forEach(x => x.classList.toggle("active", x === b)); });
  $("#eSave").onclick = async () => {
    const name = $("#eName").value.trim(), amount = +$("#eAmt").value;
    if (!name || !(amount > 0)) { toast("חסר שם או סכום"); return; }
    const body = { action: "saveManual", id: id, type: it.type, name: name, amount: amount, category: income ? "" : $("#eCat").value, date: it.date };
    if (it.recurring) { body.scope = st.scope; body.ym = cur; body.recurring = { day: +$("#eDay").value || it.day }; if (it.type === "income") body.recent = it.recent; }
    else body.date = $("#eDate").value || it.date;
    closeSheet(); await action(body, "נשמר");
  };
  const sk = $("#eSkip"); if (sk) sk.onclick = async () => { closeSheet(); await action({ action: "skipManual", id: id, ym: cur }, "דילגנו על החודש"); };
  const pa = $("#ePause"); if (pa) pa.onclick = async () => { closeSheet(); await action({ action: "pauseManual", id: id, paused: !it.paused }, it.paused ? "חודש" : "הושהה"); };
  $("#eDel").onclick = async () => { if (!confirm("למחוק? גם ההופעות הקודמות יימחקו")) return; closeSheet(); await action({ action: "deleteManual", id: id }, "נמחק"); };
}
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
  const seen = ls.get("mb_seen", []), al = data ? data.alerts : [];
  openSheet("התראות", al.length ? `<div class="card">${al.map(a => `<div class="row alert ${a.level}"><div class="main"><b style="white-space:normal">${seen.indexOf(a.id) === -1 ? "• " : ""}${esc(a.title)}</b><small style="white-space:normal">${esc(a.body)}</small></div></div>`).join("")}</div>` : `<p class="empty">אין התראות כרגע</p>`);
  ls.set("mb_seen", Array.from(new Set(seen.concat(al.map(a => a.id)))).slice(-400));
  renderHeader();
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
  $$("#statusChips button").forEach(b => b.onclick = () => { ui.chargeDate = ""; ui.cardFilter = ""; setFilter(b.dataset.filter); });
  $("#search").oninput = () => renderTransactions();
  $("#ownerSel").onchange = () => { ui.owner = $("#ownerSel").value; renderTransactions(); };
  $("#fab").onclick = () => openAddTx({});
  $("#refreshBtn").onclick = () => load();
  $("#bellBtn").onclick = openAlerts;
  $("#userBtn").onclick = e => { e.stopPropagation(); toggleMenu(); };
  document.addEventListener("click", e => { const m = $("#menu"); if (!m.hidden && !m.contains(e.target)) m.hidden = true; });
  $("#overlay").onclick = closeSheet;
  $("#sheetClose").onclick = closeSheet;
  $("#loginBtn").onclick = doLogin;
  $("#pinInput").onkeydown = e => { if (e.key === "Enter") doLogin(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && pin()) load(true); });
  if (data && pin()) { try { render(); } catch (e) { console.error(e); ls.del("mb_data"); data = null; } }
  load(true);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
}
init();
