"use strict";

var LEDGER_CSV_HEADERS = ["日期", "项目", "分类", "收入", "支出", "类型", "备注"];
var LEDGER_CSV_TYPES = ["收入", "支出", "投资转入", "工资代扣"];
var ledgerCsvSession = null;

function parseLedgerCsv(text) {
  var source = String(text == null ? "" : text).replace(/^\uFEFF/, "");
  var rows = [], row = [], field = "", quoted = false;
  for (var index = 0; index < source.length; index += 1) {
    var char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') {
      if (field) throw new Error("CSV 引号必须出现在字段开头。");
      quoted = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(function (value) { return String(value).trim() !== ""; })) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV 中存在未闭合的引号。");
  row.push(field);
  if (row.some(function (value) { return String(value).trim() !== ""; })) rows.push(row);
  return rows;
}

function ledgerCsvHeaderMap(headerRow) {
  var headers = (headerRow || []).map(function (value) { return cleanText(String(value).replace(/^\uFEFF/, ""), 40); });
  var map = {}, errors = [];
  headers.forEach(function (header, index) {
    if (!header) return;
    if (Object.prototype.hasOwnProperty.call(map, header)) errors.push("表头重复：" + header);
    else map[header] = index;
  });
  LEDGER_CSV_HEADERS.forEach(function (header) { if (!Object.prototype.hasOwnProperty.call(map, header)) errors.push("缺少表头：" + header); });
  return { ok: !errors.length, map: map, errors: errors };
}

function ledgerCsvIsoDate(value) {
  var text = String(value || "").trim().replace(/[/.]/g, "-");
  var match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!match) return "";
  var normalized = match[1] + "-" + String(Number(match[2])).padStart(2, "0") + "-" + String(Number(match[3])).padStart(2, "0");
  return validImportDate(normalized) ? normalized : "";
}

function ledgerCsvAmount(value) {
  var text = String(value == null ? "" : value).trim().replace(/[￥¥,\s]/g, "");
  if (!text) return { ok: true, value: 0 };
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return { ok: false, value: 0 };
  var amount = Number(text);
  return { ok: Number.isFinite(amount) && amount >= 0 && amount <= 999999999, value: numberValue(amount) };
}

function ledgerCsvNormalizeProject(value) {
  var text = cleanText(value, MAX_TEXT_LENGTH);
  if (text.normalize) text = text.normalize("NFKC");
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase("zh-CN");
}

function ledgerCsvFingerprint(date, amount, project, type) {
  return [date, Math.round(numberValue(amount) * 100), ledgerCsvNormalizeProject(project), type].join("|");
}

function ledgerCsvReadRows(text) {
  var table = parseLedgerCsv(text);
  if (!table.length) throw new Error("CSV 文件为空。");
  var header = ledgerCsvHeaderMap(table[0]);
  if (!header.ok) throw new Error(header.errors.join("\n"));
  return table.slice(1).map(function (values, rowIndex) {
    var line = rowIndex + 2;
    function cell(name) { return cleanText(values[header.map[name]], name === "备注" ? MAX_NOTE_LENGTH : MAX_TEXT_LENGTH); }
    var date = ledgerCsvIsoDate(cell("日期"));
    var project = cell("项目"), category = cell("分类"), type = cell("类型"), note = cell("备注");
    var income = ledgerCsvAmount(cell("收入")), expense = ledgerCsvAmount(cell("支出")), errors = [];
    if (!date) errors.push("日期无效");
    if (!project) errors.push("项目不能为空");
    if (LEDGER_CSV_TYPES.indexOf(type) < 0) errors.push("类型无法识别");
    if (!income.ok) errors.push("收入金额无效");
    if (!expense.ok) errors.push("支出金额无效");
    if (type === "收入") {
      if (!(income.value > 0) || expense.value !== 0) errors.push("收入类型必须只填写正数收入");
    } else if (LEDGER_CSV_TYPES.indexOf(type) >= 0) {
      if (!(expense.value > 0) || income.value !== 0) errors.push(type + "必须只填写正数支出");
    }
    var amount = type === "收入" ? income.value : expense.value;
    return { index: rowIndex, line: line, id: uid(), date: date, project: project, category: category, income: income.value, expense: expense.value, amount: amount, type: type, note: note, errors: errors, fingerprint: errors.length ? "" : ledgerCsvFingerprint(date, amount, project, type) };
  });
}

