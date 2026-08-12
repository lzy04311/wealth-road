"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");

var LEDGER_SCHEMA_VERSION = "1";
var DEFAULT_LEDGER_PATH = path.resolve(__dirname, "..", "data", "raw", "wealth-events.csv");
var EVENT_TYPES = [
  "income", "expense", "transfer", "investment", "savings", "asset_snapshot",
  "asset_item", "account", "monthly_plan", "goal", "rule_set", "correction", "state_import"
];
var OPERATIONS = ["create", "update", "reverse", "archive", "snapshot", "import"];
var STATUSES = ["confirmed", "pending", "voided"];
var REVIEW_STATES = ["verified", "needs_review"];
var MONEY_FIELDS = [
  "amount", "market_value", "principal", "purchase_price", "current_value",
  "monthly_cost", "target_amount", "planned_income"
];
var DECIMAL_FIELDS = MONEY_FIELDS.concat(["quantity", "unit_price"]);
var TEXT_FIELDS = [
  "entity_id", "event_subtype", "account", "from_account", "to_account", "category",
  "subcategory", "counterparty", "asset_name", "owner", "note", "tags", "source_channel",
  "source_message_id", "source_text", "raw_payload_json", "parser_version"
];
var CSV_COLUMNS = [
  "schema_version", "event_id", "entity_id", "recorded_at", "effective_date", "month",
  "event_type", "event_subtype", "operation", "status", "review_state", "amount", "currency",
  "account", "from_account", "to_account", "category", "subcategory", "counterparty",
  "asset_name", "quantity", "unit_price", "market_value", "principal", "purchase_price",
  "current_value", "monthly_cost", "target_amount", "planned_income", "payday", "renewal_date",
  "owner", "note", "tags", "source_channel", "source_message_id", "source_text",
  "source_text_base64", "source_text_sha256", "raw_payload_json", "supersedes_event_id",
  "parser_version", "row_hash_sha256"
];

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function shanghaiDate(date) {
  var parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date || new Date());
  var values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + "-" + values.month + "-" + values.day;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  var parts = String(value).split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function normalizeDecimal(value, scale) {
  if (value === "" || value == null) return "";
  var text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid non-negative decimal: " + value);
  var decimals = text.indexOf(".") >= 0 ? text.split(".")[1].length : 0;
  if (decimals > scale) throw new Error("Too many decimal places: " + value);
  var number = Number(text);
  if (!Number.isFinite(number)) throw new Error("Invalid decimal: " + value);
  return number.toFixed(scale);
}

