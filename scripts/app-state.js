"use strict";

var CURRENT_SCHEMA_VERSION = 2;
var incomeSources = ["工资", "奖金", "副业", "其他"];
var accountTypes = ["生活消费", "自我投资", "长期投资", "短期储蓄", "应急金", "自由支配", "其他"];
var investmentTypes = ["投资", "储蓄", "转入", "转出"];
var assetKinds = ["现金", "投资", "电子产品", "贵重物品", "电子订阅", "买断软件", "数字资产", "其他"];
var assetStatuses = ["在用", "闲置", "观察", "保留", "准备卖出", "已停用"];
var accountNameMigration = {
  "生活费": "日常开支", "生存专项拨款": "日常开支",
  "自我投资": "学习成长", "自我升级基金": "学习成长",
  "纳斯达克": "长期投资", "纳纳你是我的神": "长期投资", "娜娜你是我的神": "长期投资",
  "短债/现金": "备用现金", "流动资金（子弹）": "备用现金",
  "A股玩耍仓": "高风险投资", "与大A斗智斗勇专项基金": "高风险投资",
  "租房/应急金": "应急金", "保命钱": "应急金",
  "自由支配": "娱乐消费", "败家额度": "娱乐消费"
};
var defaultBudgetPercents = { "日常开支": 25.8, "学习成长": 14.5, "长期投资": 16.1, "备用现金": 4.8, "高风险投资": 1.6, "应急金": 30.6, "娱乐消费": 6.5 };
var defaultRules = ["应急金达到目标前，结余优先进入应急金。", "娱乐消费不能透支。", "长期投资不用于日常开支。", "高风险投资不能影响长期投资。"].join("\n");
var MAX_IMPORT_BYTES = 1024 * 1024;
var MAX_TEXT_LENGTH = 160;
var MAX_NOTE_LENGTH = 1200;
var state = null;
var expenseViewMode = "list";
var selectedExpenseDate = "";
var dashboardPieMode = "budget";
var assetKindFilter = "全部";
var activeQuickType = "";
var lastSavedAt = null;
var statusNoticeTimer = null;
var renderContextCache = null;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function byId(id) { return document.getElementById(id); }
function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function backupTimestamp() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "_" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0"); }
function savedTimeText(d) { if (!d) return "--"; return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0"); }
function updateSaveStatusUI() {
  var text = savedTimeText(lastSavedAt);
  var topEl = byId("saveStatusText");
  var dataEl = byId("dataLastSavedText");
  if (topEl) topEl.textContent = "已保存";
  if (dataEl) dataEl.textContent = text;
}
function notify(message) {
  var topEl = byId("saveStatusText");
  if (!topEl) return;
  topEl.textContent = cleanText(message, 80) || "已保存";
  if (statusNoticeTimer) clearTimeout(statusNoticeTimer);
  statusNoticeTimer = setTimeout(function () {
    topEl.textContent = "已保存";
    statusNoticeTimer = null;
  }, 2600);
}
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
function monthOf(date) { return String(date || today()).slice(0, 7); }
function currentMonth() { return byId("currentMonth").value || monthOf(today()); }
function monthText(month) { var parts = String(month || currentMonth()).split("-"); return (parts[0] || "----") + "年" + (parts[1] || "--") + "月"; }
function updateMonthText() { var el = byId("currentMonthText"); if (el) el.textContent = monthText(currentMonth()); }
function money(n) { return "¥" + (Number(n) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function numberValue(n) { var value = Number(n); if (!Number.isFinite(value)) value = 0; return Math.round(value * 100) / 100; }
function esc(str) { return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function sum(list, picker) { return list.reduce(function (total, item) { return total + numberValue(picker(item)); }, 0); }
function cleanText(value, maxLength) { return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength || MAX_TEXT_LENGTH); }
function safeId(value) { var text = String(value == null ? "" : value); return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : uid(); }
function safeDate(value, fallback) {
  var text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback || today();
  var parts = text.split("-"), d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.getFullYear() === Number(parts[0]) && d.getMonth() === Number(parts[1]) - 1 && d.getDate() === Number(parts[2]) ? text : (fallback || today());
}
function safeOptionalDate(value) {
  var text = String(value || "");
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  var parts = text.split("-"), d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.getFullYear() === Number(parts[0]) && d.getMonth() === Number(parts[1]) - 1 && d.getDate() === Number(parts[2]) ? text : "";
}
function safeMonth(value, fallbackDate) { var text = String(value || ""); return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : monthOf(fallbackDate || today()); }
function safeAmount(value) { return Math.max(0, Math.min(999999999, numberValue(value))); }
function safePercent(value) { return Math.max(0, Math.min(100, numberValue(value))); }
function safeEnum(value, list, fallback) { return list.indexOf(value) >= 0 ? value : fallback; }
function ensureId(item) { if (!item || typeof item !== "object") return item; item.id = safeId(item.id); return item; }
function monthEndDate(month) { var y = parseInt(String(month).slice(0, 4), 10), m = parseInt(String(month).slice(5, 7), 10); if (!y || !m) return "9999-12-31"; var d = new Date(y, m, 0); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

function normalizeState(data) {
  var base = data && typeof data === "object" ? data : {};
  var idMap = {};
  var accounts = Array.isArray(base.accounts) && base.accounts.length ? base.accounts.map(function (account) { return normalizeAccount(account, idMap); }) : defaultAccounts();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    accounts: accounts,
    incomes: Array.isArray(base.incomes) ? base.incomes.map(normalizeIncome) : [],
    expenses: Array.isArray(base.expenses) ? base.expenses.map(function (item) { return normalizeExpense(item, idMap); }) : [],
    investments: Array.isArray(base.investments) ? base.investments.map(function (item) { return normalizeInvestment(item, idMap); }) : [],
    snapshots: Array.isArray(base.snapshots) ? base.snapshots.map(function (item) { return normalizeSnapshot(item, idMap); }) : [],
    assetItems: Array.isArray(base.assetItems) ? base.assetItems.map(normalizeAssetItem) : [],
    monthlyPlans: normalizeMonthlyPlans(base.monthlyPlans),
    rules: typeof base.rules === "string" ? cleanText(base.rules, 5000) : defaultRules
  };
}
function normalizeAccount(account, idMap) {
  account = account && typeof account === "object" ? account : {};
  var originalId = String(account.id || "");
  var id = safeId(account.id);
  if (originalId) idMap[originalId] = id;
  var rawName = cleanText(account.name);
  var normalizedName = accountNameMigration[rawName] || rawName;
  var budgetPercent = account.budgetPercent;
  if ((budgetPercent == null || budgetPercent === "") && account.budget != null) budgetPercent = Math.round((numberValue(account.budget) / 6200 * 100) * 10) / 10;
  if ((!budgetPercent || numberValue(budgetPercent) === 0) && defaultBudgetPercents[normalizedName] != null) budgetPercent = defaultBudgetPercents[normalizedName];
  return { id: id, name: normalizedName || "未命名账户", type: safeEnum(account.type, accountTypes, "其他"), budgetPercent: safePercent(budgetPercent), fixedBudget: !!account.fixedBudget, includeExpense: !!account.includeExpense, includeAsset: !!account.includeAsset, target: safeAmount(account.target), note: cleanText(account.note, MAX_NOTE_LENGTH) };
}
function normalizeAccountId(id, idMap) { var raw = String(id || ""); return idMap[raw] || (/^[A-Za-z0-9_-]{1,80}$/.test(raw) ? raw : ""); }
function normalizeIncome(item) {
  item = item && typeof item === "object" ? item : {};
  var date = safeDate(item.date);
  return { id: safeId(item.id), date: date, month: safeMonth(item.month, date), source: safeEnum(item.source, incomeSources, "其他"), amount: safeAmount(item.amount), note: cleanText(item.note, MAX_NOTE_LENGTH) };
}
function normalizeExpense(item, idMap) {
  item = item && typeof item === "object" ? item : {};
  var date = safeDate(item.date);
  return { id: safeId(item.id), date: date, month: safeMonth(item.month, date), accountId: normalizeAccountId(item.accountId, idMap), category: cleanText(item.category) || "未分类", amount: safeAmount(item.amount), note: cleanText(item.note, MAX_NOTE_LENGTH) };
}
function normalizeInvestment(item, idMap) {
  item = item && typeof item === "object" ? item : {};
  var date = safeDate(item.date);
  return { id: safeId(item.id), date: date, month: safeMonth(item.month, date), accountId: normalizeAccountId(item.accountId, idMap), type: safeEnum(item.type, investmentTypes, "投资"), amount: safeAmount(item.amount), product: cleanText(item.product), note: cleanText(item.note, MAX_NOTE_LENGTH) };
}
function normalizeSnapshot(item, idMap) {
  item = item && typeof item === "object" ? item : {};
  var date = safeDate(item.date);
  return { id: safeId(item.id), date: date, month: safeMonth(item.month, date), accountId: normalizeAccountId(item.accountId, idMap), marketValue: safeAmount(item.marketValue), principal: safeAmount(item.principal), note: cleanText(item.note, MAX_NOTE_LENGTH) };
}
function normalizeAssetItem(item) {
  item = item && typeof item === "object" ? item : {};
  return {
    id: safeId(item.id),
    kind: safeEnum(item.kind, assetKinds, "其他"),
    name: cleanText(item.name) || "未命名资产",
    owner: cleanText(item.owner),
    purchasePrice: safeAmount(item.purchasePrice),
    currentValue: safeAmount(item.currentValue),
    monthlyCost: safeAmount(item.monthlyCost),
    renewalDate: safeOptionalDate(item.renewalDate),
    status: safeEnum(item.status, assetStatuses, "在用"),
    note: cleanText(item.note, MAX_NOTE_LENGTH)
  };
}
function normalizeMonthlyPlans(plans) {
  var normalized = {};
  if (!plans || typeof plans !== "object" || Array.isArray(plans)) return normalized;
  Object.keys(plans).forEach(function (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    var plan = plans[month] && typeof plans[month] === "object" ? plans[month] : {};
    var rawIncome = plan.plannedIncome;
    var plannedIncome = rawIncome === "" || rawIncome == null ? "" : safeAmount(rawIncome);
    var payday = Math.min(31, Math.max(1, parseInt(plan.payday, 10) || 15));
    normalized[month] = { plannedIncome: plannedIncome, payday: payday };
  });
  return normalized;
}
function defaultAccounts() {
  return [
    { id: uid(), name: "日常开支", type: "生活消费", budgetPercent: defaultBudgetPercents["日常开支"], fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, note: "" },
    { id: uid(), name: "学习成长", type: "自我投资", budgetPercent: defaultBudgetPercents["学习成长"], fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, note: "" },
    { id: uid(), name: "长期投资", type: "长期投资", budgetPercent: defaultBudgetPercents["长期投资"], fixedBudget: true, includeExpense: false, includeAsset: true, target: 0, note: "" },
    { id: uid(), name: "备用现金", type: "短期储蓄", budgetPercent: defaultBudgetPercents["备用现金"], fixedBudget: true, includeExpense: false, includeAsset: true, target: 0, note: "" },
    { id: uid(), name: "高风险投资", type: "长期投资", budgetPercent: defaultBudgetPercents["高风险投资"], fixedBudget: true, includeExpense: false, includeAsset: true, target: 0, note: "控制仓位" },
    { id: uid(), name: "应急金", type: "应急金", budgetPercent: defaultBudgetPercents["应急金"], fixedBudget: true, includeExpense: false, includeAsset: true, target: 25000, note: "" },
    { id: uid(), name: "娱乐消费", type: "自由支配", budgetPercent: defaultBudgetPercents["娱乐消费"], fixedBudget: true, includeExpense: true, includeAsset: false, target: 0, note: "" }
  ];
}