function ledgerCsvImportedProject(note) {
  var match = /^项目：([^；]*)/.exec(String(note || ""));
  return match ? cleanText(match[1]) : "";
}

function ledgerCsvExistingFingerprints() {
  var result = {};
  function add(item, type, projects) {
    (projects || []).filter(Boolean).forEach(function (project) { result[ledgerCsvFingerprint(item.date, item.amount, project, type)] = true; });
  }
  state.incomes.forEach(function (item) { add(item, "收入", [ledgerCsvImportedProject(item.note), item.source, item.note]); });
  state.expenses.forEach(function (item) { add(item, item.paymentMode === "payroll_withholding" ? "工资代扣" : "支出", [ledgerCsvImportedProject(item.note), item.category, item.note]); });
  state.investments.forEach(function (item) {
    if (item.type === "转出") return;
    add(item, "投资转入", [ledgerCsvImportedProject(item.note), item.product, item.note]);
  });
  return result;
}

function ledgerCsvFundAccount(category, predicate, fallbackSelectId) {
  var normalized = accountNameMigration[cleanText(category)] || cleanText(category);
  var exact = state.accounts.find(function (account) { return !account.archived && predicate(account) && account.name === normalized; });
  if (exact) return exact.id;
  var select = byId(fallbackSelectId);
  return select ? select.value : "";
}

function ledgerCsvNote(row) {
  var parts = ["项目：" + row.project];
  if (row.type === "收入" && row.category && incomeSources.indexOf(row.category) < 0) parts.push("原分类：" + row.category);
  if (row.type === "投资转入" && row.category) parts.push("分类：" + row.category);
  if (row.note) parts.push(row.note);
  return cleanText(parts.join("；"), MAX_NOTE_LENGTH);
}

function ledgerCsvBuildCandidate(row) {
  var note = ledgerCsvNote(row);
  if (row.type === "收入") {
    var incomeMoney = byId("ledgerCsvIncomeMoneyAccount");
    return { collection: "incomes", record: normalizeIncome({ id: row.id, date: row.date, accountId: "", moneyAccountId: incomeMoney ? incomeMoney.value : "", source: incomeSources.indexOf(row.category) >= 0 ? row.category : (incomeSources.indexOf(row.project) >= 0 ? row.project : "其他"), amount: row.amount, note: note }, {}) };
  }
  if (row.type === "支出" || row.type === "工资代扣") {
    var expenseAccountId = ledgerCsvFundAccount(row.category, function (account) { return account.includeExpense; }, "ledgerCsvExpenseAccount");
    if (!expenseAccountId) return { error: "请选择默认消费资金池" };
    var expenseMoney = byId("ledgerCsvExpenseMoneyAccount");
    var paymentMode = row.type === "工资代扣" ? "payroll_withholding" : "money_account";
    return { collection: "expenses", record: normalizeExpense({ id: row.id, date: row.date, accountId: expenseAccountId, sourceAccountId: "", moneyAccountId: paymentMode === "payroll_withholding" ? "" : (expenseMoney ? expenseMoney.value : ""), paymentMode: paymentMode, category: row.category || "未分类", amount: row.amount, note: note }, {}) };
  }
  var investmentAccountId = ledgerCsvFundAccount(row.category, function (account) { return account.includeAsset; }, "ledgerCsvInvestmentAccount");
  if (!investmentAccountId) return { error: "请选择默认投资策略" };
  var source = byId("ledgerCsvInvestmentSourceMoneyAccount"), target = byId("ledgerCsvInvestmentTargetMoneyAccount");
  var sourceId = source ? source.value : "", targetId = target ? target.value : "";
  if (!!sourceId !== !!targetId) return { error: "投资转出和转入账户必须同时选择或同时留空" };
  return { collection: "investments", record: normalizeInvestment({ id: row.id, date: row.date, accountId: investmentAccountId, sourceAccountId: "", sourceMoneyAccountId: sourceId, targetMoneyAccountId: targetId, type: "投资", amount: row.amount, product: row.project, note: note }, {}) };
}

