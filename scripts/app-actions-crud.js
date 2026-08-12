"use strict";

function upsert(list, item) {
  if (list === state.incomes) item = normalizeIncome(item, {});
  else if (list === state.expenses) item = normalizeExpense(item, {});
  else if (list === state.investments) item = normalizeInvestment(item, {});
  else if (list === state.transfers) item = normalizeTransfer(item, {});
  else if (list === state.snapshots) item = normalizeSnapshot(item, {});
  else if (list === state.accounts) item = normalizeAccount(item, {});
  else if (list === state.assetItems) item = normalizeAssetItem(item, {});
  else if (list === state.liabilities) item = normalizeLiability(item);

  var index = list.findIndex(function (row) { return row.id === item.id; });
  var previous = index >= 0 ? list[index] : null;
  if (index >= 0) list[index] = item; else list.push(item);
  if (save()) return true;
  if (index >= 0) list[index] = previous; else list.pop();
  return false;
}

function removeRecord(type, id) {
  var map = { income: "incomes", expense: "expenses", investment: "investments", transfer: "transfers", snapshot: "snapshots", account: "accounts", assetItem: "assetItems", liability: "liabilities" };
  var key = map[type];
  if (!key) return;
  appConfirm("确认删除", "确定删除这条数据吗？", "删除", "取消").then(function (ok) {
    if (!ok) return;
    if (type === "account") {
      var used = state.incomes.some(function (x) { return x.accountId === id; }) || state.expenses.some(function (x) { return x.accountId === id || x.sourceAccountId === id; }) || state.investments.some(function (x) { return x.accountId === id || x.sourceAccountId === id; }) || state.transfers.some(function (x) { return x.fromAccountId === id || x.toAccountId === id; }) || state.snapshots.some(function (x) { return x.accountId === id; });
      if (used) {
        appConfirm("账户仍有关联记录", "这个账户已有历史记录。为保留账目上下文，系统会将它归档并停止新记录。", "归档账户", "取消").then(function (confirmed) {
          if (!confirmed) return;
          var account = state.accounts.find(function (item) { return item.id === id; });
          if (!account) return;
          account.archived = true;
          if (save()) { syncSelects(); renderAll(); }
        });
        return;
      }
    }
    removeRecordFinal(type, id, key);
  });
}

function removeRecordFinal(type, id, key) {
  var previous = state[key];
  state[key] = state[key].filter(function (item) { return item.id !== id; });
  if (save()) renderAll(); else state[key] = previous;
}

