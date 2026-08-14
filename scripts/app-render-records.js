function recordList(records, type) {
  if (!records.length) {
    if (arguments[2]) return empty("没有找到匹配记录。", "换一个金额、类别、账户或备注关键词试试。", "", "⌕");
    if (type === "income") return empty("这个月还没有记录收入。", "先记下第一笔收入，让系统知道这个月的起点。", "", "🪙");
    if (type === "expense") return empty("这个月还没有花销记录。", "还没有支出记录，这个月的边界还很干净。", "", "🧺");
    return empty("这个月还没有投资记录。", "还没有投资记录，给未来自己的第一笔钱可以从这里开始。", "", "📈");
  }
  return records.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (item) {
    var title = "", details = "", amountClass = "";
    if (type === "income") { title = item.source; details = meta(["到账账户：" + moneyAccountName(item.moneyAccountId), "收入归属：" + fundingAccountName(item.accountId), "日期：" + item.date, "备注：" + (item.note || "无")]); amountClass = "positive"; }
    else if (type === "expense") { title = accountName(item.accountId); details = meta(["付款账户：" + (item.moneyAccountId ? moneyAccountName(item.moneyAccountId) : fundingAccountName(item.sourceAccountId)), "资金池：" + accountName(item.accountId), "类别：" + item.category, "日期：" + item.date, "备注：" + (item.note || "无")]); amountClass = "negative"; }
    else { title = accountName(item.accountId); details = meta(["付款账户：" + (item.sourceMoneyAccountId ? moneyAccountName(item.sourceMoneyAccountId) : fundingAccountName(item.sourceAccountId)), "投资账户：" + moneyAccountName(item.targetMoneyAccountId), "投资策略：" + accountName(item.accountId), "类型：" + item.type, "产品：" + (item.product || "无"), "日期：" + item.date, "备注：" + (item.note || "无")]); amountClass = item.type === "转出" ? "negative" : "positive"; }
    return "<div class=\"record-card\"><div class=\"row-title\"><span>" + esc(title) + "</span><span class=\"badge\">" + esc(type === "income" ? "收入" : (type === "expense" ? item.category : item.type)) + "</span></div><div class=\"row-amount " + amountClass + "\">" + (type === "expense" || item.type === "转出" ? "-" : "+") + money(item.amount) + "</div>" + details + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"duplicate\" data-type=\"" + esc(type) + "\" data-id=\"" + esc(item.id) + "\">再记一笔</button><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"" + esc(type) + "\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"" + esc(type) + "\" data-id=\"" + esc(item.id) + "\">删除</button></div></div>";
  }).join("");
}
function renderMonthlyPlanForm() { var month = currentMonth(), plan = monthlyPlan(month); byId("planMonth").value = month; byId("plannedIncome").value = plan.hasPlannedIncome ? plan.plannedIncome : ""; byId("plannedPayday").value = plan.payday || 15; }
function renderIncome() {
  var month = currentMonth(), allRecords = state.incomes.filter(function (item) { return item.month === month; }), records = filterFlowRecords(allRecords, "income"), total = sum(records, function (item) { return item.amount; }), monthTotal = sum(allRecords, function (item) { return item.amount; }), plan = monthlyPlan(month);
  renderMonthlyPlanForm();
  byId("incomeModuleSummary").innerHTML = pill("本月记录", allRecords.length + " 条") + pill("实际收入", money(monthTotal)) + pill("计划收入", plan.hasPlannedIncome ? money(plan.plannedIncome) : "未填写");
  if (!plan.hasPlannedIncome) byId("incomeModuleSummary").innerHTML += "<span class=\"summary-pill warning\">请先填写本月计划收入，系统才能计算预算金额。</span><span class=\"summary-pill\">去填写计划收入</span>";
  byId("incomeSummary").textContent = flowRecordSummary(allRecords, records, total, "合计");
  byId("incomeList").innerHTML = recordList(records, "income", !!flowRecordSearch);

  var year = month.slice(0, 4), months = Array.from({ length: 12 }, function (_, i) { return i + 1; });
  var rows = months.map(function (m) {
    var key = year + "-" + String(m).padStart(2, "0");
    var monthRecs = state.incomes.filter(function (x) { return x.month === key; });
    var actual = sum(monthRecs, function (x) { return x.amount; });
    var mPlan = monthlyPlan(key);
    var planned = mPlan.hasPlannedIncome ? mPlan.plannedIncome : null;
    var ratio = planned && planned > 0 ? actual / planned : null;
    var status = planned == null ? "未设计划" : (ratio >= 0.9 ? "已到账" : "未到账");
    return { key: key, month: m, actual: actual, planned: planned, ratio: ratio, count: monthRecs.length, status: status };
  });
  var maxVal = Math.max(1, Math.max.apply(null, rows.map(function (r) { return Math.max(r.actual, r.planned || 0); })));
  var yearActual = sum(rows, function (r) { return r.actual; });
  var yearPlanned = sum(rows, function (r) { return r.planned || 0; });
  var yearRatio = yearPlanned > 0 ? yearActual / yearPlanned * 100 : null;
  byId("incomeYearChart").innerHTML =
    "<div class=\"income-year-head\"><h2>" + year + " 年度收入柱状图</h2><div class=\"income-year-meta\">"
    + "<span>年度实际收入 " + money(yearActual) + "</span>"
    + "<span>年度计划收入 " + (yearPlanned > 0 ? money(yearPlanned) : "未设置") + "</span>"
    + "<span>年度到账完成率 " + (yearRatio == null ? "--" : yearRatio.toFixed(1) + "%") + "</span>"
    + "</div></div>"
    + "<div class=\"income-bars-scroll\"><div class=\"income-bars\">"
    + rows.map(function (r) {
      var h = Math.max(4, r.actual / maxVal * 100);
      var c = r.planned == null ? "none-plan" : (r.actual < r.planned ? "below-plan" : "ok-plan");
      return "<div class=\"income-bar-item\"><div class=\"income-tooltip\"><div>实际收入：" + money(r.actual) + "</div><div>计划收入：" + (r.planned == null ? "未设置" : money(r.planned)) + "</div><div>到账比例：" + (r.ratio == null ? "--" : (r.ratio * 100).toFixed(1) + "%") + "</div><div>收入笔数：" + r.count + "</div></div><div class=\"income-bar-wrap\"><div class=\"income-plan-line\" style=\"height:" + (r.planned == null ? 0 : Math.max(2, r.planned / maxVal * 100)) + "%\"></div><div class=\"income-bar " + c + "\" style=\"height:" + h.toFixed(1) + "%\"></div></div><div class=\"income-bar-amount\">" + (r.actual > 0 ? Math.round(r.actual).toLocaleString("zh-CN") : "0") + "</div><div class=\"income-bar-label\">" + r.month + "月</div><div class=\"income-bar-status " + (r.status === "已到账" ? "positive" : (r.status === "未到账" ? "negative" : "warning")) + "\">" + r.status + "</div></div>";
    }).join("")
    + "</div></div>";
}
function renderAccounts() {
  renderMoneyAccounts();
  renderReconciliations();
  renderUnlinkedMoneyRecords();
  renderAllocations();
  var status = budgetPercentMessage(), month = currentMonth(), plan = monthlyPlan(month), budgetTotal = plan.hasPlannedIncome ? sum(state.accounts, function (item) { return item.includeExpense && !item.archived ? accountBudgetAmount(item, month) : 0; }) : null;
  if (byId("budgetPercentSummary")) { byId("budgetPercentSummary").textContent = status.text; byId("budgetPercentSummary").className = "notice " + status.className; }
  if (byId("accountModuleSummary")) byId("accountModuleSummary").innerHTML = pill("资金池", state.accounts.filter(function (a) { return !a.archived; }).length + " 个") + pill("计划比例", totalBudgetPercent().toFixed(1) + "%") + pill("消费预算", budgetTotal == null ? "待填写计划收入" : money(budgetTotal));

  var displayAccounts = state.accounts.filter(function (account) { return !account.archived; });
  var idxEmergency = displayAccounts.findIndex(function (a) { return a.name === "应急金"; });
  var idxFree = displayAccounts.findIndex(function (a) { return a.name === "娱乐消费"; });
  if (idxEmergency >= 0 && idxFree >= 0) {
    var temp = displayAccounts[idxEmergency];
    displayAccounts[idxEmergency] = displayAccounts[idxFree];
    displayAccounts[idxFree] = temp;
  }
  var accountOverview = byId("accountOverview");
  if (!accountOverview) return;
  accountOverview.innerHTML = displayAccounts.length ? displayAccounts.map(function (account) {
    var spent = monthlyExpense(account.id, month), balance = accountBalance(account, month), target = numberValue(account.target), budget = accountBudgetAmount(account, month), hasBudget = budget != null;
    var invested = monthlyInvestment(account.id, month);
    var remain = hasBudget ? Math.max(0, budget - spent) : null;
    var assetValue = account.includeAsset ? accountAssetValueForMonth(account, month).value : balance;
    var progressLabel = "本月投入", progressPct = 0, progressText = "待填写计划收入", primaryLabel = "本月投入", primaryValue = hasBudget ? money(invested) : "待计划";
    var detailItems = [];
    if (account.includeExpense) {
      primaryLabel = "剩余额度";
      primaryValue = hasBudget ? money(remain) : "待计划";
      progressLabel = "预算使用";
      progressPct = hasBudget && budget > 0 ? Math.min(100, spent / budget * 100) : 0;
      progressText = hasBudget && budget > 0 ? (money(spent) + " / " + money(budget)) : "待填写计划收入";
      detailItems = [
        { label: "预算比例", value: numberValue(account.budgetPercent).toFixed(1) + "%" },
        { label: "本月预算", value: hasBudget ? money(budget) : "待计划" },
        { label: "已使用", value: money(spent) }
      ];
    } else if (target > 0) {
      progressLabel = "目标进度";
      progressPct = Math.min(100, assetValue / target * 100);
      progressText = money(assetValue) + " / " + money(target);
      primaryLabel = "距离目标";
      primaryValue = money(Math.max(0, target - assetValue));
      detailItems = [
        { label: "当前资产", value: money(assetValue) },
        { label: "目标金额", value: money(target) },
        { label: "本月投入", value: money(invested) }
      ];
    } else {
      progressPct = hasBudget && budget > 0 ? Math.min(100, invested / budget * 100) : 0;
      progressText = hasBudget && budget > 0 ? (money(invested) + " / " + money(budget)) : "待填写计划收入";
      detailItems = [
        { label: "预算比例", value: numberValue(account.budgetPercent).toFixed(1) + "%" },
        { label: "计划投入", value: hasBudget ? money(budget) : "待计划" },
        { label: "当前资产", value: money(assetValue) }
      ];
    }
    var role = accountRole(account);
    var statusItem = accountStatus(account, month);
    var tip = account.note || role.tip || "按你的节奏稳步推进";
    var metricHtml = detailItems.map(function (item) {
      return "<div class=\"metric-item\"><span>" + esc(item.label) + "</span><strong>" + esc(item.value) + "</strong></div>";
    }).join("");
    var cardMode = account.includeExpense ? "expense" : "asset";
    return "<article class=\"account-card role-account-card role-card-" + cardMode + "\" style=\"--account-color:" + esc(role.color || "#B9A898") + "\">"
      + "<div class=\"role-card-head\">"
      + "<div class=\"role-title\">"
      + "<div class=\"role-icon\">" + esc(role.emoji || "📦") + "</div>"
      + "<div><h3>" + esc(account.name) + "</h3><p>" + esc(account.type) + "</p></div>"
      + "</div>"
      + "<span class=\"status-pill " + esc(statusItem.className || "") + "\">" + esc(statusItem.text) + "</span>"
      + "</div>"
      + "<p class=\"role-desc\">" + esc(role.desc || "自定义资金模块") + "</p>"
      + "<div class=\"role-primary\"><span>" + esc(primaryLabel) + "</span><strong>" + esc(primaryValue) + "</strong></div>"
      + "<div class=\"role-metrics compact\">"
      + metricHtml
      + "</div>"
      + "<div class=\"role-progress-label\"><span>" + esc(progressLabel) + "</span><strong>" + esc(progressText) + "</strong></div>"
      + "<div class=\"progress role-progress\"><span style=\"width:" + progressPct + "%\"></span></div>"
      + "<div class=\"role-tip\">" + esc(account.note || tip) + "</div>"
      + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"account\" data-id=\"" + esc(account.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"account\" data-id=\"" + esc(account.id) + "\">删除</button></div>"
      + "</article>";
  }).join("") : empty("还没有账户。", "先建立几个资金账户，比如日常开支、应急金、娱乐消费。", "", "🧱");
}
function renderMoneyAccounts() {
  if (!byId("moneyAccountList")) return;
  var month = currentMonth(), active = (state.moneyAccounts || []).filter(function (item) { return !item.archived; });
  var total = sum(active, function (item) { return moneyAccountBalance(item, month); });
  byId("moneyAccountSummary").innerHTML = pill("实际账户", active.length + " 个") + pill("账面余额合计", money(total)) + (active.length ? "<span class=\"summary-pill warning\">总额以已录入账户为准；遗漏账户会使净资产偏低。</span>" : "<span class=\"summary-pill warning\">先添加银行卡、支付宝或现金账户，系统才会按真实位置计算金融资产。</span>");
  byId("moneyAccountList").innerHTML = active.length ? active.map(function (item) {
    var balance = moneyAccountBalance(item, month);
    var count = state.incomes.filter(function (x) { return x.moneyAccountId === item.id; }).length + state.expenses.filter(function (x) { return x.moneyAccountId === item.id; }).length + state.investments.filter(function (x) { return x.sourceMoneyAccountId === item.id || x.targetMoneyAccountId === item.id; }).length + state.transfers.filter(function (x) { return x.fromMoneyAccountId === item.id || x.toMoneyAccountId === item.id; }).length + state.reconciliations.filter(function (x) { return x.moneyAccountId === item.id; }).length;
    return "<article class=\"account-card role-account-card role-card-asset\"><div class=\"role-card-head\"><div class=\"role-title\"><div class=\"role-icon\">" + (item.type === "银行卡" ? "🏦" : (item.type === "支付账户" ? "📱" : (item.type === "投资账户" ? "📈" : "💵"))) + "</div><div><h3>" + esc(item.name) + "</h3><p>" + esc(item.type) + "</p></div></div><span class=\"status-pill\">" + count + " 笔流水</span></div><div class=\"role-primary\"><span>账面余额</span><strong class=\"" + (balance >= 0 ? "positive" : "negative") + "\">" + money(balance) + "</strong></div><div class=\"role-metrics compact\"><div class=\"metric-item\"><span>期初余额</span><strong>" + money(item.openingBalance) + "</strong></div><div class=\"metric-item\"><span>期初日期</span><strong>" + esc(item.openingBalanceDate || "未填写") + "</strong></div></div><div class=\"role-tip\">" + esc(item.note || "这里记录钱实际存放的位置") + "</div><div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"moneyAccount\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"moneyAccount\" data-id=\"" + esc(item.id) + "\">删除</button></div></article>";
  }).join("") : empty("还没有实际资金账户。", "先录入银行卡、支付宝、现金或投资平台，以及开始记账前的余额。", "", "🏦");
}
function renderReconciliations() {
  if (!byId("reconciliationList")) return;
  var records = (state.reconciliations || []).filter(function (item) { return item.month === currentMonth(); }).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  byId("reconciliationList").innerHTML = records.length ? records.map(function (item) {
    var adjustmentText = (item.adjustment >= 0 ? "+" : "-") + money(Math.abs(item.adjustment));
    return "<div class=\"record-card\"><div class=\"row-title\"><span>" + esc(moneyAccountName(item.moneyAccountId)) + "</span><span class=\"badge\">余额核对</span></div><div class=\"row-amount " + (item.adjustment >= 0 ? "positive" : "negative") + "\">" + esc(adjustmentText) + "</div>" + meta(["日期：" + item.date, "核对前：" + money(item.bookBalance), "实际余额：" + money(item.actualBalance), "备注：" + (item.note || "无")]) + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"reconciliation\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"reconciliation\" data-id=\"" + esc(item.id) + "\">删除</button></div></div>";
  }).join("") : empty("本月还没有余额核对。", "建议定期按银行或投资平台显示的余额核对一次。", "", "✓");
}
function unlinkedMoneyRecords() {
  var rows = [];
  state.incomes.forEach(function (item) { if (!item.moneyAccountId) rows.push({ type: "income", item: item }); });
  state.expenses.forEach(function (item) { if (!item.moneyAccountId) rows.push({ type: "expense", item: item }); });
  state.investments.forEach(function (item) { if (!item.sourceMoneyAccountId || !item.targetMoneyAccountId) rows.push({ type: "investment", item: item }); });
  state.transfers.forEach(function (item) { if (!item.fromMoneyAccountId || !item.toMoneyAccountId) rows.push({ type: "transfer", item: item }); });
  return rows.sort(function (a, b) { return String(b.item.date).localeCompare(String(a.item.date)); });
}
function renderUnlinkedMoneyRecords() {
  if (!byId("unlinkedMoneyList")) return;
  var rows = unlinkedMoneyRecords(), visible = rows.slice(0, 100), active = (state.moneyAccounts || []).filter(function (item) { return !item.archived; });
  byId("unlinkedMoneySummary").innerHTML = pill("待补流水", rows.length + " 条") + (rows.length > visible.length ? pill("当前显示", visible.length + " 条") : "");
  if (!active.length) { byId("unlinkedMoneyList").innerHTML = empty("需要先建立实际账户。", "建立银行卡、支付账户或投资平台后，再回来补齐历史流水。", "", "🏦"); return; }
  byId("unlinkedMoneyList").innerHTML = visible.length ? visible.map(function (row) {
    var item = row.item, title = row.type === "income" ? "收入 · " + item.source : (row.type === "expense" ? "支出 · " + item.category : (row.type === "investment" ? item.type + " · " + (item.product || accountName(item.accountId)) : "账户转账"));
    var selects = "";
    if (row.type === "income" || row.type === "expense") selects = "<div class=\"field\"><label>实际账户</label><select id=\"repair-" + row.type + "-" + esc(item.id) + "\">" + moneyAccountOptions("", true) + "</select></div>";
    if (row.type === "investment") selects = "<div class=\"field\"><label>转出账户</label><select id=\"repair-investment-from-" + esc(item.id) + "\">" + moneyAccountOptions(item.sourceMoneyAccountId || "", true) + "</select></div><div class=\"field\"><label>转入账户</label><select id=\"repair-investment-to-" + esc(item.id) + "\">" + moneyAccountOptions(item.targetMoneyAccountId || "", true) + "</select></div>";
    if (row.type === "transfer") selects = "<div class=\"field\"><label>转出账户</label><select id=\"repair-transfer-from-" + esc(item.id) + "\">" + moneyAccountOptions(item.fromMoneyAccountId || "", true) + "</select></div><div class=\"field\"><label>转入账户</label><select id=\"repair-transfer-to-" + esc(item.id) + "\">" + moneyAccountOptions(item.toMoneyAccountId || "", true) + "</select></div>";
    return "<div class=\"record-card repair-card\"><div class=\"row-title\"><span>" + esc(title) + "</span><span class=\"badge warning\">待补账户</span></div><div class=\"row-amount\">" + money(item.amount) + "</div>" + meta(["日期：" + item.date, "备注：" + (item.note || "无")]) + "<div class=\"form-grid repair-grid\">" + selects + "</div><div class=\"row-actions\"><button class=\"btn small primary\" data-action=\"link-money-account\" data-type=\"" + row.type + "\" data-id=\"" + esc(item.id) + "\">保存关联</button></div></div>";
  }).join("") : empty("历史流水都已补齐实际账户。", "以后新增流水会在已建立真实账户时强制选择。", "", "✓");
}
function renderAllocations() {
  if (!byId("allocationList")) return;
  var records = (state.allocations || []).filter(function (item) { return item.month === currentMonth(); }).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  byId("allocationList").innerHTML = records.length ? records.map(function (item) {
    return "<div class=\"record-card\"><div class=\"row-title\"><span>" + esc(item.fromAccountId ? accountName(item.fromAccountId) : "待分配资金") + " → " + esc(accountName(item.toAccountId)) + "</span><span class=\"badge\">用途调整</span></div><div class=\"row-amount\">" + money(item.amount) + "</div>" + meta(["日期：" + item.date, "备注：" + (item.note || "无"), "不影响实际账户和净资产"]) + "<div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"allocation\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"allocation\" data-id=\"" + esc(item.id) + "\">删除</button></div></div>";
  }).join("") : empty("本月还没有调整资金用途。", "需要时可以把待分配资金转入应急金、备用现金等资金池。", "", "⇄");
}
function renderExpenses(ctx) {
  var month = currentMonth(), allRecords = state.expenses.filter(function (item) { return item.month === month; }), records = filterFlowRecords(allRecords, "expense"), total = sum(records, function (item) { return item.amount; }), monthTotal = sum(allRecords, function (item) { return item.amount; });
  var renderCtx = ctx && ctx.month === month ? ctx : getRenderContext(month);
  var s = renderCtx.summary;
  byId("expenseModuleSummary").innerHTML = pill("本月记录", allRecords.length + " 条") + pill("支出合计", money(monthTotal)) + pill("预算状态", s.overBudget ? "已超支" : "正常");
  if (s.orphanExpenseCount > 0) byId("expenseModuleSummary").innerHTML += "<span class=\"summary-pill warning\">发现 " + s.orphanExpenseCount + " 条孤立支出（" + money(s.orphanExpenseTotal) + "），已计入总支出，需修复分类账户。</span>";
  byId("expenseSummary").textContent = flowRecordSummary(allRecords, records, total, "合计");
  byId("expenseList").innerHTML = recordList(records, "expense", !!flowRecordSearch);

  var switchEl = byId("expenseViewSwitch");
  if (switchEl) switchEl.querySelectorAll("[data-view-mode]").forEach(function (btn) { btn.classList.toggle("active", btn.dataset.viewMode === expenseViewMode); });
  byId("expenseListWrap").style.display = expenseViewMode === "list" ? "" : "none";
  byId("expenseCalendarWrap").style.display = expenseViewMode === "calendar" ? "" : "none";

  if (expenseViewMode !== "calendar") return;
  var dateMap = {};
  records.forEach(function (item) {
    if (!dateMap[item.date]) dateMap[item.date] = { total: 0, items: [] };
    dateMap[item.date].total += numberValue(item.amount);
    dateMap[item.date].items.push(item);
  });
  var year = parseInt(month.slice(0, 4), 10), mon = parseInt(month.slice(5, 7), 10), first = new Date(year, mon - 1, 1), days = new Date(year, mon, 0).getDate();
  var offset = first.getDay(), cells = [];
  var dateKeys = Object.keys(dateMap);
  var maxTotal = dateKeys.length ? Math.max.apply(null, dateKeys.map(function (d) { return dateMap[d].total; })) : 0;
  var displayDate = selectedExpenseDate && dateMap[selectedExpenseDate] ? selectedExpenseDate : (dateKeys[0] || "");
  for (var i = 0; i < offset; i++) cells.push("<div class=\"cal-day empty-day\"></div>");
  for (var d = 1; d <= days; d++) {
    var dateStr = year + "-" + String(mon).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    var dayData = dateMap[dateStr], totalDay = dayData ? dayData.total : 0;
    var ratio = maxTotal > 0 ? totalDay / maxTotal : 0;
    var todayFlag = dateStr === today();
    var summaries = dayData ? dayData.items.slice(0, 2).map(function (x) { return esc((x.category || accountName(x.accountId)) + " " + money(x.amount)); }).join("<br>") : "";
    var extra = dayData && dayData.items.length > 2 ? "<div class=\"cal-extra\">+" + (dayData.items.length - 2) + "</div>" : "";
    cells.push("<button type=\"button\" class=\"cal-day" + (dayData ? " has-expense" : "") + (todayFlag ? " is-today" : "") + (displayDate === dateStr ? " is-selected" : "") + "\" data-action=\"open-expense-day\" data-date=\"" + dateStr + "\" style=\"--heat:" + ratio.toFixed(2) + "\"><div class=\"cal-date\">" + d + "</div><div class=\"cal-amount\">" + (dayData ? money(totalDay) : "") + "</div><div class=\"cal-summary\">" + summaries + "</div>" + extra + "</button>");
  }
  while (cells.length % 7 !== 0) cells.push("<div class=\"cal-day empty-day\"></div>");
  var selectedDateForRender = displayDate;
  var detailHtml = "";
  if (selectedDateForRender && dateMap[selectedDateForRender]) {
    detailHtml = "<div class=\"calendar-detail\"><div class=\"section-title compact\"><div><h2>" + selectedDateForRender + " 支出明细</h2></div></div><div class=\"card-grid\">"
      + dateMap[selectedDateForRender].items.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (item) {
        return "<div class=\"record-card\"><div class=\"row-title\"><span>" + esc(accountName(item.accountId)) + "</span><span class=\"badge\">" + esc(item.category) + "</span></div><div class=\"row-amount negative\">-" + money(item.amount) + "</div><div class=\"row-meta\">备注：" + esc(item.note || "无") + "</div><div class=\"row-actions\"><button class=\"btn small ghost\" data-action=\"edit\" data-type=\"expense\" data-id=\"" + esc(item.id) + "\">编辑</button><button class=\"btn small danger\" data-action=\"delete\" data-type=\"expense\" data-id=\"" + esc(item.id) + "\">删除</button></div></div>";
      }).join("") + "</div></div>";
  } else {
    detailHtml = "<div class=\"calendar-detail\">" + empty("还没选中有支出的日期。", "点击日历中的日期格查看当天明细。", "", "🗓️") + "</div>";
  }
  byId("expenseCalendarWrap").innerHTML = "<div class=\"calendar-card\"><div class=\"calendar-weekdays\"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class=\"calendar-grid\">" + cells.join("") + "</div></div>" + detailHtml;
}
