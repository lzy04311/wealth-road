"use strict";

function upsert(list, item) {
  var collection = "";
  if (list === state.incomes) { collection = "incomes"; item = normalizeIncome(item, {}); }
  else if (list === state.expenses) { collection = "expenses"; item = normalizeExpense(item, {}); }
  else if (list === state.investments) { collection = "investments"; item = normalizeInvestment(item, {}); }
  else if (list === state.transfers) { collection = "transfers"; item = normalizeTransfer(item, {}); }
  else if (list === state.snapshots) { collection = "snapshots"; item = normalizeSnapshot(item, {}); }
  else if (list === state.accounts) { collection = "accounts"; item = normalizeAccount(item, {}); }
  else if (list === state.moneyAccounts) { collection = "moneyAccounts"; item = normalizeMoneyAccount(item); }
  else if (list === state.reconciliations) { collection = "reconciliations"; item = normalizeReconciliation(item, {}); }
  else if (list === state.allocations) { collection = "allocations"; item = normalizeAllocation(item, {}); }
  else if (list === state.assetItems) { collection = "assetItems"; item = normalizeAssetItem(item, {}); }
  else if (list === state.liabilities) { collection = "liabilities"; item = normalizeLiability(item); }

  var index = list.findIndex(function (row) { return row.id === item.id; });
  var previous = index >= 0 ? list[index] : null;
  var edited = index >= 0;
  if (index >= 0) list[index] = item; else list.push(item);
  if (save()) {
    var message = recordSaveMessage(list, item, edited);
    if (typeof auditLog === "function") auditLog({ operation: edited ? "update" : "create", collection: collection, entityId: item.id, summary: message });
    showActionFeedback(message);
    return true;
  }
  if (index >= 0) list[index] = previous; else list.pop();
  return false;
}

function linkHistoricalMoneyAccount(type, id) {
  var map = { income: "incomes", expense: "expenses", investment: "investments", transfer: "transfers" }, key = map[type];
  if (!key) return;
  var record = state[key].find(function (item) { return item.id === id; });
  if (!record) return;
  var previous = Object.assign({}, record);
  if (type === "income" || type === "expense") {
    var moneyAccountId = byId("repair-" + type + "-" + id).value;
    if (!moneyAccountId) { notify("请选择实际账户"); return; }
    record.moneyAccountId = moneyAccountId;
  } else if (type === "investment") {
    record.sourceMoneyAccountId = byId("repair-investment-from-" + id).value;
    record.targetMoneyAccountId = byId("repair-investment-to-" + id).value;
    if (!record.sourceMoneyAccountId || !record.targetMoneyAccountId) { Object.assign(record, previous); notify("请选择投资的转出账户和转入账户"); return; }
  } else {
    record.fromMoneyAccountId = byId("repair-transfer-from-" + id).value;
    record.toMoneyAccountId = byId("repair-transfer-to-" + id).value;
    if (!record.fromMoneyAccountId || !record.toMoneyAccountId || record.fromMoneyAccountId === record.toMoneyAccountId) { Object.assign(record, previous); notify("转账必须选择两个不同的实际账户"); return; }
  }
  if (!save()) { Object.assign(record, previous); return; }
  renderAll();
  if (typeof auditLog === "function") auditLog({ operation: "link_money_account", collection: key, entityId: id, summary: "补齐历史流水实际账户" });
  showActionFeedback("已补齐历史流水的实际账户", "撤销", function () {
    var linkedState = Object.assign({}, record);
    Object.assign(record, previous);
    if (save()) { renderAll(); showActionFeedback("已撤销历史账户关联"); }
    else Object.assign(record, linkedState);
  });
}

function recordSaveMessage(list, item, edited) {
  var action = edited ? "已更新" : "已保存";
  if (list === state.incomes) return action + "收入 " + money(item.amount) + " · " + item.source;
  if (list === state.expenses) return action + "支出 " + money(item.amount) + " · " + item.category;
  if (list === state.investments) return action + item.type + " " + money(item.amount) + (item.product ? " · " + item.product : "");
  if (list === state.transfers) return action + "转账 " + money(item.amount);
  if (list === state.snapshots) return action + "净值 " + money(item.marketValue) + " · " + accountName(item.accountId);
  if (list === state.accounts) return action + "资金池 · " + item.name;
  if (list === state.moneyAccounts) return action + "实际账户 · " + item.name;
  if (list === state.allocations) return action + "资金分配 " + money(item.amount);
  if (list === state.assetItems) return action + "资产 · " + item.name;
  if (list === state.liabilities) return action + "负债 · " + item.name;
  if (list === state.reconciliations) return action + "余额核对 " + money(item.adjustment);
  return action;
}

function recordDeleteLabel(type, item) {
  if (type === "income") return "收入 " + money(item.amount);
  if (type === "expense") return "支出 " + money(item.amount);
  if (type === "investment") return item.type + " " + money(item.amount);
  if (type === "transfer") return "转账 " + money(item.amount);
  if (type === "snapshot") return "净值记录";
  if (type === "allocation") return "资金分配 " + money(item.amount);
  return item.name || "记录";
}

