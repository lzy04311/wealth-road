"use strict";

function resetForm(prefix) { byId(prefix + "Form").reset(); byId(prefix + "Id").value = ""; if (byId(prefix + "Date")) byId(prefix + "Date").value = today(); if (byId(prefix + "Month")) byId(prefix + "Month").value = currentMonth(); var title = byId(prefix + "FormTitle"); if (title) title.textContent = prefix === "snapshot" ? "净值更新" : title.textContent.replace("编辑", "新增"); }
function formCard(prefix) { return byId(prefix + "FormCard"); }
function openForm(prefix) { var card = formCard(prefix); if (card) card.classList.add("open"); if (prefix === "snapshot") { var modal = byId("snapshotModal"); if (modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); } } }
function closeForm(prefix) { var card = formCard(prefix); if (card) card.classList.remove("open"); if (prefix === "snapshot") { var modal = byId("snapshotModal"); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); } } }
function closeQuickModal() {
  var modal = byId("quickModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  activeQuickType = "";
  document.querySelectorAll(".quick-form").forEach(function (form) { form.classList.remove("active"); });
}
function openSnapshotRecords() { var modal = byId("snapshotRecordsModal"); if (!modal) return; renderAssets(); modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); }
function closeSnapshotRecords() { var modal = byId("snapshotRecordsModal"); if (!modal) return; modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
function openQuickEntry(type) {
  var modal = byId("quickModal");
  if (!modal) return;
  var titleMap = { expense: "记一笔花销", income: "记一笔收入", investment: "记一笔投资" };
  var formMap = { expense: "quickFormExpense", income: "quickFormIncome", investment: "quickFormInvestment" };
  var amountMap = { expense: "quickExpenseAmount", income: "quickIncomeAmount", investment: "quickInvestmentAmount" };
  var formId = formMap[type];
  if (!formId) return;
  activeQuickType = type;
  byId("quickModalTitle").textContent = titleMap[type];
  document.querySelectorAll(".quick-form").forEach(function (form) { form.classList.remove("active"); });
  byId(formId).classList.add("active");

  byId("quickIncomeSource").innerHTML = optionHtml(incomeSources, byId("quickIncomeSource").value);
  byId("quickInvestmentType").innerHTML = optionHtml(investmentTypes, byId("quickInvestmentType").value);
  byId("quickExpenseAccount").innerHTML = accountOptions(byId("quickExpenseAccount").value, function (acc) { return acc.includeExpense; });
  byId("quickInvestmentAccount").innerHTML = accountOptions(byId("quickInvestmentAccount").value, function (acc) { return acc.includeAsset || !acc.includeExpense; });

  ["quickIncomeDate", "quickExpenseDate", "quickInvestmentDate"].forEach(function (id) { byId(id).value = today(); });
  ["quickIncomeMonth", "quickExpenseMonth", "quickInvestmentMonth"].forEach(function (id) { byId(id).value = currentMonth(); });

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  var target = byId(amountMap[type]);
  if (target) target.focus();
}
function bindQuickModalSubmit() {
  byId("quickFormIncome").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!upsert(state.incomes, {
      id: uid(),
      date: byId("quickIncomeDate").value,
      month: byId("quickIncomeMonth").value,
      source: byId("quickIncomeSource").value,
      amount: safeAmount(byId("quickIncomeAmount").value),
      note: cleanText(byId("quickIncomeNote").value, MAX_NOTE_LENGTH)
    })) return;
    this.reset();
    closeQuickModal();
    renderAll();
  });
  byId("quickFormExpense").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!upsert(state.expenses, {
      id: uid(),
      date: byId("quickExpenseDate").value,
      month: byId("quickExpenseMonth").value,
      accountId: byId("quickExpenseAccount").value,
      category: cleanText(byId("quickExpenseCategory").value) || "未分类",
      amount: safeAmount(byId("quickExpenseAmount").value),
      note: cleanText(byId("quickExpenseNote").value, MAX_NOTE_LENGTH)
    })) return;
    this.reset();
    closeQuickModal();
    renderAll();
  });
  byId("quickFormInvestment").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!upsert(state.investments, {
      id: uid(),
      date: byId("quickInvestmentDate").value,
      month: byId("quickInvestmentMonth").value,
      accountId: byId("quickInvestmentAccount").value,
      type: byId("quickInvestmentType").value,
      amount: safeAmount(byId("quickInvestmentAmount").value),
      product: cleanText(byId("quickInvestmentProduct").value),
      note: cleanText(byId("quickInvestmentNote").value, MAX_NOTE_LENGTH)
    })) return;
    this.reset();
    closeQuickModal();
    renderAll();
  });
}
function upsert(list, item) {
  var index = list.findIndex(function (row) { return row.id === item.id; });
  var previous = index >= 0 ? list[index] : null;
  if (index >= 0) list[index] = item; else list.push(item);
  if (save()) return true;
  if (index >= 0) list[index] = previous; else list.pop();
  return false;
}
function handleSubmit() {
  byId("incomeForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.incomes, { id: byId("incomeId").value || uid(), date: byId("incomeDate").value, month: byId("incomeMonth").value, source: byId("incomeSource").value, amount: safeAmount(byId("incomeAmount").value), note: cleanText(byId("incomeNote").value, MAX_NOTE_LENGTH) })) return; resetForm("income"); closeForm("income"); renderAll(); });
  byId("accountForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.accounts, { id: byId("accountId").value || uid(), name: cleanText(byId("accountName").value) || "未命名账户", type: byId("accountType").value, budgetPercent: safePercent(byId("accountBudgetPercent").value), fixedBudget: byId("accountFixed").checked, includeExpense: byId("accountExpense").checked, includeAsset: byId("accountAsset").checked, target: safeAmount(byId("accountTarget").value), note: cleanText(byId("accountNote").value, MAX_NOTE_LENGTH) })) return; resetForm("account"); closeForm("account"); renderAll(); });
  byId("expenseForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.expenses, { id: byId("expenseId").value || uid(), date: byId("expenseDate").value, month: byId("expenseMonth").value, accountId: byId("expenseAccount").value, category: cleanText(byId("expenseCategory").value) || "未分类", amount: safeAmount(byId("expenseAmount").value), note: cleanText(byId("expenseNote").value, MAX_NOTE_LENGTH) })) return; resetForm("expense"); closeForm("expense"); renderAll(); });
  byId("investmentForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.investments, { id: byId("investmentId").value || uid(), date: byId("investmentDate").value, month: byId("investmentMonth").value, accountId: byId("investmentAccount").value, type: byId("investmentType").value, amount: safeAmount(byId("investmentAmount").value), product: cleanText(byId("investmentProduct").value), note: cleanText(byId("investmentNote").value, MAX_NOTE_LENGTH) })) return; resetForm("investment"); closeForm("investment"); renderAll(); });
  byId("snapshotForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.snapshots, { id: byId("snapshotId").value || uid(), date: byId("snapshotDate").value, month: byId("snapshotMonth").value, accountId: byId("snapshotAccount").value, marketValue: safeAmount(byId("snapshotMarketValue").value), principal: safeAmount(byId("snapshotPrincipal").value), note: cleanText(byId("snapshotNote").value, MAX_NOTE_LENGTH) })) return; resetForm("snapshot"); closeForm("snapshot"); renderAll(); });
  byId("assetItemForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.assetItems, { id: byId("assetItemId").value || uid(), kind: byId("assetItemKind").value, name: cleanText(byId("assetItemName").value) || "未命名资产", owner: cleanText(byId("assetItemOwner").value), purchasePrice: safeAmount(byId("assetItemPurchasePrice").value), currentValue: safeAmount(byId("assetItemCurrentValue").value), monthlyCost: safeAmount(byId("assetItemMonthlyCost").value), renewalDate: safeOptionalDate(byId("assetItemRenewalDate").value), status: byId("assetItemStatus").value, note: cleanText(byId("assetItemNote").value, MAX_NOTE_LENGTH) })) return; resetForm("assetItem"); closeForm("assetItem"); renderAll(); });
}
function handleHealthDetailClick(event) {
  var healthDetail = event.target.closest("[data-health-detail]");
  if (!healthDetail) return false;
  var type = healthDetail.dataset.healthDetail, modal = byId("healthModal"), body = byId("healthModalBody");
  if (!modal || !body) return true;
  if (type === "score") {
    body.innerHTML = "<h3>评分规则</h3><p>基准 <b>72</b> 分</p><p>未填计划收入 <b>-18</b>｜工资到账 <b>+8</b> / 逾期 <b>-12</b></p><p>超支 <b>-18</b>｜支出&lt;55% <b>+6</b></p><p>负结余 <b>-16</b> / 正结余 <b>+8</b></p><p>无快照 <b>-8</b>｜回撤 <b>-8</b> / 增长 <b>+4</b></p>";
  } else {
    body.innerHTML = "<h3>风险等级</h3><p>≥82 <b>低风险</b></p><p>≥64 <b>可控</b></p><p>≥45 <b>需关注</b></p><p>&lt;45 <b>高风险</b></p>";
  }
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  return true;
}
function setDashboardHomeMode(viewName) {
  document.body.classList.toggle("dashboard-home-mode", viewName === "dashboard");
  document.querySelectorAll(".dashboard-bottom-nav [data-view]").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
}
function handleViewSwitchClick(event) {
  var tab = event.target.closest(".tab");
  if (tab) {
    document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
    document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
    tab.classList.add("active");
    byId(tab.dataset.view).classList.add("active");
    setDashboardHomeMode(tab.dataset.view);
    return true;
  }
  var openViewBtn = event.target.closest("[data-action=\"open-view\"]");
  if (!openViewBtn) return false;
  var targetView = openViewBtn.dataset.view;
  if (!targetView || !byId(targetView)) return true;
  document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
  document.querySelectorAll(".view").forEach(function (x) { x.classList.remove("active"); });
  var targetTab = document.querySelector(".tab[data-view=\"" + targetView + "\"]");
  if (targetTab) targetTab.classList.add("active");
  byId(targetView).classList.add("active");
  setDashboardHomeMode(targetView);
  return true;
}
function handleFormAndModalClick(event) {
  var addBtn = event.target.closest("[data-open-form]");
  if (addBtn) { var p = addBtn.dataset.openForm; resetForm(p); openForm(p); return true; }
  var quick = event.target.closest("[data-quick-action]");
  if (quick) { openQuickEntry(quick.dataset.quickAction); return true; }
  if (event.target.closest("[data-quick-close]")) { closeQuickModal(); var hm = byId("healthModal"); if (hm) { hm.classList.remove("open"); hm.setAttribute("aria-hidden","true"); } return true; }
  if (event.target.closest("[data-snapshot-close]")) { resetForm("snapshot"); closeForm("snapshot"); return true; }
  if (event.target.closest("[data-snapshot-records-close]")) { closeSnapshotRecords(); return true; }
  return false;
}
function handleFeatureToggleClick(event) {
  if (event.target.closest("[data-action=\"set-dashboard-pie\"]")) { dashboardPieMode = event.target.closest("[data-action=\"set-dashboard-pie\"]").dataset.pieMode || "budget"; renderDashboardPies(currentMonth()); return true; }
  if (event.target.closest("[data-action=\"open-snapshot-records\"]")) { openSnapshotRecords(); return true; }
  if (event.target.closest("[data-action=\"set-asset-kind\"]")) { assetKindFilter = event.target.closest("[data-action=\"set-asset-kind\"]").dataset.kind || "全部"; renderAssets(); return true; }
  if (event.target.closest("[data-action=\"set-expense-view\"]")) { expenseViewMode = event.target.closest("[data-action=\"set-expense-view\"]").dataset.viewMode || "list"; renderExpenses(); return true; }
  if (event.target.closest("[data-action=\"open-expense-day\"]")) { selectedExpenseDate = event.target.closest("[data-action=\"open-expense-day\"]").dataset.date || ""; renderExpenses(); return true; }
  if (event.target.closest("[data-action=\"toggle-flow-review\"]")) { toggleFlowReview(); return true; }
  var flowTab = event.target.closest(".flow-tab");
  if (flowTab) { switchFlowTab(flowTab.dataset.flowTab); return true; }
  var flowAdd = event.target.closest("#flowAddRecord");
  if (flowAdd) { openQuickEntry(flowActiveTab); return true; }
  return false;
}
function bindClicks() {
  document.addEventListener("click", function (event) {
    if (handleHealthDetailClick(event)) return;
    if (handleViewSwitchClick(event)) return;
    if (handleFormAndModalClick(event)) return;
    if (handleFeatureToggleClick(event)) return;
    var btn = event.target.closest("[data-action]"); if (!btn) return;
    if (btn.dataset.action === "delete") removeRecord(btn.dataset.type, btn.dataset.id);
    if (btn.dataset.action === "edit") editRecord(btn.dataset.type, btn.dataset.id);
  });
  byId("currentMonth").addEventListener("change", function () { ["income", "expense", "investment", "snapshot"].forEach(function (p) { var el = byId(p + "Month"); if (el && !byId(p + "Id").value) el.value = currentMonth(); }); renderAll(); });
  byId("dashboardDate").addEventListener("change", function () { if (!this.value) return; byId("currentMonth").value = monthOf(this.value); ["income", "expense", "investment", "snapshot"].forEach(function (p) { var el = byId(p + "Month"); if (el && !byId(p + "Id").value) el.value = currentMonth(); }); renderTodayWidget(); renderAll(); });
  ["income", "expense", "investment", "snapshot"].forEach(function (p) { byId(p + "Date").addEventListener("change", function () { if (this.value) byId(p + "Month").value = monthOf(this.value); }); byId("cancel" + p.charAt(0).toUpperCase() + p.slice(1) + "Edit").addEventListener("click", function () { resetForm(p); closeForm(p); }); });
  byId("cancelAccountEdit").addEventListener("click", function () { resetForm("account"); closeForm("account"); });
  byId("cancelAssetItemEdit").addEventListener("click", function () { resetForm("assetItem"); closeForm("assetItem"); });
  byId("saveRules").addEventListener("click", function () { var previous = state.rules; state.rules = cleanText(byId("rulesText").value, 5000); if (save()) { renderAll(); alert("规则已保存"); } else { state.rules = previous; } });
  byId("saveMonthlyPlan").addEventListener("click", function () { var month = currentMonth(), incomeRaw = byId("plannedIncome").value.trim(), payday = parseInt(byId("plannedPayday").value, 10) || 15, previousPlans = Object.assign({}, state.monthlyPlans || {}); if (!state.monthlyPlans) state.monthlyPlans = {}; state.monthlyPlans[month] = { plannedIncome: incomeRaw === "" ? "" : safeAmount(incomeRaw), payday: Math.min(31, Math.max(1, payday)) }; if (save()) { renderAll(); alert("本月计划已保存"); } else { state.monthlyPlans = previousPlans; } });
  byId("exportData").addEventListener("click", exportData); byId("importData").addEventListener("click", importData);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { if (activeQuickType) closeQuickModal(); closeForm("snapshot"); closeSnapshotRecords(); var hm = byId("healthModal"); if (hm && hm.classList.contains("open")) { hm.classList.remove("open"); hm.setAttribute("aria-hidden","true"); } }
  });
}
function removeRecord(type, id) { if (!confirm("确定删除这条数据吗？")) return; var map = { income: "incomes", expense: "expenses", investment: "investments", snapshot: "snapshots", account: "accounts", assetItem: "assetItems" }, key = map[type]; if (!key) return; if (type === "account") { var used = state.expenses.some(function (x) { return x.accountId === id; }) || state.investments.some(function (x) { return x.accountId === id; }) || state.snapshots.some(function (x) { return x.accountId === id; }); if (used && !confirm("这个账户已有记录，删除后历史记录会显示为已删除账户。继续吗？")) return; } var previous = state[key]; state[key] = state[key].filter(function (item) { return item.id !== id; }); if (save()) renderAll(); else state[key] = previous; }
function editRecord(type, id) {
  if (type === "income") { var income = state.incomes.find(function (x) { return x.id === id; }); if (!income) return; openForm("income"); byId("incomeFormTitle").textContent = "编辑收入"; byId("incomeId").value = income.id; byId("incomeDate").value = income.date; byId("incomeMonth").value = income.month; byId("incomeSource").value = income.source; byId("incomeAmount").value = income.amount; byId("incomeNote").value = income.note || ""; }
  if (type === "account") { var account = state.accounts.find(function (x) { return x.id === id; }); if (!account) return; openForm("account"); byId("accountFormTitle").textContent = "编辑账户"; byId("accountId").value = account.id; byId("accountName").value = account.name; byId("accountType").value = account.type; byId("accountBudgetPercent").value = account.budgetPercent || ""; byId("accountTarget").value = account.target || ""; byId("accountFixed").checked = !!account.fixedBudget; byId("accountExpense").checked = !!account.includeExpense; byId("accountAsset").checked = !!account.includeAsset; byId("accountNote").value = account.note || ""; }
  if (type === "expense") { var expense = state.expenses.find(function (x) { return x.id === id; }); if (!expense) return; openForm("expense"); byId("expenseFormTitle").textContent = "编辑支出"; byId("expenseId").value = expense.id; byId("expenseDate").value = expense.date; byId("expenseMonth").value = expense.month; byId("expenseAccount").value = expense.accountId; byId("expenseCategory").value = expense.category; byId("expenseAmount").value = expense.amount; byId("expenseNote").value = expense.note || ""; }
  if (type === "investment") { var inv = state.investments.find(function (x) { return x.id === id; }); if (!inv) return; openForm("investment"); byId("investmentFormTitle").textContent = "编辑投资/储蓄"; byId("investmentId").value = inv.id; byId("investmentDate").value = inv.date; byId("investmentMonth").value = inv.month; byId("investmentAccount").value = inv.accountId; byId("investmentType").value = inv.type; byId("investmentAmount").value = inv.amount; byId("investmentProduct").value = inv.product || ""; byId("investmentNote").value = inv.note || ""; }
  if (type === "snapshot") { var snap = state.snapshots.find(function (x) { return x.id === id; }); if (!snap) return; closeSnapshotRecords(); openForm("snapshot"); byId("snapshotFormTitle").textContent = "编辑净值更新"; byId("snapshotId").value = snap.id; byId("snapshotDate").value = snap.date; byId("snapshotMonth").value = snap.month; byId("snapshotAccount").value = snap.accountId; byId("snapshotMarketValue").value = snap.marketValue; byId("snapshotPrincipal").value = snap.principal; byId("snapshotNote").value = snap.note || ""; }
  if (type === "assetItem") { var asset = state.assetItems.find(function (x) { return x.id === id; }); if (!asset) return; openForm("assetItem"); byId("assetItemFormTitle").textContent = "编辑资产"; byId("assetItemId").value = asset.id; byId("assetItemKind").value = asset.kind; byId("assetItemName").value = asset.name; byId("assetItemStatus").value = asset.status; byId("assetItemCurrentValue").value = asset.currentValue || ""; byId("assetItemPurchasePrice").value = asset.purchasePrice || ""; byId("assetItemMonthlyCost").value = asset.monthlyCost || ""; byId("assetItemRenewalDate").value = asset.renewalDate || ""; byId("assetItemOwner").value = asset.owner || ""; byId("assetItemNote").value = asset.note || ""; }
}
function downloadStateBackup(payload, fileName) { var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function exportData() { downloadStateBackup(state, "money-os-backup_" + backupTimestamp() + ".json"); }
function importData() {
  var file = byId("importFile").files[0];
  if (!file) { alert("请先选择 JSON 文件"); return; }
  if (file.size > MAX_IMPORT_BYTES) { alert("导入失败：备份文件超过 1MB，请确认文件是否正确。"); return; }
  var reader = new FileReader();
  reader.onload = function () {
    var next;
    try {
      next = normalizeState(JSON.parse(reader.result));
    } catch (err) {
      alert("导入失败：JSON 文件格式不正确");
      return;
    }
    downloadStateBackup(state, "money-os-backup-before-import_" + backupTimestamp() + ".json");
    if (!confirm("已准备导入备份文件。系统会先导出当前数据作为安全备份。确认继续导入吗？")) return;
    var previous = state;
    state = next;
    if (save()) {
      renderAll();
      alert("导入完成");
    } else {
      state = previous;
    }
  };
  reader.readAsText(file, "UTF-8");
}
function init() { byId("dashboardDate").value = today(); renderTodayWidget(); setInterval(renderTodayWidget, 30000); byId("currentMonth").value = monthOf(today()); ["income", "expense", "investment", "snapshot"].forEach(function (p) { byId(p + "Date").value = today(); byId(p + "Month").value = currentMonth(); }); syncSelects(); handleSubmit(); bindQuickModalSubmit(); bindClicks(); renderAll(); setDashboardHomeMode("dashboard"); }
init();

