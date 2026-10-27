import { billStore } from "./storage.js";
import { budgetStore } from "./budgetStorage.js";

const $ = (id) => document.getElementById(id);
const categories = {
  Rent: { icon: "⌂", color: "#6d5ce8", soft: "#f0edff" },
  Electricity: { icon: "ϟ", color: "#d99a2b", soft: "#fff4df" },
  Water: { icon: "≈", color: "#3477c7", soft: "#eaf3ff" },
  Other: { icon: "▦", color: "#21845b", soft: "#e8f7ef" }
};
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const parseDate = value => new Date(`${value}T00:00:00`);
const prettyDate = value => parseDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
let bills = [];
let chart = null;
let summaryChart = null;
let budgets = [];
let insightPie = null;
let insightBar = null;
let insightLine = null;
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
function categoryIcon(category) {
  const c = categories[category] || categories.Other;
  return `<span class="bill-icon" style="background:${c.soft};color:${c.color}">${c.icon}</span>`;
}
function dateLabel(date) {
  if (date < todayString()) return "Overdue";
  if (date === todayString()) return "Due today";
  const diff = Math.round((parseDate(date) - parseDate(todayString())) / 86400000);
  if (diff === 1) return "Due tomorrow";
  return `In ${diff} days`;
}
function renderDashboard() {
  const total = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const paid = bills.filter(b => b.status === "Paid");
  const pending = bills.filter(b => b.status === "Pending");
  $("total-expenses").textContent = money(total);
  $("paid-count").textContent = paid.length;
  $("pending-count").textContent = pending.length;
  $("paid-caption").textContent = `${money(paid.reduce((s,b)=>s+Number(b.amount),0))} settled`;
  $("pending-caption").textContent = `${money(pending.reduce((s,b)=>s+Number(b.amount),0))} outstanding`;
  const next = pending.slice().sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0];
  $("next-due").textContent = next ? prettyDate(next.dueDate).replace(/,\s*\d{4}$/,"") : "—";
  $("next-due-caption").textContent = next ? `${next.description} · ${money(next.amount)}` : "No pending bills";
  const month = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  $("current-month").textContent = month;
  const upcoming = pending.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,4);
  $("upcoming-list").innerHTML = upcoming.length ? upcoming.map(b => `
    <div class="upcoming-item">${categoryIcon(b.category)}<div class="bill-info"><strong>${escapeHtml(b.description)}</strong><small>${escapeHtml(b.category)} · ${prettyDate(b.dueDate)}</small></div><div class="upcoming-amount">${money(b.amount)}<small>${dateLabel(b.dueDate)}</small></div></div>`).join("") :
    `<div class="empty-state"><div class="empty-icon">✓</div><strong>All caught up!</strong><p>No pending bills at the moment.</p></div>`;
  renderChart();
  renderExpenseSummary();
}
function categoryTotals() {
  return Object.keys(categories).map(category => ({ category, total: bills.filter(b => b.category === category).reduce((s,b)=>s+Number(b.amount),0) }));
}
function makeDoughnut(canvasId, active) {
  const canvas = $(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;
  return new Chart(canvas, { type: "doughnut", data: { labels: active.map(i=>i.category), datasets: [{ data: active.map(i=>i.total), backgroundColor: active.map(i=>categories[i.category].color), borderColor: "#111c2e", borderWidth: 4, hoverOffset: 5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${money(context.raw)}` } } } } });
}
function renderChart() {
  const active = categoryTotals().filter(item => item.total > 0);
  $("chart-empty").classList.toggle("hidden", active.length > 0);
  $("category-legend").innerHTML = active.map(item => `<div class="legend-item"><span class="legend-dot" style="background:${categories[item.category].color}"></span><span>${item.category}</span><span class="legend-value">${money(item.total)}</span></div>`).join("");
  if (chart) chart.destroy();
  chart = makeDoughnut("expense-chart", active);
}
function renderExpenseSummary() {
  const totals = categoryTotals();
  const active = totals.filter(item => item.total > 0);
  const grandTotal = totals.reduce((sum, item) => sum + item.total, 0);
  $("summary-total").textContent = money(grandTotal);
  $("summary-month").textContent = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  $("summary-chart-empty").classList.toggle("hidden", active.length > 0);
  if (summaryChart) summaryChart.destroy();
  summaryChart = makeDoughnut("expense-chart-summary", active);
  $("category-summary-list").innerHTML = totals.map(item => {
    const percent = grandTotal ? Math.round(item.total / grandTotal * 100) : 0;
    return `<div class="category-summary-row"><div class="category-summary-name"><span class="legend-dot" style="background:${categories[item.category].color}"></span>${item.category}</div><div class="progress-track"><div class="progress-fill" style="width:${percent}%;background:${categories[item.category].color}"></div></div><div class="category-summary-amount">${money(item.total)}<small>${percent}% of total</small></div></div>`;
  }).join("");
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function billsForMonth(month) { return bills.filter(b => String(b.dueDate || "").startsWith(month)); }
function budgetSpend(budget) {
  const monthBills = billsForMonth(budget.month);
  return monthBills.filter(b => budget.category === "Overall household" || b.category === budget.category).reduce((sum,b) => sum + Number(b.amount), 0);
}
function budgetPercent(spent, limit) { return limit > 0 ? Math.round(spent / limit * 100) : 0; }
function resetBudgetForm() {
  $("budget-form").reset(); $("budget-id").value = "";
  $("budget-form-heading").textContent = "Create a budget";
  $("budget-submit").textContent = "＋ Save budget";
  $("budget-cancel-edit").classList.add("hidden");
  $("budget-form-message").textContent = "";
  $("budget-month").value = currentMonthKey();
}
function renderBudgets() {
  const month = currentMonthKey();
  const monthBudgets = budgets.filter(b => b.month === month);
  const monthBills = billsForMonth(month);
  const spent = monthBills.reduce((sum,b) => sum + Number(b.amount), 0);
  const totalLimit = monthBudgets.filter(b => b.category === "Overall household").reduce((sum,b)=>sum+Number(b.amount),0) || monthBudgets.reduce((sum,b)=>sum+Number(b.amount),0);
  const remaining = totalLimit - spent;
  $("budget-current-month").textContent = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  $("budget-total").textContent = money(totalLimit);
  $("budget-spent").textContent = money(spent);
  $("budget-remaining").textContent = money(Math.abs(remaining));
  $("budget-remaining-caption").textContent = remaining < 0 ? `${money(Math.abs(remaining))} over budget` : "Available to spend";
  $("budget-remaining").style.color = remaining < 0 ? "#ff8c91" : "#69dfac";
  $("budget-utilization").textContent = totalLimit ? `${budgetPercent(spent,totalLimit)}%` : "—";
  const sorted = [...monthBudgets].sort((a,b) => (a.category === "Overall household" ? -1 : 0) - (b.category === "Overall household" ? -1 : 0));
  $("budget-list").innerHTML = sorted.map(b => {
    const actual = budgetSpend(b), limit = Number(b.amount), pct = budgetPercent(actual,limit), over = actual > limit;
    const color = over ? "#ff7d85" : pct >= 80 ? "#ffb65b" : "#55d5b0";
    return `<div class="budget-row"><div class="budget-row-main"><div class="budget-category-icon">${b.category === "Overall household" ? "⌂" : (categories[b.category] || categories.Other).icon}</div><div class="budget-row-title"><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.category)} · ${new Date(`${b.month}-01T00:00:00`).toLocaleDateString("en-IN",{month:"short",year:"numeric"})}</small></div></div><div class="budget-progress-area"><div class="budget-progress-label"><span>${money(actual)} spent</span><strong>${money(limit)} limit</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,pct)}%;background:${color}"></div></div><small class="budget-progress-caption" style="color:${color}">${over ? `${money(actual-limit)} over limit` : `${money(limit-actual)} remaining`} · ${pct}% used</small></div><div class="budget-row-actions"><button class="icon-btn" data-budget-action="edit" data-id="${b.id}">Edit</button><button class="icon-btn" data-budget-action="delete" data-id="${b.id}">Delete</button></div></div>`;
  }).join("");
  $("budget-empty").classList.toggle("hidden", sorted.length > 0);
  renderBudgetInsights(monthBudgets, monthBills);
}
function renderBudgetInsights(monthBudgets, monthBills) {
  const categorySpend = Object.keys(categories).map(category => ({category,total:monthBills.filter(b=>b.category===category).reduce((s,b)=>s+Number(b.amount),0)}));
  const highest = [...categorySpend].sort((a,b)=>b.total-a.total)[0];
  const categoryBudgets = monthBudgets.filter(b=>b.category!=="Overall household").map(b=>({...b,spent:budgetSpend(b),pct:budgetPercent(budgetSpend(b),Number(b.amount))}));
  const over = categoryBudgets.filter(b=>b.spent>Number(b.amount));
  const closest = categoryBudgets.filter(b=>b.spent<=Number(b.amount)).sort((a,b)=>b.pct-a.pct)[0];
  const insights = [];
  if (highest && highest.total > 0) insights.push({icon:"↗",title:"Highest spending category",body:`${highest.category} has the highest recorded spending at ${money(highest.total)} this month.`,tone:"blue"});
  if (over.length) insights.push({icon:"!",title:"Budget exceeded",body:`${over.map(b=>b.category).join(", ")} ${over.length===1?"is":"are"} over the set limit. Review these expenses.`,tone:"red"});
  else if (closest) insights.push({icon:"◷",title:"Closest to its limit",body:`${closest.category} has used ${closest.pct}% of its budget (${money(closest.spent)} of ${money(closest.amount)}).`,tone:"orange"});
  const overall = monthBudgets.find(b=>b.category==="Overall household");
  if (overall) { const total=monthBills.reduce((s,b)=>s+Number(b.amount),0); const pct=budgetPercent(total,Number(overall.amount)); insights.push({icon:pct>100?"!":"✓",title:"Household budget status",body:pct>100?`You are ${money(total-Number(overall.amount))} above your overall limit.`:`${money(Number(overall.amount)-total)} remains in your overall household budget.`,tone:pct>100?"red":"green"}); }
  if (!insights.length) insights.push({icon:"✦",title:"Your insights will appear here",body:"Add a budget and record bills to get category spending insights and over-budget indicators.",tone:"purple"});
  $("budget-insights").innerHTML = insights.map(i=>`<div class="insight-item"><span class="insight-icon ${i.tone}">${i.icon}</span><div><strong>${i.title}</strong><p>${i.body}</p></div></div>`).join("");
}
function editBudget(budget) {
  $("budget-id").value=budget.id; $("budget-name").value=budget.name; $("budget-category").value=budget.category; $("budget-amount").value=budget.amount; $("budget-month").value=budget.month;
  $("budget-form-heading").textContent="Edit budget"; $("budget-submit").textContent="Save changes"; $("budget-cancel-edit").classList.remove("hidden");
  $("budget-form-heading").scrollIntoView({behavior:"smooth",block:"center"});
}


