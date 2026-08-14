"use strict";

function renderInvestments(ctx) {
  var month = currentMonth();
  var renderCtx = ctx && ctx.month === month ? ctx : getRenderContext(month);
  var records = state.investments.filter(function (item) { return item.month === month; });
  var net = sum(records, function (item) { return item.type === "转出" ? -item.amount : item.amount; });
  var inTotal = sum(records, function (item) { return item.type === "转出" ? 0 : item.amount; });

  // Layer 1: Cockpit
  var snap = renderCtx.snapshot;
  byId("investCockpitValue").textContent = money(snap.performanceAsset);
  byId("investCockpitPrincipal").textContent = money(snap.performancePrincipal);
  byId("investCockpitPnl").textContent = money(snap.pnl);
  byId("investCockpitPnl").className = snap.pnl >= 0 ? "positive" : "negative";
  byId("investCockpitRoi").textContent = snap.roi != null ? (snap.roi >= 0 ? "+" : "") + snap.roi.toFixed(2) + "%" : "--";
  byId("investCockpitRoi").className = (snap.roi || 0) >= 0 ? "positive" : "negative";
  byId("investStatNetIn").textContent = money(net);
  byId("investStatMonthChange").textContent = snap.monthChange != null ? money(snap.monthChange) : "快照不足";
  byId("investStatMonthChange").className = (snap.monthChange || 0) >= 0 ? "positive" : (snap.monthChange != null ? "negative" : "warning");

  // Layer 2: Portfolio cards
  var assetAccounts = state.accounts.filter(function (a) { return a.includeAsset && !a.archived && a.valuationMethod === "净值快照"; });
  var lastDates = [];
  byId("investStatAccountCount").textContent = assetAccounts.length + " 个";
  byId("investPortfolioSummary").textContent = assetAccounts.length + " 个净值账户 · 总市值 " + money(snap.performanceAsset);

  byId("investPortfolioGrid").innerHTML = assetAccounts.length ? assetAccounts.map(function (account) {
    var av = accountAssetValueForMonth(account, month);
    var latestSnap = latestSnapshotForAccount(account.id);
    if (latestSnap) lastDates.push(latestSnap.date);
    var monthlyInv = monthlyInvestment(account.id, month);
    var cardPnl = av.value - av.principal;
    var cardRoi = av.principal > 0 ? (cardPnl / av.principal * 100) : null;
    var role = accountRole(account);
    var hasSnapshot = av.source === "snapshot";
    return "<div class=\"invest-portfolio-card\" style=\"--account-color:" + esc(role.color || "#B9A898") + "\">"
      + "<div class=\"ip-card-top\">"
      + "<div class=\"ip-card-emoji\">" + esc(role.emoji || "📦") + "</div>"
      + "<div class=\"ip-card-title\"><h3>" + esc(account.name) + "</h3><p>" + esc(account.type) + "</p></div>"
      + (hasSnapshot ? "<span class=\"ip-card-badge ok\">已更新</span>" : "<span class=\"ip-card-badge stale\">待更新净值</span>")
      + "</div>"
      + "<div class=\"ip-card-hero\"><span>当前市值</span><strong>" + money(av.value) + "</strong></div>"
      + "<div class=\"ip-card-metrics\">"
      + "<div><span>累计本金</span><strong>" + money(av.principal) + "</strong></div>"
      + "<div><span>浮动盈亏</span><strong class=\"" + (cardPnl >= 0 ? "positive" : "negative") + "\">" + money(cardPnl) + "</strong></div>"
      + "<div><span>收益率</span><strong class=\"" + ((cardRoi || 0) >= 0 ? "positive" : "negative") + "\">" + (cardRoi != null ? (cardRoi >= 0 ? "+" : "") + cardRoi.toFixed(2) + "%" : "--") + "</strong></div>"
      + "<div><span>本月变化</span><strong class=\"" + (monthlyInv >= 0 ? "positive" : "negative") + "\">" + money(monthlyInv) + "</strong></div>"
      + "</div>"
      + "<div class=\"ip-card-foot\"><span>" + (hasSnapshot ? "最近更新：" + av.snapshotDate : "暂无净值快照") + "</span></div>"
      + "</div>";
  }).join("") : empty("还没有投资资金池。", "在「账户与分配」页配置长期投资或高风险投资资金池，这里就会出现策略卡片。", "", "📊");

  // Layer 3: actions hint
  if (lastDates.length) {
    lastDates.sort();
    byId("investStatLastUpdate").textContent = lastDates[lastDates.length - 1];
    byId("investActionsHint").textContent = "最近更新 " + lastDates[lastDates.length - 1] + " · 定期更新净值，追踪投资真实表现";
  } else {
    byId("investStatLastUpdate").textContent = "暂无";
    byId("investActionsHint").textContent = "还没有净值记录，完成首次更新后开启投资仪表盘";
  }

  // Right-side mini stats
  var accountsWithSnap = assetAccounts.filter(function(a) {
    return latestSnapshotForAccount(a.id) !== null;
  }).length;
  byId("investRightStats").innerHTML =
    "<div class=\"invest-right-stat\"><span>总市值</span><strong>" + money(snap.performanceAsset) + "</strong></div>" +
    "<div class=\"invest-right-stat\"><span>总本金</span><strong>" + money(snap.performancePrincipal) + "</strong></div>" +
    "<div class=\"invest-right-stat\"><span>盈亏</span><strong class=\"" + (snap.pnl >= 0 ? "positive" : "negative") + "\">" + money(snap.pnl) + "</strong></div>" +
    "<div class=\"invest-right-stat\"><span>收益率</span><strong class=\"" + ((snap.roi || 0) >= 0 ? "positive" : "negative") + "\">" + (snap.roi != null ? (snap.roi >= 0 ? "+" : "") + snap.roi.toFixed(2) + "%" : "--") + "</strong></div>" +
    "<div class=\"invest-right-stat\"><span>已更新账户</span><strong>" + accountsWithSnap + "/" + assetAccounts.length + "</strong></div>";

  // Layer 4: Records
  byId("investmentModuleSummary").innerHTML = pill("本月记录", records.length + " 条") + pill("转入/储蓄/投资", money(inTotal)) + pill("净额", money(net));
  byId("investmentSummary").textContent = month + " 共 " + records.length + " 条，净额 " + money(net);
  byId("investmentList").innerHTML = recordList(records, "investment", false);
  renderTransfers(month);
}

