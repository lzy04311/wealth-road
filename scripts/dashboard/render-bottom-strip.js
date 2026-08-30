"use strict";

function renderDashboardBottomStrip(s, assetSnap, change, attribution, primaryGoal, readiness) {
  var strip = byId("dashboardBottomStrip");
  if (!strip) return;
  var month = currentMonth();
  var expenseRows = dashboardExpenseCategoryRows(month);
  var sentence = readiness && readiness.onboardingNeeded ? "先完成实际账户、月度计划和第一笔记录。" : (s.freeCash < 0 ? "先守住现金流，再谈进攻。" : (assetSnap.roi != null && assetSnap.roi > 0 ? "慢就是快，复利是时间给耐心者的奖赏。" : "让每一笔钱回到它该去的位置。"));
  var cashRate = s.income > 0 ? Math.max(0, Math.min(100, s.expense / s.income * 100)) : 0;
  strip.innerHTML = [
    dashboardStripCashModule(s, cashRate, readiness),
    dashboardStripStructureModule(s, expenseRows),
    dashboardStripInvestModule(assetSnap, attribution),
    dashboardStripWealthAttributionModule(change, attribution),
    dashboardStripAllocationModule(dashboardAllocationExecution(month), readiness),
    dashboardStripQuoteModule(sentence, readiness)
  ].join("");
}

function dashboardStripCashModule(s, cashRate, readiness) {
  if (readiness && !readiness.hasCashflowEvidence) {
    return "<article class=\"dashboard-strip-item dashboard-strip-cash\"><div class=\"dashboard-strip-block\"><span class=\"dashboard-strip-title\">现金流总览</span><div class=\"dashboard-strip-body\"><div class=\"dashboard-strip-kv\"><em>实际现金净流入</em><strong class=\"warning\">待记录</strong></div><div class=\"dashboard-strip-foot\">记录到账收入与现金支出后计算</div></div></div></article>";
  }
  var flowText = s.netCashFlow >= 0 ? "+" + money(s.netCashFlow) : "-" + money(Math.abs(s.netCashFlow));
  return "<article class=\"dashboard-strip-item dashboard-strip-cash\">"
    + "<div class=\"dashboard-strip-block\">"
    + "<span class=\"dashboard-strip-title\">现金流总览</span>"
    + "<div class=\"dashboard-strip-body\">"
    + "<div class=\"dashboard-strip-kv\"><em>实际现金净流入</em><strong class=\"" + (s.netCashFlow >= 0 ? "positive" : "negative") + "\">" + flowText + "</strong></div>"
    + "<div class=\"dashboard-strip-bar\" style=\"--strip-income-ratio:" + esc((100 - cashRate).toFixed(1)) + "%\"></div>"
    + "<div class=\"dashboard-strip-split\"><span>到账收入 " + esc(money(s.income)) + "</span><span>现金支出 " + esc(money(s.cashExpense)) + "</span></div>"
    + "<div class=\"dashboard-strip-foot\">本月待分配 " + esc(money(s.freeCash)) + (s.payrollWithholdingExpense > 0 ? " · 工资代扣 " + esc(money(s.payrollWithholdingExpense)) + " 已计入消费" : "") + "</div>"
    + "</div>"
    + "</div></article>";
}

function dashboardStripStructureModule(s, expenseRows) {
  var topRows = expenseRows.slice(0, 3);
  return "<article class=\"dashboard-strip-item dashboard-strip-structure\">"
    + "<div class=\"dashboard-strip-block\">"
    + "<span class=\"dashboard-strip-title\">收支结构</span>"
    + "<div class=\"dashboard-strip-body\">"
    + "<div class=\"dashboard-strip-sub\">支出占比 TOP3</div>"
    + "<div class=\"dashboard-strip-donut-row\">"
    + "<div class=\"dashboard-strip-donut-center\">" + dashboardStripDonutCore(topRows) + "</div>"
    + "<div class=\"dashboard-strip-list\">" + dashboardStripTopList(topRows, "本月支出结构") + "</div>"
    + "</div>"
    + "</div>"
    + "</div></article>";
}

