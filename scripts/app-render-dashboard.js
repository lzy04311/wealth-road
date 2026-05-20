function renderDashboard() {
  var month = currentMonth(), s = monthlySummary(month), assetSnap = assetSnapshotSummary(month), health = financialHealth(month), forecast = monthlyForecast(month);
  var todayDate = new Date().getDate();
  var salaryRatio = s.hasPlannedIncome && s.plannedIncome > 0 ? (s.income / s.plannedIncome) : null;
  var salaryReady = !!(salaryRatio != null && salaryRatio >= 0.9);
  var monthSnapshots = state.snapshots.filter(function (x) { return x.month === month; });
  var assetStatusText = !state.snapshots.length
    ? "还没有净值更新，先记录一次当前资产作为起点。"
    : (monthSnapshots.length < 2
      ? "还没有足够快照，月底再记录一次就能看到变化。"
      : (assetSnap.monthChange > 0
        ? "这个月资产正在变厚，继续保持记录节奏"
        : (assetSnap.monthChange < 0 ? "本月资产出现回撤，先观察，不急着判断。" : "本月资产暂时平稳，继续记录即可。")));
  var salaryStatus = !s.hasPlannedIncome ? "等待填写计划收入" : (salaryReady ? "工资已到账" : "等待工资到账");
  var salaryHint = "系统按实际流水更新中";

  byId("mainAssetValue").textContent = money(assetSnap.totalAsset || s.asset);
  byId("mainSystemStatus").textContent = assetStatusText;
  byId("mainSystemStatus").className = "cockpit-status " + (!state.snapshots.length || monthSnapshots.length < 2 ? "warning" : (assetSnap.monthChange >= 0 ? "positive" : "negative"));
  var snapRhythmClass = state.snapshots.length >= 4 ? "active" : (state.snapshots.length >= 2 ? "warm" : "cold");
  var snapRhythmLabel = state.snapshots.length >= 4 ? "节奏稳定" : (state.snapshots.length >= 2 ? "节奏建立中" : "等待首次记录");
  var lastSnapForTrack = state.snapshots.length ? state.snapshots.slice().sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); })[0].date : "";
  byId("mainAssetTrack").innerHTML = "<div class=\"asset-snap-status\"><span class=\"asset-snap-dot " + snapRhythmClass + "\"></span><span>" + esc(snapRhythmLabel) + (state.snapshots.length ? " · " + state.snapshots.length + " 次更新" + (lastSnapForTrack ? " · " + lastSnapForTrack : "") : " · 还没有净值更新") + "</span></div>";
  byId("mainHealthPanel").innerHTML = "<div class=\"health-grid\"><div class=\"health-score\" data-health-detail=\"score\"><span>资金健康指数</span><strong class=\"" + health.className + "\">" + health.score + "</strong></div><div class=\"health-row\" data-health-detail=\"risk\"><span>当前风险等级</span><strong class=\"" + health.className + "\">" + esc(health.risk) + "</strong></div></div><div class=\"health-advice\"><span>今日建议</span><strong>" + esc(health.advice) + "</strong></div>" + renderDashboardRhythm(month, s);

  byId("flowActual").textContent = money(s.income);
  byId("flowExpense").textContent = money(s.expense);
  byId("flowInvestment").textContent = money(s.investment);
  byId("flowSurplus").textContent = money(s.surplus);
  byId("flowSurplus").className = s.surplus >= 0 ? "positive" : "negative";
  byId("forecastExpense").textContent = money(forecast.projectedExpense);
  byId("forecastSurplus").textContent = money(forecast.projectedSurplus);
  byId("forecastSurplus").className = forecast.projectedSurplus >= 0 ? "positive" : "negative";
  byId("forecastDailySpend").textContent = money(forecast.dailySafeSpend);
  byId("forecastPace").textContent = forecast.pace;
  byId("forecastPace").className = forecast.className;

  byId("budgetTotalValue").textContent = s.hasPlannedIncome ? money(s.budget) : "待填写计划收入";
  byId("budgetExpenseValue").textContent = money(s.expense);
  byId("budgetUsedRate").textContent = forecast.budgetUsedRate == null ? "--" : forecast.budgetUsedRate.toFixed(1) + "%";
  byId("budgetUsedRate").className = forecast.budgetClassName;
  byId("budgetStatus").textContent = forecast.budgetStatus;
  byId("budgetStatus").className = forecast.budgetClassName;
  renderDashboardTrend(month);
  renderDashboardPies(month);
  renderDashboardTrendContext(month, assetSnap, monthSnapshots);
  renderDashboardBudgetInsights(month);
}