function renderTransfers(month) {
  var records = (state.transfers || []).filter(function (item) { return item.month === month; });
  var total = sum(records, function (item) { return item.amount; });
  if (byId("transferSummary")) byId("transferSummary").textContent = (state.moneyAccounts || []).filter(function (item) { return !item.archived; }).length < 2 ? "至少建立两个实际账户后，才能记录账户之间的移动" : month + " 共 " + records.length + " 笔内部调拨，合计 " + money(total) + "，不影响净资产";
  if (!byId("transferList")) return;
  byId("transferList").innerHTML = records.length ? records.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (item) {
    var fromName = item.fromMoneyAccountId ? moneyAccountName(item.fromMoneyAccountId) : accountName(item.fromAccountId);
    var toName = item.toMoneyAccountId ? moneyAccountName(item.toMoneyAccountId) : accountName(item.toAccountId);
    return "<div class=\"record-card\"><div class=\"row-title\"><span>" + esc(fromName) + " → " + esc(toName) + "</span><span class=\"badge\">实际账户转账</span></div><div class=\"row-amount\">" + money(item.amount) + "</div>" + meta(["日期：" + item.date, "资金用途不变", "备注：" + (item.note || "无")]) + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"transfer\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"transfer\" data-id=\"" + esc(item.id) + "\">删除</button></div></div>";
  }).join("") : empty("本月没有账户间转账。", "账户内部调拨应记录在这里，不要记成收入或支出。", "", "↔");
}