function auditCollectionType(collection) {
  var map = { incomes: "income", expenses: "expense", investments: "investment", transfers: "transfer", snapshots: "snapshot", accounts: "account", moneyAccounts: "moneyAccount", reconciliations: "reconciliation", allocations: "allocation", assetItems: "assetItem", liabilities: "liability" };
  return map[collection] || "";
}
function openAuditEntity(collection, id) {
  var type = auditCollectionType(collection);
  if (!type || !id) return;
  var key = { income: "incomes", expense: "expenses", investment: "investments", transfer: "transfers", snapshot: "snapshots", account: "accounts", moneyAccount: "moneyAccounts", reconciliation: "reconciliations", allocation: "allocations", assetItem: "assetItems", liability: "liabilities" }[type];
  if (!key || !state[key]) return;
  var exists = state[key].some(function (item) { return item.id === id; });
  if (!exists) { notify("该记录已被删除或不存在"); return; }
  editRecord(type, id);
}
function removeRecord(type, id) {
  var map = { income: "incomes", expense: "expenses", investment: "investments", transfer: "transfers", snapshot: "snapshots", account: "accounts", moneyAccount: "moneyAccounts", reconciliation: "reconciliations", allocation: "allocations", assetItem: "assetItems", liability: "liabilities" };
  var key = map[type];
  if (!key) return;
  appConfirm("确认删除", "确定删除这条数据吗？", "删除", "取消").then(function (ok) {
    if (!ok) return;
    if (type === "moneyAccount") {
      var moneyUsed = state.incomes.some(function (x) { return x.moneyAccountId === id; }) || state.expenses.some(function (x) { return x.moneyAccountId === id; }) || state.investments.some(function (x) { return x.sourceMoneyAccountId === id || x.targetMoneyAccountId === id; }) || state.transfers.some(function (x) { return x.fromMoneyAccountId === id || x.toMoneyAccountId === id; }) || state.reconciliations.some(function (x) { return x.moneyAccountId === id; });
      if (moneyUsed) {
        appConfirm("实际账户仍有关联记录", "这个账户已有历史流水。为保留钱的位置记录，系统会将它归档。", "归档账户", "取消").then(function (confirmed) {
          if (!confirmed) return;
          var moneyAccount = state.moneyAccounts.find(function (item) { return item.id === id; });
          if (!moneyAccount) return;
          moneyAccount.archived = true;
          if (save()) {
            syncSelects(); renderAll();
            if (typeof auditLog === "function") auditLog({ operation: "archive", collection: "moneyAccounts", entityId: id, summary: "归档实际账户 · " + moneyAccount.name });
            showActionFeedback("已归档实际账户 · " + moneyAccount.name, "撤销", function () {
              moneyAccount.archived = false;
              if (save()) { syncSelects(); renderAll(); showActionFeedback("已恢复实际账户 · " + moneyAccount.name); }
              else moneyAccount.archived = true;
            });
          } else moneyAccount.archived = false;
        });
        return;
      }
    }
    if (type === "account") {
      var used = state.incomes.some(function (x) { return x.accountId === id; }) || state.expenses.some(function (x) { return x.accountId === id || x.sourceAccountId === id; }) || state.investments.some(function (x) { return x.accountId === id || x.sourceAccountId === id; }) || state.transfers.some(function (x) { return x.fromAccountId === id || x.toAccountId === id; }) || state.snapshots.some(function (x) { return x.accountId === id; }) || state.allocations.some(function (x) { return x.fromAccountId === id || x.toAccountId === id; });
      if (used) {
        appConfirm("账户仍有关联记录", "这个账户已有历史记录。为保留账目上下文，系统会将它归档并停止新记录。", "归档账户", "取消").then(function (confirmed) {
          if (!confirmed) return;
          var account = state.accounts.find(function (item) { return item.id === id; });
          if (!account) return;
          account.archived = true;
          if (save()) {
            syncSelects();
            renderAll();
            if (typeof auditLog === "function") auditLog({ operation: "archive", collection: "accounts", entityId: id, summary: "归档账户 · " + account.name });
            showActionFeedback("已归档账户 · " + account.name, "撤销", function () {
              account.archived = false;
              if (save()) {
                syncSelects();
                renderAll();
                showActionFeedback("已恢复账户 · " + account.name);
              } else account.archived = true;
            });
          } else account.archived = false;
        });
        return;
      }
    }
    removeRecordFinal(type, id, key);
  });
}

