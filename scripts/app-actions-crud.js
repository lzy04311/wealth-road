"use strict";

function upsert(list, item) {
  if (list === state.incomes) item = normalizeIncome(item);
  else if (list === state.expenses) item = normalizeExpense(item, {});
  else if (list === state.investments) item = normalizeInvestment(item, {});
  else if (list === state.snapshots) item = normalizeSnapshot(item, {});
  else if (list === state.accounts) item = normalizeAccount(item, {});
  else if (list === state.assetItems) item = normalizeAssetItem(item);

  var index = list.findIndex(function (row) { return row.id === item.id; });
  var previous = index >= 0 ? list[index] : null;
  if (index >= 0) list[index] = item; else list.push(item);
  if (save()) return true;
  if (index >= 0) list[index] = previous; else list.pop();
  return false;
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
