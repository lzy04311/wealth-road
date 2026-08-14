"use strict";

// Run with:
// node scripts/check-project.js

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var failures = [];

function relative(filePath) { return path.relative(root, filePath).replace(/\\/g, "/"); }
function ignoredDirectory(name) { return name === ".git" || name === "node_modules" || name === "data"; }
function walk(directory, predicate, files) {
  files = files || [];
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    if (entry.isDirectory() && ignoredDirectory(entry.name)) return;
    var fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, files);
    else if (!predicate || predicate(fullPath)) files.push(fullPath);
  });
  return files;
}
function run(label, command, args) {
  process.stdout.write("\n== " + label + " ==\n");
  var result = childProcess.spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (result.error || result.status !== 0) failures.push(label);
}
function check(label, fn) {
  process.stdout.write("\n== " + label + " ==\n");
  try {
    var detail = fn();
    console.log("PASS " + label + (detail ? " · " + detail : ""));
  } catch (error) {
    failures.push(label);
    console.error("FAIL " + label);
    console.error(error && error.message ? error.message : error);
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

[
  ["data safety", "scripts/app-data-safety.test.js"],
  ["render and sync smoke", "scripts/app-render-smoke.test.js"],
  ["PWA and brand", "scripts/pwa-assets.test.js"],
  ["private finance ledger", "scripts/finance-ledger.test.js"]
].forEach(function (entry) { run(entry[0], process.execPath, [entry[1]]); });

check("JavaScript syntax", function () {
  var files = walk(root, function (filePath) { return path.extname(filePath) === ".js"; });
  files.forEach(function (filePath) {
    var result = childProcess.spawnSync(process.execPath, ["--check", filePath], { cwd: root, encoding: "utf8" });
    assert(result.status === 0, relative(filePath) + "\n" + (result.stderr || result.stdout || "syntax check failed"));
  });
  return files.length + " files";
});

check("retired product names", function () {
  var retiredNames = ["财富" + "志", "财富自由" + "之路", "财富" + "中枢", "money" + "-os", "wealth" + "-road", "通用个人资金管理网页" + " App"];
  var textExtensions = { ".css": true, ".html": true, ".js": true, ".json": true, ".md": true, ".svg": true };
  var hits = [];
  walk(root, function (filePath) { return !!textExtensions[path.extname(filePath).toLowerCase()]; }).forEach(function (filePath) {
    var content = fs.readFileSync(filePath, "utf8");
    retiredNames.forEach(function (name) { if (content.indexOf(name) !== -1) hits.push(relative(filePath) + ": " + name); });
  });
  assert(hits.length === 0, hits.join("\n"));
  return "0 occurrences";
});

check("Markdown links", function () {
  var files = walk(root, function (filePath) { return path.extname(filePath) === ".md"; });
  var missing = [];
  files.forEach(function (filePath) {
    var content = fs.readFileSync(filePath, "utf8");
    var pattern = /\[[^\]]*\]\(([^)]+)\)/g;
    var match;
    while ((match = pattern.exec(content))) {
      var target = match[1].trim();
      if (/^(https?:\/\/|mailto:|#)/.test(target)) continue;
      target = target.split("#")[0];
      if (!target) continue;
      var candidate = path.resolve(path.dirname(filePath), decodeURIComponent(target));
      if (!fs.existsSync(candidate)) missing.push(relative(filePath) + " -> " + target);
    }
  });
  assert(missing.length === 0, missing.join("\n"));
  return files.length + " files";
});

run("unstaged whitespace", "git", ["diff", "--check"]);
run("staged whitespace", "git", ["diff", "--cached", "--check"]);

check("private ledger guard", function () {
  var ignored = childProcess.spawnSync("git", ["check-ignore", "-q", "data/raw/wealth-events.csv"], { cwd: root });
  assert(ignored.status === 0, "data/raw/wealth-events.csv is not ignored");
  var tracked = childProcess.spawnSync("git", ["ls-files", "--", "data/raw/wealth-events.csv"], { cwd: root, encoding: "utf8" });
  assert(tracked.status === 0 && !String(tracked.stdout || "").trim(), "private ledger is tracked");
  return "ignored and untracked";
});

if (failures.length) {
  console.error("\nPROJECT CHECK FAILED: " + failures.join(", "));
  process.exit(1);
}
console.log("\nPROJECT CHECK PASSED");
