"use strict";

var FINANCIAL_HEALTH_MODEL = {
  version: 1,
  label: "月度执行健康度",
  baseScore: 72,
  salaryReceivedRatio: 0.9,
  salaryGraceDays: 3,
  lowSpendingRatio: 0.55,
  adjustments: {
    missingPlannedIncome: -18,
    salaryReceived: 8,
    salaryLate: -12,
    overBudget: -18,
    lowSpending: 6,
    negativeFreeCash: -16,
    positiveFreeCash: 8,
    incompleteAssetBaseline: -8
  },
  thresholds: {
    stable: 82,
    controlled: 64,
    attention: 45
  }
};

function monthlyIncome(month) { return sum(state.incomes, function (item) { return item.month === month ? item.amount : 0; }); }
function monthlyPlan(month) { var plan = state.monthlyPlans && state.monthlyPlans[month] ? state.monthlyPlans[month] : {}; var raw = plan.plannedIncome; var has = raw !== "" && raw != null && !isNaN(Number(raw)) && Number(raw) > 0; return { plannedIncome: has ? numberValue(raw) : null, hasPlannedIncome: has, payday: plan.payday ? parseInt(plan.payday, 10) : 15 }; }
function accountBudgetAmount(account, month) { var plan = monthlyPlan(month); if (!plan.hasPlannedIncome) return null; return plan.plannedIncome * numberValue(account.budgetPercent) / 100; }
function monthlyExpense(accountId, month) { return sum(state.expenses, function (item) { return item.accountId === accountId && item.month === month ? item.amount : 0; }); }
function monthlyInvestment(accountId, month) { return sum(state.investments, function (item) { if (item.accountId !== accountId || item.month !== month) return 0; return item.type === "转出" ? -item.amount : item.amount; }); }
function investmentDirection(item) { return item.type === "转出" ? -1 : 1; }
function transactionDateWithin(item, month) { return String(item.date || "") <= monthEndDate(month); }
function hasMoneyAccounts() { return Array.isArray(state.moneyAccounts) && state.moneyAccounts.some(function (item) { return !item.archived; }); }
function moneyAccountName(id) { var item = (state.moneyAccounts || []).find(function (account) { return account.id === id; }); return item ? item.name : (id ? "已删除资金账户" : "未指定实际账户"); }
function moneyAccountOpeningBalanceUntil(account, endDate) {
  if (!account || !account.openingBalance) return 0;
  if (account.openingBalanceDate && account.openingBalanceDate > endDate) return 0;
  return numberValue(account.openingBalance);
}
function moneyAccountTransactionUntil(item, account, endDate) {
  var date = String(item.date || "");
  return date <= endDate && (!account.openingBalanceDate || date >= account.openingBalanceDate);
}
function moneyAccountBalanceUntil(account, endDate, excludeReconciliationId) {
  var opening = moneyAccountOpeningBalanceUntil(account, endDate);
  var income = sum(state.incomes, function (item) { return item.moneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.amount : 0; });
  var expense = sum(state.expenses, function (item) { return item.moneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.amount : 0; });
  var investmentIn = sum(state.investments, function (item) { return item.targetMoneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.amount : 0; });
  var investmentOut = sum(state.investments, function (item) { return item.sourceMoneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.amount : 0; });
  var transferIn = sum(state.transfers || [], function (item) { return item.toMoneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.amount : 0; });
  var transferOut = sum(state.transfers || [], function (item) { return item.fromMoneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.amount : 0; });
  var adjustment = sum(state.reconciliations || [], function (item) { return item.id !== excludeReconciliationId && item.moneyAccountId === account.id && moneyAccountTransactionUntil(item, account, endDate) ? item.adjustment : 0; });
  return numberValue(opening + income - expense + investmentIn - investmentOut + transferIn - transferOut + adjustment);
}
function moneyAccountBalance(account, month) { return moneyAccountBalanceUntil(account, monthEndDate(month)); }
function moneyAccountsTotal(month) { return sum(state.moneyAccounts || [], function (account) { return account.archived ? 0 : moneyAccountBalance(account, month); }); }
function openingBalanceForMonth(account, month) {
  if (!account.openingBalance) return 0;
  if (account.openingBalanceDate && account.openingBalanceDate > monthEndDate(month)) return 0;
  return numberValue(account.openingBalance);
}
function accountBalance(account, month) {
  var opening = openingBalanceForMonth(account, month);
  var income = sum(state.incomes, function (item) { return item.accountId === account.id && transactionDateWithin(item, month) ? item.amount : 0; });
  var expense = sum(state.expenses, function (item) { var linkedId = hasMoneyAccounts() ? item.accountId : item.sourceAccountId; return linkedId === account.id && transactionDateWithin(item, month) ? item.amount : 0; });
  var investment = sum(state.investments, function (item) { if (item.accountId !== account.id || !transactionDateWithin(item, month)) return 0; return investmentDirection(item) * item.amount; });
  var investmentFunding = hasMoneyAccounts() ? 0 : sum(state.investments, function (item) { return item.sourceAccountId === account.id && item.accountId !== account.id && transactionDateWithin(item, month) ? investmentDirection(item) * item.amount : 0; });
  var transferIn = hasMoneyAccounts() ? 0 : sum(state.transfers || [], function (item) { return item.toAccountId === account.id && transactionDateWithin(item, month) ? item.amount : 0; });
  var transferOut = hasMoneyAccounts() ? 0 : sum(state.transfers || [], function (item) { return item.fromAccountId === account.id && transactionDateWithin(item, month) ? item.amount : 0; });
  var allocationIn = sum(state.allocations || [], function (item) { return item.toAccountId === account.id && transactionDateWithin(item, month) ? item.amount : 0; });
  var allocationOut = sum(state.allocations || [], function (item) { return item.fromAccountId === account.id && transactionDateWithin(item, month) ? item.amount : 0; });
  return numberValue(opening + income - expense + investment - investmentFunding + transferIn - transferOut + allocationIn - allocationOut);
}
function totalBudgetPercent() { return sum(state.accounts, function (item) { return item.archived ? 0 : item.budgetPercent || 0; }); }
function budgetPercentMessage() { var total = Math.round(totalBudgetPercent() * 10) / 10; if (total === 100) return { text: "资金分配比例合计 100%，计划刚好分配完", className: "positive" }; if (total < 100) return { text: "资金分配比例合计 " + total.toFixed(1) + "% ，还有 " + (100 - total).toFixed(1) + "% 未分配", className: "positive" }; return { text: "资金分配比例合计 " + total.toFixed(1) + "% ，比例超出 " + (total - 100).toFixed(1) + "% ，需要调整", className: "negative" }; }
function monthlySummary(month) {
  var income = monthlyIncome(month), plan = monthlyPlan(month);
  var allocationBudget = plan.hasPlannedIncome ? sum(state.accounts, function (item) { return item.archived ? 0 : accountBudgetAmount(item, month); }) : 0;
  var spendingBudget = plan.hasPlannedIncome ? sum(state.accounts, function (item) { return !item.archived && item.includeExpense ? accountBudgetAmount(item, month) : 0; }) : 0;
  var accountMap = {};
  state.accounts.forEach(function (account) { accountMap[account.id] = account; });
  var orphanExpenseCount = 0, orphanExpenseTotal = 0;
  var expense = sum(state.expenses, function (item) {
    if (item.month !== month) return 0;
    if (!Object.prototype.hasOwnProperty.call(accountMap, item.accountId)) { orphanExpenseCount += 1; orphanExpenseTotal += numberValue(item.amount); }
    return item.amount;
  });
  var invest = sum(state.investments, function (item) { return item.month === month ? investmentDirection(item) * item.amount : 0; });
  var legacyTransferOut = sum(state.investments, function (item) { return item.month === month && item.type === "转出" ? item.amount : 0; });
  var freeCash = numberValue(income - expense - Math.max(0, invest));
  var netCashFlow = numberValue(income - expense);
  var assetNet = sum(state.accounts, function (account) { return account.includeAsset && !account.archived ? accountBalance(account, month) : 0; });
  var snap = assetSnapshotSummary(month);
  return {
    income: income, plannedIncome: plan.plannedIncome, hasPlannedIncome: plan.hasPlannedIncome, payday: plan.payday,
    budget: spendingBudget, spendingBudget: spendingBudget, allocationBudget: allocationBudget,
    expense: expense, surplus: freeCash, freeCash: freeCash, netCashFlow: netCashFlow,
    budgetBalance: plan.hasPlannedIncome ? spendingBudget - expense : 0, investment: invest,
    assetNet: assetNet, assetMarketValue: snap.totalAsset,
    orphanExpenseCount: orphanExpenseCount, orphanExpenseTotal: numberValue(orphanExpenseTotal),
    legacyTransferOut: legacyTransferOut,
    overBudget: plan.hasPlannedIncome && expense > spendingBudget && spendingBudget >= 0
  };
}
function financialHealthLevel(score) {
  var thresholds = FINANCIAL_HEALTH_MODEL.thresholds;
  if (score >= thresholds.stable) return { label: "稳定", className: "positive" };
  if (score >= thresholds.controlled) return { label: "可控", className: "warning" };
  if (score >= thresholds.attention) return { label: "需关注", className: "negative" };
  return { label: "高压力", className: "negative" };
}
function financialHealth(month) {
  var s = monthlySummary(month), snap = assetSnapshotSummary(month), isCurrent = month === monthOf(today()), todayDate = isCurrent ? new Date().getDate() : 31;
  var model = FINANCIAL_HEALTH_MODEL, adjustments = model.adjustments;
  var score = model.baseScore;
  if (!s.hasPlannedIncome) score += adjustments.missingPlannedIncome;
  else {
    var salaryRatio = s.plannedIncome > 0 ? s.income / s.plannedIncome : 0;
    if (salaryRatio >= model.salaryReceivedRatio) score += adjustments.salaryReceived;
    else if (todayDate > s.payday + model.salaryGraceDays) score += adjustments.salaryLate;
  }
  if (s.overBudget) score += adjustments.overBudget;
  else if (s.hasPlannedIncome && s.spendingBudget > 0 && s.expense / s.spendingBudget < model.lowSpendingRatio) score += adjustments.lowSpending;
  if (s.freeCash < 0) score += adjustments.negativeFreeCash;
  else if (s.freeCash > 0) score += adjustments.positiveFreeCash;
  if (snap.completeness !== "complete") score += adjustments.incompleteAssetBaseline;
  score = Math.max(0, Math.min(100, Math.round(score)));
  var level = financialHealthLevel(score);
  var advice = !s.hasPlannedIncome ? "先填写本月计划收入，预算判断才会精确" : (s.overBudget ? "消费预算已超支，先检查非必要支出" : (s.freeCash < 0 ? "待分配资金为负，检查投入节奏和支出结构" : (snap.completeness !== "complete" ? "补齐净值更新，建立资产判断基线" : "资金节奏稳定，继续按当前规则记录")));
  return { score: score, level: level.label, className: level.className, advice: advice, label: model.label, modelVersion: model.version };
}
function monthlyForecast(month) {
  var s = monthlySummary(month), parts = String(month || currentMonth()).split("-"), y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  var now = new Date(), isCurrent = month === monthOf(today()), day = isCurrent ? now.getDate() : new Date(y, m, 0).getDate(), days = new Date(y, m, 0).getDate();
  var remainingDays = Math.max(1, days - day + 1), dailyExpense = day > 0 ? s.expense / day : 0;
  var projectedExpense = numberValue(dailyExpense * days), projectedSurplus = numberValue(s.income - projectedExpense - Math.max(0, s.investment));
  var safeSpend = s.hasPlannedIncome ? Math.max(0, s.spendingBudget - s.expense) : Math.max(0, s.freeCash);
  var dailySafeSpend = numberValue(safeSpend / remainingDays);
  var paceRatio = s.hasPlannedIncome && s.spendingBudget > 0 ? projectedExpense / s.spendingBudget : null;
  var pace = paceRatio == null ? "待计划" : (paceRatio > 1 ? "偏快" : (paceRatio > 0.85 ? "接近上限" : "正常"));
  var className = paceRatio == null ? "warning" : (paceRatio > 1 ? "negative" : (paceRatio > 0.85 ? "warning" : "positive"));
  var budgetUsedRate = s.hasPlannedIncome && s.spendingBudget > 0 ? s.expense / s.spendingBudget * 100 : null;
  var budgetStatus = budgetUsedRate == null ? "待计划" : (budgetUsedRate > 100 ? "已超支" : (budgetUsedRate > 85 ? "接近上限" : "正常"));
  var budgetClassName = budgetUsedRate == null ? "warning" : (budgetUsedRate > 100 ? "negative" : (budgetUsedRate > 85 ? "warning" : "positive"));
  return { projectedExpense: projectedExpense, projectedSurplus: projectedSurplus, safeSpend: numberValue(safeSpend), dailySafeSpend: dailySafeSpend, pace: pace, className: className, budgetUsedRate: budgetUsedRate, budgetStatus: budgetStatus, budgetClassName: budgetClassName };
}
function cumulativeInvestmentNet(accountId, month) { return sum(state.investments, function (item) { if (item.accountId !== accountId || !transactionDateWithin(item, month)) return 0; return investmentDirection(item) * item.amount; }); }
function latestSnapshotForAccount(accountId) { return state.snapshots.filter(function (x) { return x.accountId === accountId; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null; }
function latestSnapshotForAccountUntil(accountId, month) { var end = monthEndDate(month); return state.snapshots.filter(function (x) { return x.accountId === accountId && String(x.date || "") <= end; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null; }
function accountLedgerDeltaBetween(accountId, startDate, endDate) {
  var income = sum(state.incomes, function (item) { return item.accountId === accountId && item.date > startDate && item.date <= endDate ? item.amount : 0; });
  var expense = sum(state.expenses, function (item) { return item.sourceAccountId === accountId && item.date > startDate && item.date <= endDate ? item.amount : 0; });
  var investment = sum(state.investments, function (item) { return item.accountId === accountId && item.date > startDate && item.date <= endDate ? investmentDirection(item) * item.amount : 0; });
  var investmentFunding = sum(state.investments, function (item) { return item.sourceAccountId === accountId && item.accountId !== accountId && item.date > startDate && item.date <= endDate ? investmentDirection(item) * item.amount : 0; });
  var transferIn = sum(state.transfers || [], function (item) { return item.toAccountId === accountId && item.date > startDate && item.date <= endDate ? item.amount : 0; });
  var transferOut = sum(state.transfers || [], function (item) { return item.fromAccountId === accountId && item.date > startDate && item.date <= endDate ? item.amount : 0; });
  return numberValue(income - expense + investment - investmentFunding + transferIn - transferOut);
}
function accountAssetValueForMonth(account, month) {
  var balance = accountBalance(account, month);
  if (account.valuationMethod === "流水余额") return { value: balance, principal: Math.max(0, balance), source: "ledger", snapshotDate: "" };
  var snap = latestSnapshotForAccountUntil(account.id, month);
  if (!snap) return { value: Math.max(0, balance), principal: Math.max(0, cumulativeInvestmentNet(account.id, month) + openingBalanceForMonth(account, month)), source: "estimate", snapshotDate: "" };
  var endDate = monthEndDate(month);
  var afterSnapshot = accountLedgerDeltaBetween(account.id, snap.date, endDate);
  return { value: numberValue(Math.max(0, snap.marketValue + afterSnapshot)), principal: numberValue(Math.max(0, snap.principal + afterSnapshot)), source: "snapshot", snapshotDate: snap.date };
}
function snapshotPortfolioValueAtDate(date) {
  var total = 0, complete = true;
  state.accounts.filter(function (account) { return account.includeAsset && !account.archived && account.valuationMethod === "净值快照"; }).forEach(function (account) {
    var snap = state.snapshots.filter(function (x) { return x.accountId === account.id && x.date <= date; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
    if (!snap) { complete = false; return; }
    var afterSnapshot = accountLedgerDeltaBetween(account.id, snap.date, date);
    total += numberValue(snap.marketValue + afterSnapshot);
  });
  return complete ? numberValue(total) : null;
}
function assetSnapshotSummary(month) {
  var assetAccounts = state.accounts.filter(function (a) { return a.includeAsset && !a.archived; });
  var totalAsset = 0, totalPrincipal = 0, performanceAsset = 0, performancePrincipal = 0, fallbackAccounts = [], snapshotAccounts = [];
  assetAccounts.forEach(function (account) {
    var row = accountAssetValueForMonth(account, month);
    totalAsset += row.value;
    totalPrincipal += row.principal;
    if (account.valuationMethod === "净值快照") {
      performanceAsset += row.value;
      performancePrincipal += row.principal;
      if (row.source === "snapshot") snapshotAccounts.push(account.name);
      if (row.source === "estimate") fallbackAccounts.push(account.name);
    }
  });
  var pnl = performanceAsset - performancePrincipal;
  var performanceAccounts = assetAccounts.filter(function (account) { return account.valuationMethod === "净值快照"; });
  var performanceReady = performanceAccounts.length > 0 && fallbackAccounts.length === 0;
  var roi = performanceReady && performancePrincipal > 0 ? pnl / performancePrincipal * 100 : null;
  var currentSnaps = state.snapshots.filter(function (x) { return x.month === month; });
  var dates = Array.from(new Set(currentSnaps.map(function (x) { return x.date; }))).sort();
  var monthChange = null;
  if (performanceReady && dates.length >= 2) {
    var firstDate = dates[0], lastDate = dates[dates.length - 1];
    var firstValue = snapshotPortfolioValueAtDate(firstDate), lastValue = snapshotPortfolioValueAtDate(lastDate);
    var contributions = sum(performanceAccounts, function (account) { return accountLedgerDeltaBetween(account.id, firstDate, lastDate); });
    if (firstValue != null && lastValue != null) monthChange = numberValue(lastValue - firstValue - contributions);
  }
  return { totalAsset: numberValue(totalAsset), totalPrincipal: numberValue(totalPrincipal), performanceAsset: numberValue(performanceAsset), performancePrincipal: numberValue(performancePrincipal), pnl: numberValue(pnl), roi: roi, monthChange: monthChange, fallbackAccounts: fallbackAccounts, snapshotAccounts: snapshotAccounts, completeness: assetAccounts.length === 0 ? "missing" : (fallbackAccounts.length ? "estimated" : "complete"), performanceReady: performanceReady };
}
function valueKnownByMonth(date, month) { return date ? date <= monthEndDate(month) : month >= monthOf(today()); }
function independentAssetItems(month) { return (state.assetItems || []).filter(function (item) { return item.valuationMode === "独立计入" && item.kind !== "电子订阅" && item.status !== "已停用" && valueKnownByMonth(item.valuationDate, month || monthOf(today())); }); }
function liabilityTotal(month) { return sum(state.liabilities || [], function (item) { return item.status === "已结清" || !valueKnownByMonth(item.balanceDate, month || monthOf(today())) ? 0 : item.currentBalance; }); }
function unallocatedCashSummary(month) {
  if (hasMoneyAccounts()) {
    var assigned = sum(state.accounts, function (account) { return account.archived ? 0 : accountBalance(account, month); });
    var difference = numberValue(moneyAccountsTotal(month) - assigned);
    return { value: numberValue(Math.max(0, difference)), gap: numberValue(Math.max(0, -difference)) };
  }
  var value = sum(state.incomes, function (item) { return !item.accountId && transactionDateWithin(item, month) ? item.amount : 0; });
  value -= sum(state.expenses, function (item) { return !item.sourceAccountId && transactionDateWithin(item, month) ? item.amount : 0; });
  value -= sum(state.investments, function (item) { return !item.sourceAccountId && transactionDateWithin(item, month) ? investmentDirection(item) * item.amount : 0; });
  value += sum(state.allocations || [], function (item) { return !item.fromAccountId && transactionDateWithin(item, month) ? -item.amount : (!item.toAccountId && transactionDateWithin(item, month) ? item.amount : 0); });
  return { value: numberValue(Math.max(0, value)), gap: numberValue(Math.max(0, -value)) };
}
function wealthSummary(month) {
  var portfolio = assetSnapshotSummary(month);
  var unallocated = unallocatedCashSummary(month);
  var independentAssets = sum(independentAssetItems(month), function (item) { return item.currentValue; });
  var liabilities = liabilityTotal(month);
  var financialAssets = hasMoneyAccounts() ? numberValue(moneyAccountsTotal(month) + portfolio.pnl) : numberValue(portfolio.totalAsset + unallocated.value);
  var grossAssets = numberValue(financialAssets + independentAssets);
  var unresolvedAssets = (state.assetItems || []).filter(function (item) { return item.valuationMode === "待确认" && item.currentValue > 0; });
  return { financialAssets: financialAssets, accountAssets: hasMoneyAccounts() ? financialAssets : portfolio.totalAsset, unallocatedCash: unallocated.value, unallocatedGap: unallocated.gap, independentAssets: independentAssets, grossAssets: grossAssets, liabilities: liabilities, netWorth: numberValue(grossAssets - liabilities), unresolvedAssets: unresolvedAssets, portfolio: portfolio };
}
function accountName(id) { var a = state.accounts.find(function (item) { return item.id === id; }); return a ? a.name : (id ? "已删除账户" : "未指定账户"); }
function fundingAccountName(id) { return id ? accountName(id) : "待分配资金"; }
function accountRole(account) {
  var roleMap = {
    "日常开支": { emoji: "🍚", desc: "吃饭、交通、居住和日用品", color: "#B9B8B2", tip: "优先守住必要开支" },
    "学习成长": { emoji: "🌱", desc: "课程、书籍、健身和工具", color: "#A99A78", tip: "让成长投入产生长期价值" },
    "长期投资": { emoji: "🚀", desc: "长期定投和核心资产", color: "#6E7378", tip: "坚持长期纪律，不追涨杀跌" },
    "备用现金": { emoji: "🛡️", desc: "随时可用的现金和短期存款", color: "#9AA7AA", tip: "保持流动性，方便随时调度" },
    "高风险投资": { emoji: "🎲", desc: "波动较大的小仓位投资", color: "#9A8F7A", tip: "控制仓位，不影响长期计划" },
    "应急金": { emoji: "💰", desc: "突发支出和生活安全垫", color: "#D8B45F", tip: "优先补足安全垫" },
    "娱乐消费": { emoji: "☕", desc: "聚餐、游戏、旅行和小确幸", color: "#B85B50", tip: "可以享受，但不要透支" }
  };
  return roleMap[account.name] || { emoji: "📦", desc: "自定义资金模块", color: "#B8976E", tip: "按你的策略持续优化" };
}
function accountVisual(account) { var byType = { "长期投资": "#B8976E", "短期储蓄": "#9AA7AA", "应急金": "#D8B45F", "生活消费": "#B9B8B2", "自我投资": "#A99A78", "自由支配": "#B85B50", "其他": "#7A776F" }; var role = accountRole(account); return { color: role.color || byType[account.type] || byType["其他"], emoji: role.emoji }; }
function accountStatus(account, month) {
  var plan = monthlyPlan(month), budget = accountBudgetAmount(account, month), spent = monthlyExpense(account.id, month), current = account.includeAsset ? accountAssetValueForMonth(account, month).value : accountBalance(account, month), target = numberValue(account.target), investNet = monthlyInvestment(account.id, month);
  if (account.archived) return { text: "已归档", className: "" };
  if (account.includeExpense) {
    if (!plan.hasPlannedIncome) return { text: "待填写计划收入", className: "warning" };
    if (budget > 0) { var ratio = spent / budget; if (ratio >= 1) return { text: "已超支", className: "negative" }; if (ratio >= 0.7) return { text: "接近上限", className: "warning" }; }
    return { text: "正常", className: "positive" };
  }
  if (target > 0) return current >= target ? { text: "目标已达成", className: "positive" } : { text: "目标推进中", className: "warning" };
  if (numberValue(account.budgetPercent) > 0 && investNet === 0) return { text: "待执行", className: "warning" };
  if (investNet > 0) return { text: "已投入", className: "positive" };
  return { text: "继续积累", className: "" };
}
function daysUntilDate(dateText) {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateText))) return null;
  var parts = String(dateText).split("-").map(Number);
  var now = new Date();
  var todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  return Math.round((targetDate.getTime() - todayDate.getTime()) / 86400000);
}
function upcomingReminders(horizonDays) {
  var horizon = horizonDays == null ? 7 : horizonDays;
  var month = currentMonth();
  var plan = monthlyPlan(month);
  var s = monthlySummary(month);
  var reminders = [];
  if (plan.hasPlannedIncome) {
    var salaryReceived = s.plannedIncome > 0 ? s.income / s.plannedIncome >= 0.9 : false;
    if (!salaryReceived) {
      var payday = plan.payday || 15;
      var paydayDate = month + "-" + String(payday).padStart(2, "0");
      var paydayDays = daysUntilDate(paydayDate);
      if (paydayDays != null && paydayDays <= horizon && paydayDays >= -3) {
        reminders.push({
          type: "payday", title: "发薪日 " + payday + " 号", date: paydayDate, daysLeft: paydayDays,
          className: paydayDays < 0 ? "negative" : "warning",
          description: paydayDays < 0 ? "工资尚未到账，已过发薪日" : (paydayDays === 0 ? "今天发薪，请确认到账" : paydayDays + " 天后发薪"),
          view: "flow"
        });
      }
    }
  }
  (state.assetItems || []).forEach(function (item) {
    if (item.kind !== "电子订阅" || item.status === "已停用" || !item.renewalDate) return;
    var days = daysUntilDate(item.renewalDate);
    if (days != null && days <= horizon) {
      reminders.push({
        type: "renewal", title: item.name + " 续费", date: item.renewalDate, daysLeft: days,
        className: days < 0 ? "negative" : "warning",
        description: days < 0 ? "已过期 " + (-days) + " 天，月成本 " + money(item.monthlyCost) : (days === 0 ? "今天到期，月成本 " + money(item.monthlyCost) : days + " 天后到期，月成本 " + money(item.monthlyCost)),
        view: "assets"
      });
    }
  });
  (state.liabilities || []).forEach(function (item) {
    if (item.status !== "还款中" || !item.dueDate) return;
    var days = daysUntilDate(item.dueDate);
    if (days != null && days <= horizon) {
      reminders.push({
        type: "due", title: item.name + " 还款", date: item.dueDate, daysLeft: days,
        className: days < 0 ? "negative" : "warning",
        description: days < 0 ? "已逾期 " + (-days) + " 天，最低还款 " + money(item.minimumPayment) : (days === 0 ? "今天到期，最低还款 " + money(item.minimumPayment) : days + " 天后到期，最低还款 " + money(item.minimumPayment)),
        view: "assets"
      });
    }
  });
  return reminders.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
}
