"use strict";

function renderDashboard(ctx) {
  var month = currentMonth();
  var renderCtx = ctx && ctx.month === month ? ctx : getRenderContext(month);
  var s = renderCtx.summary;
  var assetSnap = renderCtx.snapshot;
  var wealth = wealthSummary(month);
  var change = wealthChange(month);
  var attribution = wealthAttribution(month);
  var insights = dashboardInsights(month);
  var events = upcomingFinanceEvents(7);
  var futureOutflowEvents = upcomingFinanceEvents(30);
  var health = financialHealth(month);
  var readiness = dashboardReadiness(month);
  var forecast = monthlyForecast(month);
  var totalAsset = wealth.netWorth;
  var assetAccounts = state.accounts.filter(function (account) { return account.includeAsset && !account.archived; });
  var investmentRows = dashboardInvestmentPortfolioRows(month, assetAccounts);
  var investmentAssets = numberValue(sum(investmentRows, function (row) { return row.value; }));
  var targetAccounts = state.accounts.filter(function (account) { return !account.archived && numberValue(account.target) > 0; });
  var primaryGoal = dashboardPrimaryGoal(month, targetAccounts);
  var savingRate = s.income > 0 ? Math.max(0, (s.income - s.expense) / s.income * 100) : null;
  var storageDisplay = typeof storageHealthPresentation === "function" ? storageHealthPresentation() : { shortLabel: "待检测", detail: "存储状态待检测", className: "warning" };
  var backupText = storageDisplay.shortLabel;
  var coreJudgement = readiness.canJudgeExecution ? (s.surplus >= 0 ? "资金节奏稳定" : "现金流承压") : "等待首笔真实数据";
  if (health.score != null && health.className === "warning") coreJudgement = "优先校准预算";
  if (health.score != null && health.className === "negative") coreJudgement = "先守住现金流";

  renderDashboardStatusBar(month, storageDisplay, events);
  renderDashboardAssetCard(month, s, health, totalAsset, wealth, change, investmentAssets, readiness);
  renderDashboardCompass(s, assetSnap, change, attribution, readiness.onboardingNeeded ? null : primaryGoal, events, insights, coreJudgement, readiness);
  renderDashboardRightCards(month, investmentRows, insights, events, readiness.onboardingNeeded ? null : primaryGoal, futureOutflowEvents, readiness);
  renderDashboardBottomStrip(s, assetSnap, change, attribution, readiness.onboardingNeeded ? null : primaryGoal, readiness);
  renderDashboardBottomStatus(s, assetSnap, savingRate, forecast, storageDisplay, readiness);
}

function renderDashboardStatusBar(month, storageDisplay, events) {
  var el = byId("dashboardStatusBar");
  if (!el) return;
  events = events || upcomingFinanceEvents(7);
  var dateShort = today().slice(5).replace("-", ".");
  var dateTip = today() + " · " + dashboardWeekdayText() + "\n今日";
  var reminderValue = events.length ? events.length + " 项 · 未来7天" : "无已记录事项";
  var reminderTip = events.length
    ? events.slice(0, 4).map(function (item) { return item.title + " · " + (item.amount == null ? "金额待定" : money(item.amount)); }).join("\n") + (events.length > 4 ? "\n另有 " + (events.length - 4) + " 项" : "")
    : "未来 7 天没有明确财务事件";
  var storageItem = storageDisplay && typeof storageDisplay === "object" ? storageDisplay : { shortLabel: String(storageDisplay || "待检测"), detail: "存储状态待检测", className: "warning" };
  el.innerHTML = [
    { value: dateShort + " · " + dashboardWeekdayText(), tip: dateTip },
    { value: "● " + storageItem.shortLabel, tip: storageItem.detail, id: "dashboardStorageHealth", className: storageItem.className },
    { value: reminderValue, tip: reminderTip }
  ].map(function (item) {
    return "<div class=\"dashboard-status-pill\" tabindex=\"0\" data-dash-tip=\"" + esc(item.tip) + "\"><strong" + (item.id ? " id=\"" + esc(item.id) + "\"" : "") + " class=\"" + esc(item.className || "") + "\">" + esc(item.value) + "</strong></div>";
  }).join("");
}

