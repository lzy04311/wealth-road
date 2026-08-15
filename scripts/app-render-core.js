"use strict";

function optionHtml(list, value) { return list.map(function (item) { return "<option value=\"" + esc(item) + "\"" + (item === value ? " selected" : "") + ">" + esc(item) + "</option>"; }).join(""); }
function accountOptions(selected, filterFn) { return state.accounts.filter(function (item) { return (!item.archived || item.id === selected) && (!filterFn || filterFn(item)); }).map(function (item) { return "<option value=\"" + esc(item.id) + "\"" + (item.id === selected ? " selected" : "") + ">" + esc(item.name) + "</option>"; }).join(""); }
function optionalAccountOptions(selected, label, filterFn) { return "<option value=\"\">" + esc(label || "未指定") + "</option>" + accountOptions(selected, filterFn); }
function syncAccountSelect(id, selected, label, filterFn) { var el = byId(id); if (el) el.innerHTML = optionalAccountOptions(selected == null ? el.value : selected, label, filterFn); }
function fundPoolOptions(selected, allowPending, filterFn) {
  var groups = { "消费预算": [], "现金储备": [], "投资资金": [], "其他资金池": [] };
  state.accounts.filter(function (item) { return (!item.archived || item.id === selected) && (!filterFn || filterFn(item)); }).forEach(function (item) {
    var group = item.includeExpense ? "消费预算" : (item.type === "长期投资" ? "投资资金" : ((item.type === "短期储蓄" || item.type === "应急金") ? "现金储备" : "其他资金池"));
    groups[group].push(item);
  });
  var html = allowPending ? "<option value=\"\">待分配资金</option>" : "";
  Object.keys(groups).forEach(function (label) {
    if (!groups[label].length) return;
    html += "<optgroup label=\"" + esc(label) + "\">" + groups[label].map(function (item) { return "<option value=\"" + esc(item.id) + "\"" + (item.id === selected ? " selected" : "") + ">" + esc(item.name) + "</option>"; }).join("") + "</optgroup>";
  });
  return html;
}
function moneyAccountOptions(selected, allowEmpty) {
  var html = allowEmpty ? "<option value=\"\">" + (hasMoneyAccounts() ? "请选择实际账户" : "尚未建立实际账户") + "</option>" : "";
  html += (state.moneyAccounts || []).filter(function (item) { return !item.archived || item.id === selected; }).map(function (item) { return "<option value=\"" + esc(item.id) + "\"" + (item.id === selected ? " selected" : "") + ">" + esc(item.name) + " · " + esc(item.type) + "</option>"; }).join("");
  return html;
}
function syncSelects() {
  var selectedIncomeAccount = byId("incomeAccount").value, selectedExpenseAccount = byId("expenseAccount").value, selectedInvestmentAccount = byId("investmentAccount").value, selectedSnapshotAccount = byId("snapshotAccount").value;
  byId("incomeSource").innerHTML = optionHtml(incomeSources, byId("incomeSource").value);
  byId("accountType").innerHTML = optionHtml(accountTypes, byId("accountType").value);
  byId("accountValuationMethod").innerHTML = optionHtml(accountValuationMethods, byId("accountValuationMethod").value);
  if (byId("moneyAccountType")) byId("moneyAccountType").innerHTML = optionHtml(moneyAccountTypes, byId("moneyAccountType").value);
  byId("investmentType").innerHTML = optionHtml(investmentEntryTypes, byId("investmentType").value);
  if (byId("assetItemKind")) byId("assetItemKind").innerHTML = optionHtml(assetKinds, byId("assetItemKind").value);
  if (byId("assetItemStatus")) byId("assetItemStatus").innerHTML = optionHtml(assetStatuses, byId("assetItemStatus").value);
  if (byId("assetItemValuationMode")) byId("assetItemValuationMode").innerHTML = optionHtml(assetValuationModes, byId("assetItemValuationMode").value);
  if (byId("liabilityType")) byId("liabilityType").innerHTML = optionHtml(liabilityTypes, byId("liabilityType").value);
  if (byId("liabilityStatus")) byId("liabilityStatus").innerHTML = optionHtml(liabilityStatuses, byId("liabilityStatus").value);
  byId("incomeAccount").innerHTML = fundPoolOptions(selectedIncomeAccount, true);
  byId("expenseAccount").innerHTML = fundPoolOptions(selectedExpenseAccount, false, function (acc) { return acc.includeExpense || acc.id === selectedExpenseAccount; });
  byId("investmentAccount").innerHTML = fundPoolOptions(selectedInvestmentAccount, false, function (acc) { return acc.includeAsset || acc.id === selectedInvestmentAccount; });
  byId("snapshotAccount").innerHTML = accountOptions(selectedSnapshotAccount, function (acc) { return acc.includeAsset || acc.id === selectedSnapshotAccount; });
  ["incomeMoneyAccount", "expenseMoneyAccount", "investmentSourceMoneyAccount", "investmentTargetMoneyAccount", "quickIncomeMoneyAccount", "quickExpenseMoneyAccount", "quickInvestmentSourceMoneyAccount", "quickInvestmentTargetMoneyAccount"].forEach(function (id) { var el = byId(id); if (el) el.innerHTML = moneyAccountOptions(el.value, true); });
  ["incomeMoneyAccount", "expenseMoneyAccount", "investmentSourceMoneyAccount", "investmentTargetMoneyAccount", "quickIncomeMoneyAccount", "quickExpenseMoneyAccount", "quickInvestmentSourceMoneyAccount", "quickInvestmentTargetMoneyAccount"].forEach(function (id) { var el = byId(id); if (el) el.required = hasMoneyAccounts(); });
  ["transferFromAccount", "transferToAccount"].forEach(function (id) { var el = byId(id); if (el) el.innerHTML = moneyAccountOptions(el.value, false); });
  if (byId("reconciliationMoneyAccount")) byId("reconciliationMoneyAccount").innerHTML = moneyAccountOptions(byId("reconciliationMoneyAccount").value, true);
  if (byId("allocationFromAccount")) byId("allocationFromAccount").innerHTML = fundPoolOptions(byId("allocationFromAccount").value, true);
  if (byId("allocationToAccount")) byId("allocationToAccount").innerHTML = fundPoolOptions(byId("allocationToAccount").value, false);
  syncAccountSelect("assetItemLinkedAccount", null, "不关联账户", function (acc) { return acc.includeAsset; });
}
function renderTodayWidget() { var dateValue = byId("dashboardDate") && byId("dashboardDate").value ? byId("dashboardDate").value : today(), parts = dateValue.split("-"), d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), hour = new Date().getHours(), emoji = hour < 6 ? "😴" : hour < 11 ? "😊" : hour < 14 ? "😋" : hour < 18 ? "🙂" : hour < 22 ? "🌙" : "😴"; byId("todayDate").textContent = d.getFullYear() + "年" + String(d.getMonth() + 1).padStart(2, "0") + "月" + String(d.getDate()).padStart(2, "0") + "日"; byId("todayEmoji").textContent = emoji; }
function renderStats(containerId, stats) { byId(containerId).innerHTML = stats.map(function (item) { var details = Array.isArray(item.details) ? "<div class=\"stat-details\">" + item.details.map(function (d) { return "<div class=\"stat-detail\"><span>" + esc(d.label) + "</span><strong class=\"" + (d.className || "") + "\">" + esc(d.value) + "</strong></div>"; }).join("") + "</div>" : ""; return "<div class=\"card stat " + (item.featured ? "main-stat" : "") + "\"><div class=\"label\">" + esc(item.label) + "</div><div class=\"value " + (item.className || "") + "\">" + esc(item.value) + "</div><div class=\"hint\">" + esc(item.hint || "") + "</div>" + details + "</div>"; }).join(""); }
function accountCard(account, visual, pct, body) { return "<div class=\"account-card\" style=\"--account-color:" + esc(visual.color) + "\"><div class=\"account-top\"><div class=\"account-head\"><div class=\"account-emoji\">" + esc(visual.emoji) + "</div><div><div class=\"row-title\">" + esc(account.name) + "<span class=\"badge\">" + esc(account.type) + "</span></div><div class=\"row-meta\">预算比例 " + numberValue(account.budgetPercent).toFixed(1) + "%</div></div></div><strong>" + (pct == null ? "" : pct.toFixed(0) + "%") + "</strong></div>" + body + "</div>"; }
function empty(title, desc, action, emoji) {
  return "<div class=\"empty empty-card\"><div class=\"empty-emoji\">" + esc(emoji || "🧾") + "</div><div class=\"empty-title\">" + esc(title || "暂无数据") + "</div>" + (desc ? "<div class=\"empty-desc\">" + esc(desc) + "</div>" : "") + (action ? "<div class=\"empty-action\">" + esc(action) + "</div>" : "") + "</div>";
}
function meta(items) { return items.map(function (x) { return "<div class=\"row-meta\">" + esc(x) + "</div>"; }).join(""); }
function pill(label, value) { return "<span class=\"summary-pill\">" + esc(label) + " <strong>" + esc(value) + "</strong></span>"; }

var renderContextCache = null;

function buildRenderContext(month) {
  var targetMonth = month || currentMonth();
  return {
    month: targetMonth,
    summary: monthlySummary(targetMonth),
    snapshot: assetSnapshotSummary(targetMonth)
  };
}

function getRenderContext(month) {
  var targetMonth = month || currentMonth();
  if (!renderContextCache || renderContextCache.month !== targetMonth) renderContextCache = buildRenderContext(targetMonth);
  return renderContextCache;
}