function dashboardPct(value, total) {
  if (!total || total <= 0) return null;
  return Math.max(0, Math.min(100, value / total * 100));
}
function dashboardPctText(pct) {
  return pct == null ? "--" : pct.toFixed(0) + "%";
}
function dashboardRhythmRow(label, value, pct, className) {
  return "<div class=\"rhythm-row\"><div class=\"rhythm-row-head\"><span>" + esc(label) + "</span><strong class=\"" + (className || "") + "\">" + esc(value) + "</strong></div><div class=\"rhythm-bar\"><span class=\"" + (className || "") + "\" style=\"width:" + (pct == null ? 0 : pct.toFixed(0)) + "%\"></span></div></div>";
}
function renderDashboardRhythm(month, s) {
  var plan = monthlyPlan(month);
  var incomePct = plan.hasPlannedIncome ? dashboardPct(s.income, plan.plannedIncome) : null;
  var budgetPct = s.hasPlannedIncome && s.budget > 0 ? dashboardPct(s.expense, s.budget) : null;
  var investTarget = s.hasPlannedIncome ? sum(state.accounts, function (account) {
    return account.includeAsset ? (accountBudgetAmount(account, month) || 0) : 0;
  }) : 0;
  var investPct = investTarget > 0 ? dashboardPct(Math.max(0, s.investment), investTarget) : null;
  var settlePct = s.income > 0 ? dashboardPct(Math.max(0, s.surplus), s.income) : null;
  return "<div class=\"dashboard-rhythm\">"
    + "<div class=\"rhythm-title\"><span>资金节奏</span><strong>" + esc(monthText(month)) + "</strong></div>"
    + dashboardRhythmRow("收入到账", incomePct == null ? "待计划" : dashboardPctText(incomePct), incomePct, incomePct != null && incomePct >= 90 ? "positive" : "warning")
    + dashboardRhythmRow("预算使用", budgetPct == null ? "待计划" : dashboardPctText(budgetPct), budgetPct, budgetPct != null && budgetPct > 100 ? "negative" : (budgetPct != null && budgetPct > 85 ? "warning" : "positive"))
    + dashboardRhythmRow("投资执行", investPct == null ? "待目标" : dashboardPctText(investPct), investPct, investPct != null && investPct > 0 ? "positive" : "warning")
    + dashboardRhythmRow("结余沉淀", settlePct == null ? "--" : dashboardPctText(settlePct), settlePct, s.surplus >= 0 ? "positive" : "negative")
    + "</div>";
}
function renderDashboardTrendContext(month, assetSnap, monthSnapshots) {
  var el = byId("dashboardTrendChart");
  if (!el) return;
  var latest = state.snapshots.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); })[0] || null;
  var roiText = assetSnap.roi == null ? "--" : ((assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%");
  var changeText = assetSnap.monthChange == null ? "快照不足" : money(assetSnap.monthChange);
  var snapText = latest ? (state.snapshots.length + " 条 · " + latest.date) : "暂无快照";
  var trendClass = assetSnap.monthChange == null ? "warning" : (assetSnap.monthChange >= 0 ? "positive" : "negative");
  var title = el.querySelector(".dashboard-chart-title");
  if (title) {
    title.innerHTML = "<span>投资盈亏</span><div class=\"trend-summary\"><div><small>当前收益率</small><strong class=\"" + ((assetSnap.roi || 0) >= 0 ? "positive" : "negative") + "\">" + esc(roiText) + "</strong></div><div><small>本月变化</small><strong class=\"" + trendClass + "\">" + esc(changeText) + "</strong></div><div><small>快照</small><strong>" + esc(snapText) + "</strong></div></div>";
  }
  var insight = "";
  if (!state.snapshots.length) {
    insight = "还没有净值更新，完成首次记录后这里会显示趋势判断。";
  } else if (state.snapshots.length < 2) {
    insight = "至少需要两次净值更新才能判断趋势方向，继续记录。";
  } else if (assetSnap.monthChange != null && assetSnap.monthChange > 0) {
    insight = "本月资产波动可控，当前趋势偏积极。";
  } else if (assetSnap.monthChange != null && assetSnap.monthChange < 0) {
    insight = "本月资产出现回撤，先观察不急着判断。";
  } else {
    insight = "本月资产暂时平稳，继续按当前节奏记录。";
  }
  var old = el.querySelector(".dashboard-trend-insight");
  if (old) old.remove();
  var footer = document.createElement("div");
  footer.className = "dashboard-trend-insight " + (state.snapshots.length < 2 ? "warning" : trendClass);
  footer.innerHTML = "<span class=\"trend-insight-dot\"></span>" + esc(insight);
  el.appendChild(footer);
}
function renderDashboardBudgetInsights(month) {
  var el = byId("budgetLegend");
  if (!el) return;
  var maxPctAccount = null, maxPct = 0;
  state.accounts.forEach(function(a) {
    var pct = numberValue(a.budgetPercent);
    if (pct > maxPct) { maxPct = pct; maxPctAccount = a; }
  });
  var longTermPct = sum(state.accounts.filter(function(a) {
    return a.type === "长期投资" || a.type === "短期储蓄" || a.type === "应急金";
  }), function(a) { return numberValue(a.budgetPercent); });
  var freePct = sum(state.accounts.filter(function(a) {
    return a.type === "自由支配";
  }), function(a) { return numberValue(a.budgetPercent); });
  el.innerHTML = "<div class=\"budget-insights\">"
    + "<div class=\"budget-insight-item\"><span>最高占比</span><strong>" + esc(maxPctAccount ? maxPctAccount.name : "--") + "</strong><small>" + maxPct.toFixed(1) + "%</small></div>"
    + "<div class=\"budget-insight-item\"><span>长期资金</span><strong>" + longTermPct.toFixed(1) + "%</strong><small>" + (longTermPct >= 30 ? "偏稳健" : (longTermPct >= 15 ? "可加强" : "偏低")) + "</small></div>"
    + "<div class=\"budget-insight-item\"><span>自由额度</span><strong>" + freePct.toFixed(1) + "%</strong><small>" + (freePct <= 15 ? "可控" : "偏高") + "</small></div>"
    + "</div>";
}
