"use strict";

function renderDashboard() {
  var month = currentMonth();
  var s = monthlySummary(month);
  var assetSnap = assetSnapshotSummary(month);
  var health = financialHealth(month);
  var forecast = monthlyForecast(month);
  var assetTotal = assetSnap.totalAsset || s.asset;
  var roiText = assetSnap.roi == null ? "待更新" : ((assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%");
  var budgetTotal = totalBudgetPercent();
  var targetAccounts = state.accounts.filter(function (account) { return numberValue(account.target) > 0; });
  var reachedTargets = targetAccounts.filter(function (account) { return accountBalance(account, month) >= numberValue(account.target); });
  var targetText = targetAccounts.length ? (reachedTargets.length + "/" + targetAccounts.length + " 已完成") : "待设置目标";
  var targetClass = !targetAccounts.length ? "warning" : (reachedTargets.length === targetAccounts.length ? "positive" : "warning");
  var latestSnapshot = state.snapshots.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); })[0] || null;
  var backupText = lastSavedAt ? "已保存" : "本地可用";
  var coreJudgement = s.surplus >= 0 ? "资金节奏稳定，结余正在沉淀" : "现金流承压，先收紧支出";
  if (health.className === "warning") coreJudgement = "资金节奏需留意，优先校准预算";
  if (health.className === "negative") coreJudgement = "风险正在抬升，先守住现金流";
  var core = byId("compassCoreStatus");
  if (core) core.textContent = coreJudgement;

  var nodes = [
    { key: "flow", view: "flow", name: "流水", desc: "钱如何流动", value: s.surplus >= 0 ? ("结余 " + money(s.surplus)) : ("缺口 " + money(Math.abs(s.surplus))), className: s.surplus >= 0 ? "positive" : "negative", level: "core" },
    { key: "invest", view: "investments", name: "投资", desc: "钱如何进入未来", value: roiText, className: assetSnap.roi == null ? "warning" : (assetSnap.roi >= 0 ? "positive" : "negative"), level: "core" },
    { key: "assets", view: "assets", name: "资产", desc: "我真正拥有什么", value: money(assetTotal), className: "", level: "core" },
    { key: "accounts", view: "accounts", name: "分配", desc: "钱应该归位哪里", value: budgetTotal.toFixed(1) + "%", className: budgetTotal > 100 ? "negative" : (budgetTotal === 100 ? "positive" : "warning"), level: "aux" },
    { key: "goals", view: "goals", name: "目标", desc: "钱要通向哪里", value: targetText, className: targetClass, level: "aux" },
    { key: "data", view: "data", name: "备份", desc: "数据安全出口", value: backupText, className: "positive", level: "aux" }
  ];

  var nodeLayer = byId("wealthCompassNodes");
  if (nodeLayer) nodeLayer.innerHTML = nodes.map(dashboardCompassNode).join("");

  var summary = byId("dashboardStateSummary");
  if (summary) {
    summary.innerHTML = ""
      + dashboardStateCard("当前总资产", money(assetTotal), latestSnapshot ? ("最近快照 " + latestSnapshot.date) : "还没有净值快照", "")
      + dashboardStateCard("本月真实结余", money(s.surplus), s.surplus >= 0 ? "现金流保持正向" : "现金流出现缺口", s.surplus >= 0 ? "positive" : "negative")
      + dashboardStateCard("资金健康指数", String(health.score), health.risk, health.className, "score")
      + dashboardStateCard("今日建议", health.advice, forecast.budgetStatus, forecast.budgetClassName);
  }
}

function dashboardCompassNode(item) {
  return "<button class=\"compass-node node-" + esc(item.key) + " is-" + esc(item.level || "aux") + "\" type=\"button\" data-action=\"open-view\" data-view=\"" + esc(item.view) + "\">"
    + "<span class=\"node-dot\"></span>"
    + "<span class=\"node-name\">" + esc(item.name) + "</span>"
    + "<span class=\"node-desc\">" + esc(item.desc) + "</span>"
    + "<strong class=\"" + esc(item.className || "") + "\">" + esc(item.value) + "</strong>"
    + "</button>";
}

function dashboardStateCard(label, value, hint, className, healthDetail) {
  var detail = healthDetail ? " data-health-detail=\"" + esc(healthDetail) + "\"" : "";
  return "<article class=\"state-card\"" + detail + ">"
    + "<span>" + esc(label) + "</span>"
    + "<strong class=\"" + esc(className || "") + "\">" + esc(value) + "</strong>"
    + "<small class=\"" + esc(className || "") + "\">" + esc(hint || "") + "</small>"
    + "</article>";
}