function ledgerCsvOptionRows(items, predicate, emptyLabel) {
  var rows = ["<option value=\"\">" + esc(emptyLabel) + "</option>"];
  (items || []).filter(function (item) { return !item.archived && (!predicate || predicate(item)); }).forEach(function (item) { rows.push("<option value=\"" + esc(item.id) + "\">" + esc(item.name) + "</option>"); });
  return rows.join("");
}

function populateLedgerCsvMappings() {
  if (!byId("ledgerCsvExpenseAccount")) return;
  byId("ledgerCsvExpenseAccount").innerHTML = ledgerCsvOptionRows(state.accounts, function (item) { return item.includeExpense; }, "选择默认消费资金池");
  byId("ledgerCsvInvestmentAccount").innerHTML = ledgerCsvOptionRows(state.accounts, function (item) { return item.includeAsset; }, "选择默认投资策略");
  ["ledgerCsvIncomeMoneyAccount", "ledgerCsvExpenseMoneyAccount", "ledgerCsvInvestmentSourceMoneyAccount", "ledgerCsvInvestmentTargetMoneyAccount"].forEach(function (id) {
    byId(id).innerHTML = ledgerCsvOptionRows(state.moneyAccounts, null, "不指定，导入后待补");
  });
}

function ledgerCsvPreviewModel() {
  if (!ledgerCsvSession) return null;
  var existing = ledgerCsvExistingFingerprints(), frequencies = {};
  ledgerCsvSession.rows.forEach(function (row) { if (row.fingerprint) frequencies[row.fingerprint] = (frequencies[row.fingerprint] || 0) + 1; });
  var counts = { incomes: 0, expenses: 0, investments: 0, duplicates: 0, invalid: 0, unmapped: 0, unresolved: 0 };
  var rows = ledgerCsvSession.rows.map(function (row) {
    if (row.errors.length) { counts.invalid += 1; return { row: row, status: "invalid", message: row.errors.join("；"), include: false }; }
    var duplicate = !!existing[row.fingerprint] || frequencies[row.fingerprint] > 1;
    var decision = duplicate ? (ledgerCsvSession.decisions[row.index] || "") : "import";
    if (duplicate) { counts.duplicates += 1; if (!decision) counts.unresolved += 1; }
    if (duplicate && !decision) return { row: row, status: "duplicate", message: "日期、金额、项目和类型与其他记录相同", decision: "", include: false };
    if (duplicate && decision === "skip") return { row: row, status: "duplicate", message: "疑似重复，已明确选择跳过", decision: decision, include: false };
    var candidate = ledgerCsvBuildCandidate(row);
    if (candidate.error) { counts.unmapped += 1; return { row: row, status: "unmapped", message: candidate.error, decision: decision, include: false }; }
    var include = true;
    if (include) counts[candidate.collection] += 1;
    return { row: row, status: duplicate ? "duplicate" : "ready", message: duplicate ? "疑似重复，已明确选择仍然导入" : "可以导入", decision: decision, include: include, candidate: candidate };
  });
  return { rows: rows, counts: counts };
}

