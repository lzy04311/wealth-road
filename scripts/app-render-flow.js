"use strict";

var flowActiveTab = "income";
var flowReviewExpanded = false;
var FLOW_TABS = { income: true, expense: true, investment: true };

function renderFlowOverview() {
  var month = currentMonth(), s = monthlySummary(month);
  var ratio = s.hasPlannedIncome && s.plannedIncome > 0 ? s.income / s.plannedIncome : null;
  var salaryStatus = !s.hasPlannedIncome ? "等待填写计划收入" : (ratio >= 0.9 ? "工资已到账" : "等待工资到账");
  var systemStatus = !s.hasPlannedIncome ? "计划收入未填写" : (s.overBudget ? "本月有超支" : (s.surplus < 0 ? "现金流为负" : (s.surplus > 0 ? "现金流健康" : "持续观察")));

  byId("flowOvSurplus").textContent = money(s.surplus);
  byId("flowOvSurplus").className = s.surplus >= 0 ? "positive" : "negative";
  byId("flowOvSurplusSub").textContent = s.hasPlannedIncome ? "计划收入 " + money(s.plannedIncome) : "填写计划收入后启动预算";
  byId("flowOvIncome").textContent = money(s.income);
  byId("flowOvExpense").textContent = money(s.expense);
  byId("flowOvInvestment").textContent = money(s.investment);

  var salaryEl = byId("flowOvSalary");
  salaryEl.textContent = salaryStatus;
  salaryEl.className = !s.hasPlannedIncome ? "warning" : (ratio >= 0.9 ? "positive" : "warning");

  var statusEl = byId("flowOvStatus");
  statusEl.textContent = systemStatus;
  statusEl.className = !s.hasPlannedIncome ? "warning" : (s.overBudget || s.surplus < 0 ? "negative" : (s.surplus > 0 ? "positive" : ""));

  // Controls hint
  var hintEl = byId("flowControlsHint");
  if (!s.hasPlannedIncome) {
    hintEl.textContent = "填写计划收入后，系统将自动计算各账户预算金额";
    hintEl.className = "flow-controls-hint warning";
  } else if (s.overBudget) {
    hintEl.textContent = "本月已超支 " + money(s.expense - s.budget) + "，建议检查支出结构";
    hintEl.className = "flow-controls-hint negative";
  } else if (s.surplus < 0) {
    hintEl.textContent = "本月现金流为负，注意控制支出节奏";
    hintEl.className = "flow-controls-hint warning";
  } else {
    hintEl.textContent = "预算运行正常，继续按计划执行";
    hintEl.className = "flow-controls-hint positive";
  }

  // Right-side mini stats
  var budgetText = s.hasPlannedIncome ? money(s.budget) : "待计划";
  var budgetUsed = s.hasPlannedIncome && s.budget > 0 ? (s.expense / s.budget * 100).toFixed(0) + "%" : "--";
  byId("flowRightStats").innerHTML =
    "<div class=\"flow-right-stat\"><span>总预算</span><strong>" + esc(budgetText) + "</strong></div>" +
    "<div class=\"flow-right-stat\"><span>预算使用</span><strong>" + esc(budgetUsed) + "</strong></div>" +
    "<div class=\"flow-right-stat\"><span>预算结余</span><strong>" + (s.hasPlannedIncome ? money(s.budgetBalance) : "--") + "</strong></div>";

  // Review toggle summary
  var reviewSummary = "收入 " + money(s.income) + " · 支出 " + money(s.expense) + " · 结余 " + money(s.surplus);
  if (s.overBudget) reviewSummary += " · 已超支";
  byId("flowReviewSummary").textContent = reviewSummary;

  // Sync review expand state
  var reviewSection = byId("flowReviewSection");
  if (reviewSection) reviewSection.classList.toggle("expanded", flowReviewExpanded);
}

function renderFlow() {
  renderFlowOverview();
  renderMonthlyPlanForm();
  syncFlowTabPanels();
}

function syncFlowTabPanels() {
  document.querySelectorAll(".flow-tab").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.flowTab === flowActiveTab);
  });
  document.querySelectorAll(".flow-record-panel").forEach(function (p) {
    p.classList.toggle("active", p.dataset.flowPanel === flowActiveTab);
  });
}

function switchFlowTab(tabName) {
  if (!FLOW_TABS[tabName]) return;
  flowActiveTab = tabName;
  syncFlowTabPanels();
}

function toggleFlowReview() {
  flowReviewExpanded = !flowReviewExpanded;
  var section = byId("flowReviewSection");
  if (section) section.classList.toggle("expanded", flowReviewExpanded);
}
