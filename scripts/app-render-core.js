"use strict";

function optionHtml(list, value) { return list.map(function (item) { return "<option value=\"" + esc(item) + "\"" + (item === value ? " selected" : "") + ">" + esc(item) + "</option>"; }).join(""); }
function accountOptions(selected, filterFn) { return state.accounts.filter(filterFn || function () { return true; }).map(function (item) { return "<option value=\"" + esc(item.id) + "\"" + (item.id === selected ? " selected" : "") + ">" + esc(item.name) + "</option>"; }).join(""); }
function syncSelects() { var selectedExpenseAccount = byId("expenseAccount").value; var selectedInvestmentAccount = byId("investmentAccount").value; var selectedSnapshotAccount = byId("snapshotAccount").value; byId("incomeSource").innerHTML = optionHtml(incomeSources, byId("incomeSource").value); byId("accountType").innerHTML = optionHtml(accountTypes, byId("accountType").value); byId("investmentType").innerHTML = optionHtml(investmentTypes, byId("investmentType").value); if (byId("assetItemKind")) byId("assetItemKind").innerHTML = optionHtml(assetKinds, byId("assetItemKind").value); if (byId("assetItemStatus")) byId("assetItemStatus").innerHTML = optionHtml(assetStatuses, byId("assetItemStatus").value); byId("expenseAccount").innerHTML = accountOptions(selectedExpenseAccount, function (acc) { return acc.includeExpense || acc.id === selectedExpenseAccount; }); byId("investmentAccount").innerHTML = accountOptions(selectedInvestmentAccount, function (acc) { return acc.includeAsset || !acc.includeExpense || acc.id === selectedInvestmentAccount; }); byId("snapshotAccount").innerHTML = accountOptions(selectedSnapshotAccount, function (acc) { return acc.includeAsset || acc.id === selectedSnapshotAccount; }); }
function renderTodayWidget() { var dateValue = byId("dashboardDate") && byId("dashboardDate").value ? byId("dashboardDate").value : today(), parts = dateValue.split("-"), d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), hour = new Date().getHours(), emoji = hour < 6 ? "😴" : hour < 11 ? "😊" : hour < 14 ? "😋" : hour < 18 ? "🙂" : hour < 22 ? "🌙" : "😴"; byId("todayDate").textContent = d.getFullYear() + "年" + String(d.getMonth() + 1).padStart(2, "0") + "月" + String(d.getDate()).padStart(2, "0") + "日"; byId("todayEmoji").textContent = emoji; }
function renderStats(containerId, stats) { byId(containerId).innerHTML = stats.map(function (item) { var details = Array.isArray(item.details) ? "<div class=\"stat-details\">" + item.details.map(function (d) { return "<div class=\"stat-detail\"><span>" + esc(d.label) + "</span><strong class=\"" + (d.className || "") + "\">" + esc(d.value) + "</strong></div>"; }).join("") + "</div>" : ""; return "<div class=\"card stat " + (item.featured ? "main-stat" : "") + "\"><div class=\"label\">" + esc(item.label) + "</div><div class=\"value " + (item.className || "") + "\">" + esc(item.value) + "</div><div class=\"hint\">" + esc(item.hint || "") + "</div>" + details + "</div>"; }).join(""); }
function renderPie(pieId, legendId, items, centerLabel, emptyText, centerValue, budgetMode) {
  function p2c(cx, cy, r, deg) {
    var rad = Math.PI * deg / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function ringPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
    var outerStart = p2c(cx, cy, rOuter, startDeg), outerEnd = p2c(cx, cy, rOuter, endDeg);
    var innerEnd = p2c(cx, cy, rInner, endDeg), innerStart = p2c(cx, cy, rInner, startDeg);
    var large = endDeg - startDeg > 180 ? 1 : 0;
    return "M " + outerStart.x + " " + outerStart.y
      + " A " + rOuter + " " + rOuter + " 0 " + large + " 1 " + outerEnd.x + " " + outerEnd.y
      + " L " + innerEnd.x + " " + innerEnd.y
      + " A " + rInner + " " + rInner + " 0 " + large + " 0 " + innerStart.x + " " + innerStart.y
      + " Z";
  }
  var total = sum(items, function (item) { return item.value; });
  if (!total) {
    byId(pieId).innerHTML = "<div class=\"empty\">" + esc(emptyText || "暂无可展示的数据") + "</div>";
    byId(legendId).innerHTML = "";
    return;
  }
  var cx = 130, cy = 130, rOuter = 98, rInner = 52, gapDeg = 1.2, explode = 0, start = -90;
  var labels = [];
  var slices = items.map(function (item) {
    var rawAngle = item.value / total * 360;
    var usedGap = rawAngle > gapDeg * 1.35 ? gapDeg : Math.max(0.7, rawAngle * 0.22);
    var segStart = start + usedGap / 2;
    var segEnd = start + rawAngle - usedGap / 2;
    var safeEnd = Math.max(segStart + 0.8, segEnd);
    var mid = (segStart + safeEnd) / 2;
    var tx = explode * Math.cos(Math.PI * mid / 180);
    var ty = explode * Math.sin(Math.PI * mid / 180);
    var pct = budgetMode ? numberValue(item.value).toFixed(1) : (item.value / total * 100).toFixed(1);
    var amountText = item.display || money(item.value);
    var tip = item.name + "\n比例：" + pct + "%\n金额：" + amountText;
    var d = ringPath(cx, cy, rOuter, rInner, segStart, safeEnd);
    var lineStart = p2c(cx + tx, cy + ty, rOuter + 2, mid);
    var lineMid = p2c(cx + tx, cy + ty, rOuter + 22, mid);
    var right = Math.cos(Math.PI * mid / 180) >= 0;
    var lineEnd = { x: lineMid.x + (right ? 22 : -22), y: lineMid.y };
    labels.push("<path class=\"pie-label-line\" d=\"M " + lineStart.x.toFixed(1) + " " + lineStart.y.toFixed(1) + " L " + lineMid.x.toFixed(1) + " " + lineMid.y.toFixed(1) + " L " + lineEnd.x.toFixed(1) + " " + lineEnd.y.toFixed(1) + "\"></path><text class=\"pie-label-text\" x=\"" + (lineEnd.x + (right ? 5 : -5)).toFixed(1) + "\" y=\"" + (lineEnd.y + 3).toFixed(1) + "\" text-anchor=\"" + (right ? "start" : "end") + "\">" + esc(item.name) + "</text>");
    start += rawAngle;
    return "<path class=\"pie-slice\" d=\"" + d + "\" fill=\"" + item.color + "\" transform=\"translate(" + tx.toFixed(2) + " " + ty.toFixed(2) + ")\"><title>" + esc(tip) + "</title></path>";
  }).join("");
  var hasCenterValue = centerValue !== "" && centerValue != null;
  var centerLabelY = hasCenterValue ? 126 : 134;
  var centerValueText = hasCenterValue ? ("<text class=\"pie-center-value\" x=\"130\" y=\"144\" text-anchor=\"middle\">" + esc(centerValue) + "</text>") : "";
  byId(pieId).innerHTML = "<svg viewBox=\"0 0 260 260\" role=\"img\"><g>" + slices + "</g><g>" + labels.join("") + "</g><circle class=\"pie-center\" cx=\"130\" cy=\"130\" r=\"48\"></circle><text class=\"pie-center-label\" x=\"130\" y=\"" + centerLabelY + "\" text-anchor=\"middle\">" + esc(centerLabel) + "</text>" + centerValueText + "</svg>";
  if (byId(legendId)) byId(legendId).innerHTML = "";
}
function renderDashboardPies(month) {
  var plan = monthlyPlan(month), monthIncome = monthlyIncome(month), budgetCenter = plan.hasPlannedIncome ? plan.plannedIncome : monthIncome;
  var budgetMap = {
    "生存专项拨款": "生存",
    "自我升级基金": "自投",
    "纳纳你是我的神": "长投",
    "与大A斗智斗勇专项基金": "长投",
    "流动资金（子弹）": "短储",
    "败家额度": "自由",
    "保命钱": "应急"
  };
  var budgetTypeMap = { "生活消费": "生存", "自我投资": "自投", "长期投资": "长投", "短期储蓄": "短储", "自由支配": "自由", "应急金": "应急", "其他": "其他" };
  var colorMap = { "生存": "#B9B8B2", "自投": "#8FA59A", "长投": "#6E7378", "短储": "#9AA7AA", "自由": "#C9A86A", "应急": "#D8CCB4" };
  var grouped = {};
  state.accounts.forEach(function (account) {
    var name = budgetMap[account.name] || budgetTypeMap[account.type] || account.name;
    if (!grouped[name]) grouped[name] = { name: name, value: 0, displayValue: 0, color: colorMap[name] || accountVisual(account).color };
    grouped[name].value += Math.max(0, numberValue(account.budgetPercent));
    grouped[name].displayValue += Math.max(0, numberValue(accountBudgetAmount(account, month)));
  });
  var budgetItems = Object.keys(grouped).map(function (key) {
    var item = grouped[key];
    item.display = plan.hasPlannedIncome ? money(item.displayValue) : "待填写计划收入";
    return item;
  }).filter(function (item) { return item.value > 0; });
  var assetShortNames = { "纳纳你是我的神": "娜娜", "娜娜你是我的神": "娜娜", "与大A斗智斗勇专项基金": "大A", "流动资金（子弹）": "子弹", "保命钱": "保命" };
  var assetColorMap = { "纳纳你是我的神": "#6E7378", "娜娜你是我的神": "#6E7378", "与大A斗智斗勇专项基金": "#9A8F7A", "流动资金（子弹）": "#9AA7AA", "保命钱": "#C9A86A" };
  var assetItems = state.accounts.filter(function (account) { return account.includeAsset; }).map(function (account) { var row = accountAssetValueForMonth(account, month); return { name: assetShortNames[account.name] || account.name, value: Math.max(0, row.value), display: money(row.value), color: assetColorMap[account.name] || "#B9B8B2" }; }).filter(function (item) { return item.value > 0; });
  var assetSnap = assetSnapshotSummary(month);
  var isAssetMode = dashboardPieMode === "asset";
  var title = byId("dashboardPieTitle");
  if (title) title.textContent = isAssetMode ? "资产构成" : "预算分配";
  document.querySelectorAll("[data-action=\"set-dashboard-pie\"]").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.pieMode === dashboardPieMode);
  });
  if (isAssetMode) {
    renderPie("budgetPie", "budgetLegend", assetItems, "资产构成", "暂无计入资产的账户余额", assetSnap.totalAsset > 0 ? money(assetSnap.totalAsset) : "", false);
  } else {
    renderPie("budgetPie", "budgetLegend", budgetItems, "预算分配", "请先设置账户预算比例", plan.hasPlannedIncome ? money(budgetCenter) : "", true);
  }
}
function renderDashboardTrend(month) {
  var el = byId("dashboardTrendChart");
  if (!el) return;
  var all = state.snapshots.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  // Only include last 100 days
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 100);
  var cutoffStr = cutoff.getFullYear() + "-" + String(cutoff.getMonth() + 1).padStart(2, "0") + "-" + String(cutoff.getDate()).padStart(2, "0");
  var points = all.filter(function (p) { return p.date >= cutoffStr; });
  if (points.length < 2) points = all;
  if (points.length < 2) {
    el.innerHTML = "<div class=\"dashboard-chart-title\">投资盈亏</div><div class=\"dashboard-chart-empty\">记录两次净值更新后，这里会出现财富增长曲线。</div>";
    return;
  }
  // Group by date and sum
  var dateMap = {};
  points.forEach(function (p) {
    if (!dateMap[p.date]) dateMap[p.date] = { marketValue: 0, principal: 0 };
    dateMap[p.date].marketValue += numberValue(p.marketValue);
    dateMap[p.date].principal += numberValue(p.principal);
  });
  var grouped = Object.keys(dateMap).sort().map(function (d) {
    var row = dateMap[d];
    return { date: d, rate: row.principal > 0 ? (row.marketValue - row.principal) / row.principal * 100 : 0 };
  });
  if (grouped.length < 2) {
    el.innerHTML = "<div class=\"dashboard-chart-title\">投资盈亏</div><div class=\"dashboard-chart-empty\">记录两次净值更新后，这里会出现财富增长曲线。</div>";
    return;
  }

  var w = 620, h = 320, padX = 5, padTop = 30, padBottom = 32;
  var rates = grouped.map(function (g) { return g.rate; });

  // Dynamic Y-axis with 20% padding, always includes zero
  var dataMin = Math.min.apply(null, rates);
  var dataMax = Math.max.apply(null, rates);
  var dataRange = dataMax - dataMin || 1;
  var pad = dataRange * 0.2;
  var rawMin = dataMin - pad;
  var rawMax = dataMax + pad;
  if (rawMin > 0) rawMin = 0;
  if (rawMax < 0) rawMax = 0;
  var yMin = Math.floor(rawMin / 5) * 5;
  var yMax = Math.ceil(rawMax / 5) * 5;
  if (yMin === 0 && yMax === 0) { yMin = -10; yMax = 10; }

  function x(i) { return padX + (w - padX - 16) * (grouped.length === 1 ? 0 : i / (grouped.length - 1)); }
  function y(v) { return padTop + (h - padTop - padBottom) * (1 - (v - yMin) / (yMax - yMin)); }
  var zeroY = y(0);

  // Horizontal grid lines at each tick
  var tickCount = 5;
  var tickStep = (yMax - yMin) / (tickCount - 1);
  var ticks = [];
  for (var t = 0; t < tickCount; t++) { ticks.push(yMin + tickStep * t); }

  var gridLines = ticks.map(function (t) {
    var ty = y(t);
    return "<line class=\"dashboard-grid-line\" x1=\"" + padX + "\" y1=\"" + ty.toFixed(1) + "\" x2=\"" + (w - 16) + "\" y2=\"" + ty.toFixed(1) + "\"></line>";
  }).join("");

  var yLabels = ticks.map(function (t) {
    var ty = y(t);
    return "<line class=\"dashboard-axis\" x1=\"" + (padX - 6) + "\" y1=\"" + ty.toFixed(1) + "\" x2=\"" + padX + "\" y2=\"" + ty.toFixed(1) + "\"></line><text class=\"dashboard-rate-label\" x=\"" + (padX - 10) + "\" y=\"" + (ty + 4).toFixed(1) + "\" text-anchor=\"end\">" + t + "%</text>";
  }).join("");

  // X-axis date labels
  var dateLabels = grouped.map(function (g, i) {
    var step = Math.max(1, Math.ceil(grouped.length / 6));
    if (i % step !== 0 && i !== grouped.length - 1) return "";
    return "<text class=\"dashboard-rate-label\" x=\"" + x(i).toFixed(1) + "\" y=\"" + (h - 8).toFixed(1) + "\" text-anchor=\"middle\">" + g.date.slice(5) + "</text>";
  }).join("");

  // Area polygon: data line then return along zero line
  var areaPts = "";
  for (var i = 0; i < grouped.length; i++) {
    areaPts += (i > 0 ? " " : "") + x(i).toFixed(1) + "," + y(rates[i]).toFixed(1);
  }
  areaPts += " " + x(grouped.length - 1).toFixed(1) + "," + zeroY.toFixed(1);
  areaPts += " " + x(0).toFixed(1) + "," + zeroY.toFixed(1);

  // Split line into above/below-zero segments with zero-crossing intersection
  var aboveSegs = [], belowSegs = [], cur = [], curAbove = null;
  for (var i = 0; i < grouped.length; i++) {
    var isAbove = rates[i] >= 0;
    if (curAbove !== null && isAbove !== curAbove) {
      // Zero crossing: compute intersection
      var tVal = (0 - rates[i - 1]) / (rates[i] - rates[i - 1]);
      var cx = x(i - 1) + (x(i) - x(i - 1)) * tVal;
      cur.push(cx.toFixed(1) + "," + zeroY.toFixed(1));
      if (curAbove) aboveSegs.push(cur); else belowSegs.push(cur);
      cur = [];
      cur.push(cx.toFixed(1) + "," + zeroY.toFixed(1));
    }
    cur.push(x(i).toFixed(1) + "," + y(rates[i]).toFixed(1));
    curAbove = isAbove;
  }
  if (cur.length > 0) {
    if (curAbove) aboveSegs.push(cur); else belowSegs.push(cur);
  }

  var aboveLines = aboveSegs.map(function(s) { return "<polyline class=\"dashboard-trend-above\" points=\"" + s.join(" ") + "\"></polyline>"; }).join("");
  var belowLines = belowSegs.map(function(s) { return "<polyline class=\"dashboard-trend-below\" points=\"" + s.join(" ") + "\"></polyline>"; }).join("");

  // Data point dots
  var dots = rates.map(function (v, i) {
    var px = x(i), py = y(v);
    var showLabel = i % Math.max(1, Math.floor(grouped.length / 8)) === 0 || i === grouped.length - 1;
    var labelHtml = showLabel ? "<text class=\"dashboard-rate-label\" x=\"" + px.toFixed(1) + "\" y=\"" + (py - 10).toFixed(1) + "\" text-anchor=\"middle\">" + grouped[i].rate.toFixed(1) + "%</text>" : "";
    var dotClass = v >= 0 ? "dashboard-trend-point up" : "dashboard-trend-point down";
    return "<circle class=\"" + dotClass + "\" cx=\"" + px.toFixed(1) + "\" cy=\"" + py.toFixed(1) + "\" r=\"3\"></circle>" + labelHtml;
  }).join("");

  var latest = rates[rates.length - 1];
  var finalClass = latest >= 0 ? "dashboard-trend-dot up" : "dashboard-trend-dot down";
  el.innerHTML = "<div class=\"dashboard-chart-title\">投资盈亏</div><svg viewBox=\"0 0 " + w + " " + h + "\" role=\"img\">"
    + "<defs>"
    + "<linearGradient id=\"trendAreaGrad\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">"
    + "<stop offset=\"0%\" stop-color=\"#8C928E\" stop-opacity=\"0.16\"></stop>"
    + "<stop offset=\"100%\" stop-color=\"#8C928E\" stop-opacity=\"0.01\"></stop>"
    + "</linearGradient>"
    + "</defs>"
    + gridLines
    + "<line class=\"dashboard-axis\" x1=\"" + padX + "\" y1=\"" + padTop + "\" x2=\"" + padX + "\" y2=\"" + (h - padBottom) + "\"></line>"
    + "<line class=\"dashboard-axis\" x1=\"" + padX + "\" y1=\"" + (h - padBottom) + "\" x2=\"" + (w - 16) + "\" y2=\"" + (h - padBottom) + "\"></line>"
    + "<line class=\"dashboard-zero-line\" x1=\"" + padX + "\" y1=\"" + zeroY.toFixed(1) + "\" x2=\"" + (w - 16) + "\" y2=\"" + zeroY.toFixed(1) + "\"></line>"
    + yLabels
    + dateLabels
    + "<polygon class=\"dashboard-trend-area\" points=\"" + areaPts + "\"></polygon>"
    + aboveLines
    + belowLines
    + dots
    + "<circle class=\"" + finalClass + "\" cx=\"" + x(grouped.length - 1).toFixed(1) + "\" cy=\"" + y(latest).toFixed(1) + "\" r=\"5\"></circle>"
    + "</svg>";
}
function accountCard(account, visual, pct, body) { return "<div class=\"account-card\" style=\"--account-color:" + esc(visual.color) + "\"><div class=\"account-top\"><div class=\"account-head\"><div class=\"account-emoji\">" + esc(visual.emoji) + "</div><div><div class=\"row-title\">" + esc(account.name) + "<span class=\"badge\">" + esc(account.type) + "</span></div><div class=\"row-meta\">预算比例 " + numberValue(account.budgetPercent).toFixed(1) + "%</div></div></div><strong>" + (pct == null ? "" : pct.toFixed(0) + "%") + "</strong></div>" + body + "</div>"; }
function empty(title, desc, action, emoji) {
  return "<div class=\"empty empty-card\"><div class=\"empty-emoji\">" + esc(emoji || "🧾") + "</div><div class=\"empty-title\">" + esc(title || "暂无数据") + "</div>" + (desc ? "<div class=\"empty-desc\">" + esc(desc) + "</div>" : "") + (action ? "<div class=\"empty-action\">" + esc(action) + "</div>" : "") + "</div>";
}
function meta(items) { return items.map(function (x) { return "<div class=\"row-meta\">" + esc(x) + "</div>"; }).join(""); }
function pill(label, value) { return "<span class=\"summary-pill\">" + esc(label) + " <strong>" + esc(value) + "</strong></span>"; }