function formulaSafe(value) {
  var text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function csvCell(value) {
  return "\"" + String(value == null ? "" : value).replace(/\"/g, "\"\"") + "\"";
}

function csvRow(values) {
  return values.map(csvCell).join(",");
}

function parseCsv(text) {
  var rows = [], row = [], cell = "", quoted = false;
  for (var i = 0; i < text.length; i += 1) {
    var ch = text[i];
    if (quoted) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") { cell += "\""; i += 1; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === "\"") quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (cell !== "" || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(function (item) { return item.some(function (value) { return value !== ""; }); });
}

function rowHash(row) {
  var payload = {};
  CSV_COLUMNS.forEach(function (column) {
    if (column !== "row_hash_sha256") payload[column] = String(row[column] == null ? "" : row[column]);
  });
  return sha256(JSON.stringify(payload));
}

function baseEvent(input, now) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Event payload must be an object.");
  var sourceText = String(input.source_text == null ? "" : input.source_text);
  if (!sourceText) throw new Error("source_text is required.");
  var effectiveDate = String(input.effective_date || shanghaiDate(now));
  var originalPayload = input.raw_payload_json != null
    ? String(input.raw_payload_json)
    : JSON.stringify(input);
  var row = {};
  CSV_COLUMNS.forEach(function (column) { row[column] = ""; });
  row.schema_version = LEDGER_SCHEMA_VERSION;
  row.event_id = String(input.event_id || crypto.randomUUID());
  row.entity_id = String(input.entity_id || row.event_id);
  row.recorded_at = String(input.recorded_at || (now || new Date()).toISOString());
  row.effective_date = effectiveDate;
  row.month = String(input.month || effectiveDate.slice(0, 7));
  row.event_type = String(input.event_type || "");
  row.event_subtype = String(input.event_subtype || "");
  row.operation = String(input.operation || "create");
  row.status = String(input.status || "confirmed");
  row.review_state = String(input.review_state || "verified");
  MONEY_FIELDS.forEach(function (field) { row[field] = normalizeDecimal(input[field], 2); });
  row.quantity = normalizeDecimal(input.quantity, 8);
  row.unit_price = normalizeDecimal(input.unit_price, 8);
  row.currency = String(input.currency || "CNY").toUpperCase();
  ["account", "from_account", "to_account", "category", "subcategory", "counterparty", "asset_name",
    "owner", "note", "tags", "source_channel", "source_message_id", "supersedes_event_id", "parser_version"
  ].forEach(function (field) { row[field] = String(input[field] == null ? "" : input[field]); });
  row.source_channel = row.source_channel || "codex_chat";
  row.parser_version = row.parser_version || "codex-manual-v1";
  row.payday = input.payday == null || input.payday === "" ? "" : String(input.payday);
  row.renewal_date = String(input.renewal_date || "");
  row.source_text = sourceText;
  row.source_text_base64 = Buffer.from(sourceText, "utf8").toString("base64");
  row.source_text_sha256 = sha256(sourceText);
  row.raw_payload_json = originalPayload;
  TEXT_FIELDS.forEach(function (field) { row[field] = formulaSafe(row[field]); });
  row.row_hash_sha256 = rowHash(row);
  return row;
}

function positive(value) {
  return value !== "" && Number(value) > 0;
}

function validateEvent(row) {
  var errors = [];
  if (row.schema_version !== LEDGER_SCHEMA_VERSION) errors.push("schema_version must be " + LEDGER_SCHEMA_VERSION);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.event_id)) errors.push("event_id must be a UUID");
  if (!row.entity_id) errors.push("entity_id is required");
  if (!Number.isFinite(Date.parse(row.recorded_at))) errors.push("recorded_at must be ISO-8601");
  if (!validDate(row.effective_date)) errors.push("effective_date must be a real YYYY-MM-DD date");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)) errors.push("month must be YYYY-MM");
  if (validDate(row.effective_date) && row.month !== row.effective_date.slice(0, 7)) {
    if (!(row.operation === "import" && row.review_state === "needs_review")) errors.push("month must match effective_date");
  }
  if (EVENT_TYPES.indexOf(row.event_type) < 0) errors.push("unsupported event_type: " + row.event_type);
  if (OPERATIONS.indexOf(row.operation) < 0) errors.push("unsupported operation: " + row.operation);
  if (STATUSES.indexOf(row.status) < 0) errors.push("unsupported status: " + row.status);
  if (REVIEW_STATES.indexOf(row.review_state) < 0) errors.push("unsupported review_state: " + row.review_state);
  if (!/^[A-Z]{3}$/.test(row.currency)) errors.push("currency must be a three-letter code");
  DECIMAL_FIELDS.forEach(function (field) {
    if (row[field] !== "" && !/^\d+\.\d+$/.test(row[field])) errors.push(field + " must be a normalized non-negative decimal");
  });
  if (["income", "expense", "investment", "savings", "transfer"].indexOf(row.event_type) >= 0 && !positive(row.amount)) errors.push("amount must be greater than zero");
  if (row.event_type === "transfer") {
    if (!row.from_account || !row.to_account) errors.push("transfer requires from_account and to_account");
    if (row.from_account && row.from_account === row.to_account) errors.push("transfer accounts must differ");
  }
  if (row.event_type === "asset_snapshot") {
    if (!row.account) errors.push("asset_snapshot requires account");
    if (!positive(row.market_value) && row.market_value !== "0.00") errors.push("asset_snapshot requires market_value");
  }
  if (row.event_type === "monthly_plan" && row.planned_income === "" && row.payday === "") errors.push("monthly_plan requires planned_income or payday");
  if (row.event_type === "goal" && !positive(row.target_amount)) errors.push("goal requires target_amount");
  if (row.event_type === "correction" && !row.supersedes_event_id) errors.push("correction requires supersedes_event_id");
  if (row.payday !== "" && (!/^\d+$/.test(row.payday) || Number(row.payday) < 1 || Number(row.payday) > 31)) errors.push("payday must be 1-31");
  if (row.renewal_date && !validDate(row.renewal_date)) errors.push("renewal_date must be YYYY-MM-DD");
  if (!row.source_text_base64 || !row.source_text_sha256) errors.push("source text proof is required");
  return errors;
}