function editRecord(type, id) {
  if (type === "income") {
    var income = state.incomes.find(function (x) { return x.id === id; });
    if (!income) return;
    openForm("income");
    byId("incomeFormTitle").textContent = "编辑收入";
    byId("incomeId").value = income.id;
    byId("incomeDate").value = income.date;
    byId("incomeSource").value = income.source;
    byId("incomeAccount").value = income.accountId || "";
    byId("incomeAmount").value = income.amount;
    byId("incomeNote").value = income.note || "";
  }
  if (type === "account") {
    var account = state.accounts.find(function (x) { return x.id === id; });
    if (!account) return;
    openForm("account");
    byId("accountFormTitle").textContent = "编辑账户";
    byId("accountId").value = account.id;
    byId("accountName").value = account.name;
    byId("accountType").value = account.type;
    byId("accountBudgetPercent").value = account.budgetPercent || "";
    byId("accountTarget").value = account.target || "";
    byId("accountOpeningBalance").value = account.openingBalance || "";
    byId("accountOpeningBalanceDate").value = account.openingBalanceDate || "";
    byId("accountValuationMethod").value = account.valuationMethod || "流水余额";
    byId("accountFixed").checked = !!account.fixedBudget;
    byId("accountExpense").checked = !!account.includeExpense;
    byId("accountAsset").checked = !!account.includeAsset;
    byId("accountNote").value = account.note || "";
  }
  if (type === "expense") {
    var expense = state.expenses.find(function (x) { return x.id === id; });
    if (!expense) return;
    openForm("expense");
    byId("expenseFormTitle").textContent = "编辑支出";
    byId("expenseId").value = expense.id;
    byId("expenseDate").value = expense.date;
    byId("expenseAccount").value = expense.accountId;
    byId("expenseSourceAccount").value = expense.sourceAccountId || "";
    byId("expenseCategory").value = expense.category;
    byId("expenseAmount").value = expense.amount;
    byId("expenseNote").value = expense.note || "";
  }
  if (type === "investment") {
    var inv = state.investments.find(function (x) { return x.id === id; });
    if (!inv) return;
    openForm("investment");
    byId("investmentFormTitle").textContent = "编辑投资/储蓄";
    byId("investmentId").value = inv.id;
    byId("investmentDate").value = inv.date;
    byId("investmentAccount").value = inv.accountId;
    byId("investmentSourceAccount").value = inv.sourceAccountId || "";
    byId("investmentType").innerHTML = optionHtml(investmentEntryTypes.concat(investmentEntryTypes.indexOf(inv.type) < 0 ? [inv.type] : []), inv.type);
    byId("investmentAmount").value = inv.amount;
    byId("investmentProduct").value = inv.product || "";
    byId("investmentNote").value = inv.note || "";
  }
  if (type === "transfer") {
    var transfer = state.transfers.find(function (x) { return x.id === id; });
    if (!transfer) return;
    openForm("transfer");
    byId("transferFormTitle").textContent = "编辑转账";
    byId("transferId").value = transfer.id;
    byId("transferDate").value = transfer.date;
    byId("transferFromAccount").value = transfer.fromAccountId;
    byId("transferToAccount").value = transfer.toAccountId;
    byId("transferAmount").value = transfer.amount;
    byId("transferNote").value = transfer.note || "";
  }
  if (type === "snapshot") {
    var snap = state.snapshots.find(function (x) { return x.id === id; });
    if (!snap) return;
    closeSnapshotRecords();
    openForm("snapshot");
    byId("snapshotFormTitle").textContent = "编辑净值更新";
    byId("snapshotId").value = snap.id;
    byId("snapshotDate").value = snap.date;
    byId("snapshotAccount").value = snap.accountId;
    byId("snapshotMarketValue").value = snap.marketValue;
    byId("snapshotPrincipal").value = snap.principal;
    byId("snapshotNote").value = snap.note || "";
  }
  if (type === "assetItem") {
    var asset = state.assetItems.find(function (x) { return x.id === id; });
    if (!asset) return;
    openForm("assetItem");
    byId("assetItemFormTitle").textContent = "编辑资产";
    byId("assetItemId").value = asset.id;
    byId("assetItemKind").value = asset.kind;
    byId("assetItemName").value = asset.name;
    byId("assetItemStatus").value = asset.status;
    byId("assetItemValuationMode").value = asset.valuationMode || defaultAssetValuationMode(asset);
    byId("assetItemLinkedAccount").value = asset.linkedAccountId || "";
    byId("assetItemCurrentValue").value = asset.currentValue || "";
    byId("assetItemValuationDate").value = asset.valuationDate || "";
    byId("assetItemPurchasePrice").value = asset.purchasePrice || "";
    byId("assetItemMonthlyCost").value = asset.monthlyCost || "";
    byId("assetItemRenewalDate").value = asset.renewalDate || "";
    byId("assetItemOwner").value = asset.owner || "";
    byId("assetItemNote").value = asset.note || "";
  }
  if (type === "liability") {
    var liability = state.liabilities.find(function (x) { return x.id === id; });
    if (!liability) return;
    openForm("liability");
    byId("liabilityFormTitle").textContent = "编辑负债";
    byId("liabilityId").value = liability.id;
    byId("liabilityName").value = liability.name;
    byId("liabilityType").value = liability.type;
    byId("liabilityCurrentBalance").value = liability.currentBalance || "";
    byId("liabilityBalanceDate").value = liability.balanceDate || "";
    byId("liabilityInterestRate").value = liability.interestRate || "";
    byId("liabilityMinimumPayment").value = liability.minimumPayment || "";
    byId("liabilityDueDate").value = liability.dueDate || "";
    byId("liabilityStatus").value = liability.status;
    byId("liabilityNote").value = liability.note || "";
  }
}