function renderLedgerCsvPreview() {
  var panel = byId("ledgerCsvPreview");
  if (!panel || !ledgerCsvSession) return;
  var model = ledgerCsvPreviewModel(), counts = model.counts;
  panel.hidden = false;
  byId("ledgerCsvPreviewStats").innerHTML = [
    ["新增收入", counts.incomes], ["新增支出", counts.expenses], ["新增投资", counts.investments],
    ["疑似重复", counts.duplicates], ["无法识别", counts.invalid], ["待映射", counts.unmapped]
  ].map(function (item) { return "<div><span>" + item[0] + "</span><strong>" + item[1] + "</strong></div>"; }).join("");
  byId("ledgerCsvPreviewNotice").textContent = counts.unresolved
    ? "还有 " + counts.unresolved + " 条疑似重复未决定；请选择导入或跳过。"
    : (counts.unmapped ? "请完成默认资金池或投资策略映射。" : "预览已就绪；确认前不会写入任何数据。");
  var visible = model.rows.slice(0, 300);
  byId("ledgerCsvPreviewRows").innerHTML = visible.map(function (entry) {
    var row = entry.row;
    var decision = entry.status === "duplicate"
      ? "<label class=\"ledger-duplicate-choice\"><span>疑似重复处理</span><select data-ledger-duplicate-decision=\"" + row.index + "\"><option value=\"\"" + (!entry.decision ? " selected" : "") + ">请选择</option><option value=\"import\"" + (entry.decision === "import" ? " selected" : "") + ">仍然导入</option><option value=\"skip\"" + (entry.decision === "skip" ? " selected" : "") + ">跳过此条</option></select></label>"
      : "";
    return "<tr class=\"ledger-row-" + entry.status + "\"><td>" + row.line + "</td><td>" + esc(row.date || "—") + "</td><td>" + esc(row.type || "—") + "</td><td>" + esc(row.project || "—") + "</td><td>" + esc(money(row.amount)) + "</td><td><span class=\"ledger-row-status\">" + esc(entry.message) + "</span>" + decision + "</td></tr>";
  }).join("");
  byId("ledgerCsvPreviewLimit").textContent = model.rows.length > visible.length ? "共 " + model.rows.length + " 行，当前展示前 " + visible.length + " 行；全部行仍会参与校验和导入。" : "共解析 " + model.rows.length + " 行。";
  byId("importAllLedgerDuplicates").disabled = counts.duplicates === 0;
  byId("skipAllLedgerDuplicates").disabled = counts.duplicates === 0;
  byId("confirmLedgerCsvImport").disabled = counts.unresolved > 0 || counts.unmapped > 0 || (counts.incomes + counts.expenses + counts.investments) === 0;
  ledgerCsvSession.model = model;
}

function resetLedgerCsvImport() {
  ledgerCsvSession = null;
  if (byId("ledgerCsvFile")) byId("ledgerCsvFile").value = "";
  if (byId("ledgerCsvPreview")) byId("ledgerCsvPreview").hidden = true;
  if (byId("ledgerCsvPreviewRows")) byId("ledgerCsvPreviewRows").innerHTML = "";
}

function decideAllLedgerCsvDuplicates(decision) {
  if (!ledgerCsvSession || (decision !== "import" && decision !== "skip")) return;
  var existing = ledgerCsvExistingFingerprints(), frequencies = {};
  ledgerCsvSession.rows.forEach(function (row) { if (row.fingerprint) frequencies[row.fingerprint] = (frequencies[row.fingerprint] || 0) + 1; });
  ledgerCsvSession.rows.forEach(function (row) {
    if (!row.errors.length && (!!existing[row.fingerprint] || frequencies[row.fingerprint] > 1)) ledgerCsvSession.decisions[row.index] = decision;
  });
  renderLedgerCsvPreview();
}

function previewLedgerCsv() {
  var file = byId("ledgerCsvFile").files[0];
  if (!file) { notify("请先选择 CSV 文件"); return; }
  if (file.size > MAX_IMPORT_BYTES) { notify("流水导入失败：CSV 文件超过 16MB。"); return; }
  if (!/\.csv$/i.test(file.name || "")) { notify("请选择 .csv 文件"); return; }
  file.text().then(function (text) {
    var rows = ledgerCsvReadRows(text);
    if (!rows.length) throw new Error("CSV 中没有可读取的流水行。");
    ledgerCsvSession = { fileName: file.name, rows: rows, decisions: {}, model: null };
    populateLedgerCsvMappings();
    renderLedgerCsvPreview();
  }).catch(function (err) {
    resetLedgerCsvImport();
    appAlert("流水导入失败", String(err && err.message ? err.message : err), "关闭");
  });
}