function initInsightsYear() {
  const select = $("insights-year");
  if (!select || select.options.length) return;
  const year = new Date().getFullYear();
  for (let y = year - 2; y <= year + 1; y++) {
    const option = document.createElement("option"); option.value = String(y); option.textContent = String(y);
    if (y === year) option.selected = true;
    select.appendChild(option);
  }
}
function renderInsights() {
  if (!$("insights-pie")) return;
  initInsightsYear();
  const year = Number($("insights-year").value || new Date().getFullYear());
  const yearBills = bills.filter(b => String(b.dueDate || "").startsWith(`${year}-`));
  const monthLabels = Array.from({length:12}, (_,i) => new Date(year,i,1).toLocaleDateString("en-IN",{month:"short"}));
  const monthly = Array(12).fill(0);
  yearBills.forEach(b => { const month = Number(String(b.dueDate).slice(5,7))-1; if(month>=0 && month<12) monthly[month] += Number(b.amount)||0; });
  const categoryTotals = Object.keys(categories).map(category => ({category,total:yearBills.filter(b=>b.category===category).reduce((s,b)=>s+(Number(b.amount)||0),0)}));
  const total = monthly.reduce((s,v)=>s+v,0);
  const nonZeroMonths = monthly.filter(v=>v>0);
  const average = nonZeroMonths.length ? nonZeroMonths.reduce((s,v)=>s+v,0)/nonZeroMonths.length : 0;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const isCurrentYear = year === currentYear;
  const startForecastAt = isCurrentYear ? currentMonth + 1 : (year > currentYear ? 0 : 12);
  const forecast = monthly.map((value,index) => {
    if (year > currentYear) return value > 0 ? value : average;
    if (isCurrentYear && index >= startForecastAt && value === 0) return average;
    return null;
  });
  const restEstimate = isCurrentYear ? monthly.slice(currentMonth+1).reduce((s,v,i)=>s+(v || forecast[currentMonth+1+i] || 0),0) : (year > currentYear ? monthly.reduce((s,v,i)=>s+(v||forecast[i]||0),0) : 0);
  const top = [...categoryTotals].sort((a,b)=>b.total-a.total)[0];
  $("insight-year-total").textContent = money(total);
  $("insight-top-category").textContent = top && top.total ? top.category : "—";
  $("insight-top-amount").textContent = top && top.total ? money(top.total)+" recorded" : "No recorded expenses";
  $("insight-average").textContent = money(average);
  $("insight-forecast").textContent = money(restEstimate);
  const palette = Object.keys(categories).map(c=>categories[c].color);
  const activeCategories = categoryTotals.filter(item=>item.total>0);
  $("insights-pie-empty").classList.toggle("hidden", activeCategories.length>0);
  $("insights-pie-legend").innerHTML = activeCategories.map(item=>`<div class="legend-item"><span class="legend-dot" style="background:${categories[item.category].color}"></span><span>${item.category}</span><span class="legend-value">${money(item.total)}</span></div>`).join("");
  const commonOptions = {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#aabbd0",usePointStyle:true,boxWidth:8,font:{size:10}}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label ? ctx.dataset.label+": " : ""}${money(ctx.raw||0)}`}}}};
  if (insightPie) insightPie.destroy();
  insightPie = new Chart($("insights-pie"), {type:"pie",data:{labels:activeCategories.map(i=>i.category),datasets:[{data:activeCategories.map(i=>i.total),backgroundColor:activeCategories.map(i=>categories[i.category].color),borderColor:"#142033",borderWidth:3}]},options:{...commonOptions,plugins:{...commonOptions.plugins,legend:{display:false}}}});
  if (insightBar) insightBar.destroy();
  insightBar = new Chart($("insights-bar"), {type:"bar",data:{labels:monthLabels,datasets:[{label:"Recorded bills",data:monthly,backgroundColor:"#6f7cff",borderRadius:5},{label:"Estimated spend",data:forecast,backgroundColor:"#ffb65b88",borderColor:"#ffb65b",borderWidth:1,borderRadius:5}]},options:{...commonOptions,scales:{x:{ticks:{color:"#8fa2bb",font:{size:9}},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#8fa2bb",font:{size:9},callback:v=>"₹"+Number(v).toLocaleString("en-IN")},grid:{color:"#26364d"}}}}});
  if (insightLine) insightLine.destroy();
  const actualLine = monthly.map((value,index)=> value>0 ? value : (isCurrentYear && index>currentMonth ? null : 0));
  const forecastLine = monthly.map((value,index)=> {
    if (year>currentYear) return value || average || 0;
    if (isCurrentYear && index>currentMonth && value===0) return average;
    return null;
  });
  insightLine = new Chart($("insights-line"), {type:"line",data:{labels:monthLabels,datasets:[{label:"Recorded expenses",data:actualLine,borderColor:"#6f7cff",backgroundColor:"#6f7cff22",fill:true,tension:.32,pointRadius:3,spanGaps:false},{label:"Estimated future spend",data:forecastLine,borderColor:"#ffb65b",backgroundColor:"transparent",borderDash:[6,5],tension:.32,pointRadius:3,spanGaps:false}]},options:{...commonOptions,scales:{x:{ticks:{color:"#8fa2bb",font:{size:9}},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#8fa2bb",font:{size:9},callback:v=>"₹"+Number(v).toLocaleString("en-IN")},grid:{color:"#26364d"}}}}});
  const highestMonth = monthly.reduce((best,value,index)=>value>monthly[best] ? index : best,0);
  const highlights=[];
  if (top && top.total>0) highlights.push({icon:"↗",title:"Highest category",body:`${top.category} accounts for ${money(top.total)} of recorded bills in ${year}.`,tone:"blue"});
  if (nonZeroMonths.length) highlights.push({icon:"∿",title:"Typical monthly spend",body:`Across ${nonZeroMonths.length} month(s) with bills, the average is ${money(average)}.`,tone:"purple"});
  if (total>0) highlights.push({icon:"▦",title:"Highest recorded month",body:`${monthLabels[highestMonth]} has the highest recorded total at ${money(monthly[highestMonth])}.`,tone:"orange"});
  if (isCurrentYear && average>0 && currentMonth<11) highlights.push({icon:"◷",title:"Forecast note",body:`The rest-of-year estimate is ${money(restEstimate)}, using the average of months with recorded bills for empty future months.`,tone:"green"});
  if (!highlights.length) highlights.push({icon:"✦",title:"Insights will appear here",body:"Add bills with due dates in this year to populate charts and spending highlights.",tone:"purple"});
  $("insights-highlights").innerHTML=highlights.map(i=>`<div class="insight-item"><span class="insight-icon ${i.tone}">${i.icon}</span><div><strong>${i.title}</strong><p>${i.body}</p></div></div>`).join("");
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active-view", view.dataset.page === viewName));
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === viewName));
  if (viewName === "expenses") renderExpenseSummary();
  if (viewName === "budgets") renderBudgets();
  if (viewName === "insights") renderInsights();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderBills() {
  const query = $("search-input").value.trim().toLowerCase();
  const status = $("status-filter").value;
  const filtered = bills.filter(b => (status === "all" || b.status === status) &&
    [b.description,b.category,b.dueDate].some(v => String(v).toLowerCase().includes(query)));
  $("bills-tbody").innerHTML = filtered.map(b => `
    <tr>
      <td><div class="bill-name-cell">${categoryIcon(b.category)}<div><strong>${escapeHtml(b.description)}</strong><small>Added to household bills</small></div></div></td>
      <td><span class="category-label">${escapeHtml(b.category)}</span></td>
      <td>${prettyDate(b.dueDate)}</td>
      <td class="amount-cell">${money(b.amount)}</td>
      <td><span class="status-badge ${b.status.toLowerCase()}">${b.status}</span></td>
      <td><div class="actions">${b.status === "Pending" ? `<button class="icon-btn mark-paid" data-action="paid" data-id="${b.id}" title="Mark as paid">✓ Paid</button>` : ""}<button class="icon-btn" data-action="edit" data-id="${b.id}" title="Edit bill">Edit</button><button class="icon-btn" data-action="delete" data-id="${b.id}" title="Delete bill">×</button></div></td>
    </tr>`).join("");
  $("no-bills").classList.toggle("hidden", filtered.length > 0);
  $("bill-count-label").textContent = `${filtered.length} bill${filtered.length===1?"":"s"}`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
}
async function refresh() {
  bills = await billStore.getAll();
  renderDashboard();
  renderBills();
  renderBudgets();
  if (document.querySelector('.view.active-view')?.dataset.page === "insights") renderInsights();
}
function resetForm() {
  $("bill-form").reset();
  $("bill-id").value = "";
  $("form-heading").textContent = "Add a bill";
  $("submit-bill").textContent = "＋ Add bill";
  $("cancel-edit").classList.add("hidden");
  $("form-message").textContent = "";
  $("due-date").value = todayString();
}
function editBill(bill) {
  $("bill-id").value = bill.id;
  $("category").value = bill.category;
  $("description").value = bill.description;
  $("amount").value = bill.amount;
  $("due-date").value = bill.dueDate;
  $("status").value = bill.status;
  $("form-heading").textContent = "Edit bill";
  $("submit-bill").textContent = "Save changes";
  $("cancel-edit").classList.remove("hidden");
  switchView("add-bill");
}
$("bill-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("bill-id").value;
  const bill = {
    category: $("category").value,
    description: $("description").value.trim(),
    amount: Number($("amount").value),
    dueDate: $("due-date").value,
    status: $("status").value
  };
  if (!bill.description || !Number.isFinite(bill.amount) || bill.amount <= 0 || !bill.dueDate) {
    $("form-message").textContent = "Please enter a description, valid amount, and due date.";
    return;
  }
  try {
    if (id) {
      await billStore.update(id, bill);
      toast("Bill updated successfully");
    } else {
      await billStore.create(bill);
      toast("Bill added successfully");
    }
    resetForm();
    await refresh();
    switchView("bills");
  } catch (error) {
    $("form-message").textContent = error.message;
    toast(error.message);
  }
});
$("bills-tbody").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const bill = bills.find(b => b.id === button.dataset.id);
  if (!bill) return;
  if (button.dataset.action === "edit") {
    editBill(bill);
    toast("Editing requires a backend update endpoint to save changes.");
    return;
  }
  try {
    if (button.dataset.action === "paid") {
      await billStore.update(bill.id, { status: "Paid" });
      toast("Bill marked as paid");
    } else if (button.dataset.action === "delete") {
      if (!confirm(`Delete "${bill.description}"? This cannot be undone.`)) return;
      await billStore.remove(bill.id);
      toast("Bill deleted");
    }
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});
$("cancel-edit").addEventListener("click", resetForm);
$("search-input").addEventListener("input", renderBills);
$("status-filter").addEventListener("change", renderBills);
$("top-add-btn").addEventListener("click", () => { resetForm(); switchView("add-bill"); });
$("export-btn").addEventListener("click", () => {
  const rows = [["Category","Description","Amount (INR)","Due date","Status"], ...bills.map(b=>[b.category,b.description,b.amount,b.dueDate,b.status])];
  const csv = rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href = url; a.download = "billwise-bills.csv"; a.click(); URL.revokeObjectURL(url);
});
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  if (button.dataset.view === "add-bill") resetForm();
  switchView(button.dataset.view);
}));

$("budget-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id=$("budget-id").value;
  const budget={name:$("budget-name").value.trim(),category:$("budget-category").value,amount:Number($("budget-amount").value),month:$("budget-month").value};
  if(!budget.name || !budget.month || !Number.isFinite(budget.amount) || budget.amount<=0){$("budget-form-message").textContent="Enter a name, month, and valid amount.";return;}
  const duplicate=budgets.some(b=>b.id!==id && b.month===budget.month && b.category===budget.category);
  if(duplicate && !confirm(`A budget for ${budget.category} already exists for ${budget.month}. Save another one anyway?`)) return;
  if(id){await budgetStore.update(id,budget);toast("Budget updated successfully");}else{await budgetStore.create(budget);toast("Budget saved successfully");}
  resetBudgetForm(); budgets=await budgetStore.getAll(); renderBudgets();
});
$("budget-cancel-edit").addEventListener("click",resetBudgetForm);
if ($("insights-year")) $("insights-year").addEventListener("change", renderInsights);
$("budget-list").addEventListener("click",async event=>{
  const btn=event.target.closest("button[data-budget-action]"); if(!btn)return;
  const budget=budgets.find(b=>b.id===btn.dataset.id); if(!budget)return;
  if(btn.dataset.budgetAction==="edit"){editBudget(budget);return;}
  if(!confirm(`Delete budget "${budget.name}"?`))return;
  await budgetStore.remove(budget.id); budgets=await budgetStore.getAll(); renderBudgets(); toast("Budget deleted");
});

document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.go)));
document.querySelectorAll(".brand").forEach(link => link.addEventListener("click", event => { event.preventDefault(); switchView("dashboard"); }));
$("due-date").value = todayString();
$("budget-month").value = currentMonthKey();
resetBudgetForm();
(async () => {
  budgets = await budgetStore.getAll();
  try { await refresh(); }
  catch (error) {
    toast(error.message);
    console.error("AWS bills API failed:", error);
    $("bills-tbody").innerHTML = `<tr><td colspan="6">Could not load bills from AWS. ${escapeHtml(error.message)}</td></tr>`;
  }
})();
