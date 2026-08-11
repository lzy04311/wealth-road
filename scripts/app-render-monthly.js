function renderMonthly(ctx) {
  var month = currentMonth();
  var renderCtx = ctx && ctx.month === month ? ctx : getRenderContext(month);
  var s = renderCtx.summary, ratio = s.hasPlannedIncome && s.plannedIncome > 0 ? s.income / s.plannedIncome : null, snap = renderCtx.snapshot;
  var salaryStatus = !s.hasPlannedIncome ? "等待填写计划收入" : (ratio >= 0.9 ? "工资已到账" : "等待工资到账");
  var systemStatus = !s.hasPlannedIncome ? "计划收入未填写" : (s.overBudget ? "本月有超支" : (s.surplus < 0 ? "现金流为负" : (s.surplus > 0 ? "现金流健康" : "持续观察")));
  var summaryText = !s.hasPlannedIncome
    ? "请先填写本月计划收入，预算系统才能完整运行。"
    : (s.overBudget
      ? "本月花销偏高，建议检查娱乐消费和日常开支。"
      : (s.surplus < 0 ? "本月现金流为负，需要检查投入节奏和支出结构。" : (s.surplus > 0 ? "这个月系统运行平稳，继续保持。" : "本月数据还不完整，继续记录后再判断。")));

  byId("monthlyReportTitle").textContent = month + " 月度资金报告";
  byId("monthlyReportStatus").textContent = systemStatus;
  byId("monthlyReportStatus").className = "status-pill " + (!s.hasPlannedIncome ? "warning" : (s.overBudget || s.surplus < 0 ? "negative" : (s.surplus > 0 ? "positive" : "")));
  byId("mrIncome").textContent = money(s.income);
  byId("mrExpense").textContent = money(s.expense);
  byId("mrInvestment").textContent = money(s.investment);
  byId("mrSurplus").textContent = money(s.surplus);
  byId("mrSurplus").className = s.surplus >= 0 ? "positive" : "negative";
  byId("mrAsset").textContent = money(snap.totalAsset);
  if (byId("mrAsset") && byId("mrAsset").parentElement && byId("mrAsset").parentElement.querySelector("span")) byId("mrAsset").parentElement.querySelector("span").textContent = "月末当前市值";
  byId("mrSalary").textContent = salaryStatus;
  byId("mrSalary").className = !s.hasPlannedIncome ? "warning" : (ratio >= 0.9 ? "positive" : "warning");
  byId("mrSystem").textContent = systemStatus;
  byId("mrSystem").className = !s.hasPlannedIncome ? "warning" : (s.overBudget || s.surplus < 0 ? "negative" : (s.surplus > 0 ? "positive" : ""));
  byId("mrSummary").textContent = summaryText;
  byId("mrSummary").className = "monthly-report-summary " + (!s.hasPlannedIncome ? "warning" : (s.overBudget || s.surplus < 0 ? "negative" : (s.surplus > 0 ? "positive" : "")));
  byId("mrIncomeExec").textContent = "计划收入：" + (s.hasPlannedIncome ? money(s.plannedIncome) : "待填写计划收入") + "｜实际收入：" + money(s.income) + "｜到账比例：" + (ratio == null ? "--" : (ratio * 100).toFixed(1) + "%");
  byId("mrBudgetExec").textContent = "总预算：" + (s.hasPlannedIncome ? money(s.budget) : "待填写计划收入") + "｜总支出：" + money(s.expense) + "｜预算结余：" + (s.hasPlannedIncome ? money(s.budgetBalance) : "待填写计划收入");
  byId("mrAssetExec").textContent = "本月投入/储蓄：" + money(s.investment) + "｜投入净额：" + money(s.assetNet) + "｜当前市值：" + money(snap.totalAsset);

  renderStats("monthlyStats", [{ label: "本月收入总额", value: money(s.income), className: "positive" }, { label: "本月计划收入", value: s.hasPlannedIncome ? money(s.plannedIncome) : "待填写计划收入" }, { label: "总预算", value: s.hasPlannedIncome ? money(s.budget) : "待填写计划收入" }, { label: "总支出", value: money(s.expense), className: s.overBudget ? "negative" : "" }, { label: "总结余", value: money(s.surplus), className: s.surplus >= 0 ? "positive" : "negative" }, { label: "投资/储蓄总额", value: money(s.investment) }, { label: "月末投入净额", value: money(s.assetNet) }, { label: "月末当前市值", value: money(snap.totalAsset), className: "positive" }, { label: "预算结余", value: s.hasPlannedIncome ? money(s.budgetBalance) : "待填写计划收入", className: s.budgetBalance >= 0 ? "positive" : "negative" }]);
  byId("monthlyTable").innerHTML = state.accounts.map(function (account) { var budget = accountBudgetAmount(account, month), used = monthlyExpense(account.id, month), hasBudget = budget != null, balance = hasBudget ? budget - used : null, inv = monthlyInvestment(account.id, month), current = accountBalance(account, month); return "<tr><td>" + esc(account.name) + "</td><td>" + esc(account.type) + "</td><td>" + numberValue(account.budgetPercent).toFixed(1) + "%</td><td>" + esc(hasBudget ? money(budget) : "待填写计划收入") + "</td><td>" + money(used) + "</td><td class=\"" + (!hasBudget || balance >= 0 ? "positive" : "negative") + "\">" + esc(hasBudget ? money(balance) : "待填写计划收入") + "</td><td>" + money(inv) + "</td><td>" + money(current) + "</td></tr>"; }).join("");
  var monthlyCurrentHead = document.querySelector("#flow table thead th:nth-child(8)");
  if (monthlyCurrentHead) monthlyCurrentHead.textContent = "当前金额（投入净额）";
}

function renderGoals() { var month = currentMonth(), targets = state.accounts.filter(function (a) { return numberValue(a.target) > 0; }); byId("goalList").innerHTML = targets.length ? targets.map(function (account) { var current = accountBalance(account, month), target = numberValue(account.target), pct = Math.min(100, current / target * 100), gap = target - current, visual = accountVisual(account); return accountCard(account, visual, pct, "<div class=\"account-mini-grid\"><div class=\"account-mini\"><span>当前金额</span><strong>" + esc(money(current)) + "</strong></div><div class=\"account-mini\"><span>目标金额</span><strong>" + esc(money(target)) + "</strong></div></div><div class=\"progress\"><span style=\"width:" + pct + "%\"></span></div><div class=\"row-meta " + (gap > 0 ? "warning" : "positive") + "\">" + esc(gap > 0 ? "距离目标还差 " + money(gap) : "已完成，超出 " + money(Math.abs(gap))) + "</div>"); }).join("") : empty("还没有设置储蓄目标。", "可以先给「应急金」设置一个目标金额，比如 25000。", "", "🎯"); }

function renderAll() {
  updateMonthText();
  updateSaveStatusUI();
  syncSelects();
  renderContextCache = buildRenderContext(currentMonth());
  renderDashboard(renderContextCache);
  renderAssets();
  renderIncome();
  renderAccounts();
  renderExpenses(renderContextCache);
  renderInvestments(renderContextCache);
  renderMonthly(renderContextCache);
  renderGoals();
  renderFlow(renderContextCache);
  byId("rulesText").value = state.rules;
}
