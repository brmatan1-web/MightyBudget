const categories=[
 {name:'סופר ומזון',icon:'🛒',spent:2860,budget:4000,color:'#21aecd'},
 {name:'ילדים',icon:'🧸',spent:1715,budget:2500,color:'#7159e7'},
 {name:'מסעדות ובתי קפה',icon:'☕',spent:1180,budget:1200,color:'#ea8f44'},
 {name:'רכב ותחבורה',icon:'🚗',spent:790,budget:1400,color:'#48aa83'},
 {name:'ביגוד ובית',icon:'🏠',spent:1020,budget:1500,color:'#d75f86'}];
let transactions=[
 {id:1,name:'סופרטל',category:'סופר ומזון',amount:619.10,date:'היום, 12:41',icon:'🛒'},
 {id:2,name:'פוקס קידס',category:'ילדים',amount:229.60,date:'אתמול, 18:09',icon:'🧸'},
 {id:3,name:'עיריית אור יהודה',category:'ארנונה ועירייה',amount:710.73,date:'3 באוק׳',icon:'🏛️',installment:'9/12'},
 {id:4,name:'מלכת שבא',category:'חופשות',amount:684,date:'2 באוק׳',icon:'🏨',installment:'3/10'},
 {id:5,name:'ארומה',category:'מסעדות ובתי קפה',amount:78.50,date:'1 באוק׳',icon:'☕'},
 {id:6,name:'אייבורי',category:'לא מסווג',amount:55,date:'30 בספט׳',icon:'💻'},
 {id:7,name:'חברת החשמל',category:'חשמל',amount:486.25,date:'28 בספט׳',icon:'⚡'}];
