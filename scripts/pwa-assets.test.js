"use strict";

// Run with:
// node scripts/pwa-assets.test.js

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertFile(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), relativePath + " should exist");
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
  } catch (err) {
    console.error("FAIL " + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

test("index exposes installable PWA metadata", function () {
  var html = readText("index.html");
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<meta name="theme-color" content="#C9A66B">/);
  assert.match(html, /<script defer src="scripts\/app-pwa\.js(?:\?v=\d+)?"><\/script>/);
  assert.doesNotMatch(html, /navigator\.serviceWorker\.register/);
});

test("public product name is consistently 财记", function () {
  var html = readText("index.html");
  var manifest = JSON.parse(readText("manifest.webmanifest"));
  var icon = readText("icons/icon.svg");
  var dataActions = readText("scripts/app-actions-data.js");
  var sync = readText("scripts/app-sync.js");

  assert.match(html, /<title>财记<\/title>/);
  assert.match(html, /<footer>财记 · 本地优先版<\/footer>/);
  assert.strictEqual(manifest.name, "财记");
  assert.strictEqual(manifest.short_name, "财记");
  assert.match(icon, /aria-label="财记"/);
  assert.match(dataActions, /caiji-backup_/);
  assert.match(sync, /caiji-backup-before-cloud-pull_/);

  var retiredNames = [
    "财富" + "志",
    "财富自由" + "之路",
    "财富" + "中枢",
    "money" + "-os",
    "wealth" + "-road"
  ];
  [html, JSON.stringify(manifest), icon, dataActions, sync].forEach(function (content) {
    retiredNames.forEach(function (name) {
      assert.strictEqual(content.indexOf(name), -1, name + " should not return");
    });
  });
});

test("index declares a content security policy", function () {
  var html = readText("index.html");
  assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /object-src 'none'/);
});

test("auth module does not load Supabase from a broad CDN by default", function () {
  var auth = readText("scripts/app-auth.js");
  assert.doesNotMatch(auth, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/);
});

test("manifest declares standalone app icons", function () {
  assertFile("manifest.webmanifest");
  var manifest = JSON.parse(readText("manifest.webmanifest"));
  assert.strictEqual(manifest.display, "standalone");
  assert.strictEqual(manifest.start_url, "./index.html");
  assert.strictEqual(manifest.scope, "./");
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.some(function (icon) {
    return icon.src === "icons/icon-192.png" && icon.sizes === "192x192";
  }));
  assert.ok(manifest.icons.some(function (icon) {
    return icon.src === "icons/icon-512.png" && icon.sizes === "512x512";
  }));
});

test("manifest icon files exist", function () {
  assertFile("icons/icon.svg");
  assertFile("icons/icon-192.png");
  assertFile("icons/icon-512.png");
});

test("service worker precaches core shell assets", function () {
  assertFile("service-worker.js");
  var sw = readText("service-worker.js");
  [
    "./index.html",
    "./styles.css",
    "./scripts/app-state.js",
    "./scripts/app-actions.js",
    "./manifest.webmanifest"
  ].forEach(function (asset) {
    assert.ok(sw.indexOf(asset) !== -1, asset + " should be precached");
  });
  assert.match(sw, /self\.addEventListener\("install"/);
  assert.match(sw, /self\.addEventListener\("fetch"/);
});

test("service worker runtime cache only writes app shell assets", function () {
  var sw = readText("service-worker.js");
  assert.match(sw, /function isAppShellRequest/);
  assert.doesNotMatch(sw, /cache\.put\(request,/);
});
