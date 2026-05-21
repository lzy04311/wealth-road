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
  var coreJudgement = s.surplus >= 0 ? "资金节奏稳定，结余正在沉淀" : "现金流承压，先收紧支出";
  if (health.className === "warning") coreJudgement = "资金节奏需留意，优先校准预算";
  if (health.className === "negative") coreJudgement = "风险正在抬升，先守住现金流";

  renderDashboardStatusBar(month, backupText);
  renderDashboardAssetCard(month, s, assetSnap, health, totalAsset, savingRate);
  renderDashboardCompass(s, assetSnap, health, totalAsset, targetAccounts, reachedTargets, roiText, backupText, coreJudgement);
  renderDashboardRightCards(month, s, assetSnap, health, forecast, assetAccounts, targetAccounts, reachedTargets, targetProgress, backupText);
  renderDashboardBottomStrip(s, assetSnap, savingRate, assetAccounts, targetAccounts, targetProgress);
}

function renderDashboardStatusBar(month, backupText) {
  var el = byId("dashboardStatusBar");
  if (!el) return;
  el.innerHTML = [
    { label: "今日", value: today(), sub: monthText(month) },
    { label: "同步状态", value: backupText, sub: lastSavedAt ? savedTimeText(lastSavedAt).slice(11, 19) : "本地存储" },
    { label: "市场状态", value: "占位观察", sub: "暂不接入行情" }
  ].map(function (item) {
    return "<div class=\"dashboard-status-pill\"><span>" + esc(item.label) + "</span><strong>" + esc(item.value) + "</strong><small>" + esc(item.sub) + "</small></div>";
  }).join("");
}