function dashboardStripInvestModule(assetSnap, attribution) {
  var hasSnapshotData = !!assetSnap.performanceReady;
  var principalText = hasSnapshotData ? money(assetSnap.performancePrincipal) : "—";
  var pnlText = hasSnapshotData ? dashboardSignedMoney(assetSnap.pnl) : "—";
  var pnlClass = !hasSnapshotData ? "warning" : (assetSnap.pnl >= 0 ? "positive" : "negative");
  var roiText = assetSnap.roi == null ? "--" : (assetSnap.roi >= 0 ? "+" : "") + assetSnap.roi.toFixed(2) + "%";
  return "<article class=\"dashboard-strip-item dashboard-strip-invest\">"
    + "<div class=\"dashboard-strip-block\">"
    + "<span class=\"dashboard-strip-title\">投资回报</span>"
    + "<div class=\"dashboard-strip-body\">"
    + "<div class=\"dashboard-strip-double\"><div><em>本金</em><strong>" + esc(principalText) + "</strong></div><div><em>浮动盈亏</em><strong class=\"" + pnlClass + "\">" + esc(pnlText) + "</strong></div></div>"
    + "<div class=\"dashboard-strip-sub\">当前收益率 " + esc(roiText) + "</div>"
    + "<div class=\"dashboard-strip-invest-line\">" + dashboardStripSparkline(assetSnap) + "</div>"
    + "</div>"
    + "</div></article>";
}

function dashboardStripWealthAttributionModule(change, attribution) {
  if (!change.hasBaseline) {
    return "<article class=\"dashboard-strip-item dashboard-strip-allocation\"><div class=\"dashboard-strip-block\"><span class=\"dashboard-strip-title\">财富归因</span><div class=\"dashboard-strip-body\"><div class=\"dashboard-strip-kv\"><em>本月净变化</em><strong class=\"warning\">等待形成完整基线</strong></div><div class=\"dashboard-strip-foot\">基线完整后展示收支、投资、负债与调整</div></div></div></article>";
  }
  var explanatoryRows = [
    { label: "收支贡献", value: attribution.cashflowContribution },
    { label: "投资损益", value: attribution.investmentPnl },
    { label: "负债变化", value: attribution.liabilityChange },
    { label: "核对调整", value: attribution.otherChange }
  ].sort(function (a, b) { return Math.abs(numberValue(b.value)) - Math.abs(numberValue(a.value)); }).slice(0, 2);
  explanatoryRows.push({ label: "未解释变化", value: attribution.unexplained });
  return "<article class=\"dashboard-strip-item dashboard-strip-allocation\">"
    + "<div class=\"dashboard-strip-block\">"
    + "<span class=\"dashboard-strip-title\">财富归因</span>"
    + "<div class=\"dashboard-strip-body\">"
    + "<div class=\"dashboard-strip-kv\"><em>本月净变化</em><strong class=\"" + (change.change >= 0 ? "positive" : "negative") + "\">" + esc(dashboardSignedMoney(change.change)) + "</strong></div>"
    + "<div class=\"dashboard-strip-list\">" + explanatoryRows.map(function (row) { return "<span><i class=\"dashboard-strip-dot\" aria-hidden=\"true\"></i>" + esc(row.label + " " + dashboardSignedMoney(row.value)) + "</span>"; }).join("") + "</div>"
    + "</div>"
    + "</div></article>";
}

function dashboardStripAllocationModule(execution, readiness) {
  var planText = execution.hasPlan ? money(execution.planned) : "待填写计划收入";
  var actualUnknown = !!(readiness && !readiness.hasMonthActivity && !execution.hasPlan);
  var actualClass = !execution.hasPlan ? "warning" : (execution.deviation === 0 ? "positive" : "warning");
  var pools = execution.pools.filter(function (row) { return row.planned != null || row.actual > 0; }).slice(0, 3);
  var poolText = pools.length ? pools.map(function (row) {
    var planned = row.planned == null ? "按实际" : numberValue(row.budgetPercent).toFixed(1) + "%";
    return dashboardShortName(row.name) + " " + planned + " · 余额 " + money(row.balance);
  }) : ["暂无资金池分配记录"];
  return "<article class=\"dashboard-strip-item dashboard-strip-goal\">"
    + "<div class=\"dashboard-strip-block\">"
    + "<span class=\"dashboard-strip-title\">资金池执行</span>"
    + "<div class=\"dashboard-strip-body\">"
    + "<div class=\"dashboard-strip-double\"><div><em>计划分配</em><strong class=\"" + (!execution.hasPlan ? "warning" : "") + "\">" + esc(planText) + "</strong></div><div><em>实际分配</em><strong class=\"" + actualClass + "\">" + esc(actualUnknown ? "待记录" : money(execution.actual)) + "</strong></div></div>"
    + "<div class=\"dashboard-strip-list\">" + poolText.map(function (text) { return "<span><i class=\"dashboard-strip-dot\" aria-hidden=\"true\"></i>" + esc(text) + "</span>"; }).join("") + "</div>"
    + "<div class=\"dashboard-strip-foot\">" + esc(execution.hasPlan ? "偏差 " + dashboardSignedMoney(execution.deviation) : "记录收入归属与待分配转入") + "</div>"
    + "</div>"
    + "</div></article>";
}

