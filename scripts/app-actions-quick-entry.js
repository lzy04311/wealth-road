"use strict";

function closeQuickModal() {
  var modal = byId("quickModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  activeQuickType = "";
  document.querySelectorAll(".quick-form").forEach(function (form) { form.classList.remove("active"); });
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
