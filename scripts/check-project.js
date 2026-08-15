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

check("browser layer boundaries", function () {
  var scripts = browserScriptFiles().map(relative);
  function position(file) {
    var index = scripts.indexOf(file);
    assert(index >= 0, file + " is missing from index.html");
    return index;
  }
  assert(position("scripts/app-state.js") < position("scripts/app-ui-feedback.js"), "state must load before UI feedback");
  assert(position("scripts/app-ui-feedback.js") < position("scripts/app-storage.js"), "UI feedback must exist before storage save paths run");
  assert(position("scripts/app-calculations.js") < position("scripts/app-render-core.js"), "calculations must load before render context");
  assert(position("scripts/app-actions-modals.js") < position("scripts/app-actions-forms.js"), "form lifecycle must load before form bindings");
  assert(position("scripts/app-actions-forms.js") < position("scripts/app-actions.js"), "form bindings must load before app initialization");

  var stateSource = fs.readFileSync(path.join(root, "scripts/app-state.js"), "utf8");
  var feedbackSource = fs.readFileSync(path.join(root, "scripts/app-ui-feedback.js"), "utf8");
  var renderCoreSource = fs.readFileSync(path.join(root, "scripts/app-render-core.js"), "utf8");
  var actionsSource = fs.readFileSync(path.join(root, "scripts/app-actions.js"), "utf8");
  var formActionsSource = fs.readFileSync(path.join(root, "scripts/app-actions-forms.js"), "utf8");
  assert(stateSource.indexOf("function notify(") === -1, "UI feedback must not return to app-state.js");
  assert(stateSource.indexOf("renderContextCache") === -1, "render context must not return to app-state.js");
  assert(feedbackSource.indexOf("function notify(") >= 0, "app-ui-feedback.js must own notifications");
  assert(renderCoreSource.indexOf("renderContextCache") >= 0, "app-render-core.js must own render context");
  assert(actionsSource.indexOf("addEventListener(\"submit\"") === -1, "form submit bindings must not return to app-actions.js");
  assert(formActionsSource.indexOf("function bindFormSubmits(") >= 0, "app-actions-forms.js must expose the form binding entry");

  var stylesEntry = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  var pagesSource = fs.readFileSync(path.join(root, "styles/pages.css"), "utf8");
  var subpagesSource = fs.readFileSync(path.join(root, "styles/subpages.css"), "utf8");
  var controlsSource = fs.readFileSync(path.join(root, "styles/controls.css"), "utf8");
  var workspaceBaseSource = fs.readFileSync(path.join(root, "styles/subpages/workspace-base.css"), "utf8");
  var hierarchySource = fs.readFileSync(path.join(root, "styles/subpages/hierarchy.css"), "utf8");
  var indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  var serviceWorkerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  function cssImportRecords(source) {
    var records = [];
    var pattern = /@import\s+url\("([^"?]+)(?:\?v=(\d+))?"\);/g;
    var match;
    while ((match = pattern.exec(source))) records.push({ target: match[1], version: match[2] || "" });
    return records;
  }
  function cssImportTargets(source) { return cssImportRecords(source).map(function (record) { return record.target; }); }
  function importedVersion(source, target) {
    var record = cssImportRecords(source).find(function (candidate) { return candidate.target === target; });
    assert(record && record.version, target + " must have a cache version");
    return record.version;
  }
  var expectedPageImports = ["./pages/assets.css", "./pages/accounts.css", "./pages/records.css", "./pages/data.css", "./pages/flow.css", "./pages/investments.css"];
  var expectedSubpageImports = ["./subpages/workspace-base.css", "./subpages/hierarchy.css", "./subpages/form-drawer.css"];
  assert(stylesEntry.indexOf("styles/controls.css") >= 0, "styles.css must load the controls layer");
  assert(stylesEntry.indexOf("styles/controls.css") < stylesEntry.indexOf("styles/pages.css"), "shared controls must load before page-specific styles");
  assert(JSON.stringify(cssImportTargets(pagesSource)) === JSON.stringify(expectedPageImports), "styles/pages.css import order changed");
  assert(JSON.stringify(cssImportTargets(subpagesSource)) === JSON.stringify(expectedSubpageImports), "styles/subpages.css import order changed");
  assert(pagesSource.replace(/@import[^;]+;/g, "").trim() === "", "styles/pages.css must remain import-only");
  assert(subpagesSource.replace(/@import[^;]+;/g, "").trim() === "", "styles/subpages.css must remain import-only");
  var pageEntryVersion = importedVersion(stylesEntry, "./styles/pages.css");
  var subpageEntryVersion = importedVersion(stylesEntry, "./styles/subpages.css");
  assert(cssImportRecords(pagesSource).every(function (record) { return record.version === pageEntryVersion; }), "page CSS module cache versions must match styles/pages.css");
  assert(cssImportRecords(subpagesSource).every(function (record) { return record.version === subpageEntryVersion; }), "subpage CSS module cache versions must match styles/subpages.css");
  var rootStylesVersion = (indexSource.match(/styles\.css\?v=(\d+)/) || [])[1];
  var serviceWorkerVersion = (serviceWorkerSource.match(/caiji-pwa-v(\d+)/) || [])[1];
  assert(rootStylesVersion && rootStylesVersion === serviceWorkerVersion, "index stylesheet and service-worker cache versions must match");
  expectedPageImports.concat(expectedSubpageImports).forEach(function (target) {
    assert(fs.existsSync(path.resolve(path.join(root, "styles"), target)), target + " is missing");
  });
  assert(controlsSource.indexOf(".form-grid") >= 0 && controlsSource.indexOf(".btn.primary") >= 0, "styles/controls.css must own shared forms and buttons");
  var workspaceShellSelectors = [
    ".module-page-mode .app",
    ".module-page-mode .module-page-header",
    ".module-page-mode .module-page-header::after",
    ".module-page-mode .module-back-btn",
    ".module-page-mode .module-page-header h2",
    ".module-page-mode .module-page-header p",
    ".subpage-context-bar",
    ".subpage-context-bar p"
  ];
  workspaceShellSelectors.forEach(function (selector) {
    assert(workspaceBaseSource.indexOf(selector) >= 0, "workspace shell selector is missing from workspace-base.css: " + selector);
    assert(hierarchySource.indexOf(selector) === -1, "workspace shell selector must not return to hierarchy.css: " + selector);
  });
  return scripts.length + " ordered scripts · 9 ordered page CSS modules · state/UI/actions/CSS shell/cache ownership enforced";
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