function dashboardWeekdayText() {
  var names = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return names[new Date().getDay()];
}

function renderDashboardAssetCard(month, s, health, totalAsset, wealth, change, investmentAssets, readiness) {
  var isUnknown = !!(readiness && readiness.onboardingNeeded);
  setDashboardText("dashboardAssetHealth", health.score == null ? "执行健康 · 待评估" : "执行健康 · " + health.score);
  var healthEl = byId("dashboardAssetHealth");
  if (healthEl) healthEl.className = "dashboard-pill dashboard-health-trigger " + esc(health.className || "warning");
  setDashboardText("dashboardTotalAsset", isUnknown ? "待建账" : (totalAsset < 0 ? "-" + money(Math.abs(totalAsset)) : money(totalAsset)));
  var changeValue = change.hasBaseline ? dashboardSignedMoney(change.change) : "基线待补";
  var changeClass = !change.hasBaseline ? "warning" : (change.change >= 0 ? "positive" : "negative");
  var changeTip = change.hasBaseline ? "本月净资产变化" : "没有可靠月初净资产基线";
  var changeEl = byId("dashboardAssetChange");
  changeEl.innerHTML = "<span>本月变化</span><strong class=\"" + changeClass + "\">" + esc(changeValue) + "</strong>";
  changeEl.setAttribute("data-dash-tip", changeTip);
  var liabilityHint = isUnknown ? "待记录" : (wealth.liabilities > 0 ? "待偿还" : "已记录为零");
  byId("dashboardAssetMetrics").innerHTML = [
    dashboardMetric("本月待分配", isUnknown ? "待记录" : money(s.freeCash), isUnknown ? "warning" : (s.freeCash >= 0 ? "positive" : "negative"), isUnknown ? "记录收入与流出后计算" : "收入减支出减投入"),
    dashboardMetric("金融资产", isUnknown ? "待建账" : money(wealth.financialAssets), isUnknown ? "warning" : "", isUnknown ? "添加实际账户后计算" : "当前持有"),
    dashboardMetric("投资资产", isUnknown ? "待记录" : money(investmentAssets), isUnknown ? "warning" : "", isUnknown ? "记录持仓或净值后计算" : "投资账户市值"),
    dashboardMetric("负债", isUnknown ? "待记录" : money(wealth.liabilities), isUnknown ? "warning" : (wealth.liabilities > 0 ? "negative" : ""), liabilityHint)
  ].join("");
  renderDashboardAssetTrend(month, readiness);
}

function renderDashboardCompass(s, assetSnap, change, attribution, primaryGoal, events, insights, coreJudgement, readiness) {
  setDashboardText("compassCoreStatus", coreJudgement);
  var hasCashflow = !(readiness && !readiness.hasCashflowEvidence);
  var netFlowText = hasCashflow ? (s.netCashFlow >= 0 ? "+" + money(s.netCashFlow) : "-" + money(Math.abs(s.netCashFlow))) : "—";
  var investmentMetric = dashboardInvestmentMetric(assetSnap, attribution);
  var topInsight = dashboardTopInsight(insights);
  var nodes = [
    { key: "data", name: "财富变化", desc: change.hasBaseline ? "本月" : "基线待补", value: change.hasBaseline ? dashboardSignedMoney(change.change) : "—", className: !change.hasBaseline ? "warning" : (change.change >= 0 ? "positive" : "negative"), level: "core" },
    { key: "flow", view: "flow", name: "现金流", desc: hasCashflow ? "本月结余" : "待记录", value: netFlowText, className: hasCashflow ? (s.netCashFlow >= 0 ? "positive" : "negative") : "warning", level: "core" },
    { key: "invest", view: "investments", name: "投资", desc: investmentMetric.context, value: investmentMetric.value, className: investmentMetric.className, level: "core" },
    { key: "assets", name: "近期", desc: events.length ? "未来7天" : "无已记录事项", value: events.length ? events.length + "项" : "—", className: "warning", level: "aux" },
    { key: "goals", view: "goals", name: "目标", desc: primaryGoal ? dashboardBriefText(primaryGoal.name, 6) : "暂无目标", value: primaryGoal ? primaryGoal.progress.toFixed(0) + "%" : "—", className: primaryGoal ? "positive" : "warning", level: "aux" },
    { key: "accounts", name: "洞察", desc: topInsight ? dashboardBriefText(topInsight.title, 7) : (readiness && !readiness.hasFinancialEvidence ? "待记录" : "无显著变化"), value: insights.length ? insights.length + "项" : "—", className: insights.length ? dashboardInsightTone(topInsight) : "warning", level: "aux" }
  ];
  var nodeLayer = byId("wealthCompassNodes");
  if (nodeLayer) nodeLayer.innerHTML = nodes.map(dashboardCompassNode).join("");
}

