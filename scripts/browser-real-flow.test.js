"use strict";

// Zero-dependency real-browser gate. Starts a localhost server and asks an installed
// Edge/Chrome binary to execute the mobile flow in tests/browser/quality-gate.html.
var childProcess = require("child_process");
var fs = require("fs");
var http = require("http");
var os = require("os");
var path = require("path");

var root = path.join(__dirname, "..");

function executableCandidates() {
  var candidates = [process.env.CHROME_PATH];
  if (process.platform === "win32") {
    [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].forEach(function (base) {
      if (!base) return;
      candidates.push(path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"));
      candidates.push(path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
    });
  } else {
    ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"].forEach(function (name) {
      var found = childProcess.spawnSync("which", [name], { encoding: "utf8" });
      if (found.status === 0) candidates.push(String(found.stdout || "").trim());
    });
  }
  return candidates.filter(function (candidate, index, rows) { return candidate && rows.indexOf(candidate) === index && fs.existsSync(candidate); });
}

function contentType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" })[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function createServer() {
  return http.createServer(function (request, response) {
    var requestPath;
    try { requestPath = decodeURIComponent(String(request.url || "/").split("?")[0]); }
    catch (err) { response.writeHead(400); response.end("bad request"); return; }
    if (requestPath === "/__gate_delay__") {
      setTimeout(function () { response.writeHead(204, { "Cache-Control": "no-store" }); response.end(); }, 5000);
      return;
    }
    var relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    var filePath = path.resolve(root, relative);
    if (filePath !== root && filePath.indexOf(root + path.sep) !== 0) { response.writeHead(403); response.end("forbidden"); return; }
    fs.readFile(filePath, function (error, body) {
      if (error) { response.writeHead(404); response.end("not found"); return; }
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(body);
    });
  });
}

function runBrowser(executable, url, profile) {
  return new Promise(function (resolve, reject) {
    var args = [
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-sandbox",
      "--disable-software-rasterizer",
      "--disable-features=Vulkan,SkiaGraphite",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--user-data-dir=" + profile,
      "--window-size=390,844",
      "--virtual-time-budget=2000",
      "--dump-dom",
      url
    ];
    var child = childProcess.spawn(executable, args, { windowsHide: true });
    var stdout = "", stderr = "", settled = false;
    child.stdout.on("data", function (chunk) { stdout += chunk; });
    child.stderr.on("data", function (chunk) { stderr += chunk; });
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("browser gate timed out"));
    }, 25000);
    child.on("error", function (error) { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    child.on("close", function (code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) { reject(new Error("browser exited " + code + "\n" + stderr.slice(-1600))); return; }
      resolve(stdout);
    });
  });
}

(async function () {
  var executable = executableCandidates()[0];
  if (!executable) throw new Error("No installed Edge/Chrome binary found for the required real-browser gate");
  var profile = fs.mkdtempSync(path.join(os.tmpdir(), "caiji-browser-gate-"));
  var server = createServer();
  try {
    await new Promise(function (resolve, reject) { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    var address = server.address();
    var html = await runBrowser(executable, "http://127.0.0.1:" + address.port + "/tests/browser/quality-gate.html", profile);
    if (html.indexOf('data-browser-gate="pass"') === -1) {
      var result = (html.match(/<pre id="result">([\s\S]*?)<\/pre>/) || [])[1] || "browser gate did not report a result";
      throw new Error(result.replace(/<[^>]+>/g, ""));
    }
    console.log("PASS real browser flow · Edge/Chrome · 390x844 · localStorage + IndexedDB + mobile visual/a11y contract");
  } finally {
    await new Promise(function (resolve) { server.close(resolve); });
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(function (error) {
  console.error("FAIL real browser flow");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