function renderDashboardAssetCard(month, s, assetSnap, health, totalAsset, savingRate) {
  setDashboardText("dashboardAssetHealth", "资产健康度 " + health.score + "分");
  setDashboardText("dashboardTotalAsset", money(totalAsset));
  var changeText = assetSnap.monthChange == null ? "净值快照不足，继续记录后显示月内变化" : "本月净值变化 " + money(assetSnap.monthChange);
  var changeClass = assetSnap.monthChange == null ? "warning" : (assetSnap.monthChange >= 0 ? "positive" : "negative");
  byId("dashboardAssetChange").innerHTML = "<span>较本月首条快照</span><strong class=\"" + changeClass + "\">" + esc(changeText) + "</strong>";
  byId("dashboardAssetMetrics").innerHTML = [
    dashboardMetric("本月结余", money(s.surplus), s.surplus >= 0 ? "positive" : "negative", "现金流"),
    dashboardMetric("可用资金", money(Math.max(0, s.income - s.expense)), "", "收入减支出"),
    dashboardMetric("投资收益", money(assetSnap.pnl), assetSnap.pnl >= 0 ? "positive" : "negative", assetSnap.roi == null ? "待更新" : assetSnap.roi.toFixed(2) + "%"),
    dashboardMetric("储蓄率", savingRate == null ? "--" : savingRate.toFixed(1) + "%", "positive", "本月")
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
  cards.push(dashboardSideCard("风险评估", health.risk, health.advice, health.className, "dashboard-risk-bar", forecast.budgetStatus));
  cards.push(dashboardSideCard("目标进度", targetAccounts.length ? reachedTargets.length + "/" + targetAccounts.length + " 进行中" : "待设置目标", "阶段性目标推进", targetAccounts.length ? "positive" : "warning", "dashboard-progress-ring", targetProgress.toFixed(0) + "%"));
  cards.push(dashboardSideCard("备份与安全", backupText, lastSavedAt ? "上次保存 " + savedTimeText(lastSavedAt).slice(11, 19) : "使用浏览器本地存储", "positive", "dashboard-check-mark", "✓"));
  byId("dashboardRightCards").innerHTML = cards.join("");
}

function renderDashboardBottomStrip(s, assetSnap, savingRate, assetAccounts, targetAccounts, targetProgress) {
  var strip = byId("dashboardBottomStrip");
  if (!strip) return;
  var topExpense = state.expenses.filter(function (item) { return item.month === currentMonth(); }).slice().sort(function (a, b) { return b.amount - a.amount; })[0];
  strip.innerHTML = [
    dashboardStripItem("现金流", s.surplus >= 0 ? "+" + money(s.surplus) : "-" + money(Math.abs(s.surplus)), "收入 " + money(s.income) + "｜支出 " + money(s.expense), s.surplus >= 0 ? "positive" : "negative"),
    dashboardStripItem("收支结构", topExpense ? topExpense.category : "暂无支出", "本月支出 " + money(s.expense), ""),
    dashboardStripItem("投资回报", money(assetSnap.pnl), assetSnap.roi == null ? "收益率待更新" : "收益率 " + assetSnap.roi.toFixed(2) + "%", assetSnap.pnl >= 0 ? "positive" : "negative"),
    dashboardStripItem("资产配置", assetAccounts.length + " 个资产账户", "预算比例 " + totalBudgetPercent().toFixed(1) + "%", ""),
    dashboardStripItem("储蓄目标", targetAccounts.length ? targetProgress.toFixed(0) + "%" : "待设置", "储蓄率 " + (savingRate == null ? "--" : savingRate.toFixed(1) + "%"), targetAccounts.length ? "positive" : "warning"),
    dashboardStripItem("本月一句话", "稳住现金流", "让资金回到该去的位置。", "")
  ].join("");
}

function dashboardMetric(label, value, className, hint) {
  return "<div><span>" + esc(label) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><small>" + esc(hint || "") + "</small></div>";
}

function dashboardSideCard(title, value, desc, className, visualClass, visualText) {
  return "<article class=\"dashboard-side-card dashboard-panel\"><h3>" + esc(title) + "</h3><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><p>" + esc(desc) + "</p><div class=\"" + esc(visualClass || "") + "\"><span>" + esc(visualText || "") + "</span></div></article>";
}

function dashboardStripItem(title, value, desc, className) {
  return "<article class=\"dashboard-strip-item\"><span>" + esc(title) + "</span><strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong><small>" + esc(desc) + "</small></article>";
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
  var rows = assetAccounts.map(function (account) {
    var row = accountAssetValueForMonth(account, month);
    return { name: account.name, value: Math.max(0, row.value), color: accountVisual(account).color };
  }).filter(function (row) { return row.value > 0; });
  if (!rows.length) return "<div class=\"dashboard-empty-mini\">暂无资产结构，先更新净值。</div>";
  var total = sum(rows, function (row) { return row.value; }) || 1;
  var gradient = "", cursor = 0;
  rows.forEach(function (row) {
    var pct = row.value / total * 100;
    gradient += row.color + " " + cursor.toFixed(1) + "% " + (cursor + pct).toFixed(1) + "%, ";
    cursor += pct;
  });
  return "<div class=\"dashboard-structure\"><div class=\"dashboard-donut\" style=\"--dashboard-donut:" + esc(gradient.replace(/, $/, "")) + "\"></div><div class=\"dashboard-structure-list\">"
    + rows.slice(0, 4).map(function (row) {
      var pct = row.value / total * 100;
      return "<div><span style=\"background:" + esc(row.color) + "\"></span><strong>" + esc(dashboardShortName(row.name)) + "</strong><em>" + pct.toFixed(0) + "%</em></div>";
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
  var labels = rows.map(function (row, index) { return "<text x=\"" + px(index).toFixed(1) + "\" y=\"" + (h - 2) + "\" text-anchor=\"middle\">" + esc(row.month.slice(5)) + "</text>"; }).join("");
  var dots = rows.map(function (row, index) { return "<circle cx=\"" + px(index).toFixed(1) + "\" cy=\"" + py(row.value).toFixed(1) + "\" r=\"3\"></circle>"; }).join("");
  el.innerHTML = "<svg viewBox=\"0 0 " + w + " " + h + "\" role=\"img\"><polyline points=\"" + points + "\"></polyline>" + dots + labels + "</svg>";
}

function setDashboardText(id, value) {
  var el = byId(id);
  if (el) el.textContent = value;
}