function confirmLedgerCsvImport() {
  if (!ledgerCsvSession) return;
  renderLedgerCsvPreview();
  var model = ledgerCsvSession.model, counts = model.counts;
  if (counts.unresolved || counts.unmapped) { notify("请先处理疑似重复并完成账户映射"); return; }
  var selected = model.rows.filter(function (entry) { return entry.include && entry.candidate; });
  if (!selected.length) { notify("没有选择可导入的流水"); return; }
  var merged = clonePlain(state);
  selected.forEach(function (entry) { merged[entry.candidate.collection].push(entry.candidate.record); });
  var prepared = prepareImportedState(merged);
  if (!prepared.ok) { appAlert("流水校验失败", prepared.errors.join("\n"), "关闭"); return; }
  var summary = "将追加收入 " + counts.incomes + " 条、支出 " + counts.expenses + " 条、投资 " + counts.investments + " 条。";
  appConfirm("确认追加流水", summary + "\n\n工资代扣按到账前已结算处理：计入消费和预算，不再次减少实际账户。\n\n确认继续？", "备份并导入", "取消").then(function (confirmed) {
    if (!confirmed) return false;
    return createSafetyCheckpoint(state, "caiji-backup-before-ledger-import_").then(function (checkpoint) {
      if (checkpoint.localVerified) return true;
      return appConfirm("检查点未完成读回验证", "已尝试发起当前数据的 JSON 下载。请先在下载列表确认文件存在，再决定是否继续。", "我已确认备份", "取消");
    });
  }).then(function (ready) {
    if (!ready) return;
    var previous = state;
    state = prepared.state;
    if (!save()) { state = previous; notify("流水导入失败：保存未完成，已回滚。"); return; }
    if (typeof auditLog === "function") auditLog({ operation: "import", collection: "transactions", entityId: "", summary: "CSV 流水追加 · 收入 " + counts.incomes + " · 支出 " + counts.expenses + " · 投资 " + counts.investments });
    resetLedgerCsvImport();
    renderAll();
    notify("流水导入完成，共追加 " + selected.length + " 条");
  });
}

function initLedgerCsvImport() {
  if (!byId("previewLedgerCsv")) return;
  populateLedgerCsvMappings();
  byId("previewLedgerCsv").addEventListener("click", previewLedgerCsv);
  byId("confirmLedgerCsvImport").addEventListener("click", confirmLedgerCsvImport);
  byId("cancelLedgerCsvImport").addEventListener("click", resetLedgerCsvImport);
  byId("importAllLedgerDuplicates").addEventListener("click", function () { decideAllLedgerCsvDuplicates("import"); });
  byId("skipAllLedgerDuplicates").addEventListener("click", function () { decideAllLedgerCsvDuplicates("skip"); });
  ["ledgerCsvExpenseAccount", "ledgerCsvInvestmentAccount", "ledgerCsvIncomeMoneyAccount", "ledgerCsvExpenseMoneyAccount", "ledgerCsvInvestmentSourceMoneyAccount", "ledgerCsvInvestmentTargetMoneyAccount"].forEach(function (id) {
    byId(id).addEventListener("change", renderLedgerCsvPreview);
  });
  byId("ledgerCsvPreviewRows").addEventListener("change", function (event) {
    var select = event.target.closest("[data-ledger-duplicate-decision]");
    if (!select || !ledgerCsvSession) return;
    ledgerCsvSession.decisions[Number(select.dataset.ledgerDuplicateDecision)] = select.value;
    renderLedgerCsvPreview();
  });
}
