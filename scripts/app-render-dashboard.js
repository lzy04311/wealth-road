"use strict";

function renderDashboard() {
  var month = currentMonth();
  var s = monthlySummary(month);
  var assetSnap = assetSnapshotSummary(month);
  var health = financialHealth(month);
  var forecast = monthlyForecast(month);
  var totalAsset = assetSnap.totalAsset || s.asset || 0;
  var assetAccounts = state.accounts.filter(function (account) { return account.includeAsset; });
  var targetAccounts = state.accounts.filter(function (account) { return numberValue(account.target) > 0; });
  var reachedTargets = targetAccounts.filter(function (account) { return accountBalance(account, month) >= numberValue(account.target); });
  var targetProgress = targetAccounts.length ? reachedTargets.length / targetAccounts.length * 100 : 0;
  var savingRate = s.income > 0 ? Math.max(0, (s.income - s.expense) / s.income * 100) : null;
  var roiText = assetSnap.roi == null ? "待更新" : (assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%";
  var backupText = lastSavedAt ? "已保存" : "本地可用";
  var coreJudgement = s.surplus >= 0 ? "资金节奏稳定" : "现金流承压";
  if (health.className === "warning") coreJudgement = "优先校准预算";
  if (health.className === "negative") coreJudgement = "先守住现金流";

  renderDashboardStatusBar(month, backupText);
  renderDashboardAssetCard(month, s, assetSnap, health, totalAsset, savingRate);
  renderDashboardCompass(s, assetSnap, health, totalAsset, targetAccounts, reachedTargets, roiText, backupText, coreJudgement);
  renderDashboardRightCards(month, s, assetSnap, health, forecast, assetAccounts, targetAccounts, reachedTargets, targetProgress, backupText);
  renderDashboardBottomStrip(s, assetSnap, savingRate, assetAccounts, targetAccounts, targetProgress);
  renderDashboardBottomStatus(s, assetSnap, savingRate, forecast, backupText);
}

function renderDashboardStatusBar(month, backupText) {
  var el = byId("dashboardStatusBar");
  if (!el) return;
  el.innerHTML = [
    { label: "今日", value: today(), sub: dashboardWeekdayText() },
    { label: "同步状态", value: backupText, sub: lastSavedAt ? savedTimeText(lastSavedAt).slice(11, 19) : "本地存储" },
    { label: "市场状态", value: "占位观察", sub: "暂不接入行情" }
  ].map(function (item) {
    return "<div class=\"dashboard-status-pill\"><span>" + esc(item.label) + "</span><strong>" + esc(item.value) + "</strong><small>" + esc(item.sub) + "</small></div>";
  }).join("");
}

function dashboardWeekdayText() {
  var names = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return names[new Date().getDay()];
}

function renderDashboardAssetCard(month, s, assetSnap, health, totalAsset, savingRate) {
  setDashboardText("dashboardAssetHealth", "资产健康度 " + health.score + "分");
  setDashboardText("dashboardTotalAsset", money(totalAsset));
  var previousAsset = assetSnapshotSummary(dashboardPrevMonth(month)).totalAsset || monthlySummary(dashboardPrevMonth(month)).asset || 0;
  var monthDelta = previousAsset > 0 ? totalAsset - previousAsset : null;
  var recentChange = dashboardRecentAssetChange();
  var changeText = monthDelta == null ? "上月基线不足，继续记录后显示变化" : (monthDelta >= 0 ? "+" : "") + money(monthDelta);
  var changeClass = monthDelta == null ? "warning" : (monthDelta >= 0 ? "positive" : "negative");
  byId("dashboardAssetChange").innerHTML = "<span>较上月</span><strong class=\"" + changeClass + "\">" + esc(changeText) + "</strong>";
  byId("dashboardAssetMetrics").innerHTML = [
    dashboardMetric("本月结余", money(s.surplus), s.surplus >= 0 ? "positive" : "negative", "现金流"),
    dashboardMetric("可用资金", money(Math.max(0, s.income - s.expense)), "", "收入减支出"),
    dashboardMetric("投资增长", assetSnap.roi == null ? "待更新" : (assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%", assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"), "累计收益 " + money(assetSnap.pnl)),
    dashboardMetric("昨日收益", recentChange == null ? "待快照" : (recentChange >= 0 ? "+" : "") + money(recentChange), recentChange == null ? "warning" : (recentChange >= 0 ? "positive" : "negative"), "近两次快照")
  ].join("");
  renderDashboardAssetTrend(month);
}

function renderDashboardCompass(s, assetSnap, health, totalAsset, targetAccounts, reachedTargets, roiText, backupText, coreJudgement) {
  setDashboardText("compassCoreStatus", coreJudgement);
  var targetText = targetAccounts.length ? reachedTargets.length + "/" + targetAccounts.length + " 已完成" : "待设置目标";
  var nodes = [
    { key: "flow", view: "flow", name: "现金流", desc: "本月净流入", value: s.surplus >= 0 ? "+" + money(s.surplus) : "-" + money(Math.abs(s.surplus)), className: s.surplus >= 0 ? "positive" : "negative", level: "core" },
    { key: "invest", view: "investments", name: "投资收益", desc: "收益率", value: roiText, className: assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"), level: "core" },
    { key: "assets", view: "assets", name: "资产配置", desc: "当前总资产", value: money(totalAsset), className: "", level: "core" },
    { key: "accounts", view: "accounts", name: "分配", desc: "预算比例", value: totalBudgetPercent().toFixed(1) + "%", className: totalBudgetPercent() > 100 ? "negative" : "positive", level: "aux" },
    { key: "goals", view: "goals", name: "目标进度", desc: "阶段目标", value: targetText, className: targetAccounts.length ? "positive" : "warning", level: "aux" },
    { key: "data", view: "data", name: "备份", desc: "数据安全", value: backupText, className: "positive", level: "aux" }
  ];
  var nodeLayer = byId("wealthCompassNodes");
  if (nodeLayer) nodeLayer.innerHTML = nodes.map(dashboardCompassNode).join("");
}

function renderDashboardRightCards(month, s, assetSnap, health, forecast, assetAccounts, targetAccounts, reachedTargets, targetProgress, backupText) {
  var cards = [];
  cards.push("<article class=\"dashboard-side-card dashboard-panel\"><h3>资产结构</h3>" + dashboardAssetStructure(month, assetAccounts) + "<button type=\"button\" class=\"dashboard-link\" data-action=\"open-view\" data-view=\"assets\">查看详情</button></article>");
  cards.push(dashboardInsightCard(s, forecast));
  cards.push(dashboardRiskCard(health, forecast));
  cards.push(dashboardGoalCard(targetAccounts, reachedTargets, targetProgress));
  cards.push(dashboardBackupCard(backupText));
  byId("dashboardRightCards").innerHTML = cards.join("");
}

function renderDashboardBottomStrip(s, assetSnap, savingRate, assetAccounts, targetAccounts, targetProgress) {
  var strip = byId("dashboardBottomStrip");
  if (!strip) return;
  var month = currentMonth();
  var expenseRows = dashboardExpenseCategoryRows(month);
  var topExpense = expenseRows[0];
  var topExpenseText = topExpense ? topExpense.name + " " + topExpense.pct.toFixed(0) + "%" : "暂无支出";
  var assetRows = dashboardAssetAllocationRows(month, assetAccounts);
  var assetText = assetRows.length ? assetRows.slice(0, 3).map(function (row) { return row.name + " " + row.pct.toFixed(0) + "%"; }).join(" / ") : "待更新资产";
  var sentence = s.surplus < 0 ? "先守住现金流，再谈进攻。" : (assetSnap.roi != null && assetSnap.roi > 0 ? "让复利安静地工作。" : "让资金回到该去的位置。");
  var cashRate = s.income > 0 ? Math.max(0, Math.min(100, s.expense / s.income * 100)) : 0;
  var savingProgress = targetAccounts.length ? Math.max(0, Math.min(100, targetProgress)) : Math.max(0, Math.min(100, savingRate || 0));
  strip.innerHTML = [
    dashboardStripItem("现金流总览", s.surplus >= 0 ? "+" + money(s.surplus) : "-" + money(Math.abs(s.surplus)), "收入 " + money(s.income) + " · 支出 " + money(s.expense), s.surplus >= 0 ? "positive" : "negative", "cash", dashboardStripProgress(cashRate, "结余 " + (s.surplus >= 0 ? "+" : "-") + money(Math.abs(s.surplus)), "支出 " + cashRate.toFixed(0) + "%"), "cash"),
    dashboardStripItem("收支结构", topExpenseText, "本月支出 " + money(s.expense), "", "balance", dashboardStripDonut(expenseRows.slice(0, 3), "暂无分类"), "structure"),
    dashboardStripItem("投资回报", assetSnap.pnl >= 0 ? "+" + money(assetSnap.pnl) : "-" + money(Math.abs(assetSnap.pnl)), assetSnap.roi == null ? "收益率待更新" : "收益率 " + assetSnap.roi.toFixed(2) + "%", assetSnap.pnl >= 0 ? "positive" : "negative", "invest", dashboardStripSparkline(assetSnap), "invest"),
    dashboardStripItem("资产配置概览", assetText, assetAccounts.length + " 个资产账户", "", "asset", dashboardStripDonut(assetRows.slice(0, 4), "待更新"), "allocation"),
    dashboardStripItem("储蓄与目标", targetAccounts.length ? targetProgress.toFixed(0) + "%" : (savingRate == null ? "待记录" : savingRate.toFixed(1) + "%"), "储蓄率 " + (savingRate == null ? "--" : savingRate.toFixed(1) + "%"), targetAccounts.length ? "positive" : "warning", "goal", dashboardStripProgress(savingProgress, targetAccounts.length ? "目标进度" : "储蓄进度", savingProgress.toFixed(0) + "%"), "goal"),
    dashboardStripItem("本月一句话", "稳住节奏", sentence, "", "quote", "<div class=\"dashboard-strip-quote-art\"></div>", "quote")
  ].join("");
}

function renderDashboardBottomStatus(s, assetSnap, savingRate, forecast, backupText) {
  var el = byId("dashboardBottomStatus");
  if (!el) return;
  var expenseStatus = s.overBudget ? "支出待收紧" : "支出结构优化";
  var savingStatus = savingRate == null ? "储蓄率待记录" : "储蓄率 " + savingRate.toFixed(1) + "%";
  var investStatus = assetSnap.roi == null ? "投资待快照" : (assetSnap.roi >= 0 ? "投资收益回升" : "投资收益承压");
  el.innerHTML = [
    dashboardStatusItem("云端同步正常", backupText, "positive"),
    dashboardStatusItem(expenseStatus, forecast.budgetStatus || "持续观察", s.overBudget ? "warning" : "positive"),
    dashboardStatusItem("储蓄率提升", savingStatus, savingRate == null ? "warning" : "positive"),
    dashboardStatusItem(investStatus, assetSnap.roi == null ? "等待数据" : assetSnap.roi.toFixed(2) + "%", assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"))
  ].join("");
}

function dashboardMetric(label, value, className, hint) {
  return "<div><span>" + esc(label) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><small>" + esc(hint || "") + "</small></div>";
}

function dashboardSideCard(title, value, desc, className, visualClass, visualText) {
  return "<article class=\"dashboard-side-card dashboard-panel\"><h3><i></i>" + esc(title) + "</h3><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><p>" + esc(desc) + "</p><div class=\"" + esc(visualClass || "") + "\"><span>" + esc(visualText || "") + "</span></div></article>";
}

function dashboardInsightCard(s, forecast) {
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-insight-card\"><h3><i></i>本月洞察</h3>"
    + "<strong class=\"" + esc(dashboardInsightClass(s, forecast)) + "\">" + esc(dashboardInsightValue(s, forecast)) + "</strong>"
    + "<p>" + esc(dashboardInsightText(s, forecast)) + "</p>"
    + dashboardMiniSparkline(s, forecast)
    + "</article>";
}

function dashboardRiskCard(health, forecast) {
  var status = health.risk || "低风险";
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-risk-card\"><h3><i></i>风险评估</h3>"
    + "<strong class=\"" + esc(health.className || "positive") + "\">" + esc(status) + "</strong>"
    + "<p>" + esc(health.advice) + "</p>"
    + "<div class=\"dashboard-risk-bar\"><span>" + esc(forecast.budgetStatus || "持续观察") + "</span></div>"
    + "</article>";
}

function dashboardGoalCard(targetAccounts, reachedTargets, targetProgress) {
  var value = targetAccounts.length ? reachedTargets.length + "/" + targetAccounts.length + " 进行中" : "待设置目标";
  var status = targetAccounts.length ? "阶段目标推进中" : "先设置阶段目标";
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-goal-card\"><h3><i></i>目标进度</h3>"
    + "<div class=\"dashboard-goal-visual\">"
    + "<div class=\"dashboard-goal-ring\" style=\"--goal-progress:" + esc(String(Math.max(0, Math.min(100, targetProgress)))) + "%\"><span>" + esc(targetProgress.toFixed(0)) + "%</span></div>"
    + "<div><strong class=\"" + (targetAccounts.length ? "positive" : "warning") + "\">" + esc(value) + "</strong><p>" + esc(status) + "</p></div>"
    + "</div></article>";
}

function dashboardBackupCard(backupText) {
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-backup-card\"><h3><i></i>备份与安全</h3>"
    + "<strong class=\"positive\">" + esc(backupText) + "</strong>"
    + "<p>" + esc(lastSavedAt ? "上次保存 " + savedTimeText(lastSavedAt).slice(11, 19) : "使用浏览器本地存储") + "</p>"
    + "<div class=\"dashboard-check-mark\"><span>✓</span></div>"
    + "</article>";
}

function dashboardMiniSparkline(s, forecast) {
  var used = forecast.budgetUsedRate == null ? 42 : Math.max(8, Math.min(92, forecast.budgetUsedRate));
  var surplus = s.surplus >= 0 ? 68 : 30;
  var income = s.income > 0 ? 78 : 36;
  var values = [28, income, used, surplus, Math.max(24, Math.min(88, (used + surplus) / 2))];
  var points = values.map(function (value, index) {
    return (8 + index * 22) + "," + (58 - value * .42).toFixed(1);
  }).join(" ");
  return "<div class=\"dashboard-mini-sparkline\"><svg viewBox=\"0 0 104 62\" aria-hidden=\"true\"><polyline points=\"" + points + "\"></polyline><circle cx=\"96\" cy=\"" + (58 - values[4] * .42).toFixed(1) + "\" r=\"2.4\"></circle></svg></div>";
}

function dashboardStripItem(title, value, desc, className, icon, visual, modifier) {
  return "<article class=\"dashboard-strip-item dashboard-strip-" + esc(modifier || icon || "item") + "\"><i>" + esc(dashboardStripIcon(icon)) + "</i><div class=\"dashboard-strip-copy\"><span>" + esc(title) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><small>" + esc(desc) + "</small>" + (visual || "") + "</div></article>";
}

function dashboardStatusItem(title, value, className) {
  return "<article class=\"dashboard-status-item\"><i class=\"" + esc(className || "") + "\"></i><div><span>" + esc(title) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong></div></article>";
}

function dashboardStripIcon(icon) {
  var map = { cash: "⌁", balance: "▣", invest: "↗", asset: "◌", goal: "◎", quote: "“" };
  return map[icon] || "•";
}

function dashboardStripProgress(rate, leftText, rightText) {
  var safeRate = Math.max(0, Math.min(100, numberValue(rate)));
  return "<div class=\"dashboard-strip-progress\" style=\"--strip-progress:" + esc(safeRate.toFixed(1)) + "%\"><b></b><p><span>" + esc(leftText) + "</span><span>" + esc(rightText) + "</span></p></div>";
}

function dashboardStripDonut(rows, emptyText) {
  if (!rows.length) return "<div class=\"dashboard-strip-mini-empty\">" + esc(emptyText) + "</div>";
  var palette = ["#B88A4A", "#D9B65D", "#F2E5CC", "#8F6334"];
  var visibleRows = rows.slice(0, 4).map(function (row) {
    return { name: row.name, pct: row.pct };
  });
  var visibleTotal = sum(visibleRows, function (row) { return row.pct; });
  if (visibleTotal < 99) visibleRows.push({ name: "其他", pct: 100 - visibleTotal });
  var cursor = 0;
  var gradient = visibleRows.map(function (row, index) {
    var color = palette[index % palette.length];
    var start = cursor;
    cursor += Math.max(0, row.pct);
    row.color = color;
    return color + " " + start.toFixed(1) + "% " + cursor.toFixed(1) + "%";
  }).join(", ");
  return "<div class=\"dashboard-strip-donut-wrap\"><div class=\"dashboard-strip-donut\" style=\"--strip-donut:" + esc(gradient) + "\"></div><div class=\"dashboard-strip-mini-list\">"
    + visibleRows.slice(0, 4).map(function (row) {
      return "<span><i style=\"background:" + esc(row.color) + "\"></i>" + esc(row.name) + " " + esc(row.pct.toFixed(0)) + "%</span>";
    }).join("") + "</div></div>";
}

function dashboardStripSparkline(assetSnap) {
  var values = dashboardStripInvestmentValues(assetSnap);
  var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
  var span = max - min || 1;
  var points = values.map(function (value, index) {
    return (4 + index * 18) + "," + (32 - (value - min) / span * 24).toFixed(1);
  }).join(" ");
  return "<div class=\"dashboard-strip-sparkline\"><svg viewBox=\"0 0 94 36\" aria-hidden=\"true\"><polyline points=\"" + points + "\"></polyline><circle cx=\"76\" cy=\"" + (32 - (values[4] - min) / span * 24).toFixed(1) + "\" r=\"2\"></circle></svg></div>";
}

function dashboardStripInvestmentValues(assetSnap) {
  var byDate = {};
  state.snapshots.forEach(function (item) {
    if (!item.date) return;
    byDate[item.date] = (byDate[item.date] || 0) + numberValue(item.marketValue);
  });
  var values = Object.keys(byDate).sort().slice(-5).map(function (date) { return byDate[date]; });
  while (values.length < 5) values.unshift(Math.max(0, numberValue(assetSnap.total) - (5 - values.length) * 80));
  return values;
}

function dashboardExpenseCategoryRows(month) {
  var map = {};
  state.expenses.forEach(function (item) {
    if (item.month !== month) return;
    var name = item.category || "未分类";
    map[name] = (map[name] || 0) + numberValue(item.amount);
  });
  var rows = Object.keys(map).map(function (name) { return { name: dashboardShortName(name), value: map[name] }; }).sort(function (a, b) { return b.value - a.value; });
  var total = sum(rows, function (row) { return row.value; }) || 1;
  rows.forEach(function (row) { row.pct = row.value / total * 100; });
  return rows;
}

function dashboardAssetAllocationRows(month, assetAccounts) {
  var rows = assetAccounts.map(function (account) {
    var data = accountAssetValueForMonth(account, month);
    return { name: dashboardShortName(account.name), value: Math.max(0, data.value) };
  }).filter(function (row) { return row.value > 0; }).sort(function (a, b) { return b.value - a.value; });
  var total = sum(rows, function (row) { return row.value; }) || 1;
  rows.forEach(function (row) { row.pct = row.value / total * 100; });
  return rows;
}

function dashboardPrevMonth(month) {
  var year = parseInt(String(month).slice(0, 4), 10);
  var mon = parseInt(String(month).slice(5, 7), 10);
  var d = new Date(year, mon - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function dashboardRecentAssetChange() {
  var byDate = {};
  state.snapshots.forEach(function (item) {
    if (!item.date) return;
    byDate[item.date] = (byDate[item.date] || 0) + numberValue(item.marketValue);
  });
  var dates = Object.keys(byDate).sort();
  if (dates.length < 2) return null;
  return numberValue(byDate[dates[dates.length - 1]] - byDate[dates[dates.length - 2]]);
}

function dashboardInsightValue(s, forecast) {
  if (!s.hasPlannedIncome) return "待计划";
  if (s.overBudget) return "已超支";
  if (s.surplus < 0) return "现金流为负";
  return forecast.budgetUsedRate == null ? "持续观察" : forecast.budgetUsedRate.toFixed(0) + "%";
}

function dashboardInsightText(s, forecast) {
  if (!s.hasPlannedIncome) return "先填写计划收入，预算判断才会完整。";
  if (s.overBudget) return "本月支出越过预算线，先收紧非必要支出。";
  if (s.surplus < 0) return "投入和支出合计偏高，需要看现金节奏。";
  return "预算使用处于" + forecast.budgetStatus + "，继续保持记录节奏。";
}

function dashboardInsightClass(s, forecast) {
  if (!s.hasPlannedIncome) return "warning";
  if (s.overBudget || s.surplus < 0) return "negative";
  return forecast.budgetClassName || "positive";
}

function dashboardCompassNode(item) {
  return "<button class=\"compass-node node-" + esc(item.key) + " is-" + esc(item.level || "aux") + "\" type=\"button\" data-action=\"open-view\" data-view=\"" + esc(item.view) + "\">"
    + "<span class=\"node-dot\"></span>"
    + "<span class=\"node-name\">" + esc(item.name) + "</span>"
    + "<span class=\"node-desc\">" + esc(item.desc) + "</span>"
    + "<strong class=\"" + esc(item.className || "") + "\">" + esc(item.value) + "</strong>"
    + "</button>";
}

function dashboardAssetStructure(month, assetAccounts) {
  var palette = ["#B88A4A", "#D9B65D", "#F2E5CC", "#8F6334", "#C8A06A", "#E8D7B6"];
  var rows = assetAccounts.map(function (account) {
    var row = accountAssetValueForMonth(account, month);
    return { name: account.name, value: Math.max(0, row.value), color: accountVisual(account).color };
  }).filter(function (row) { return row.value > 0; });
  if (!rows.length) return "<div class=\"dashboard-empty-mini\">暂无资产结构，先更新净值。</div>";
  var total = sum(rows, function (row) { return row.value; }) || 1;
  var gradient = "", cursor = 0;
  rows.forEach(function (row, index) {
    row.color = palette[index % palette.length];
    var pct = row.value / total * 100;
    gradient += row.color + " " + cursor.toFixed(1) + "% " + (cursor + pct).toFixed(1) + "%, ";
    cursor += pct;
  });
  return "<div class=\"dashboard-structure\"><div class=\"dashboard-donut\" style=\"--dashboard-donut:" + esc(gradient.replace(/, $/, "")) + "\"></div><div class=\"dashboard-structure-list\">"
    + rows.slice(0, 4).map(function (row) {
      var pct = row.value / total * 100;
      return "<div><span style=\"background:" + esc(row.color) + "\"></span><strong>" + esc(dashboardShortName(row.name)) + "</strong><em>" + pct.toFixed(0) + "%</em><b>" + esc(money(row.value)) + "</b></div>";
    }).join("") + "</div></div>";
}

function dashboardShortName(name) {
  if (name.indexOf("纳纳") >= 0) return "投资";
  if (name.indexOf("流动") >= 0) return "现金";
  if (name.indexOf("保命") >= 0) return "保障";
  return String(name).length > 4 ? String(name).slice(0, 4) : String(name);
}

function renderDashboardAssetTrend(month) {
  var el = byId("dashboardAssetTrend");
  if (!el) return;
  var y = parseInt(month.slice(0, 4), 10);
  var m = parseInt(month.slice(5, 7), 10);
  var rows = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(y, m - 1 - i, 1);
    var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    rows.push({ month: key, value: assetSnapshotSummary(key).totalAsset || monthlySummary(key).asset || 0 });
  }
  var max = Math.max.apply(null, rows.map(function (row) { return row.value; })) || 1;
  var min = Math.min.apply(null, rows.map(function (row) { return row.value; }));
  var range = max - min || 1;
  var w = 360, h = 118, pad = 14;
  function px(index) { return pad + (w - pad * 2) * (rows.length === 1 ? 0 : index / (rows.length - 1)); }
  function py(value) { return h - pad - ((value - min) / range) * (h - pad * 2); }
  var points = rows.map(function (row, index) { return px(index).toFixed(1) + "," + py(row.value).toFixed(1); }).join(" ");
  var area = pad + "," + (h - pad) + " " + points + " " + (w - pad) + "," + (h - pad);
  var grid = [0.25, 0.5, 0.75].map(function (rate) {
    var yLine = pad + (h - pad * 2) * rate;
    return "<line x1=\"" + pad + "\" y1=\"" + yLine.toFixed(1) + "\" x2=\"" + (w - pad) + "\" y2=\"" + yLine.toFixed(1) + "\"></line>";
  }).join("");
  var labels = rows.map(function (row, index) { return "<text x=\"" + px(index).toFixed(1) + "\" y=\"" + (h - 2) + "\" text-anchor=\"middle\">" + esc(row.month.slice(5)) + "</text>"; }).join("");
  var dots = rows.map(function (row, index) { return "<circle cx=\"" + px(index).toFixed(1) + "\" cy=\"" + py(row.value).toFixed(1) + "\" r=\"1.8\"></circle>"; }).join("");
  var first = rows[0] || { value: 0 };
  var last = rows[rows.length - 1] || { value: 0 };
  var cumulativeReturn = last.value - first.value;
  var annualizedRate = dashboardAnnualizedRate(first.value, last.value, rows.length);
  var maxDrawdown = dashboardMaxDrawdown(rows);
  var facts = [
    { label: "累计收益", value: cumulativeReturn >= 0 ? "+" + money(cumulativeReturn) : "-" + money(Math.abs(cumulativeReturn)), className: cumulativeReturn >= 0 ? "positive" : "negative" },
    { label: "年化收益率", value: annualizedRate == null ? "--" : (annualizedRate >= 0 ? "+" : "") + annualizedRate.toFixed(1) + "%", className: annualizedRate == null ? "warning" : (annualizedRate >= 0 ? "positive" : "negative") },
    { label: "最大回撤", value: maxDrawdown == null ? "--" : "-" + maxDrawdown.toFixed(1) + "%", className: maxDrawdown && maxDrawdown > 0 ? "negative" : "positive" }
  ];
  el.innerHTML = "<svg viewBox=\"0 0 " + w + " " + h + "\" role=\"img\"><g class=\"dashboard-chart-grid\">" + grid + "</g><polygon points=\"" + area + "\"></polygon><polyline points=\"" + points + "\"></polyline>" + dots + labels + "</svg>"
    + "<div class=\"dashboard-trend-facts\">" + facts.map(function (item) {
      return "<div><span>" + esc(item.label) + "</span><strong class=\"" + esc(item.className) + "\">" + esc(item.value) + "</strong></div>";
    }).join("") + "</div>";
}

function dashboardAnnualizedRate(firstValue, lastValue, months) {
  if (firstValue <= 0 || months <= 1) return null;
  var years = (months - 1) / 12;
  return (Math.pow(lastValue / firstValue, 1 / years) - 1) * 100;
}

function dashboardMaxDrawdown(rows) {
  var peak = 0;
  var maxRate = 0;
  rows.forEach(function (row) {
    var value = numberValue(row.value);
    if (value > peak) peak = value;
    if (peak > 0) maxRate = Math.max(maxRate, (peak - value) / peak * 100);
  });
  return rows.length ? maxRate : null;
}

function setDashboardText(id, value) {
  var el = byId(id);
  if (el) el.textContent = value;
}
