"use strict";

function ensureMoneyAccountsSelected(ids, message) {
  if (!hasMoneyAccounts()) return true;
  var missing = ids.map(byId).find(function (el) { return el && !el.value; });
  if (!missing) return true;
  notify(message || "请选择实际资金账户");
  missing.focus();
  return false;
}

function finishFormSubmit(prefix) {
  resetForm(prefix);
  closeForm(prefix);
  renderAll();
}

function bindIncomeForm() {
  byId("incomeForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!ensureMoneyAccountsSelected(["incomeMoneyAccount"], "请选择收入实际到账的账户")) return;
    if (!upsert(state.incomes, {
      id: byId("incomeId").value || uid(),
      date: byId("incomeDate").value,
      accountId: byId("incomeAccount").value,
      moneyAccountId: byId("incomeMoneyAccount").value,
      source: byId("incomeSource").value,
      amount: safeAmount(byId("incomeAmount").value),
      note: cleanText(byId("incomeNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("income");
  });
}

function bindFundPoolForm() {
  byId("accountForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var previous = state.accounts.find(function (item) { return item.id === byId("accountId").value; });
    if (!upsert(state.accounts, {
      id: byId("accountId").value || uid(),
      name: cleanText(byId("accountName").value) || "未命名账户",
      type: byId("accountType").value,
      budgetPercent: safePercent(byId("accountBudgetPercent").value),
      fixedBudget: byId("accountFixed").checked,
      includeExpense: byId("accountExpense").checked,
      includeAsset: byId("accountAsset").checked,
      target: safeAmount(byId("accountTarget").value),
      openingBalance: safeAmount(byId("accountOpeningBalance").value),
      openingBalanceDate: safeOptionalDate(byId("accountOpeningBalanceDate").value),
      valuationMethod: byId("accountValuationMethod").value,
      archived: previous ? !!previous.archived : false,
      note: cleanText(byId("accountNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("account");
  });
}

function bindMoneyAccountForm() {
  byId("moneyAccountForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var previous = state.moneyAccounts.find(function (item) { return item.id === byId("moneyAccountId").value; });
    if (!upsert(state.moneyAccounts, {
      id: byId("moneyAccountId").value || uid(),
      name: cleanText(byId("moneyAccountName").value) || "未命名资金账户",
      type: byId("moneyAccountType").value,
      openingBalance: safeAmount(byId("moneyAccountOpeningBalance").value),
      openingBalanceDate: safeOptionalDate(byId("moneyAccountOpeningBalanceDate").value),
      archived: previous ? !!previous.archived : false,
      note: cleanText(byId("moneyAccountNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("moneyAccount");
  });
}

function bindReconciliationForm() {
  byId("reconciliationForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var id = byId("reconciliationId").value || uid();
    var date = byId("reconciliationDate").value;
    var moneyAccountId = byId("reconciliationMoneyAccount").value;
    var account = state.moneyAccounts.find(function (item) { return item.id === moneyAccountId; });
    if (!account) { notify("请选择需要核对的实际账户"); return; }
    if (account.openingBalanceDate && date < account.openingBalanceDate) { notify("核对日期不能早于该账户的期初日期"); return; }
    var bookBalance = moneyAccountBalanceUntil(account, date, id);
    var actualBalance = safeSignedAmount(byId("reconciliationActualBalance").value);
    if (!upsert(state.reconciliations, {
      id: id,
      date: date,
      moneyAccountId: moneyAccountId,
      bookBalance: bookBalance,
      actualBalance: actualBalance,
      adjustment: numberValue(actualBalance - bookBalance),
      note: cleanText(byId("reconciliationNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("reconciliation");
  });
}

function bindExpenseForm() {
  byId("expenseForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!ensureMoneyAccountsSelected(["expenseMoneyAccount"], "请选择支出实际扣款的账户")) return;
    var previous = state.expenses.find(function (item) { return item.id === byId("expenseId").value; });
    if (!upsert(state.expenses, {
      id: byId("expenseId").value || uid(),
      date: byId("expenseDate").value,
      accountId: byId("expenseAccount").value,
      sourceAccountId: previous ? previous.sourceAccountId : "",
      moneyAccountId: byId("expenseMoneyAccount").value,
      category: cleanText(byId("expenseCategory").value) || "未分类",
      amount: safeAmount(byId("expenseAmount").value),
      note: cleanText(byId("expenseNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("expense");
  });
}

function bindInvestmentForm() {
  byId("investmentForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!ensureMoneyAccountsSelected(["investmentSourceMoneyAccount", "investmentTargetMoneyAccount"], "请选择投资的转出账户和转入账户")) return;
    var previous = state.investments.find(function (item) { return item.id === byId("investmentId").value; });
    if (!upsert(state.investments, {
      id: byId("investmentId").value || uid(),
      date: byId("investmentDate").value,
      accountId: byId("investmentAccount").value,
      sourceAccountId: previous ? previous.sourceAccountId : "",
      sourceMoneyAccountId: byId("investmentSourceMoneyAccount").value,
      targetMoneyAccountId: byId("investmentTargetMoneyAccount").value,
      type: byId("investmentType").value,
      amount: safeAmount(byId("investmentAmount").value),
      product: cleanText(byId("investmentProduct").value),
      note: cleanText(byId("investmentNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("investment");
  });
}

function bindTransferForm() {
  byId("transferForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var fromId = byId("transferFromAccount").value;
    var toId = byId("transferToAccount").value;
    var previous = state.transfers.find(function (item) { return item.id === byId("transferId").value; });
    if (!fromId || !toId || fromId === toId) { notify("转出和转入账户必须不同"); return; }
    if (!upsert(state.transfers, {
      id: byId("transferId").value || uid(),
      date: byId("transferDate").value,
      fromAccountId: previous ? previous.fromAccountId : "",
      toAccountId: previous ? previous.toAccountId : "",
      fromMoneyAccountId: fromId,
      toMoneyAccountId: toId,
      amount: safeAmount(byId("transferAmount").value),
      note: cleanText(byId("transferNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("transfer");
  });
}

function bindAllocationForm() {
  byId("allocationForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var fromId = byId("allocationFromAccount").value;
    var toId = byId("allocationToAccount").value;
    if (!toId || fromId === toId) { notify("转出和转入资金池必须不同"); return; }
    if (!upsert(state.allocations, {
      id: byId("allocationId").value || uid(),
      date: byId("allocationDate").value,
      fromAccountId: fromId,
      toAccountId: toId,
      amount: safeAmount(byId("allocationAmount").value),
      note: cleanText(byId("allocationNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("allocation");
  });
}

function bindSnapshotForm() {
  byId("snapshotForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!upsert(state.snapshots, {
      id: byId("snapshotId").value || uid(),
      date: byId("snapshotDate").value,
      accountId: byId("snapshotAccount").value,
      marketValue: safeAmount(byId("snapshotMarketValue").value),
      principal: safeAmount(byId("snapshotPrincipal").value),
      note: cleanText(byId("snapshotNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("snapshot");
  });
}

function bindAssetItemForm() {
  byId("assetItemForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!upsert(state.assetItems, {
      id: byId("assetItemId").value || uid(),
      kind: byId("assetItemKind").value,
      name: cleanText(byId("assetItemName").value) || "未命名资产",
      owner: cleanText(byId("assetItemOwner").value),
      purchasePrice: safeAmount(byId("assetItemPurchasePrice").value),
      currentValue: safeAmount(byId("assetItemCurrentValue").value),
      valuationDate: safeOptionalDate(byId("assetItemValuationDate").value),
      monthlyCost: safeAmount(byId("assetItemMonthlyCost").value),
      renewalDate: safeOptionalDate(byId("assetItemRenewalDate").value),
      status: byId("assetItemStatus").value,
      valuationMode: byId("assetItemValuationMode").value,
      linkedAccountId: byId("assetItemLinkedAccount").value,
      note: cleanText(byId("assetItemNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("assetItem");
  });
}

function bindLiabilityForm() {
  byId("liabilityForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!upsert(state.liabilities, {
      id: byId("liabilityId").value || uid(),
      name: cleanText(byId("liabilityName").value) || "未命名负债",
      type: byId("liabilityType").value,
      currentBalance: safeAmount(byId("liabilityCurrentBalance").value),
      balanceDate: safeOptionalDate(byId("liabilityBalanceDate").value),
      interestRate: safePercent(byId("liabilityInterestRate").value),
      minimumPayment: safeAmount(byId("liabilityMinimumPayment").value),
      dueDate: safeOptionalDate(byId("liabilityDueDate").value),
      status: byId("liabilityStatus").value,
      note: cleanText(byId("liabilityNote").value, MAX_NOTE_LENGTH)
    })) return;
    finishFormSubmit("liability");
  });
}

function bindFormSubmits() {
  bindIncomeForm();
  bindExpenseForm();
  bindInvestmentForm();
  bindTransferForm();
  bindFundPoolForm();
  bindMoneyAccountForm();
  bindReconciliationForm();
  bindAllocationForm();
  bindSnapshotForm();
  bindAssetItemForm();
  bindLiabilityForm();
}