function dashboardStripQuoteModule(sentence, readiness) {
  return "<article class=\"dashboard-strip-item dashboard-strip-quote\">"
    + "<div class=\"dashboard-strip-block\">"
    + "<span class=\"dashboard-strip-title\">本月一句话</span>"
    + "<div class=\"dashboard-strip-body\">"
    + "<strong class=\"dashboard-strip-quote-main\">" + esc(readiness && readiness.onboardingNeeded ? "从真实数据开始" : "稳住节奏") + "</strong>"
    + "<small class=\"dashboard-strip-desc\">" + esc(sentence) + "</small>"
    + "<div class=\"dashboard-strip-quote-art\"></div>"
    + "</div>"
    + "</div></article>";
}

function dashboardStripDonutCore(rows) {
  if (!rows.length) {
    return "<div class=\"dashboard-strip-donut dashboard-strip-donut-lg dashboard-strip-donut-empty\"></div>";
  }
  var palette = ["#D5B98A", "#E0CA9E", "#EADAB8", "#F2E9D2"];
  var safeRows = rows.slice(0, 4).map(function (row) { return { name: row.name, pct: numberValue(row.pct) }; });
  var total = sum(safeRows, function (row) { return row.pct; });
  if (total < 99) safeRows.push({ name: "其他", pct: 100 - total });
  var cursor = 0;
  var gradient = safeRows.map(function (row, index) {
    var color = palette[index % palette.length];
    var start = cursor;
    cursor += Math.max(0, row.pct);
    return color + " " + start.toFixed(1) + "% " + cursor.toFixed(1) + "%";
  }).join(", ");
  return "<div class=\"dashboard-strip-donut dashboard-strip-donut-lg\" style=\"--strip-donut:" + esc(gradient) + "\"></div>";
}

function dashboardStripTopList(rows, fallbackText) {
  if (!rows.length) {
    return "<span><i class=\"dashboard-strip-dot\" aria-hidden=\"true\"></i>暂无数据</span><span><i class=\"dashboard-strip-dot\" aria-hidden=\"true\"></i>" + esc(fallbackText) + "</span><span><i class=\"dashboard-strip-dot\" aria-hidden=\"true\"></i>等待记录</span>";
  }
  return rows.slice(0, 3).map(function (row) {
    return "<span><i class=\"dashboard-strip-dot\" aria-hidden=\"true\"></i>" + esc(dashboardStripLabel(row.name)) + " " + esc(numberValue(row.pct).toFixed(0)) + "%</span>";
  }).join("");
}

function dashboardStripSparkline(assetSnap) {
  var values = dashboardStripSmoothValues(dashboardStripInvestmentValues(assetSnap));
  var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
  var span = max - min || 1;
  var width = 94, height = 36, baseY = 34;
  var dots = values.map(function (value, index) {
    return { x: 4 + index * 18, y: +(32 - (value - min) / span * 24).toFixed(1) };
  });
  var points = dots.map(function (p) { return p.x + "," + p.y; }).join(" ");
  var area = "4," + baseY + " " + points + " 76," + baseY;
  var guides = [22, 40, 58].map(function (x) {
    return "<line x1=\"" + x + "\" y1=\"8\" x2=\"" + x + "\" y2=\"34\"></line>";
  }).join("");
  var circles = dots.map(function (p, index) {
    var r = index === dots.length - 1 ? 2.8 : 2.1;
    return "<circle cx=\"" + p.x + "\" cy=\"" + p.y + "\" r=\"" + r + "\"></circle>";
  }).join("");
  return "<div class=\"dashboard-strip-sparkline\"><svg viewBox=\"0 0 " + width + " " + height + "\" aria-hidden=\"true\"><g class=\"strip-sparkline-guides\">" + guides + "</g><polygon points=\"" + area + "\"></polygon><polyline points=\"" + points + "\"></polyline>" + circles + "</svg></div>";
}

function dashboardStripSmoothValues(values) {
  if (!values || values.length < 3) return values || [];
  return values.map(function (value, index, arr) {
    if (index === 0 || index === arr.length - 1) return value;
    return (arr[index - 1] + value * 2 + arr[index + 1]) / 4;
  });
}

function dashboardStripInvestmentValues(assetSnap) {
  var byDate = {};
  state.snapshots.forEach(function (item) {
    if (!item.date) return;
    byDate[item.date] = (byDate[item.date] || 0) + numberValue(item.marketValue);
  });
  var values = Object.keys(byDate).sort().slice(-5).map(function (date) { return byDate[date]; });
  while (values.length < 5) values.unshift(Math.max(0, numberValue(assetSnap.performanceAsset) - (5 - values.length) * 80));
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