const fmt=n=>'₪'+Number(n).toLocaleString('he-IL',{maximumFractionDigits:2});
const categoryNames=['סופר ומזון','ילדים','מסעדות ובתי קפה','רכב ותחבורה','ביגוד ובית','חשמל','ארנונה ועירייה','חופשות','תקשורת ומנויים','לא מסווג'];
function renderCategories(){document.querySelector('#categoryCards').innerHTML=categories.slice(0,4).map(c=>`<div class="cat-row"><div class="row-top"><span class="cat-icon" style="background:${c.color}18">${c.icon}</span><div class="row-text"><b>${c.name}</b><small>${Math.round(c.spent/c.budget*100)}% מהתקציב</small></div><div class="row-amount"><b>${fmt(c.spent)}</b><small>מתוך ${fmt(c.budget)}</small></div></div><div class="bar"><i style="width:${Math.min(100,c.spent/c.budget*100)}%;background:${c.color}"></i></div></div>`).join('')}
function txHtml(t){return `<div class="tx" data-id="${t.id}"><span class="tx-icon">${t.icon}</span><div class="tx-main"><b>${t.name}</b><small>${t.category} • ${t.date}</small></div><div class="tx-amount"><b>${fmt(t.amount)}</b>${t.installment?`<small>תשלום ${t.installment}</small>`:''}</div></div>`}
function bindTx(){document.querySelectorAll('.tx').forEach(x=>x.onclick=()=>openEditor(+x.dataset.id))}
function renderTx(filter='all'){let list=transactions.filter(t=>filter==='all'||filter==='installment'&&t.installment||filter==='uncategorized'&&t.category==='לא מסווג');let q=document.querySelector('#searchInput')?.value||'';if(q)list=list.filter(t=>(t.name+t.category).includes(q));document.querySelector('#txList').innerHTML=list.map(txHtml).join('')||'<p style="text-align:center;color:#718096">לא נמצאו עסקאות</p>';document.querySelector('#recentList').innerHTML=transactions.slice(0,4).map(txHtml).join('');bindTx()}
function renderBudget(){document.querySelector('#budgetList').innerHTML=categories.map(c=>`<div class="budget-row"><div class="row-top"><span class="cat-icon" style="background:${c.color}18">${c.icon}</span><div class="row-text"><b>${c.name}</b><small>${fmt(c.spent)} נוצלו</small></div><div class="row-amount"><b>${fmt(c.budget-c.spent)}</b><small>נותרו</small></div></div><div class="bar"><i style="width:${Math.min(100,c.spent/c.budget*100)}%;background:${c.spent>=c.budget?'#e05260':c.color}"></i></div></div>`).join('')}
function renderInstallments(){document.querySelector('#installments').innerHTML=transactions.filter(t=>t.installment).map(t=>`<div class="installment"><span class="tx-icon">${t.icon}</span><div><b>${t.name}</b><small>תשלום ${t.installment}</small></div><strong>${fmt(t.amount)}</strong></div>`).join('')}
const titles={
 home:'שלום, מתן',
 transactions:'עסקאות',
 forecast:'תחזית',
 accounts:'חשבונות וחיבורים',
 settings:'הגדרות'
};
function go(screen){document.querySelectorAll('.screen,.bottom-nav button').forEach(x=>x.classList.remove('active'));document.querySelector(`[data-screen="${screen}"]`).classList.add('active');document.querySelector(`[data-target="${screen}"]`)?.classList.add('active');document.querySelector('#screenTitle').textContent=titles[screen];window.scrollTo(0,0)}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>go(b.dataset.target));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
let editing=null;function openEditor(id){editing=transactions.find(t=>t.id===id);editName.textContent=editing.name;editDate.textContent=editing.date;editAmount.textContent=fmt(editing.amount);editIcon.textContent=editing.icon;editCategory.innerHTML=categoryNames.map(c=>`<option ${c===editing.category?'selected':''}>${c}</option>`).join('');editNote.value=editing.note||'';unusual.checked=!!editing.unusual;backdrop.classList.add('show');editSheet.classList.add('show')}
function closeEditor(){backdrop.classList.remove('show');editSheet.classList.remove('show')};document.querySelector('.close').onclick=closeEditor;backdrop.onclick=closeEditor;saveTx.onclick=()=>{editing.category=editCategory.value;editing.note=editNote.value;editing.unusual=unusual.checked;renderTx();closeEditor();toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)};
let currentFilter='all';document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');currentFilter=c.dataset.filter;renderTx(currentFilter)});searchInput.oninput=()=>renderTx(currentFilter);
userBtn.onclick=()=>userMenu.classList.toggle('show');document.querySelectorAll('#userMenu button').forEach(b=>b.onclick=()=>{let u=b.dataset.user;screenTitle.textContent='שלום, '+u;userBtn.textContent=u[0];userMenu.classList.remove('show');toast.textContent='עברת למשתמש '+u;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1500)});
editBudget.onclick=()=>{go('settings');toast.textContent='עריכת תקציבים תהיה זמינה כאן';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1700)};
renderCategories();renderTx();renderBudget();renderInstallments();if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
fetch("https://script.google.com/macros/s/AKfycbxG9AtUDu-M6fVGhrRiscb6V2KyH0CMsPbc4SRk-ffh0upQ6GdYli9kq8UW8s-8nO2EzQ/exec")
  .then(r => r.json())
  .then(data => {
alert(JSON.stringify(data));
    document.getElementById("nextChargeAmount").innerHTML =
      "₪" + Math.round(data.confirmedAmount).toLocaleString();
const activeCards = data.cards
  .filter(card => card.amount > 0);

const cardsHtml = activeCards
  .map(card =>
    `${card.card} → ₪${Math.round(card.amount).toLocaleString()}`
  )
  .join("<br>");

document.getElementById("chargeMonth").innerHTML =
  cardsHtml;
    document.getElementById("chargeMonth").innerHTML =
      "חיוב " + data.month;

    document.getElementById("forecastAmount").innerHTML =
      "צפי ₪" + Math.round(data.forecastAmount).toLocaleString();

    console.log("API DATA", data);

  })
  .catch(err => console.error(err));
console.log("MIGHTYBUDGET LOADED");