function ensureLedger(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, csvRow(CSV_COLUMNS) + "\n", { encoding: "utf8", flag: "wx" });
}

function readLedger(filePath) {
  ensureLedger(filePath);
  var rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (!rows.length) throw new Error("Ledger is empty.");
  if (rows[0].length !== CSV_COLUMNS.length || rows[0].some(function (value, index) { return value !== CSV_COLUMNS[index]; })) {
    throw new Error("Ledger header does not match schema v" + LEDGER_SCHEMA_VERSION + ".");
  }
  return rows.slice(1).map(function (values, index) {
    if (values.length !== CSV_COLUMNS.length) throw new Error("Row " + (index + 2) + " has " + values.length + " columns; expected " + CSV_COLUMNS.length + ".");
    var row = {};
    CSV_COLUMNS.forEach(function (column, columnIndex) { row[column] = values[columnIndex]; });
    return row;
  });
}

function validateLedger(filePath) {
  var rows = readLedger(filePath), errors = [], ids = {}, byType = {}, needsReview = 0;
  rows.forEach(function (row, index) {
    var line = index + 2;
    validateEvent(row).forEach(function (error) { errors.push("row " + line + ": " + error); });
    if (ids[row.event_id]) errors.push("row " + line + ": duplicate event_id " + row.event_id);
    ids[row.event_id] = true;
    var decoded;
    try { decoded = Buffer.from(row.source_text_base64, "base64").toString("utf8"); }
    catch (err) { decoded = ""; errors.push("row " + line + ": invalid source_text_base64"); }
    if (sha256(decoded) !== row.source_text_sha256) errors.push("row " + line + ": source_text SHA-256 mismatch");
    if (rowHash(row) !== row.row_hash_sha256) errors.push("row " + line + ": row SHA-256 mismatch");
    byType[row.event_type] = (byType[row.event_type] || 0) + 1;
    if (row.review_state === "needs_review") needsReview += 1;
  });
  return { ok: errors.length === 0, rows: rows.length, needs_review: needsReview, by_type: byType, errors: errors };
}

