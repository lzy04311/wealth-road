"use strict";

function closeQuickModal() {
  var modal = byId("quickModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  activeQuickType = "";
  document.querySelectorAll(".quick-form").forEach(function (form) { form.classList.remove("active"); });
}

function fillIfEmpty(id, value) {
  var el = byId(id);
  if (!el) return;
  if (!String(el.value || "").trim()) el.value = value;
}

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
  byId("quickInvestmentType").innerHTML = optionHtml(investmentEntryTypes, byId("quickInvestmentType").value);
  byId("quickExpenseAccount").innerHTML = accountOptions(byId("quickExpenseAccount").value, function (acc) { return acc.includeExpense; });
  byId("quickInvestmentAccount").innerHTML = accountOptions(byId("quickInvestmentAccount").value, function (acc) { return acc.includeAsset; });
  syncAccountSelect("quickIncomeAccount", null, "待归集现金", function (acc) { return acc.includeAsset; });
  syncAccountSelect("quickExpenseSourceAccount", null, "待归集现金", function (acc) { return acc.includeAsset; });
  syncAccountSelect("quickInvestmentSourceAccount", null, "待归集现金", function (acc) { return acc.includeAsset; });

  ["quickIncomeDate", "quickExpenseDate", "quickInvestmentDate"].forEach(function (id) { fillIfEmpty(id, today()); });

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
      accountId: byId("quickIncomeAccount").value,
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
      accountId: byId("quickExpenseAccount").value,
      sourceAccountId: byId("quickExpenseSourceAccount").value,
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
    if (byId("quickInvestmentSourceAccount").value && byId("quickInvestmentSourceAccount").value === byId("quickInvestmentAccount").value) { notify("付款账户不能和投资账户相同"); return; }
    if (!upsert(state.investments, {
      id: uid(),
      date: byId("quickInvestmentDate").value,
      accountId: byId("quickInvestmentAccount").value,
      sourceAccountId: byId("quickInvestmentSourceAccount").value,
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
