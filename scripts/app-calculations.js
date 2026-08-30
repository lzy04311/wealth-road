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
function accountTransactionWithin(item, account, month) {
  var date = String(item.date || "");
  return date <= monthEndDate(month) && (!account.openingBalanceDate || date >= account.openingBalanceDate);
}
function hasMoneyAccounts() { return Array.isArray(state.moneyAccounts) && state.moneyAccounts.length > 0; }
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
function moneyAccountsTotal(month) { return sum(state.moneyAccounts || [], function (account) { return moneyAccountBalance(account, month); }); }
function openingBalanceForMonth(account, month) {
  if (!account.openingBalance) return 0;
  if (account.openingBalanceDate && account.openingBalanceDate > monthEndDate(month)) return 0;
  return numberValue(account.openingBalance);
}
function accountBalance(account, month) {
  var opening = openingBalanceForMonth(account, month);
  var income = sum(state.incomes, function (item) { return item.accountId === account.id && accountTransactionWithin(item, account, month) ? item.amount : 0; });
  var expense = sum(state.expenses, function (item) { var linkedId = hasMoneyAccounts() ? item.accountId : item.sourceAccountId; return linkedId === account.id && accountTransactionWithin(item, account, month) ? item.amount : 0; });
  var investment = sum(state.investments, function (item) { if (item.accountId !== account.id || !accountTransactionWithin(item, account, month)) return 0; return investmentDirection(item) * item.amount; });
  var investmentFunding = hasMoneyAccounts() ? 0 : sum(state.investments, function (item) { return item.sourceAccountId === account.id && item.accountId !== account.id && accountTransactionWithin(item, account, month) ? investmentDirection(item) * item.amount : 0; });
  var transferIn = hasMoneyAccounts() ? 0 : sum(state.transfers || [], function (item) { return item.toAccountId === account.id && accountTransactionWithin(item, account, month) ? item.amount : 0; });
  var transferOut = hasMoneyAccounts() ? 0 : sum(state.transfers || [], function (item) { return item.fromAccountId === account.id && accountTransactionWithin(item, account, month) ? item.amount : 0; });
  var allocationIn = sum(state.allocations || [], function (item) { return item.toAccountId === account.id && accountTransactionWithin(item, account, month) ? item.amount : 0; });
  var allocationOut = sum(state.allocations || [], function (item) { return item.fromAccountId === account.id && accountTransactionWithin(item, account, month) ? item.amount : 0; });
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
function dashboardRecordInMonth(item, month) {
  return !!item && (item.month === month || String(item.date || "").slice(0, 7) === month);
}
function dashboardReadiness(month) {
  var plan = monthlyPlan(month);
  var monthCollections = [state.incomes, state.expenses, state.investments, state.transfers || [], state.allocations || [], state.reconciliations || []];
  var hasMonthActivity = monthCollections.some(function (rows) { return rows.some(function (item) { return dashboardRecordInMonth(item, month); }); });
  var hasRecordHistory = monthCollections.some(function (rows) { return rows.length > 0; });
  var hasActualAccounts = (state.moneyAccounts || []).length > 0;
  var hasValuation = (state.snapshots || []).length > 0 || (state.assetItems || []).length > 0 || (state.liabilities || []).length > 0
    || state.accounts.some(function (account) { return numberValue(account.openingBalance) !== 0 || !!account.openingBalanceDate; });
  var hasWealthEvidence = hasActualAccounts || hasValuation || state.investments.length > 0;
  var hasFinancialEvidence = plan.hasPlannedIncome || hasRecordHistory || hasWealthEvidence;
  return {
    hasPlan: plan.hasPlannedIncome,
    hasMonthActivity: hasMonthActivity,
    hasCashflowEvidence: hasMonthActivity,
    hasRecordHistory: hasRecordHistory,
    hasActualAccounts: hasActualAccounts,
    hasValuation: hasValuation,
    hasWealthEvidence: hasWealthEvidence,
    hasFinancialEvidence: hasFinancialEvidence,
    canJudgeExecution: plan.hasPlannedIncome || hasMonthActivity,
    onboardingNeeded: !hasFinancialEvidence
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
  var readiness = dashboardReadiness(month);
  if (!readiness.canJudgeExecution) return { score: null, level: "待评估", className: "warning", advice: "先填写月度计划或记录本月第一笔真实流水", label: FINANCIAL_HEALTH_MODEL.label, modelVersion: FINANCIAL_HEALTH_MODEL.version, status: "insufficient" };
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
  return { score: score, level: level.label, className: level.className, advice: advice, label: model.label, modelVersion: model.version, status: "rated" };
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
function calculationMonthStartDate(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || "")) ? month + "-01" : null; }
function calculationDateBefore(dateText) {
  var parts = String(dateText || "").split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  var date = new Date(parts[0], parts[1] - 1, parts[2] - 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function calculationMonthEndDate(month) {
  var start = calculationMonthStartDate(month);
  if (!start || month > monthOf(today())) return null;
  return month === monthOf(today()) ? today() : monthEndDate(month);
}
function accountBalanceAtDate(account, endDate) {
  var opening = account.openingBalance && (!account.openingBalanceDate || account.openingBalanceDate <= endDate) ? numberValue(account.openingBalance) : 0;
  function within(item) { var date = String(item.date || ""); return date <= endDate && (!account.openingBalanceDate || date >= account.openingBalanceDate); }
  var income = sum(state.incomes, function (item) { return item.accountId === account.id && within(item) ? item.amount : 0; });
  var expense = sum(state.expenses, function (item) { var linkedId = hasMoneyAccounts() ? item.accountId : item.sourceAccountId; return linkedId === account.id && within(item) ? item.amount : 0; });
  var investment = sum(state.investments, function (item) { return item.accountId === account.id && within(item) ? investmentDirection(item) * item.amount : 0; });
  var investmentFunding = hasMoneyAccounts() ? 0 : sum(state.investments, function (item) { return item.sourceAccountId === account.id && item.accountId !== account.id && within(item) ? investmentDirection(item) * item.amount : 0; });
  var transferIn = hasMoneyAccounts() ? 0 : sum(state.transfers || [], function (item) { return item.toAccountId === account.id && within(item) ? item.amount : 0; });
  var transferOut = hasMoneyAccounts() ? 0 : sum(state.transfers || [], function (item) { return item.fromAccountId === account.id && within(item) ? item.amount : 0; });
  var allocationIn = sum(state.allocations || [], function (item) { return item.toAccountId === account.id && within(item) ? item.amount : 0; });
  var allocationOut = sum(state.allocations || [], function (item) { return item.fromAccountId === account.id && within(item) ? item.amount : 0; });
  return numberValue(opening + income - expense + investment - investmentFunding + transferIn - transferOut + allocationIn - allocationOut);
}
function portfolioSummaryAtDate(endDate) {
  var totalAsset = 0, totalPrincipal = 0, performanceAsset = 0, performancePrincipal = 0;
  state.accounts.filter(function (account) { return account.includeAsset && !account.archived; }).forEach(function (account) {
    var balance = accountBalanceAtDate(account, endDate), value = balance, principal = Math.max(0, balance);
    if (account.valuationMethod === "净值快照") {
      var snap = state.snapshots.filter(function (item) { return item.accountId === account.id && item.date <= endDate; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
      if (snap) {
        var afterSnapshot = accountLedgerDeltaBetween(account.id, snap.date, endDate);
        value = numberValue(Math.max(0, snap.marketValue + afterSnapshot));
        principal = numberValue(Math.max(0, snap.principal + afterSnapshot));
      } else {
        principal = numberValue(Math.max(0, sum(state.investments, function (item) { return item.accountId === account.id && item.date <= endDate ? investmentDirection(item) * item.amount : 0; }) + (account.openingBalance && (!account.openingBalanceDate || account.openingBalanceDate <= endDate) ? account.openingBalance : 0)));
        value = numberValue(Math.max(0, balance));
      }
      performanceAsset += value;
      performancePrincipal += principal;
    }
    totalAsset += value;
    totalPrincipal += principal;
  });
  return { totalAsset: numberValue(totalAsset), totalPrincipal: numberValue(totalPrincipal), performancePnl: numberValue(performanceAsset - performancePrincipal) };
}
function unallocatedCashSummaryAtDate(endDate) {
  if (hasMoneyAccounts()) {
    var actual = sum(state.moneyAccounts || [], function (account) { return moneyAccountBalanceUntil(account, endDate); });
    var assigned = sum(state.accounts, function (account) { return account.archived ? 0 : accountBalanceAtDate(account, endDate); });
    var difference = numberValue(actual - assigned);
    return { value: numberValue(Math.max(0, difference)), gap: numberValue(Math.max(0, -difference)) };
  }
  var value = sum(state.incomes, function (item) { return !item.accountId && item.date <= endDate ? item.amount : 0; });
  value -= sum(state.expenses, function (item) { return !item.sourceAccountId && item.date <= endDate ? item.amount : 0; });
  value -= sum(state.investments, function (item) { return !item.sourceAccountId && item.date <= endDate ? investmentDirection(item) * item.amount : 0; });
  value += sum(state.allocations || [], function (item) { return !item.fromAccountId && item.date <= endDate ? -item.amount : (!item.toAccountId && item.date <= endDate ? item.amount : 0); });
  return { value: numberValue(Math.max(0, value)), gap: numberValue(Math.max(0, -value)) };
}
function wealthSummaryAtDate(endDate) {
  var portfolio = portfolioSummaryAtDate(endDate);
  var unallocated = unallocatedCashSummaryAtDate(endDate);
  var independentAssets = sum(state.assetItems || [], function (item) { return item.valuationMode === "独立计入" && item.kind !== "电子订阅" && item.status !== "已停用" && item.currentValue > 0 && (!item.valuationDate ? endDate >= today() : item.valuationDate <= endDate) ? item.currentValue : 0; });
  var liabilities = sum(state.liabilities || [], function (item) { return item.status !== "已结清" && item.currentBalance > 0 && (!item.balanceDate ? endDate >= today() : item.balanceDate <= endDate) ? item.currentBalance : 0; });
  var financialAssets = hasMoneyAccounts() ? numberValue(sum(state.moneyAccounts || [], function (account) { return moneyAccountBalanceUntil(account, endDate); }) + portfolio.performancePnl) : numberValue(portfolio.totalAsset + unallocated.value);
  var grossAssets = numberValue(financialAssets + independentAssets);
  return { financialAssets: financialAssets, independentAssets: numberValue(independentAssets), grossAssets: grossAssets, liabilities: numberValue(liabilities), netWorth: numberValue(grossAssets - liabilities), portfolio: portfolio };
}
function wealthBaselineAvailableAtDate(openingDate, closingDate) {
  var hasEvidence = false, unavailable = false;
  function openingEvidence(item) {
    if (item.openingBalanceDate && item.openingBalanceDate <= openingDate) hasEvidence = true;
    if (item.openingBalance > 0 && (!item.openingBalanceDate || item.openingBalanceDate <= openingDate)) hasEvidence = true;
    if (item.openingBalance > 0 && item.openingBalanceDate > openingDate && item.openingBalanceDate <= closingDate) unavailable = true;
  }
  (state.moneyAccounts || []).forEach(openingEvidence);
  state.accounts.filter(function (account) { return account.includeAsset && !account.archived; }).forEach(function (account) {
    openingEvidence(account);
    if (account.valuationMethod !== "净值快照") return;
    var baselineSnap = state.snapshots.some(function (item) { return item.accountId === account.id && item.date <= openingDate; });
    if (baselineSnap) hasEvidence = true;
    var baselineExposure = accountBalanceAtDate(account, openingDate) !== 0 || state.investments.some(function (item) { return item.accountId === account.id && item.date <= openingDate && item.amount > 0; });
    if (baselineExposure && !baselineSnap) unavailable = true;
  });
  (state.assetItems || []).forEach(function (item) {
    if (item.valuationMode !== "独立计入" || item.kind === "电子订阅" || item.status === "已停用" || item.currentValue <= 0) return;
    if (item.valuationDate && item.valuationDate <= openingDate) hasEvidence = true;
    else if (!item.valuationDate || item.valuationDate <= closingDate) unavailable = true;
  });
  (state.liabilities || []).forEach(function (item) {
    if (item.status === "已结清" || item.currentBalance <= 0) return;
    if (item.balanceDate && item.balanceDate <= openingDate) hasEvidence = true;
    else if (!item.balanceDate || item.balanceDate <= closingDate) unavailable = true;
  });
  return hasEvidence && !unavailable;
}
function wealthChange(month) {
  var startDate = calculationMonthStartDate(month), closingDate = calculationMonthEndDate(month);
  if (!startDate || !closingDate) return { openingNetWorth: null, closingNetWorth: null, change: null, changeRate: null, hasBaseline: false };
  var openingDate = calculationDateBefore(startDate), closing = wealthSummaryAtDate(closingDate);
  var hasBaseline = wealthBaselineAvailableAtDate(openingDate, closingDate);
  if (!hasBaseline) return { openingNetWorth: null, closingNetWorth: closing.netWorth, change: null, changeRate: null, hasBaseline: false };
  var openingNetWorth = wealthSummaryAtDate(openingDate).netWorth;
  var change = numberValue(closing.netWorth - openingNetWorth);
  return { openingNetWorth: openingNetWorth, closingNetWorth: closing.netWorth, change: change, changeRate: openingNetWorth === 0 ? null : numberValue(change / Math.abs(openingNetWorth) * 100), hasBaseline: true };
}
function wealthAttribution(month) {
  var startDate = calculationMonthStartDate(month), closingDate = calculationMonthEndDate(month);
  if (!startDate || !closingDate) return { cashflowContribution: null, investmentPnl: null, liabilityChange: null, otherChange: null, unexplained: null, totalChange: null };
  var openingDate = calculationDateBefore(startDate);
  var cashflowContribution = numberValue(sum(state.incomes, function (item) { return item.date > openingDate && item.date <= closingDate ? item.amount : 0; }) - sum(state.expenses, function (item) { return item.date > openingDate && item.date <= closingDate ? item.amount : 0; }));
  var change = wealthChange(month);
  if (!change.hasBaseline) return { cashflowContribution: cashflowContribution, investmentPnl: null, liabilityChange: null, otherChange: null, unexplained: null, totalChange: null };
  var opening = wealthSummaryAtDate(openingDate), closing = wealthSummaryAtDate(closingDate);
  var investmentPnl = numberValue(closing.portfolio.performancePnl - opening.portfolio.performancePnl);
  var liabilityChange = numberValue(opening.liabilities - closing.liabilities);
  var otherChange = hasMoneyAccounts() ? numberValue(sum(state.reconciliations || [], function (item) { return item.date > openingDate && item.date <= closingDate ? item.adjustment : 0; })) : 0;
  var unexplained = numberValue(change.change - cashflowContribution - investmentPnl - liabilityChange - otherChange);
  return { cashflowContribution: cashflowContribution, investmentPnl: investmentPnl, liabilityChange: liabilityChange, otherChange: otherChange, unexplained: unexplained, totalChange: change.change };
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
function calculationPreviousMonth(month) {
  var parts = String(month || "").split("-").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "";
  var date = new Date(parts[0], parts[1] - 2, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}
function calculationMedian(values) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  if (!sorted.length) return null;
  var middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function dashboardInsights(month) {
  month = month || currentMonth();
  var insights = [], currentByCategory = {};
  state.expenses.forEach(function (item) { if (item.month === month) currentByCategory[item.category] = numberValue((currentByCategory[item.category] || 0) + item.amount); });
  Object.keys(currentByCategory).sort().forEach(function (category) {
    var historical = [], candidateMonth = calculationPreviousMonth(month), checked = 0;
    while (historical.length < 3 && candidateMonth && checked < 12) {
      var categoryRows = state.expenses.filter(function (item) { return item.month === candidateMonth && item.category === category; });
      if (categoryRows.length) historical.push(sum(categoryRows, function (item) { return item.amount; }));
      candidateMonth = calculationPreviousMonth(candidateMonth);
      checked += 1;
    }
    if (historical.length < 3) return;
    var median = calculationMedian(historical), current = currentByCategory[category], increase = numberValue(current - median);
    if (median > 0 && current >= 300 && increase >= 200 && current / median >= 1.5) {
      insights.push({ id: "expense-anomaly:" + month + ":" + category, type: "expense_anomaly", priority: increase >= 1000 ? "high" : "medium", title: category + "支出上升", value: current, detail: "本月 " + money(current) + "，近 3 个可用月份中位数 " + money(median) + "，增加 " + money(increase) + "。", source: "expenses" });
    }
  });
  state.accounts.filter(function (account) {
    if (account.archived || !account.includeAsset || account.valuationMethod !== "净值快照") return false;
    return account.openingBalance > 0 || state.investments.some(function (item) { return item.accountId === account.id && item.amount > 0; }) || state.snapshots.some(function (item) { return item.accountId === account.id; });
  }).forEach(function (account) {
    var latest = state.snapshots.filter(function (item) { return item.accountId === account.id && item.date <= today(); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
    var age = latest ? -daysUntilDate(latest.date) : null;
    if (!latest || age > 30) {
      insights.push({ id: "investment-snapshot-stale:" + account.id, type: "investment_snapshot_stale", priority: "medium", title: account.name + "净值数据过期", value: age, detail: latest ? "最新快照为 " + latest.date + "，距今天 " + age + " 天。" : "该投资账户尚无净值快照。", source: "snapshots" });
    }
  });
  var change = wealthChange(month), attribution = wealthAttribution(month);
  if (change.hasBaseline && attribution.totalChange != null && Math.abs(attribution.totalChange) >= 500) {
    var drivers = [
      { key: "cashflow", title: "收支是本月财富变化主要来源", value: attribution.cashflowContribution },
      { key: "investment", title: "投资损益是本月财富变化主要来源", value: attribution.investmentPnl }
    ].filter(function (item) { return item.value != null && item.value * attribution.totalChange > 0 && Math.abs(item.value) >= 500 && Math.abs(item.value) / Math.abs(attribution.totalChange) >= 0.6; }).sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    if (drivers.length) insights.push({ id: "wealth-driver:" + month + ":" + drivers[0].key, type: "wealth_driver", priority: "medium", title: drivers[0].title, value: drivers[0].value, detail: "该项贡献 " + money(drivers[0].value) + "，本月财富变化 " + money(attribution.totalChange) + "。", source: "wealthAttribution" });
  }
  var outgoing = upcomingFinanceEvents(7).filter(function (item) { return item.direction === "out" && item.amount != null; });
  var outgoingTotal = numberValue(sum(outgoing, function (item) { return item.amount; }));
  var largestOutgoing = outgoing.length ? Math.max.apply(null, outgoing.map(function (item) { return item.amount; })) : 0;
  if (largestOutgoing >= 1000 || outgoingTotal >= 1000) insights.push({ id: "upcoming-outflow:7d", type: "upcoming_cash_events", priority: outgoingTotal >= 5000 ? "high" : "medium", title: "未来 7 天有集中现金支出", value: outgoingTotal, detail: "已记录 " + outgoing.length + " 项支出或还款，合计 " + money(outgoingTotal) + "。", source: "upcomingFinanceEvents" });
  if (change.hasBaseline && attribution.unexplained != null && Math.abs(attribution.unexplained) >= 500 && (attribution.totalChange === 0 || Math.abs(attribution.unexplained) / Math.abs(attribution.totalChange) >= 0.1)) {
    insights.push({ id: "unexplained-wealth-change:" + month, type: "unexplained_wealth_change", priority: Math.abs(attribution.unexplained) >= 2000 ? "high" : "medium", title: "本月存在未归因财富变化", value: attribution.unexplained, detail: "净资产变化中有 " + money(attribution.unexplained) + " 尚未由收支、投资损益、负债或明确调整解释。", source: "wealthAttribution" });
  }
  return insights;
}
function upcomingReminders(horizonDays) {
  var horizon = horizonDays == null ? 7 : horizonDays;
  var month = monthOf(today());
  var plan = monthlyPlan(month);
  var s = monthlySummary(month);
  var reminders = [];
  if (plan.hasPlannedIncome) {
    var salaryReceived = s.plannedIncome > 0 ? s.income / s.plannedIncome >= 0.9 : false;
    if (!salaryReceived) {
      var payday = plan.payday || 15;
      var paydayDate = calculationDateForMonthDay(month, payday);
      var paydayDays = daysUntilDate(paydayDate);
      if (paydayDays != null && paydayDays <= horizon && paydayDays >= -3) {
        reminders.push({
          type: "payday", title: "发薪日 " + payday + " 号", date: paydayDate, daysLeft: paydayDays,
          className: paydayDays < 0 ? "negative" : "warning",
          description: paydayDays < 0 ? "工资尚未到账，已过发薪日" : (paydayDays === 0 ? "今天发薪，请确认到账" : paydayDays + " 天后发薪"),
          view: "flow", amount: null, direction: "in", sourceId: "monthly-plan-" + month
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
        view: "assets", amount: item.monthlyCost > 0 ? numberValue(item.monthlyCost) : null, direction: "out", sourceId: item.id
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
        view: "assets", amount: item.minimumPayment > 0 ? numberValue(item.minimumPayment) : null, direction: "out", sourceId: item.id
      });
    }
  });
  return reminders.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
}
function calculationDateForMonthDay(month, day) {
  var last = parseInt(monthEndDate(month).slice(8, 10), 10);
  return month + "-" + String(Math.min(last, Math.max(1, parseInt(day, 10) || 15))).padStart(2, "0");
}
function upcomingFinanceEvents(days) {
  var horizon = days == null ? 7 : Math.max(0, Math.floor(Number(days) || 0));
  var events = [], seen = {};
  function add(event) {
    if (!event || event.daysLeft == null || event.daysLeft < 0 || event.daysLeft > horizon) return;
    var key = event.type + "|" + event.sourceId + "|" + event.date;
    if (seen[key]) return;
    seen[key] = true;
    events.push(event);
  }
  upcomingReminders(horizon).forEach(function (item) {
    add({ date: item.date, daysLeft: item.daysLeft, type: item.type, title: item.title, amount: item.amount == null ? null : numberValue(item.amount), direction: item.direction || "neutral", sourceId: item.sourceId || "" });
  });
  Object.keys(state.monthlyPlans || {}).forEach(function (month) {
    if (month === monthOf(today())) return;
    var plan = monthlyPlan(month);
    if (!plan.hasPlannedIncome) return;
    var date = calculationDateForMonthDay(month, plan.payday);
    add({ date: date, daysLeft: daysUntilDate(date), type: "payday", title: "发薪日 " + plan.payday + " 号", amount: null, direction: "in", sourceId: "monthly-plan-" + month });
  });
  return events.sort(function (a, b) { var byDate = String(a.date).localeCompare(String(b.date)); return byDate || String(a.type).localeCompare(String(b.type)); });
}
function dashboardMinimumDebtServiceRate(month) {
  var income = monthlySummary(month).income;
  var events = upcomingFinanceEvents(30).filter(function (item) { return item.type === "due" && item.amount != null; });
  var minimumPayment = sum(events, function (item) { return item.amount; });
  return { minimumPayment: numberValue(minimumPayment), income: numberValue(income), rate: income > 0 ? numberValue(minimumPayment / income * 100) : null, eventCount: events.length };
}
function dashboardNextPlannedPayday(referenceDate) {
  var reference = String(referenceDate || today());
  var parts = reference.split("-").map(Number), base = new Date(parts[0], (parts[1] || 1) - 1, 1);
  for (var offset = 0; offset < 24; offset += 1) {
    var cursor = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    var month = cursor.getFullYear() + "-" + String(cursor.getMonth() + 1).padStart(2, "0");
    var plan = monthlyPlan(month);
    if (!plan.hasPlannedIncome) continue;
    var date = calculationDateForMonthDay(month, plan.payday);
    if (date < reference) continue;
    return { date: date, month: month, payday: plan.payday, plannedIncome: plan.plannedIncome };
  }
  return null;
}
function dashboardKnownOutflowSummary(events) {
  var known = (events || []).filter(function (item) { return item.direction === "out" && item.amount != null; });
  return {
    events: known,
    count: known.length,
    total: numberValue(sum(known, function (item) { return item.amount; })),
    subscriptionTotal: numberValue(sum(known, function (item) { return item.type === "renewal" ? item.amount : 0; })),
    repaymentTotal: numberValue(sum(known, function (item) { return item.type === "due" ? item.amount : 0; }))
  };
}
function dashboardAllocationExecution(month) {
  var plan = monthlyPlan(month), direct = {}, pending = {};
  state.incomes.forEach(function (item) {
    if (item.month === month && item.accountId) direct[item.accountId] = numberValue((direct[item.accountId] || 0) + item.amount);
  });
  (state.allocations || []).forEach(function (item) {
    if (item.month === month && !item.fromAccountId && item.toAccountId) pending[item.toAccountId] = numberValue((pending[item.toAccountId] || 0) + item.amount);
  });
  var pools = state.accounts.filter(function (account) { return !account.archived; }).map(function (account) {
    var planned = plan.hasPlannedIncome && account.fixedBudget ? accountBudgetAmount(account, month) : null;
    var actual = numberValue((direct[account.id] || 0) + (pending[account.id] || 0));
    return { id: account.id, name: account.name, fixedBudget: !!account.fixedBudget, budgetPercent: numberValue(account.budgetPercent), planned: planned == null ? null : numberValue(planned), actual: actual, balance: numberValue(accountBalance(account, month)) };
  }).filter(function (row) { return row.fixedBudget || row.actual > 0 || row.budgetPercent > 0; });
  var plannedTotal = plan.hasPlannedIncome ? sum(pools, function (row) { return row.planned == null ? 0 : row.planned; }) : null;
  var actualTotal = sum(pools, function (row) { return row.actual; });
  pools.sort(function (a, b) { return Math.max(b.planned || 0, b.actual) - Math.max(a.planned || 0, a.actual) || b.budgetPercent - a.budgetPercent; });
  return { hasPlan: plan.hasPlannedIncome, plannedIncome: plan.plannedIncome, planned: plannedTotal == null ? null : numberValue(plannedTotal), actual: numberValue(actualTotal), deviation: plannedTotal == null ? null : numberValue(actualTotal - plannedTotal), pools: pools };
}