function withLock(filePath, callback) {
  var lockPath = filePath + ".lock";
  var fd;
  try {
    fd = fs.openSync(lockPath, "wx");
    return callback();
  } finally {
    if (fd != null) fs.closeSync(fd);
    if (fd != null && fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  }
}

function appendEvents(filePath, inputs, now) {
  ensureLedger(filePath);
  var list = Array.isArray(inputs) ? inputs : [inputs];
  if (!list.length) throw new Error("At least one event is required.");
  return withLock(filePath, function () {
    var existing = readLedger(filePath), existingIds = {};
    existing.forEach(function (row) { existingIds[row.event_id] = true; });
    var rows = list.map(function (input) { return baseEvent(input, now); });
    var batchIds = {};
    rows.forEach(function (row) {
      var errors = validateEvent(row);
      if (errors.length) throw new Error(errors.join("; "));
      if (existingIds[row.event_id] || batchIds[row.event_id]) throw new Error("Duplicate event_id: " + row.event_id);
      batchIds[row.event_id] = true;
    });
    var payload = rows.map(function (row) { return csvRow(CSV_COLUMNS.map(function (column) { return row[column]; })); }).join("\n") + "\n";
    var fd = fs.openSync(filePath, "a");
    try {
      fs.writeSync(fd, payload, null, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return rows;
  });
}

function accountLookup(state) {
  var map = {};
  (Array.isArray(state.accounts) ? state.accounts : []).forEach(function (account) {
    map[String(account.id || "")] = String(account.name || "");
  });
  return map;
}

function importStateEvents(state, importedAt, rawStateText) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("State backup must be a JSON object.");
  ["accounts", "incomes", "expenses", "investments", "snapshots"].forEach(function (key) {
    if (!Array.isArray(state[key])) throw new Error("State backup field " + key + " must be an array.");
  });
  var importDate = shanghaiDate(importedAt), source = "Imported from wealth app JSON backup";
  var lookup = accountLookup(state), events = [{
    event_type: "state_import", operation: "import", effective_date: importDate, source_text: source,
    source_channel: "app_json_import", raw_payload_json: rawStateText == null ? JSON.stringify(state) : String(rawStateText)
  }];
  state.accounts.forEach(function (item) {
    events.push({ event_type: "account", operation: "import", entity_id: item.id, effective_date: importDate,
      account: item.name, event_subtype: item.type, target_amount: item.target, note: item.note,
      source_text: source + " / account / " + item.id, source_channel: "app_json_import", raw_payload_json: JSON.stringify(item) });
  });
  state.incomes.forEach(function (item) {
    events.push(importRecord("income", item, { event_subtype: item.source, account: lookup[item.accountId] || item.accountId, amount: item.amount }, lookup, source));
  });
  state.expenses.forEach(function (item) {
    events.push(importRecord("expense", item, { account: lookup[item.accountId] || item.accountId, from_account: lookup[item.sourceAccountId] || item.sourceAccountId, category: item.category, amount: item.amount }, lookup, source));
  });
  state.investments.forEach(function (item) {
    events.push(importRecord("investment", item, { account: lookup[item.accountId] || item.accountId, from_account: lookup[item.sourceAccountId] || item.sourceAccountId, event_subtype: item.type, amount: item.amount, asset_name: item.product }, lookup, source));
  });
  (Array.isArray(state.transfers) ? state.transfers : []).forEach(function (item) {
    events.push(importRecord("transfer", item, { from_account: lookup[item.fromAccountId] || item.fromAccountId, to_account: lookup[item.toAccountId] || item.toAccountId, amount: item.amount }, lookup, source));
  });
  state.snapshots.forEach(function (item) {
    events.push(importRecord("asset_snapshot", item, { account: lookup[item.accountId] || item.accountId, market_value: item.marketValue, principal: item.principal }, lookup, source));
  });
  (Array.isArray(state.assetItems) ? state.assetItems : []).forEach(function (item) {
    events.push({ event_type: "asset_item", event_subtype: item.kind, operation: "import", entity_id: item.id,
      effective_date: importDate, asset_name: item.name, owner: item.owner, purchase_price: item.purchasePrice,
      current_value: item.currentValue, monthly_cost: item.monthlyCost, renewal_date: item.renewalDate,
      status: item.status === "已停用" ? "voided" : "confirmed", note: item.note,
      source_text: source + " / asset_item / " + item.id, source_channel: "app_json_import", raw_payload_json: JSON.stringify(item) });
  });
  (Array.isArray(state.liabilities) ? state.liabilities : []).forEach(function (item) {
    events.push({ event_type: "asset_item", event_subtype: "liability/" + item.type, operation: "import", entity_id: item.id,
      effective_date: importDate, asset_name: item.name, current_value: item.currentBalance,
      monthly_cost: item.minimumPayment, status: item.status === "已结清" ? "voided" : "confirmed", note: item.note,
      source_text: source + " / liability / " + item.id, source_channel: "app_json_import", raw_payload_json: JSON.stringify(item) });
  });
  Object.keys(state.monthlyPlans || {}).forEach(function (month) {
    var plan = state.monthlyPlans[month] || {};
    events.push({ event_type: "monthly_plan", operation: "import", entity_id: "monthly-plan-" + month,
      effective_date: month + "-01", planned_income: plan.plannedIncome, payday: plan.payday,
      source_text: source + " / monthly_plan / " + month, source_channel: "app_json_import", raw_payload_json: JSON.stringify(plan) });
  });
  if (typeof state.rules === "string") {
    events.push({ event_type: "rule_set", operation: "import", effective_date: importDate, note: state.rules,
      source_text: source + " / rules", source_channel: "app_json_import", raw_payload_json: JSON.stringify({ rules: state.rules }) });
  }
  return events;
}

function importRecord(type, item, extra, lookup, source) {
  var date = String(item.date || shanghaiDate());
  var monthMismatch = item.month && String(item.month) !== date.slice(0, 7);
  return Object.assign({
    event_type: type, operation: "import", entity_id: item.id, effective_date: date,
    month: item.month || date.slice(0, 7), review_state: monthMismatch ? "needs_review" : "verified",
    note: item.note, source_text: source + " / " + type + " / " + item.id,
    source_channel: "app_json_import", raw_payload_json: JSON.stringify(item)
  }, extra || {});
}

function option(args, name, fallback) {
  var index = args.indexOf(name);
  return index >= 0 && args[index + 1] != null ? args[index + 1] : fallback;
}

function runCli(argv) {
  var command = argv[0] || "help";
  var filePath = path.resolve(option(argv, "--file", DEFAULT_LEDGER_PATH));
  if (command === "init") {
    ensureLedger(filePath);
    return { ok: true, file: filePath, columns: CSV_COLUMNS.length };
  }
  if (command === "validate") return Object.assign({ file: filePath }, validateLedger(filePath));
  if (command === "append") {
    var encoded = option(argv, "--base64", "");
    if (!encoded) throw new Error("append requires --base64 <UTF8_JSON_BASE64>.");
    var input = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    var appended = appendEvents(filePath, input);
    return { ok: true, file: filePath, appended: appended.map(function (row) {
      return { event_id: row.event_id, effective_date: row.effective_date, event_type: row.event_type,
        amount: row.amount, account: row.account, from_account: row.from_account, to_account: row.to_account,
        review_state: row.review_state };
    }) };
  }
  if (command === "import-state") {
    var inputPath = option(argv, "--input", "");
    if (!inputPath) throw new Error("import-state requires --input <backup.json>.");
    var rawStateText = fs.readFileSync(path.resolve(inputPath), "utf8");
    var state = JSON.parse(rawStateText);
    var imported = appendEvents(filePath, importStateEvents(state, null, rawStateText));
    return { ok: true, file: filePath, imported: imported.length, state_import_event_id: imported[0].event_id };
  }
  if (command === "tail") {
    var limit = Math.max(1, Math.min(100, Number(option(argv, "--limit", "10")) || 10));
    var rows = readLedger(filePath).slice(-limit).map(function (row) {
      return { event_id: row.event_id, effective_date: row.effective_date, event_type: row.event_type,
        amount: row.amount, account: row.account, from_account: row.from_account,
        to_account: row.to_account, review_state: row.review_state };
    });
    return { ok: true, file: filePath, rows: rows };
  }
  return {
    ok: true,
    usage: [
      "node scripts/finance-ledger.js init",
      "node scripts/finance-ledger.js append --base64 <UTF8_JSON_BASE64>",
      "node scripts/finance-ledger.js validate",
      "node scripts/finance-ledger.js tail --limit 10",
      "node scripts/finance-ledger.js import-state --input <backup.json>"
    ]
  };
}

if (require.main === module) {
  try {
    var result = runCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.ok === false) process.exitCode = 1;
  } catch (err) {
    process.stderr.write(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2) + "\n");
    process.exitCode = 1;
  }
}

module.exports = {
  CSV_COLUMNS: CSV_COLUMNS,
  DEFAULT_LEDGER_PATH: DEFAULT_LEDGER_PATH,
  appendEvents: appendEvents,
  baseEvent: baseEvent,
  importStateEvents: importStateEvents,
  parseCsv: parseCsv,
  readLedger: readLedger,
  runCli: runCli,
  sha256: sha256,
  validateEvent: validateEvent,
  validateLedger: validateLedger
};
