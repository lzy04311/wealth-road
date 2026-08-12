"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var ledger = require("./finance-ledger.js");

function tempLedger() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "wealth-ledger-"));
  return { dir: dir, file: path.join(dir, "wealth-events.csv") };
}

function run(name, fn) {
  try { fn(); process.stdout.write("PASS " + name + "\n"); }
  catch (err) { process.stderr.write("FAIL " + name + "\n" + err.stack + "\n"); process.exitCode = 1; }
}

var fixedNow = new Date("2026-08-12T02:00:00.000Z");

run("initializes an empty ledger and validates it", function () {
  var target = tempLedger();
  var result = ledger.runCli(["init", "--file", target.file]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(ledger.validateLedger(target.file).rows, 0);
});

run("appends an expense and preserves exact source text", function () {
  var target = tempLedger();
  var source = "今天午饭 32 元，记到日常开支";
  var rows = ledger.appendEvents(target.file, {
    event_type: "expense", effective_date: "2026-08-12", amount: "32",
    account: "日常开支", category: "餐饮", source_text: source
  }, fixedNow);
  assert.strictEqual(rows[0].amount, "32.00");
  assert.strictEqual(Buffer.from(rows[0].source_text_base64, "base64").toString("utf8"), source);
  assert.strictEqual(ledger.validateLedger(target.file).ok, true);
});

run("CLI appends a base64-encoded natural-language event", function () {
  var target = tempLedger();
  var payload = {
    event_type: "transfer", effective_date: "2026-08-12", amount: "1000",
    from_account: "备用现金", to_account: "应急金",
    source_text: "从备用现金转 1000 元到应急金"
  };
  var encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  var result = ledger.runCli(["append", "--file", target.file, "--base64", encoded]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.appended[0].event_type, "transfer");
  assert.strictEqual(result.appended[0].from_account, "备用现金");
  assert.strictEqual(result.appended[0].to_account, "应急金");
  assert.strictEqual(ledger.validateLedger(target.file).ok, true);
});

run("rejects a mismatched date and month before writing", function () {
  var target = tempLedger();
  assert.throws(function () {
    ledger.appendEvents(target.file, {
      event_type: "income", effective_date: "2026-08-12", month: "2026-07",
      amount: 100, source_text: "收到 100 元"
    }, fixedNow);
  }, /month must match effective_date/);
  assert.strictEqual(ledger.validateLedger(target.file).rows, 0);
});

run("requires both sides of a transfer", function () {
  var target = tempLedger();
  assert.throws(function () {
    ledger.appendEvents(target.file, {
      event_type: "transfer", effective_date: "2026-08-12", amount: 1000,
      from_account: "备用现金", source_text: "转出 1000"
    }, fixedNow);
  }, /requires from_account and to_account/);
});

run("protects spreadsheet cells while retaining original text", function () {
  var target = tempLedger(), source = "=HYPERLINK(\"https://example.com\")";
  var rows = ledger.appendEvents(target.file, {
    event_type: "expense", effective_date: "2026-08-12", amount: 1,
    account: "测试", source_text: source
  }, fixedNow);
  assert.strictEqual(rows[0].source_text[0], "'");
  assert.strictEqual(Buffer.from(rows[0].source_text_base64, "base64").toString("utf8"), source);
});

run("detects manual row tampering", function () {
  var target = tempLedger();
  ledger.appendEvents(target.file, {
    event_type: "income", effective_date: "2026-08-12", amount: 500,
    source_text: "收到奖金 500 元"
  }, fixedNow);
  var text = fs.readFileSync(target.file, "utf8").replace("500.00", "900.00");
  fs.writeFileSync(target.file, text, "utf8");
  assert.strictEqual(ledger.validateLedger(target.file).ok, false);
  assert.match(ledger.validateLedger(target.file).errors.join("\n"), /row SHA-256 mismatch/);
});

run("converts an app backup into preserved and analyzable events", function () {
  var state = {
    schemaVersion: 2,
    accounts: [{ id: "cash", name: "流动资金", type: "短期储蓄", target: 0, note: "" }],
    incomes: [{ id: "i1", date: "2026-08-01", month: "2026-08", source: "工资", amount: 8000, note: "" }],
    expenses: [{ id: "e1", date: "2026-08-02", month: "2026-08", accountId: "cash", category: "餐饮", amount: 20, note: "" }],
    investments: [],
    snapshots: [],
    assetItems: [],
    monthlyPlans: { "2026-08": { plannedIncome: 8000, payday: 15 } },
    rules: "不透支"
  };
  var events = ledger.importStateEvents(state, fixedNow);
  assert.strictEqual(events[0].event_type, "state_import");
  assert.deepStrictEqual(JSON.parse(events[0].raw_payload_json), state);
  assert.ok(events.some(function (event) { return event.event_type === "expense" && event.account === "流动资金"; }));
  assert.ok(events.some(function (event) { return event.event_type === "monthly_plan"; }));
});

run("import-state retains the original JSON text in the state_import row", function () {
  var target = tempLedger();
  var state = {
    schemaVersion: 3, accounts: [], incomes: [], expenses: [], investments: [], transfers: [], snapshots: [],
    assetItems: [], liabilities: [], monthlyPlans: {}, rules: ""
  };
  var raw = JSON.stringify(state, null, 4) + "\n";
  var input = path.join(target.dir, "backup.json");
  fs.writeFileSync(input, raw, "utf8");
  var result = ledger.runCli(["import-state", "--file", target.file, "--input", input]);
  assert.strictEqual(result.ok, true);
  var stateImport = ledger.readLedger(target.file)[0];
  assert.strictEqual(stateImport.event_type, "state_import");
  assert.strictEqual(stateImport.raw_payload_json, raw);
  assert.strictEqual(ledger.validateLedger(target.file).ok, true);
});
