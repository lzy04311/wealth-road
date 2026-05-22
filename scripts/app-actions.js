"use strict";

function resetForm(prefix) { byId(prefix + "Form").reset(); byId(prefix + "Id").value = ""; if (byId(prefix + "Date")) byId(prefix + "Date").value = today(); if (byId(prefix + "Month")) byId(prefix + "Month").value = currentMonth(); var title = byId(prefix + "FormTitle"); if (title) title.textContent = prefix === "snapshot" ? "净值更新" : title.textContent.replace("编辑", "新增"); }
function formCard(prefix) { return byId(prefix + "FormCard"); }
function openForm(prefix) { var card = formCard(prefix); if (card) card.classList.add("open"); if (prefix === "snapshot") { var modal = byId("snapshotModal"); if (modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); } } }
function closeForm(prefix) { var card = formCard(prefix); if (card) card.classList.remove("open"); if (prefix === "snapshot") { var modal = byId("snapshotModal"); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); } } }
function handleSubmit() {
  byId("incomeForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.incomes, { id: byId("incomeId").value || uid(), date: byId("incomeDate").value, month: byId("incomeMonth").value, source: byId("incomeSource").value, amount: safeAmount(byId("incomeAmount").value), note: cleanText(byId("incomeNote").value, MAX_NOTE_LENGTH) })) return; resetForm("income"); closeForm("income"); renderAll(); });
  byId("accountForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.accounts, { id: byId("accountId").value || uid(), name: cleanText(byId("accountName").value) || "未命名账户", type: byId("accountType").value, budgetPercent: safePercent(byId("accountBudgetPercent").value), fixedBudget: byId("accountFixed").checked, includeExpense: byId("accountExpense").checked, includeAsset: byId("accountAsset").checked, target: safeAmount(byId("accountTarget").value), note: cleanText(byId("accountNote").value, MAX_NOTE_LENGTH) })) return; resetForm("account"); closeForm("account"); renderAll(); });
  byId("expenseForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.expenses, { id: byId("expenseId").value || uid(), date: byId("expenseDate").value, month: byId("expenseMonth").value, accountId: byId("expenseAccount").value, category: cleanText(byId("expenseCategory").value) || "未分类", amount: safeAmount(byId("expenseAmount").value), note: cleanText(byId("expenseNote").value, MAX_NOTE_LENGTH) })) return; resetForm("expense"); closeForm("expense"); renderAll(); });
  byId("investmentForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.investments, { id: byId("investmentId").value || uid(), date: byId("investmentDate").value, month: byId("investmentMonth").value, accountId: byId("investmentAccount").value, type: byId("investmentType").value, amount: safeAmount(byId("investmentAmount").value), product: cleanText(byId("investmentProduct").value), note: cleanText(byId("investmentNote").value, MAX_NOTE_LENGTH) })) return; resetForm("investment"); closeForm("investment"); renderAll(); });
  byId("snapshotForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.snapshots, { id: byId("snapshotId").value || uid(), date: byId("snapshotDate").value, month: byId("snapshotMonth").value, accountId: byId("snapshotAccount").value, marketValue: safeAmount(byId("snapshotMarketValue").value), principal: safeAmount(byId("snapshotPrincipal").value), note: cleanText(byId("snapshotNote").value, MAX_NOTE_LENGTH) })) return; resetForm("snapshot"); closeForm("snapshot"); renderAll(); });
  byId("assetItemForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.assetItems, { id: byId("assetItemId").value || uid(), kind: byId("assetItemKind").value, name: cleanText(byId("assetItemName").value) || "未命名资产", owner: cleanText(byId("assetItemOwner").value), purchasePrice: safeAmount(byId("assetItemPurchasePrice").value), currentValue: safeAmount(byId("assetItemCurrentValue").value), monthlyCost: safeAmount(byId("assetItemMonthlyCost").value), renewalDate: safeOptionalDate(byId("assetItemRenewalDate").value), status: byId("assetItemStatus").value, note: cleanText(byId("assetItemNote").value, MAX_NOTE_LENGTH) })) return; resetForm("assetItem"); closeForm("assetItem"); renderAll(); });
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
function init() { byId("dashboardDate").value = today(); renderTodayWidget(); setInterval(renderTodayWidget, 30000); byId("currentMonth").value = monthOf(today()); ["income", "expense", "investment", "snapshot"].forEach(function (p) { byId(p + "Date").value = today(); byId(p + "Month").value = currentMonth(); }); syncSelects(); handleSubmit(); bindQuickModalSubmit(); bindClicks(); renderAll(); setDashboardHomeMode("dashboard"); }
init();

