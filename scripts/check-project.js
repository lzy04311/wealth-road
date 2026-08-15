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
function browserScriptFiles() {
  var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  var files = [];
  var pattern = /<script\b[^>]*\bsrc="([^"]+\.js)(?:\?[^\"]*)?"[^>]*><\/script>/g;
  var match;
  while ((match = pattern.exec(html))) files.push(path.join(root, match[1]));
  return files;
}

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

check("browser global symbols", function () {
  var declarations = {};
  browserScriptFiles().forEach(function (filePath) {
    var content = fs.readFileSync(filePath, "utf8");
    var patterns = [
      /^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm,
      /^(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/gm
    ];
    patterns.forEach(function (pattern) {
      var match;
      while ((match = pattern.exec(content))) {
        if (!declarations[match[1]]) declarations[match[1]] = [];
        declarations[match[1]].push(relative(filePath));
      }
    });
  });
  var duplicates = Object.keys(declarations).filter(function (name) { return declarations[name].length > 1; }).map(function (name) {
    return name + " -> " + declarations[name].join(", ");
  });
  assert(duplicates.length === 0, duplicates.join("\n"));
  return Object.keys(declarations).length + " unique declarations";
});

check("HTML DOM contract", function () {
  var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  var ids = {};
  var idPattern = /\bid="([^"]+)"/g;
  var match;
  while ((match = idPattern.exec(html))) ids[match[1]] = (ids[match[1]] || 0) + 1;
  var duplicateIds = Object.keys(ids).filter(function (id) { return ids[id] > 1; });
  var missing = [];
  browserScriptFiles().forEach(function (filePath) {
    var content = fs.readFileSync(filePath, "utf8");
    var referencePattern = /\bbyId\("([^"]+)"\)/g;
    while ((match = referencePattern.exec(content))) {
      if (!ids[match[1]]) missing.push(relative(filePath) + " -> #" + match[1]);
    }
  });
  assert(duplicateIds.length === 0, "duplicate ids: " + duplicateIds.join(", "));
  assert(missing.length === 0, "missing literal ids:\n" + missing.join("\n"));
  return Object.keys(ids).length + " unique ids";
});

check("CSS important allowlist", function () {
  var cssFiles = walk(path.join(root, "styles"), function (filePath) { return path.extname(filePath) === ".css"; });
  var findings = [];
  cssFiles.forEach(function (filePath) {
    fs.readFileSync(filePath, "utf8").split(/\r?\n/).forEach(function (line, index) {
      if (line.indexOf("!important") >= 0) findings.push({ file: relative(filePath), line: index + 1, text: line.trim() });
    });
  });
  assert(findings.length === 1, "expected one allowlisted !important declaration, found " + findings.length + ":\n" + findings.map(function (item) { return item.file + ":" + item.line + " " + item.text; }).join("\n"));
  assert(findings[0].file === "styles/base.css", "!important is only allowed in styles/base.css: " + findings[0].file + ":" + findings[0].line);
  assert(findings[0].text === ".hidden-view { display: none !important; }", "unexpected allowlisted declaration at styles/base.css:" + findings[0].line + ": " + findings[0].text);
  return "1 allowlisted declaration · .hidden-view";
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