function renderDashboardRightCards(month, investmentRows, insights, events, primaryGoal, futureOutflowEvents, readiness) {
  if (readiness && readiness.onboardingNeeded) {
    byId("dashboardRightCards").innerHTML = dashboardOnboardingCard();
    return;
  }
  var cards = [];
  cards.push(dashboardInvestmentPortfolioCard(investmentRows));
  cards.push(dashboardFutureOutflowCard(futureOutflowEvents));
  cards.push(dashboardFinanceEventsCard(events));
  cards.push(dashboardPrimaryGoalCard(primaryGoal));
  byId("dashboardRightCards").innerHTML = cards.join("");
}

function dashboardOnboardingCard() {
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-onboarding-card\"><span class=\"context-label\">第一次使用</span><h3>先建立三条真实基线</h3><p>模板账户只是分类框架，不代表你已经拥有这些钱。完成下面三步后，净资产、健康分和趋势才开始计算。</p>"
    + "<ol><li><strong>1</strong><span>添加银行卡、现金等实际账户</span><button type=\"button\" data-action=\"open-view\" data-view=\"accounts\">去建账户</button></li>"
    + "<li><strong>2</strong><span>填写本月计划收入和发薪日</span><button type=\"button\" data-action=\"open-view\" data-view=\"flow\">去填计划</button></li>"
    + "<li><strong>3</strong><span>记录第一笔真实收入或支出</span><button type=\"button\" data-quick-action=\"expense\">记第一笔</button></li></ol></article>";
}










