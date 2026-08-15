"use strict";

function renderDashboard(ctx) {
  var month = currentMonth();
  var renderCtx = ctx && ctx.month === month ? ctx : getRenderContext(month);
  var s = renderCtx.summary;
  var assetSnap = renderCtx.snapshot;
  var wealth = wealthSummary(month);
  var health = financialHealth(month);
  var forecast = monthlyForecast(month);
  var totalAsset = wealth.netWorth;
  var assetAccounts = state.accounts.filter(function (account) { return account.includeAsset && !account.archived; });
  var targetAccounts = state.accounts.filter(function (account) { return !account.archived && numberValue(account.target) > 0; });
  var reachedTargets = targetAccounts.filter(function (account) { var current = account.includeAsset ? accountAssetValueForMonth(account, month).value : accountBalance(account, month); return current >= numberValue(account.target); });
  var targetProgress = targetAccounts.length ? reachedTargets.length / targetAccounts.length * 100 : 0;
  var savingRate = s.income > 0 ? Math.max(0, (s.income - s.expense) / s.income * 100) : null;
  var roiText = assetSnap.roi == null ? "待更新" : (assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%";
  var backupText = "本地可用";
  var coreJudgement = s.surplus >= 0 ? "资金节奏稳定" : "现金流承压";
  if (health.className === "warning") coreJudgement = "优先校准预算";
  if (health.className === "negative") coreJudgement = "先守住现金流";

  renderDashboardStatusBar(month, backupText);
  renderDashboardAssetCard(month, s, assetSnap, health, totalAsset, savingRate, wealth);
  renderDashboardCompass(s, assetSnap, health, totalAsset, targetAccounts, reachedTargets, roiText, backupText, coreJudgement);
  renderDashboardRightCards(month, s, assetSnap, health, forecast, assetAccounts, targetAccounts, reachedTargets, targetProgress, backupText);
  renderDashboardBottomStrip(s, assetSnap, savingRate, assetAccounts, targetAccounts, targetProgress);
  renderDashboardBottomStatus(s, assetSnap, savingRate, forecast, backupText);
}

function renderDashboardStatusBar(month, backupText) {
  var el = byId("dashboardStatusBar");
  if (!el) return;
  var reminders = upcomingReminders(7);
  var dateShort = today().slice(5).replace("-", ".");
  var dateTip = today() + " · " + dashboardWeekdayText() + "\n今日";
  var reminderValue = reminders.length ? reminders.length + " 项待办" : "无待办";
  var reminderTip = reminders.length
    ? reminders.slice(0, 4).map(function (r) { return r.title + " · " + r.description; }).join("\n") + (reminders.length > 4 ? "\n另有 " + (reminders.length - 4) + " 项" : "")
    : "未来 7 天没有待办提醒";
  el.innerHTML = [
    { value: dateShort + " · " + dashboardWeekdayText(), tip: dateTip },
    { value: "● " + backupText, tip: "数据保存在当前浏览器\n自动保存正常" },
    { value: reminderValue, tip: reminderTip }
  ].map(function (item) {
    return "<div class=\"dashboard-status-pill\" data-dash-tip=\"" + esc(item.tip) + "\"><strong>" + esc(item.value) + "</strong></div>";
  }).join("");
}

function dashboardWeekdayText() {
  var names = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return names[new Date().getDay()];
}

function renderDashboardAssetCard(month, s, assetSnap, health, totalAsset, savingRate, wealth) {
  setDashboardText("dashboardAssetHealth", "执行健康 · " + health.score);
  setDashboardText("dashboardTotalAsset", totalAsset < 0 ? "-" + money(Math.abs(totalAsset)) : money(totalAsset));
  var previousWealth = wealthSummary(dashboardPrevMonth(month));
  var previousAsset = previousWealth.financialAssets;
  var monthDelta = previousWealth.financialAssets > 0 ? wealth.financialAssets - previousAsset : null;
  var changeValue = monthDelta == null ? "基线待补" : (monthDelta >= 0 ? "+" : "") + money(monthDelta);
  var changeClass = monthDelta == null ? "warning" : (monthDelta >= 0 ? "positive" : "negative");
  var changeTip = monthDelta == null ? "上月基线不足\n继续记录后即可显示较上月变化" : "较上月金融资产变化";
  var changeEl = byId("dashboardAssetChange");
  changeEl.innerHTML = "<span>较上月</span><strong class=\"" + changeClass + "\">" + esc(changeValue) + "</strong>";
  changeEl.setAttribute("data-dash-tip", changeTip);
  var roiHint = assetSnap.roi == null ? "净值待更新" : "本月收益";
  var liabilityHint = wealth.liabilities > 0 ? "待偿还" : "暂无负债";
  byId("dashboardAssetMetrics").innerHTML = [
    dashboardMetric("待分配", money(s.freeCash), s.freeCash >= 0 ? "positive" : "negative", "可分配余额"),
    dashboardMetric("金融资产", money(wealth.financialAssets), "", "当前持有"),
    dashboardMetric("投资收益率", assetSnap.roi == null ? "数据不足" : (assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%", assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"), roiHint),
    dashboardMetric("负债", money(wealth.liabilities), wealth.liabilities > 0 ? "negative" : "", liabilityHint)
  ].join("");
  renderDashboardAssetTrend(month);
}

function renderDashboardCompass(s, assetSnap, health, totalAsset, targetAccounts, reachedTargets, roiText, backupText, coreJudgement) {
  setDashboardText("compassCoreStatus", coreJudgement);
  var moneyAccountCount = (state.moneyAccounts || []).filter(function (item) { return !item.archived; }).length;
  var netFlowText = s.netCashFlow >= 0 ? "+" + money(s.netCashFlow) : "-" + money(Math.abs(s.netCashFlow));
  var targetText = targetAccounts.length ? reachedTargets.length + " / " + targetAccounts.length : "待设置";
  var backupRecency = lastSavedAt ? "最近备份 " + savedTimeText(lastSavedAt).slice(11, 16) : "最近备份 —";
  var nodes = [
    { key: "flow", view: "flow", name: "流水", desc: "本月净流入", value: netFlowText, className: s.netCashFlow >= 0 ? "positive" : "negative", level: "core" },
    { key: "invest", view: "investments", name: "投资", desc: "本月收益", value: roiText, className: assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"), level: "core" },
    { key: "assets", view: "assets", name: "资产", desc: "当前净资产", value: money(totalAsset), className: totalAsset < 0 ? "negative" : "", level: "core" },
    { key: "accounts", view: "accounts", name: "账户", desc: moneyAccountCount > 0 ? "已接入" : "未接入", value: moneyAccountCount + " 个", className: moneyAccountCount > 0 ? "positive" : "warning", level: "aux" },
    { key: "goals", view: "goals", name: "目标", desc: "本月进度", value: targetText, className: targetAccounts.length ? "positive" : "warning", level: "aux" },
    { key: "data", view: "data", name: "备份", desc: backupRecency, value: backupText, className: "positive", level: "aux" }
  ];
  var nodeLayer = byId("wealthCompassNodes");
  if (nodeLayer) nodeLayer.innerHTML = nodes.map(dashboardCompassNode).join("");
}

function renderDashboardRightCards(month, s, assetSnap, health, forecast, assetAccounts, targetAccounts, reachedTargets, targetProgress, backupText) {
  var cards = [];
  cards.push(dashboardAssetStructureCard(month, assetAccounts));
  cards.push(dashboardInsightCard(s, forecast));
  cards.push(dashboardRiskCard(health, forecast));
  cards.push(dashboardGoalCard(targetAccounts, reachedTargets, targetProgress));
  cards.push(dashboardReminderCard());
  cards.push(dashboardBackupCard(backupText));
  byId("dashboardRightCards").innerHTML = cards.join("");
}










function renderDashboardBottomStatus(s, assetSnap, savingRate, forecast, backupText) {
  var el = byId("dashboardBottomStatus");
  if (!el) return;
  var expenseStatus = s.overBudget ? "支出待收缩" : "支出结构优化";
  var savingStatus = savingRate == null ? "储蓄率待记录" : "储蓄率 " + savingRate.toFixed(1) + "%";
  var investStatus = assetSnap.roi == null ? "投资待快照" : (assetSnap.roi >= 0 ? "投资收益回升" : "投资收益承压");
  var orphanStatusTitle = s.orphanExpenseCount > 0 ? "存在孤立支出" : "账目结构正常";
  var orphanStatusValue = s.orphanExpenseCount > 0 ? (s.orphanExpenseCount + " 条 / " + money(s.orphanExpenseTotal)) : "无孤立记录";
  var orphanClass = s.orphanExpenseCount > 0 ? "warning" : "positive";
  el.innerHTML = [
    dashboardStatusItem("本地数据", backupText, "positive"),
    dashboardStatusItem(expenseStatus, forecast.budgetStatus || "持续观察", s.overBudget ? "warning" : "positive"),
    dashboardStatusItem(orphanStatusTitle, orphanStatusValue, orphanClass),
    dashboardStatusItem("储蓄率提升", savingStatus, savingRate == null ? "warning" : "positive"),
    dashboardStatusItem(investStatus, assetSnap.roi == null ? "等待数据" : assetSnap.roi.toFixed(2) + "%", assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"))
  ].join("");
}

function dashboardMetric(label, value, className, hint) {
  return "<div><span>" + esc(label) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><small>" + esc(hint || "") + "</small></div>";
}

function dashboardInsightCard(s, forecast) {
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-insight-card\"><h3><i></i>本月洞察</h3>"
    + "<strong class=\"" + esc(dashboardInsightClass(s, forecast)) + "\">" + esc(dashboardInsightValue(s, forecast)) + "</strong>"
    + "<span class=\"dashboard-insight-metric\">预算占用</span>"
    + "<p class=\"dashboard-insight-status\">" + esc(dashboardInsightText(s, forecast)) + "</p>"
    + dashboardMiniSparkline(s, forecast)
    + "</article>";
}

function dashboardRiskCard(health, forecast) {
  var status = health.level || "稳定";
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-risk-card\"><h3><i></i>月度执行健康</h3>"
    + "<strong class=\"" + esc(health.className || "positive") + "\">" + esc(status) + " · " + esc(health.score) + "</strong>"
    + "<p>本月执行状态</p>"
    + "<div class=\"dashboard-risk-bar\"><span>" + esc(forecast.budgetStatus || "持续观察") + "</span></div>"
    + "<div class=\"dashboard-health-actions\"><button type=\"button\" class=\"dashboard-link\" data-health-detail=\"all\">评分构成 →</button></div>"
    + "</article>";
}

function dashboardGoalCard(targetAccounts, reachedTargets, targetProgress) {
  var value = targetAccounts.length ? reachedTargets.length + " / " + targetAccounts.length + " 进行中" : "待设置目标";
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-goal-card\"><h3><i></i>目标</h3>"
    + "<div class=\"dashboard-goal-visual\">"
    + "<div class=\"dashboard-goal-ring\" style=\"--goal-progress:" + esc(String(Math.max(0, Math.min(100, targetProgress)))) + "%\"><span>" + esc(targetProgress.toFixed(0)) + "%</span></div>"
    + "<div><strong class=\"" + (targetAccounts.length ? "positive" : "warning") + "\">" + esc(value) + "</strong><p>本月进度</p></div>"
    + "</div></article>";
}

function dashboardBackupCard(backupText) {
  var recency = lastSavedAt ? "最近备份 " + savedTimeText(lastSavedAt).slice(11, 16) : "最近备份 —";
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-backup-card\"><h3><i></i>备份与安全</h3>"
    + "<strong class=\"positive\" data-dash-tip=\"数据保存在当前浏览器\n自动保存正常\">" + esc(backupText) + "</strong>"
    + "<p>" + esc(recency) + "</p>"
    + "<div class=\"dashboard-check-mark\"><span>✓</span></div>"
    + "</article>";
}

function dashboardReminderCard() {
  var reminders = upcomingReminders(7);
  if (!reminders.length) return "";
  var items = reminders.slice(0, 3).map(function (r) {
    return "<div class=\"dashboard-reminder-item\"><span class=\"dashboard-reminder-dot " + esc(r.className) + "\"></span><div><strong>" + esc(r.title) + "</strong><p>" + esc(r.description) + "</p></div></div>";
  }).join("");
  return "<article class=\"dashboard-side-card dashboard-panel dashboard-reminder-card\"><h3><i></i>近期提醒</h3>" + items + (reminders.length > 3 ? "<div class=\"row-meta\">另有 " + (reminders.length - 3) + " 项提醒</div>" : "") + "</article>";
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

function dashboardStatusItem(title, value, className) {
  return "<article class=\"dashboard-status-item\"><i class=\"" + esc(className || "") + "\"></i><div><span>" + esc(title) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong></div></article>";
}

function dashboardPrevMonth(month) {
  var year = parseInt(String(month).slice(0, 4), 10);
  var mon = parseInt(String(month).slice(5, 7), 10);
  var d = new Date(year, mon - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function dashboardInsightValue(s, forecast) {
  return forecast.budgetUsedRate == null ? "--" : forecast.budgetUsedRate.toFixed(0) + "%";
}

function dashboardInsightText(s, forecast) {
  if (!s.hasPlannedIncome) return "待填写计划收入";
  if (s.overBudget) return "支出已超预算";
  if (s.surplus < 0) return "现金流为负";
  if (forecast.budgetUsedRate != null && forecast.budgetUsedRate > 85) return "接近预算上限";
  return "支出仍在计划内";
}

function dashboardInsightClass(s, forecast) {
  if (!s.hasPlannedIncome) return "warning";
  if (s.overBudget || s.surplus < 0) return "negative";
  return forecast.budgetClassName || "positive";
}

function dashboardCompassNode(item) {
  return "<button class=\"compass-node node-" + esc(item.key) + " is-" + esc(item.level || "aux") + "\" type=\"button\" data-action=\"open-view\" data-view=\"" + esc(item.view) + "\">"
    + "<span class=\"node-name\">" + esc(item.name) + "</span>"
    + "<strong class=\"" + esc(item.className || "") + "\">" + esc(item.value) + "</strong>"
    + "<span class=\"node-desc\">" + esc(item.desc) + "</span>"
    + "</button>";
}

function dashboardAssetStructureRows(month, assetAccounts) {
  return assetAccounts.map(function (account) {
    var row = accountAssetValueForMonth(account, month);
    return { name: account.name, value: Math.max(0, row.value), color: accountVisual(account).color };
  }).filter(function (row) { return row.value > 0; });
}

function dashboardAssetStructureCard(month, assetAccounts) {
  var hasData = dashboardAssetStructureRows(month, assetAccounts).length > 0;
  var sub = hasData ? "<p class=\"dashboard-card-sub\">当前配置概览</p>" : "";
  return "<article class=\"dashboard-side-card dashboard-panel\"><h3>资产结构</h3><div class=\"dashboard-structure-body\">" + sub + dashboardAssetStructure(month, assetAccounts) + "</div><button type=\"button\" class=\"asset-structure-detail\" data-action=\"open-view\" data-view=\"assets\">结构明细 →</button></article>";
}

function dashboardAssetStructure(month, assetAccounts) {
  var palette = ["#D5B98A", "#E0CA9E", "#EADAB8", "#F2E9D2", "#C9A872", "#E7D4AB"];
  var rows = dashboardAssetStructureRows(month, assetAccounts);
  if (!rows.length) return "<div class=\"dashboard-empty-mini\" data-dash-tip=\"先更新投资账户净值，结构会自动出现\">暂无结构数据</div>";
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


function renderDashboardAssetTrend(month) {
  var el = byId("dashboardAssetTrend");
  if (!el) return;
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
  var first = rows[0] || { value: 0 };
  var last = rows[rows.length - 1] || { value: 0 };
  var cumulativeChange = last.value - first.value;
  var facts = [
    { label: "金融资产变化", value: cumulativeChange >= 0 ? "+" + money(cumulativeChange) : "-" + money(Math.abs(cumulativeChange)), className: cumulativeChange >= 0 ? "positive" : "negative" },
    { label: "当前投资收益", value: assetSnapshotSummary(month).roi == null ? "数据不足" : assetSnapshotSummary(month).roi.toFixed(1) + "%", className: assetSnapshotSummary(month).roi == null ? "warning" : "" },
    { label: "数据口径", value: wealthSummary(month).unresolvedAssets.length ? "待确认" : "已统一", className: wealthSummary(month).unresolvedAssets.length ? "warning" : "positive" }
  ];
  el.innerHTML = "<svg viewBox=\"0 0 " + w + " " + h + "\" role=\"img\"><g class=\"dashboard-chart-grid\">" + grid + "</g>" + yLabels + "<polygon points=\"" + area + "\"></polygon><polyline points=\"" + points + "\"></polyline>" + dots + labels + "</svg>";
  var factsEl = byId("dashboardTrendFacts");
  if (factsEl) {
    factsEl.innerHTML = facts.map(function (item) {
      return "<div><span>" + esc(item.label) + "</span><strong class=\"" + esc(item.className) + "\">" + esc(item.value) + "</strong></div>";
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
