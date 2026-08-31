"use strict";

// Zero-dependency screenshot regression gate. The committed images capture the
// current product UI, while the DOM/browser gate owns geometry and accessibility
// invariants that must remain stable across browser and font-rendering platforms.
var childProcess = require("child_process");
var fs = require("fs");
var http = require("http");
var os = require("os");
var path = require("path");
var zlib = require("zlib");

var root = path.join(__dirname, "..");
var baselineRoot = path.join(root, "tests", "visual", "baselines");
var update = process.argv.indexOf("--update") >= 0;
var channelTolerance = 24;
var changedPixelRatioLimit = 0.08;
var meanChannelDifferenceLimit = 5;

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
      setTimeout(function () { response.writeHead(204, { "Cache-Control": "no-store" }); response.end(); }, 2500);
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

function capture(executable, url, profile, outputPath, width, height) {
  return new Promise(function (resolve, reject) {
    var args = [
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-sandbox",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--force-device-scale-factor=1",
      "--user-data-dir=" + profile,
      "--window-size=" + width + "," + height,
      "--virtual-time-budget=3500",
      "--screenshot=" + outputPath,
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
      reject(new Error("visual browser gate timed out"));
    }, 30000);
    child.on("error", function (error) { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    child.on("close", function (code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) { reject(new Error("browser exited " + code + "\n" + stderr.slice(-1600))); return; }
      if (stdout.indexOf('data-visual-gate="pass"') === -1) {
        var message = (stdout.match(/data-visual-error="([^"]*)"/) || [])[1] || "visual page did not report readiness";
        reject(new Error(message));
        return;
      }
      if (!fs.existsSync(outputPath)) { reject(new Error("browser did not create screenshot " + outputPath)); return; }
      resolve();
    });
  });
}

function paeth(a, b, c) {
  var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function decodePng(filePath) {
  var file = fs.readFileSync(filePath);
  if (!file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("invalid PNG signature: " + filePath);
  var offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0, chunks = [];
  while (offset < file.length) {
    var length = file.readUInt32BE(offset), type = file.toString("ascii", offset + 4, offset + 8), data = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    if (type === "IDAT") chunks.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (bitDepth !== 8 || interlace !== 0 || [0, 2, 6].indexOf(colorType) === -1) throw new Error("unsupported PNG format: " + bitDepth + "/" + colorType + "/" + interlace);
  var source = zlib.inflateSync(Buffer.concat(chunks));
  var bytesPerPixel = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
  var stride = width * bytesPerPixel, previous = Buffer.alloc(stride), rgba = Buffer.alloc(width * height * 4), sourceOffset = 0;
  for (var y = 0; y < height; y += 1) {
    var filter = source[sourceOffset++], row = Buffer.alloc(stride);
    for (var x = 0; x < stride; x += 1) {
      var raw = source[sourceOffset++], left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0, up = previous[x] || 0, upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 0) row[x] = raw;
      else if (filter === 1) row[x] = (raw + left) & 255;
      else if (filter === 2) row[x] = (raw + up) & 255;
      else if (filter === 3) row[x] = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[x] = (raw + paeth(left, up, upperLeft)) & 255;
      else throw new Error("unsupported PNG filter " + filter);
    }
    for (x = 0; x < width; x += 1) {
      var src = x * bytesPerPixel, dest = (y * width + x) * 4;
      if (colorType === 0) rgba[dest] = rgba[dest + 1] = rgba[dest + 2] = row[src];
      else { rgba[dest] = row[src]; rgba[dest + 1] = row[src + 1]; rgba[dest + 2] = row[src + 2]; }
      rgba[dest + 3] = colorType === 6 ? row[src + 3] : 255;
    }
    previous = row;
  }
  return { width: width, height: height, pixels: rgba };
}

function compareImages(actualPath, baselinePath) {
  var actual = decodePng(actualPath), baseline = decodePng(baselinePath);
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    throw new Error("screenshot dimensions changed: expected " + baseline.width + "x" + baseline.height + ", received " + actual.width + "x" + actual.height);
  }
  var changed = 0, absolute = 0, pixels = actual.width * actual.height;
  for (var index = 0; index < actual.pixels.length; index += 4) {
    var red = Math.abs(actual.pixels[index] - baseline.pixels[index]);
    var green = Math.abs(actual.pixels[index + 1] - baseline.pixels[index + 1]);
    var blue = Math.abs(actual.pixels[index + 2] - baseline.pixels[index + 2]);
    absolute += red + green + blue;
    if (Math.max(red, green, blue) > channelTolerance) changed += 1;
  }
  var changedRatio = changed / pixels, meanDifference = absolute / (pixels * 3);
  if (changedRatio > changedPixelRatioLimit || meanDifference > meanChannelDifferenceLimit) {
    throw new Error("visual difference exceeded tolerance: " + (changedRatio * 100).toFixed(2) + "% changed pixels, mean channel difference " + meanDifference.toFixed(2) + " (limits " + (changedPixelRatioLimit * 100).toFixed(0) + "% / " + meanChannelDifferenceLimit + ")\nactual: " + actualPath + "\nbaseline: " + baselinePath);
  }
  return { changedRatio: changedRatio, meanDifference: meanDifference };
}

(async function () {
  var executable = executableCandidates()[0];
  if (!executable) throw new Error("No installed Edge/Chrome binary found for the required visual regression gate");
  var outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "caiji-visual-output-"));
  var server = createServer();
  var scenarios = [
    { name: "dashboard-desktop", width: 1440, height: 900 },
    { name: "dashboard-mobile", width: 390, height: 844 }
  ];
  try {
    await new Promise(function (resolve, reject) { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    var port = server.address().port;
    if (update) fs.mkdirSync(baselineRoot, { recursive: true });
    for (var index = 0; index < scenarios.length; index += 1) {
      var scenario = scenarios[index], actualPath = path.join(outputRoot, scenario.name + ".png"), baselinePath = path.join(baselineRoot, scenario.name + ".png");
      var profile = fs.mkdtempSync(path.join(os.tmpdir(), "caiji-visual-profile-"));
      try {
        await capture(executable, "http://127.0.0.1:" + port + "/tests/browser/visual-gate.html?mode=" + (scenario.width <= 680 ? "mobile" : "desktop"), profile, actualPath, scenario.width, scenario.height);
      } finally {
        fs.rmSync(profile, { recursive: true, force: true });
      }
      if (update) {
        fs.copyFileSync(actualPath, baselinePath);
        console.log("UPDATED " + path.relative(root, baselinePath).replace(/\\/g, "/"));
      } else {
        if (!fs.existsSync(baselinePath)) throw new Error("missing visual baseline " + path.relative(root, baselinePath).replace(/\\/g, "/") + "; run node scripts/browser-visual-regression.test.js --update after visual review");
        var result = compareImages(actualPath, baselinePath);
        console.log("PASS " + scenario.name + " · " + scenario.width + "x" + scenario.height + " · " + (result.changedRatio * 100).toFixed(2) + "% changed · mean " + result.meanDifference.toFixed(2));
      }
    }
    if (!update) console.log("PASS visual regression · deterministic fixture · desktop + mobile screenshots");
  } finally {
    await new Promise(function (resolve) { server.close(resolve); });
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
})().catch(function (error) {
  console.error("FAIL visual regression");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
