"use strict";

function resetForm(prefix) { byId(prefix + "Form").reset(); byId(prefix + "Id").value = ""; if (byId(prefix + "Date")) byId(prefix + "Date").value = today(); if (prefix === "account" && byId("accountOpeningBalanceDate")) byId("accountOpeningBalanceDate").value = today(); if (prefix === "moneyAccount" && byId("moneyAccountOpeningBalanceDate")) byId("moneyAccountOpeningBalanceDate").value = today(); if (prefix === "assetItem" && byId("assetItemValuationDate")) byId("assetItemValuationDate").value = today(); if (prefix === "liability" && byId("liabilityBalanceDate")) byId("liabilityBalanceDate").value = today(); var title = byId(prefix + "FormTitle"); if (title) title.textContent = prefix === "snapshot" ? "净值更新" : title.textContent.replace("编辑", "新增"); }
function formCard(prefix) { return byId(prefix + "FormCard"); }
function openForm(prefix) { var card = formCard(prefix); if (card) card.classList.add("open"); if (prefix === "snapshot") { var modal = byId("snapshotModal"); if (modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); } } }
function closeForm(prefix) { var card = formCard(prefix); if (card) card.classList.remove("open"); if (prefix === "snapshot") { var modal = byId("snapshotModal"); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); } } }
function handleSubmit() {
  byId("incomeForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.incomes, { id: byId("incomeId").value || uid(), date: byId("incomeDate").value, accountId: byId("incomeAccount").value, moneyAccountId: byId("incomeMoneyAccount").value, source: byId("incomeSource").value, amount: safeAmount(byId("incomeAmount").value), note: cleanText(byId("incomeNote").value, MAX_NOTE_LENGTH) })) return; resetForm("income"); closeForm("income"); renderAll(); });
  byId("accountForm").addEventListener("submit", function (e) { e.preventDefault(); var previous = state.accounts.find(function (x) { return x.id === byId("accountId").value; }); if (!upsert(state.accounts, { id: byId("accountId").value || uid(), name: cleanText(byId("accountName").value) || "未命名账户", type: byId("accountType").value, budgetPercent: safePercent(byId("accountBudgetPercent").value), fixedBudget: byId("accountFixed").checked, includeExpense: byId("accountExpense").checked, includeAsset: byId("accountAsset").checked, target: safeAmount(byId("accountTarget").value), openingBalance: safeAmount(byId("accountOpeningBalance").value), openingBalanceDate: safeOptionalDate(byId("accountOpeningBalanceDate").value), valuationMethod: byId("accountValuationMethod").value, archived: previous ? !!previous.archived : false, note: cleanText(byId("accountNote").value, MAX_NOTE_LENGTH) })) return; resetForm("account"); closeForm("account"); renderAll(); });
  byId("moneyAccountForm").addEventListener("submit", function (e) { e.preventDefault(); var previous = state.moneyAccounts.find(function (x) { return x.id === byId("moneyAccountId").value; }); if (!upsert(state.moneyAccounts, { id: byId("moneyAccountId").value || uid(), name: cleanText(byId("moneyAccountName").value) || "未命名资金账户", type: byId("moneyAccountType").value, openingBalance: safeAmount(byId("moneyAccountOpeningBalance").value), openingBalanceDate: safeOptionalDate(byId("moneyAccountOpeningBalanceDate").value), archived: previous ? !!previous.archived : false, note: cleanText(byId("moneyAccountNote").value, MAX_NOTE_LENGTH) })) return; resetForm("moneyAccount"); closeForm("moneyAccount"); renderAll(); });
  byId("expenseForm").addEventListener("submit", function (e) { e.preventDefault(); var previous = state.expenses.find(function (x) { return x.id === byId("expenseId").value; }); if (!upsert(state.expenses, { id: byId("expenseId").value || uid(), date: byId("expenseDate").value, accountId: byId("expenseAccount").value, sourceAccountId: previous ? previous.sourceAccountId : "", moneyAccountId: byId("expenseMoneyAccount").value, category: cleanText(byId("expenseCategory").value) || "未分类", amount: safeAmount(byId("expenseAmount").value), note: cleanText(byId("expenseNote").value, MAX_NOTE_LENGTH) })) return; resetForm("expense"); closeForm("expense"); renderAll(); });
  byId("investmentForm").addEventListener("submit", function (e) { e.preventDefault(); var sourceMoneyId = byId("investmentSourceMoneyAccount").value, targetMoneyId = byId("investmentTargetMoneyAccount").value, previous = state.investments.find(function (x) { return x.id === byId("investmentId").value; }); if (sourceMoneyId && targetMoneyId && sourceMoneyId === targetMoneyId) { notify("转出账户不能和转入账户相同"); return; } if (!upsert(state.investments, { id: byId("investmentId").value || uid(), date: byId("investmentDate").value, accountId: byId("investmentAccount").value, sourceAccountId: previous ? previous.sourceAccountId : "", sourceMoneyAccountId: sourceMoneyId, targetMoneyAccountId: targetMoneyId, type: byId("investmentType").value, amount: safeAmount(byId("investmentAmount").value), product: cleanText(byId("investmentProduct").value), note: cleanText(byId("investmentNote").value, MAX_NOTE_LENGTH) })) return; resetForm("investment"); closeForm("investment"); renderAll(); });
  byId("transferForm").addEventListener("submit", function (e) { e.preventDefault(); var fromId = byId("transferFromAccount").value, toId = byId("transferToAccount").value, previous = state.transfers.find(function (x) { return x.id === byId("transferId").value; }); if (!fromId || !toId || fromId === toId) { notify("转出和转入账户必须不同"); return; } if (!upsert(state.transfers, { id: byId("transferId").value || uid(), date: byId("transferDate").value, fromAccountId: previous ? previous.fromAccountId : "", toAccountId: previous ? previous.toAccountId : "", fromMoneyAccountId: fromId, toMoneyAccountId: toId, amount: safeAmount(byId("transferAmount").value), note: cleanText(byId("transferNote").value, MAX_NOTE_LENGTH) })) return; resetForm("transfer"); closeForm("transfer"); renderAll(); });
  byId("allocationForm").addEventListener("submit", function (e) { e.preventDefault(); var fromId = byId("allocationFromAccount").value, toId = byId("allocationToAccount").value; if (!toId || fromId === toId) { notify("转出和转入资金池必须不同"); return; } if (!upsert(state.allocations, { id: byId("allocationId").value || uid(), date: byId("allocationDate").value, fromAccountId: fromId, toAccountId: toId, amount: safeAmount(byId("allocationAmount").value), note: cleanText(byId("allocationNote").value, MAX_NOTE_LENGTH) })) return; resetForm("allocation"); closeForm("allocation"); renderAll(); });
  byId("snapshotForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.snapshots, { id: byId("snapshotId").value || uid(), date: byId("snapshotDate").value, accountId: byId("snapshotAccount").value, marketValue: safeAmount(byId("snapshotMarketValue").value), principal: safeAmount(byId("snapshotPrincipal").value), note: cleanText(byId("snapshotNote").value, MAX_NOTE_LENGTH) })) return; resetForm("snapshot"); closeForm("snapshot"); renderAll(); });
  byId("assetItemForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.assetItems, { id: byId("assetItemId").value || uid(), kind: byId("assetItemKind").value, name: cleanText(byId("assetItemName").value) || "未命名资产", owner: cleanText(byId("assetItemOwner").value), purchasePrice: safeAmount(byId("assetItemPurchasePrice").value), currentValue: safeAmount(byId("assetItemCurrentValue").value), valuationDate: safeOptionalDate(byId("assetItemValuationDate").value), monthlyCost: safeAmount(byId("assetItemMonthlyCost").value), renewalDate: safeOptionalDate(byId("assetItemRenewalDate").value), status: byId("assetItemStatus").value, valuationMode: byId("assetItemValuationMode").value, linkedAccountId: byId("assetItemLinkedAccount").value, note: cleanText(byId("assetItemNote").value, MAX_NOTE_LENGTH) })) return; resetForm("assetItem"); closeForm("assetItem"); renderAll(); });
  byId("liabilityForm").addEventListener("submit", function (e) { e.preventDefault(); if (!upsert(state.liabilities, { id: byId("liabilityId").value || uid(), name: cleanText(byId("liabilityName").value) || "未命名负债", type: byId("liabilityType").value, currentBalance: safeAmount(byId("liabilityCurrentBalance").value), balanceDate: safeOptionalDate(byId("liabilityBalanceDate").value), interestRate: safePercent(byId("liabilityInterestRate").value), minimumPayment: safeAmount(byId("liabilityMinimumPayment").value), dueDate: safeOptionalDate(byId("liabilityDueDate").value), status: byId("liabilityStatus").value, note: cleanText(byId("liabilityNote").value, MAX_NOTE_LENGTH) })) return; resetForm("liability"); closeForm("liability"); renderAll(); });
}
function handleFormAndModalClick(event) {
  var addBtn = event.target.closest("[data-open-form]");
  if (addBtn) { var p = addBtn.dataset.openForm; resetForm(p); openForm(p); return true; }
  var quick = event.target.closest("[data-quick-action]");
  if (quick) { openQuickEntry(quick.dataset.quickAction); return true; }
  if (event.target.closest("[data-quick-close]")) { closeQuickModal(); closeHealthModal("dismiss"); return true; }
  if (event.target.closest("[data-snapshot-close]")) { resetForm("snapshot"); closeForm("snapshot"); return true; }
  if (event.target.closest("[data-snapshot-records-close]")) { closeSnapshotRecords(); return true; }
  return false;
}
function handleFeatureToggleClick(event) {
  var shiftMonth = event.target.closest("[data-action=\"shift-month\"]");
  if (shiftMonth) { shiftCurrentMonth(parseInt(shiftMonth.dataset.monthDelta, 10) || 0); return true; }
  if (event.target.closest("[data-action=\"dismiss-feedback\"]")) { dismissActionFeedback(); return true; }
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
  var flowAddTop = event.target.closest("#flowAddRecordTop");
  if (flowAddTop) { openQuickEntry(flowActiveTab); return true; }
  var exportDataTop = event.target.closest("#exportDataTop");
  if (exportDataTop) { exportData(); return true; }
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
    if (btn.dataset.action === "duplicate") duplicateRecord(btn.dataset.type, btn.dataset.id);
  });
  byId("currentMonth").addEventListener("change", renderAll);
  byId("dashboardDate").addEventListener("change", function () { if (!this.value) return; byId("currentMonth").value = monthOf(this.value); renderTodayWidget(); renderAll(); });
  ["income", "expense", "investment", "transfer", "snapshot", "moneyAccount", "allocation"].forEach(function (p) { byId("cancel" + p.charAt(0).toUpperCase() + p.slice(1) + "Edit").addEventListener("click", function () { resetForm(p); closeForm(p); }); });
  byId("cancelAccountEdit").addEventListener("click", function () { resetForm("account"); closeForm("account"); });
  byId("cancelAssetItemEdit").addEventListener("click", function () { resetForm("assetItem"); closeForm("assetItem"); });
  byId("cancelLiabilityEdit").addEventListener("click", function () { resetForm("liability"); closeForm("liability"); });
  byId("saveRules").addEventListener("click", function () { var previous = state.rules; state.rules = cleanText(byId("rulesText").value, 5000); if (save()) { renderAll(); notify("规则已保存"); } else { state.rules = previous; } });
  byId("saveMonthlyPlan").addEventListener("click", function () { var month = currentMonth(), incomeRaw = byId("plannedIncome").value.trim(), payday = parseInt(byId("plannedPayday").value, 10) || 15, previousPlans = Object.assign({}, state.monthlyPlans || {}); if (!state.monthlyPlans) state.monthlyPlans = {}; state.monthlyPlans[month] = { plannedIncome: incomeRaw === "" ? "" : safeAmount(incomeRaw), payday: Math.min(31, Math.max(1, payday)) }; if (save()) { renderAll(); notify("本月计划已保存"); } else { state.monthlyPlans = previousPlans; } });
  byId("exportData").addEventListener("click", exportData); byId("importData").addEventListener("click", importData);
  byId("flowRecordSearch").addEventListener("input", function () { flowRecordSearch = cleanText(this.value, 80); refreshFlowRecordSearch(); });
  byId("flowRecordClear").addEventListener("click", function () { flowRecordSearch = ""; refreshFlowRecordSearch(); byId("flowRecordSearch").focus(); });
  byId("actionFeedbackButton").addEventListener("click", runActionFeedback);
  if (byId("backendSendLogin")) byId("backendSendLogin").addEventListener("click", sendBackendLoginEmail);
  if (byId("backendVerifyOtp")) byId("backendVerifyOtp").addEventListener("click", verifyBackendEmailOtp);
  if (byId("backendLogout")) byId("backendLogout").addEventListener("click", logoutBackend);
  if (byId("backendPullCloud")) byId("backendPullCloud").addEventListener("click", function () { pullCloudState(true); });
  if (byId("backendPushLocal")) byId("backendPushLocal").addEventListener("click", function () { pushLocalStateToCloud({ force: true }); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { if (activeQuickType) closeQuickModal(); closeForm("snapshot"); closeSnapshotRecords(); closeHealthModal("dismiss"); }
    if (event.key === "/" && document.body.classList.contains("module-page-mode") && byId("flow").classList.contains("active") && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") { event.preventDefault(); byId("flowRecordSearch").focus(); }
  });
}
function init() { byId("dashboardDate").value = today(); renderTodayWidget(); setInterval(renderTodayWidget, 30000); byId("currentMonth").value = monthOf(today()); ["income", "expense", "investment", "transfer", "snapshot", "allocation"].forEach(function (p) { byId(p + "Date").value = today(); }); byId("moneyAccountOpeningBalanceDate").value = today(); syncSelects(); handleSubmit(); bindQuickModalSubmit(); bindClicks(); renderAll(); setDashboardHomeMode("dashboard"); if (typeof initBackendAuth === "function") initBackendAuth(); }
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