function removeRecordFinal(type, id, key) {
  var previous = state[key];
  var removedIndex = previous.findIndex(function (item) { return item.id === id; });
  var removedItem = removedIndex >= 0 ? previous[removedIndex] : null;
  if (!removedItem) return;
  state[key] = state[key].filter(function (item) { return item.id !== id; });
  if (save()) {
    renderAll();
    if (typeof auditLog === "function") auditLog({ operation: "delete", collection: key, entityId: id, summary: "已删除" + recordDeleteLabel(type, removedItem) });
    showActionFeedback("已删除" + recordDeleteLabel(type, removedItem), "撤销", function () {
      if (state[key].some(function (item) { return item.id === removedItem.id; })) return;
      var restoreIndex = Math.min(removedIndex, state[key].length);
      state[key].splice(restoreIndex, 0, removedItem);
      if (save()) {
        syncSelects();
        renderAll();
        showActionFeedback("已撤销删除");
      } else {
        var rollbackIndex = state[key].indexOf(removedItem);
        if (rollbackIndex >= 0) state[key].splice(rollbackIndex, 1);
      }
    });
  } else state[key] = previous;
}

function duplicateRecord(type, id) {
  if (["income", "expense", "investment", "transfer", "snapshot"].indexOf(type) < 0) return;
  editRecord(type, id);
  var prefix = type;
  byId(prefix + "Id").value = "";
  byId(prefix + "Date").value = today();
  var title = byId(prefix + "FormTitle");
  if (title) title.textContent = type === "snapshot" ? "再记一次净值" : "再记一笔" + ({ income: "收入", expense: "支出", investment: "投资/储蓄", transfer: "转账" }[type] || "记录");
  var card = formCard(prefix);
  if (card && typeof card.scrollIntoView === "function") card.scrollIntoView({ behavior: "smooth", block: "center" });
  showActionFeedback("已带入上一笔内容，请核对后保存");
}

function editRecord(type, id) {
  var targetView = { income: "flow", expense: "flow", investment: "investments", transfer: "investments", snapshot: "investments", account: "accounts", moneyAccount: "accounts", reconciliation: "accounts", allocation: "accounts", assetItem: "assets", liability: "assets" }[type];
  if (targetView) activateView(targetView);
  if (type === "income" || type === "expense") switchFlowTab(type);
  if (type === "income") {
    var income = state.incomes.find(function (x) { return x.id === id; });
    if (!income) return;
    openForm("income");
    byId("incomeFormTitle").textContent = "编辑收入";
    byId("incomeId").value = income.id;
    byId("incomeDate").value = income.date;
    byId("incomeSource").value = income.source;
    byId("incomeAccount").value = income.accountId || "";
    byId("incomeMoneyAccount").value = income.moneyAccountId || "";
    byId("incomeAmount").value = income.amount;
    byId("incomeNote").value = income.note || "";
  }
  if (type === "moneyAccount") {
    var moneyAccount = state.moneyAccounts.find(function (x) { return x.id === id; });
    if (!moneyAccount) return;
    openForm("moneyAccount");
    byId("moneyAccountFormTitle").textContent = "编辑实际账户";
    byId("moneyAccountId").value = moneyAccount.id;
    byId("moneyAccountName").value = moneyAccount.name;
    byId("moneyAccountType").value = moneyAccount.type;
    byId("moneyAccountOpeningBalance").value = moneyAccount.openingBalance;
    byId("moneyAccountOpeningBalanceDate").value = moneyAccount.openingBalanceDate || "";
    byId("moneyAccountNote").value = moneyAccount.note || "";
  }
  if (type === "reconciliation") {
    var reconciliation = state.reconciliations.find(function (x) { return x.id === id; });
    if (!reconciliation) return;
    openForm("reconciliation");
    byId("reconciliationFormTitle").textContent = "编辑余额核对";
    byId("reconciliationId").value = reconciliation.id;
    byId("reconciliationDate").value = reconciliation.date;
    byId("reconciliationMoneyAccount").value = reconciliation.moneyAccountId;
    byId("reconciliationActualBalance").value = reconciliation.actualBalance;
    byId("reconciliationNote").value = reconciliation.note || "";
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
    byId("expenseMoneyAccount").value = expense.moneyAccountId || "";
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
    byId("investmentSourceMoneyAccount").value = inv.sourceMoneyAccountId || "";
    byId("investmentTargetMoneyAccount").value = inv.targetMoneyAccountId || "";
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
    byId("transferFromAccount").value = transfer.fromMoneyAccountId || "";
    byId("transferToAccount").value = transfer.toMoneyAccountId || "";
    byId("transferAmount").value = transfer.amount;
    byId("transferNote").value = transfer.note || "";
  }
  if (type === "allocation") {
    var allocation = state.allocations.find(function (x) { return x.id === id; });
    if (!allocation) return;
    openForm("allocation");
    byId("allocationFormTitle").textContent = "编辑资金分配";
    byId("allocationId").value = allocation.id;
    byId("allocationDate").value = allocation.date;
    byId("allocationFromAccount").value = allocation.fromAccountId || "";
    byId("allocationToAccount").value = allocation.toAccountId || "";
    byId("allocationAmount").value = allocation.amount;
    byId("allocationNote").value = allocation.note || "";
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
  var activeCard = formCard(type);
  if (activeCard && typeof activeCard.scrollIntoView === "function") activeCard.scrollIntoView({ behavior: "smooth", block: "center" });
}
