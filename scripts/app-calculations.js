"use strict";

function monthlyIncome(month) { return sum(state.incomes, function (item) { return item.month === month ? item.amount : 0; }); }
function monthlyPlan(month) { var plan = state.monthlyPlans && state.monthlyPlans[month] ? state.monthlyPlans[month] : {}; var raw = plan.plannedIncome; var has = raw !== "" && raw != null && !isNaN(Number(raw)) && Number(raw) > 0; return { plannedIncome: has ? numberValue(raw) : null, hasPlannedIncome: has, payday: plan.payday ? parseInt(plan.payday, 10) : 15 }; }
function accountBudgetAmount(account, month) { var plan = monthlyPlan(month); if (!plan.hasPlannedIncome) return null; return plan.plannedIncome * numberValue(account.budgetPercent) / 100; }
function monthlyExpense(accountId, month) { return sum(state.expenses, function (item) { return item.accountId === accountId && item.month === month ? item.amount : 0; }); }
function monthlyInvestment(accountId, month) { return sum(state.investments, function (item) { if (item.accountId !== accountId || item.month !== month) return 0; return item.type === "转出" ? -item.amount : item.amount; }); }
function accountBalance(account, month) { var expense = sum(state.expenses, function (item) { return item.accountId === account.id && item.month <= month ? item.amount : 0; }); var investment = sum(state.investments, function (item) { if (item.accountId !== account.id || item.month > month) return 0; return item.type === "转出" ? -item.amount : item.amount; }); return Math.max(0, investment - expense); }
function totalBudgetPercent() { return sum(state.accounts, function (item) { return item.budgetPercent || 0; }); }
function budgetPercentMessage() { var total = Math.round(totalBudgetPercent() * 10) / 10; if (total === 100) return { text: "预算比例合计 100%，比例刚好分配完", className: "positive" }; if (total < 100) return { text: "预算比例合计 " + total.toFixed(1) + "% ，还有 " + (100 - total).toFixed(1) + "% 未分配", className: "positive" }; return { text: "预算比例合计 " + total.toFixed(1) + "% ，比例超出 " + (total - 100).toFixed(1) + "% ，需要调整", className: "negative" }; }
function monthlySummary(month) {
  var income = monthlyIncome(month), plan = monthlyPlan(month), budget = plan.hasPlannedIncome ? sum(state.accounts, function (item) { return accountBudgetAmount(item, month); }) : 0;
  var accountIncludeExpenseMap = {};
  state.accounts.forEach(function (account) { accountIncludeExpenseMap[account.id] = !!account.includeExpense; });
  var orphanExpenseCount = 0;
  var orphanExpenseTotal = 0;
  var expense = sum(state.expenses, function (item) {
    if (item.month !== month) return 0;
    if (!Object.prototype.hasOwnProperty.call(accountIncludeExpenseMap, item.accountId)) {
      orphanExpenseCount += 1;
      orphanExpenseTotal += numberValue(item.amount);
      return 0;
    }
    return accountIncludeExpenseMap[item.accountId] === true ? item.amount : 0;
  });
  var invest = sum(state.investments, function (item) { return item.month === month ? (item.type === "转出" ? -item.amount : item.amount) : 0; });
  var assetNet = sum(state.accounts, function (account) { return account.includeAsset ? accountBalance(account, month) : 0; });
  var snap = assetSnapshotSummary(month);
  return { income: income, plannedIncome: plan.plannedIncome, hasPlannedIncome: plan.hasPlannedIncome, payday: plan.payday, budget: budget, expense: expense, surplus: income - expense - invest, budgetBalance: plan.hasPlannedIncome ? budget - expense : 0, investment: invest, assetNet: assetNet, assetMarketValue: snap.totalAsset, orphanExpenseCount: orphanExpenseCount, orphanExpenseTotal: numberValue(orphanExpenseTotal), overBudget: plan.hasPlannedIncome && expense > budget && budget > 0 };
}
function financialHealth(month) {
  var s = monthlySummary(month), snap = assetSnapshotSummary(month), todayDate = new Date().getDate();
  var score = 72;
  if (!s.hasPlannedIncome) score -= 18;
  else {
    var salaryRatio = s.plannedIncome > 0 ? s.income / s.plannedIncome : 0;
    if (salaryRatio >= 0.9) score += 8;
    else if (todayDate > s.payday + 3) score -= 12;
  }
  if (s.overBudget) score -= 18;
  else if (s.hasPlannedIncome && s.budget > 0 && s.expense / s.budget < 0.55) score += 6;
  if (s.surplus < 0) score -= 16;
  else if (s.surplus > 0) score += 8;
  if (!state.snapshots.length) score -= 8;
  else if (snap.monthChange != null && snap.monthChange < 0) score -= 8;
  else if (snap.monthChange != null && snap.monthChange >= 0) score += 4;
  score = Math.max(0, Math.min(100, Math.round(score)));
  var risk = score >= 82 ? "低风险" : (score >= 64 ? "可控" : (score >= 45 ? "需关注" : "高风险"));
  var className = score >= 82 ? "positive" : (score >= 64 ? "warning" : "negative");
  var advice = !s.hasPlannedIncome
    ? "先填写本月计划收入，预算判断才会精确"
    : (s.overBudget
      ? "预算已被打穿，先暂停非必要支出"
      : (s.surplus < 0
        ? "现金流为负，检查投入节奏和支出结构"
        : (!state.snapshots.length ? "补一条净值更新，建立收益判断基线" : "资金节奏稳定，继续按当前规则记录")));
  return { score: score, risk: risk, className: className, advice: advice };
}
function monthlyForecast(month) {
  var s = monthlySummary(month), parts = String(month || currentMonth()).split("-"), y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  var now = new Date(), isCurrent = month === monthOf(today()), day = isCurrent ? now.getDate() : new Date(y, m, 0).getDate(), days = new Date(y, m, 0).getDate();
  var remainingDays = Math.max(1, days - day + 1);
  var dailyExpense = day > 0 ? s.expense / day : 0;
  var projectedExpense = numberValue(dailyExpense * days);
  var projectedSurplus = numberValue(s.income - projectedExpense - s.investment);
  var safeSpend = s.hasPlannedIncome ? Math.max(0, s.budget - s.expense) : Math.max(0, s.income - s.expense - s.investment);
  var dailySafeSpend = numberValue(safeSpend / remainingDays);
  var paceRatio = s.hasPlannedIncome && s.budget > 0 ? projectedExpense / s.budget : null;
  var pace = paceRatio == null ? "待计划" : (paceRatio > 1 ? "偏快" : (paceRatio > 0.85 ? "接近上限" : "正常"));
  var className = paceRatio == null ? "warning" : (paceRatio > 1 ? "negative" : (paceRatio > 0.85 ? "warning" : "positive"));
  var budgetUsedRate = s.hasPlannedIncome && s.budget > 0 ? s.expense / s.budget * 100 : null;
  var budgetStatus = budgetUsedRate == null ? "待计划" : (budgetUsedRate > 100 ? "已超支" : (budgetUsedRate > 85 ? "接近上限" : "正常"));
  var budgetClassName = budgetUsedRate == null ? "warning" : (budgetUsedRate > 100 ? "negative" : (budgetUsedRate > 85 ? "warning" : "positive"));
  return { projectedExpense: projectedExpense, projectedSurplus: projectedSurplus, safeSpend: numberValue(safeSpend), dailySafeSpend: dailySafeSpend, pace: pace, className: className, budgetUsedRate: budgetUsedRate, budgetStatus: budgetStatus, budgetClassName: budgetClassName };
}
function cumulativeInvestmentNet(accountId, month) { return sum(state.investments, function (item) { if (item.accountId !== accountId || item.month > month) return 0; return item.type === "转出" ? -item.amount : item.amount; }); }
function latestSnapshotForAccount(accountId) {
  return state.snapshots.filter(function (x) { return x.accountId === accountId; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
}
function latestSnapshotForAccountUntil(accountId, month) {
  var end = monthEndDate(month);
  return state.snapshots.filter(function (x) { return x.accountId === accountId && String(x.date || "") <= end; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
}
function accountAssetValueForMonth(account, month) {
  var snap = latestSnapshotForAccountUntil(account.id, month);
  if (snap) return { value: numberValue(snap.marketValue), principal: numberValue(snap.principal), source: "snapshot", snapshotDate: snap.date };
  return { value: accountBalance(account, month), principal: cumulativeInvestmentNet(account.id, month), source: "net" };
}
function assetSnapshotSummary(month) {
  var assetAccounts = state.accounts.filter(function (a) { return a.includeAsset; });
  var totalAsset = 0, totalPrincipal = 0;
  var fallbackAccounts = [];
  assetAccounts.forEach(function (account) {
    var row = accountAssetValueForMonth(account, month);
    totalAsset += row.value;
    totalPrincipal += row.principal;
    if (row.source !== "snapshot") fallbackAccounts.push(account.name);
  });
  var pnl = totalAsset - totalPrincipal;
  var roi = totalPrincipal > 0 ? pnl / totalPrincipal * 100 : null;
  var monthSnaps = state.snapshots.filter(function (x) { return x.month === month; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  var monthChange = null;
  if (monthSnaps.length >= 2) {
    var firstDate = monthSnaps[0].date, lastDate = monthSnaps[monthSnaps.length - 1].date;
    var firstTotal = sum(monthSnaps.filter(function (x) { return x.date === firstDate; }), function (x) { return x.marketValue; });
    var lastTotal = sum(monthSnaps.filter(function (x) { return x.date === lastDate; }), function (x) { return x.marketValue; });
    monthChange = lastTotal - firstTotal;
  }
  return { totalAsset: numberValue(totalAsset), totalPrincipal: numberValue(totalPrincipal), pnl: numberValue(pnl), roi: roi, monthChange: monthChange, fallbackAccounts: fallbackAccounts };
}
function accountName(id) { var a = state.accounts.find(function (item) { return item.id === id; }); return a ? a.name : "已删除账户"; }
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
function accountVisual(account) {
  var byType = { "长期投资": "#B8976E", "短期储蓄": "#9AA7AA", "应急金": "#D8B45F", "生活消费": "#B9B8B2", "自我投资": "#A99A78", "自由支配": "#B85B50", "其他": "#7A776F" };
  var role = accountRole(account);
  return { color: role.color || byType[account.type] || byType["其他"], emoji: role.emoji };
}
function accountStatus(account, month) {
  var plan = monthlyPlan(month);
  var budget = accountBudgetAmount(account, month);
  var spent = monthlyExpense(account.id, month);
  var current = accountBalance(account, month);
  var target = numberValue(account.target);
  var investNet = monthlyInvestment(account.id, month);
  if (account.includeExpense) {
    if (!plan.hasPlannedIncome) return { text: "待填写计划收入", className: "warning" };
    if (budget > 0) {
      var ratio = spent / budget;
      if (ratio >= 1) return { text: "已超支", className: "negative" };
      if (ratio >= 0.7) return { text: "接近上限", className: "warning" };
    }
    return { text: "正常", className: "positive" };
  }
  if (target > 0) {
    if (current >= target) return { text: "目标已达成", className: "positive" };
    return { text: "目标推进中", className: "warning" };
  }
  if (numberValue(account.budgetPercent) > 0 && investNet === 0) return { text: "待执行", className: "warning" };
  if (investNet > 0) return { text: "已投入", className: "positive" };
  return { text: "继续积累", className: "" };
}