function renderDashboardBottomStatus(s, assetSnap, savingRate, forecast, storageDisplay, readiness) {
  var el = byId("dashboardBottomStatus");
  if (!el) return;
  var isUnknown = !!(readiness && !readiness.canJudgeExecution);
  var expenseStatus = isUnknown ? "预算状态待建立" : (s.overBudget ? "支出待收缩" : "支出结构已计算");
  var savingStatus = savingRate == null ? "储蓄率待记录" : "储蓄率 " + savingRate.toFixed(1) + "%";
  var investStatus = assetSnap.roi == null ? "投资待快照" : (assetSnap.roi >= 0 ? "投资收益回升" : "投资收益承压");
  var orphanStatusTitle = isUnknown ? "账目状态待建立" : (s.orphanExpenseCount > 0 ? "存在孤立支出" : "账目结构已校验");
  var orphanStatusValue = isUnknown ? "尚无可核对记录" : (s.orphanExpenseCount > 0 ? (s.orphanExpenseCount + " 条 / " + money(s.orphanExpenseTotal)) : "未发现孤立记录");
  var orphanClass = isUnknown || s.orphanExpenseCount > 0 ? "warning" : "positive";
  var storageItem = storageDisplay && typeof storageDisplay === "object" ? storageDisplay : { shortLabel: String(storageDisplay || "待检测"), className: "warning" };
  el.innerHTML = [
    dashboardStatusItem("本地数据", storageItem.shortLabel, storageItem.className, "dashboardBottomStorageHealth"),
    dashboardStatusItem(expenseStatus, isUnknown ? "先填写计划或记录流水" : (forecast.budgetStatus || "持续观察"), isUnknown || s.overBudget ? "warning" : "positive"),
    dashboardStatusItem(orphanStatusTitle, orphanStatusValue, orphanClass),
    dashboardStatusItem("储蓄率提升", savingStatus, savingRate == null ? "warning" : "positive"),
    dashboardStatusItem(investStatus, assetSnap.roi == null ? "等待数据" : assetSnap.roi.toFixed(2) + "%", assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"))
  ].join("");
}

function dashboardMetric(label, value, className, hint) {
  return "<div><span>" + esc(label) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><small>" + esc(hint || "") + "</small></div>";
}

function dashboardSignedMoney(value) {
  value = numberValue(value);
  if (value > 0) return "+" + money(value);
  if (value < 0) return "-" + money(Math.abs(value));
  return money(0);
}

function dashboardBriefText(value, maxLength) {
  var text = cleanText(value || "");
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

function dashboardPrimaryGoal(month, targetAccounts) {
  var rows = (targetAccounts || []).map(function (account) {
    var target = numberValue(account.target);
    var current = numberValue(account.includeAsset ? accountAssetValueForMonth(account, month).value : accountBalance(account, month));
    var progress = target > 0 ? Math.max(0, Math.min(100, current / target * 100)) : 0;
    return { id: account.id, name: account.name, current: current, target: target, remaining: numberValue(Math.max(0, target - current)), progress: progress };
  }).filter(function (row) { return row.target > 0 && row.current < row.target; });
  rows.sort(function (a, b) { return b.progress - a.progress || b.target - a.target || a.name.localeCompare(b.name); });
  return rows[0] || null;
}

function dashboardHasInvestmentData() {
  return state.accounts.some(function (account) {
    if (account.archived || !account.includeAsset || account.valuationMethod !== "净值快照") return false;
    return account.openingBalance > 0 || state.snapshots.some(function (item) { return item.accountId === account.id; }) || state.investments.some(function (item) { return item.accountId === account.id; });
  });
}

function dashboardInvestmentMetric(assetSnap, attribution) {
  if (!dashboardHasInvestmentData()) return { value: "—", context: "数据不足", className: "warning" };
  if (attribution.investmentPnl != null) return { value: dashboardSignedMoney(attribution.investmentPnl), context: "本月损益", className: attribution.investmentPnl >= 0 ? "positive" : "negative" };
  if (assetSnap.monthChange != null) return { value: dashboardSignedMoney(assetSnap.monthChange), context: "本月损益", className: assetSnap.monthChange >= 0 ? "positive" : "negative" };
  if (assetSnap.performanceReady) return { value: dashboardSignedMoney(assetSnap.pnl), context: "当前盈亏", className: assetSnap.pnl >= 0 ? "positive" : "negative" };
  return { value: "—", context: "数据不足", className: "warning" };
}

function dashboardPriorityRank(priority) {
  if (typeof priority === "number") return priority;
  return { high: 3, medium: 2, low: 1 }[priority] || 0;
}

function dashboardTopInsight(insights) {
  var ranked = (insights || []).map(function (item, index) { return { item: item, index: index }; }).sort(function (a, b) { return dashboardPriorityRank(b.item.priority) - dashboardPriorityRank(a.item.priority) || a.index - b.index; });
  return ranked.length ? ranked[0].item : null;
}

function dashboardInsightTone(insight) {
  return insight && dashboardPriorityRank(insight.priority) >= 3 ? "negative" : "warning";
}

function dashboardInsightDisplayValue(insight) {
  if (!insight || insight.value == null) return "—";
  if (insight.type === "investment_snapshot_stale") return numberValue(insight.value) + "天";
  return dashboardSignedMoney(insight.value);
}

function dashboardFutureOutflowCard(events) {
  var summary = dashboardKnownOutflowSummary(events);
  if (!summary.count) return "<article class=\"dashboard-side-card dashboard-panel dashboard-insight-card\"><h3><i></i>未来30天</h3><strong class=\"warning\">暂无已记录流出</strong><p class=\"dashboard-insight-status\">仅统计已有续费与最低还款记录</p></article>";
  var detail = [];
  if (summary.subscriptionTotal > 0) detail.push("订阅 " + money(summary.subscriptionTotal));
  if (summary.repaymentTotal > 0) detail.push("最低还款 " + money(summary.repaymentTotal));
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-insight-card\"><h3><i></i>未来30天</h3>"
    + "<strong class=\"negative\">" + esc(money(summary.total)) + "</strong>"
    + "<span class=\"dashboard-insight-metric\">未来30天已知流出 · " + esc(summary.count) + " 项</span>"
    + "<p class=\"dashboard-insight-status\">" + esc(detail.join(" · ") || "仅统计已有金额的流出记录") + "</p></article>";
}

function dashboardFinanceEventAmount(event) {
  if (event.amount == null) return "金额待定";
  if (event.direction === "in") return "+" + money(event.amount);
  if (event.direction === "out") return "-" + money(event.amount);
  return money(event.amount);
}

function dashboardFinanceEventsCard(events) {
  events = events || [];
  var summary = events.length + "项 · 未来7天";
  if (!events.length) return "<article class=\"dashboard-side-card dashboard-panel dashboard-reminder-card\"><h3><i></i>近期事件</h3><strong class=\"warning\">无已记录事项</strong><p>添加续费、还款或发薪计划后显示</p></article>";
  var items = events.slice(0, 3).map(function (event) {
    var directionText = event.direction === "in" ? "流入" : (event.direction === "out" ? "流出" : "事项");
    return "<div class=\"dashboard-reminder-item\"><span class=\"dashboard-reminder-dot " + (event.direction === "out" ? "negative" : "") + "\"></span><div><strong>" + esc(event.date.slice(5) + " · " + event.title) + "</strong><p>" + esc(dashboardFinanceEventAmount(event) + " · " + directionText) + "</p></div></div>";
  }).join("");
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-reminder-card\"><h3><i></i>近期事件</h3><strong>" + esc(summary) + "</strong>" + items + (events.length > 3 ? "<div class=\"row-meta\">另有 " + (events.length - 3) + " 项</div>" : "") + "</article>";
}

function dashboardPrimaryGoalCard(goal) {
  if (!goal) return "<article class=\"dashboard-side-card dashboard-panel dashboard-goal-card\"><h3><i></i>目标进度</h3><strong class=\"warning\">暂无目标</strong><p>尚未设置未完成资金目标</p></article>";
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-goal-card\"><h3><i></i>目标进度</h3>"
    + "<div class=\"dashboard-goal-visual\"><div class=\"dashboard-goal-ring\" style=\"--goal-progress:" + esc(goal.progress.toFixed(1)) + "%\"><span>" + esc(goal.progress.toFixed(0)) + "%</span></div>"
    + "<div><strong class=\"positive\">" + esc(goal.name) + "</strong><p>" + esc(money(goal.current) + " / " + money(goal.target)) + "<br>剩余 " + esc(money(goal.remaining)) + "</p></div></div></article>";
}

function dashboardStatusItem(title, value, className, valueId) {
  return "<article class=\"dashboard-status-item\"><i class=\"" + esc(className || "") + "\"></i><div><span>" + esc(title) + "</span><strong" + (valueId ? " id=\"" + esc(valueId) + "\"" : "") + " class=\"" + esc(className || "") + "\">" + esc(value) + "</strong></div></article>";
}

function dashboardCompassNode(item) {
  var action = item.view ? " data-action=\"open-view\" data-view=\"" + esc(item.view) + "\"" : "";
  var tag = item.view ? "button" : "div";
  return "<" + tag + " class=\"compass-node node-" + esc(item.key) + " is-" + esc(item.level || "aux") + "\"" + (item.view ? " type=\"button\"" : " role=\"status\"") + action + " aria-label=\"" + esc(item.name + "：" + item.value + "，" + item.desc) + "\">"
    + "<span class=\"node-name\">" + esc(item.name) + "</span>"
    + "<strong class=\"" + esc(item.className || "") + "\">" + esc(item.value) + "</strong>"
    + "<span class=\"node-desc\">" + esc(item.desc) + "</span>"
    + "</" + tag + ">";
}

function dashboardInvestmentPortfolioRows(month, assetAccounts) {
  return assetAccounts.filter(function (account) {
    return account.valuationMethod === "净值快照" || state.investments.some(function (item) { return item.accountId === account.id && (item.type === "投资" || item.type === "转出"); });
  }).map(function (account) {
    var row = accountAssetValueForMonth(account, month);
    var products = Array.from(new Set(state.investments.filter(function (item) { return item.accountId === account.id && item.product; }).map(function (item) { return item.product; })));
    return { name: products.length === 1 ? products[0] : account.name, accountName: account.name, value: Math.max(0, row.value), color: accountVisual(account).color };
  }).filter(function (row) { return row.value > 0; }).sort(function (a, b) { return b.value - a.value; });
}

function dashboardInvestmentPortfolioCard(rows) {
  return "<article class=\"dashboard-side-card dashboard-panel\"><h3>投资组合</h3><div class=\"dashboard-structure-body\">" + dashboardInvestmentPortfolio(rows) + "</div><button type=\"button\" class=\"asset-structure-detail\" data-action=\"open-view\" data-view=\"investments\">投资明细 →</button></article>";
}

function dashboardInvestmentPortfolio(rows) {
  var palette = ["#D5B98A", "#E0CA9E", "#EADAB8", "#F2E9D2", "#C9A872", "#E7D4AB"];
  rows = (rows || []).slice();
  if (!rows.length) return "<div class=\"dashboard-empty-mini\">暂无投资组合数据</div>";
  var total = sum(rows, function (row) { return row.value; }) || 1;
  rows.sort(function (a, b) { return b.value - a.value; });
  var gradient = "", cursor = 0;
  rows.forEach(function (row, index) {
    row.color = palette[index % palette.length];
    var pct = row.value / total * 100;
    gradient += row.color + " " + cursor.toFixed(1) + "% " + (cursor + pct).toFixed(1) + "%, ";
    cursor += pct;
  });
  var top = rows[0];
  var center = "<div class=\"dashboard-donut-center\"><strong>" + esc(Math.round(top.value / total * 100)) + "%</strong><span>" + esc(dashboardShortName(top.name)) + "</span></div>";
  return "<div class=\"dashboard-structure\"><div class=\"dashboard-donut\" style=\"--dashboard-donut:" + esc(gradient.replace(/, $/, "")) + "\">" + center + "</div><div class=\"dashboard-structure-list\">"
    + rows.slice(0, 4).map(function (row) {
      var pct = row.value / total * 100;
      return "<div><span style=\"background:" + esc(row.color) + "\"></span><strong>" + esc(dashboardShortName(row.name)) + "</strong><em>" + pct.toFixed(0) + "%</em><b>" + esc(money(row.value)) + "</b></div>";
    }).join("") + "</div></div>";
}


function renderDashboardAssetTrend(month, readiness) {
  var el = byId("dashboardAssetTrend");
  if (!el) return;
  if (readiness && !readiness.hasWealthEvidence) {
    el.innerHTML = "<div class=\"dashboard-chart-empty\">添加实际账户或资产记录后显示趋势</div>";
    var emptyFacts = byId("dashboardTrendFacts");
    if (emptyFacts) emptyFacts.innerHTML = [
      { label: "最低偿债率", value: "待记录" },
      { label: "下次计划发薪", value: "待计划" },
      { label: "数据口径", value: "待建立" }
    ].map(function (item) { return "<div><span>" + esc(item.label) + "</span><strong class=\"warning\">" + esc(item.value) + "</strong></div>"; }).join("");
    return;
  }
  var y = parseInt(month.slice(0, 4), 10);
  var m = parseInt(month.slice(5, 7), 10);
  var rows = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(y, m - 1 - i, 1);
    var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    rows.push({ month: key, value: wealthSummary(key).financialAssets });
  }
  var max = Math.max.apply(null, rows.map(function (row) { return row.value; })) || 1;
  var w = 360, h = 108;
  var leftPad = 34, rightPad = 14, topPad = 10, bottomPad = 14;
  var axisMax = dashboardNiceMax(max);
  var axisMin = 0;
  var range = axisMax - axisMin || 1;
  function px(index) { return leftPad + (w - leftPad - rightPad) * (rows.length === 1 ? 0 : index / (rows.length - 1)); }
  function py(value) { return h - bottomPad - ((value - axisMin) / range) * (h - topPad - bottomPad); }
  var points = rows.map(function (row, index) { return px(index).toFixed(1) + "," + py(row.value).toFixed(1); }).join(" ");
  var area = leftPad + "," + (h - bottomPad) + " " + points + " " + (w - rightPad) + "," + (h - bottomPad);
  var ticks = [axisMax, axisMax * 2 / 3, axisMax / 3, 0];
  var grid = ticks.map(function (tick) {
    var yLine = py(tick);
    return "<line x1=\"" + leftPad + "\" y1=\"" + yLine.toFixed(1) + "\" x2=\"" + (w - rightPad) + "\" y2=\"" + yLine.toFixed(1) + "\"></line>";
  }).join("");
  var yLabels = ticks.map(function (tick) {
    return "<text class=\"dashboard-axis-y\" x=\"" + (leftPad - 7) + "\" y=\"" + (py(tick) + 3.2).toFixed(1) + "\" text-anchor=\"end\">" + esc(dashboardAxisMoneyLabel(tick)) + "</text>";
  }).join("");
  var labels = rows.map(function (row, index) { return "<text class=\"dashboard-axis-x\" x=\"" + px(index).toFixed(1) + "\" y=\"" + (h - 1) + "\" text-anchor=\"middle\">" + esc(row.month.slice(5)) + "</text>"; }).join("");
  var dots = rows.map(function (row, index) { return "<circle cx=\"" + px(index).toFixed(1) + "\" cy=\"" + py(row.value).toFixed(1) + "\" r=\"1.4\"></circle>"; }).join("");
  var debtService = dashboardMinimumDebtServiceRate(month), nextPayday = dashboardNextPlannedPayday();
  var facts = [
    { label: "最低偿债率", value: debtService.rate == null ? "—" : debtService.rate.toFixed(1) + "%", className: debtService.rate == null ? "warning" : "", hint: "未来30天最低还款 ÷ 本月已到账收入" },
    { label: "下次计划发薪", value: nextPayday ? nextPayday.date.slice(5).replace("-", ".") + " · " + money(nextPayday.plannedIncome) : "—", className: nextPayday ? "" : "warning", hint: "按月度计划，非确定到账" },
    { label: "数据口径", value: wealthSummary(month).unresolvedAssets.length ? "待确认" : "已统一", className: wealthSummary(month).unresolvedAssets.length ? "warning" : "positive" }
  ];
  el.innerHTML = "<svg viewBox=\"0 0 " + w + " " + h + "\" role=\"img\"><g class=\"dashboard-chart-grid\">" + grid + "</g>" + yLabels + "<polygon points=\"" + area + "\"></polygon><polyline points=\"" + points + "\"></polyline>" + dots + labels + "</svg>";
  var factsEl = byId("dashboardTrendFacts");
  if (factsEl) {
    factsEl.innerHTML = facts.map(function (item) {
      return "<div" + (item.hint ? " data-dash-tip=\"" + esc(item.hint) + "\"" : "") + "><span>" + esc(item.label) + "</span><strong class=\"" + esc(item.className) + "\">" + esc(item.value) + "</strong></div>";
    }).join("");
  }
}

function dashboardNiceMax(value) {
  var n = Math.max(1, numberValue(value));
  var base = Math.pow(10, Math.floor(Math.log10(n)));
  var ratio = n / base;
  var step = ratio <= 1 ? 1 : (ratio <= 2 ? 2 : (ratio <= 5 ? 5 : 10));
  return step * base;
}

function dashboardAxisMoneyLabel(value) {
  var n = numberValue(value);
  if (n >= 100000000) return (n / 100000000).toFixed(n % 100000000 === 0 ? 0 : 1) + "亿";
  if (n >= 10000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(Math.round(n));
}

function setDashboardText(id, value) {
  var el = byId(id);
  if (el) el.textContent = value;
}
