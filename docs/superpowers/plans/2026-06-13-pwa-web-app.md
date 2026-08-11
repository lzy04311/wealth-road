# PWA Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the static finance web app installable from mobile browsers as a PWA.

**Architecture:** Keep the app static and dependency-free. Add a web app manifest, service worker, local app icons, and a focused Node-based asset contract test.

**Tech Stack:** HTML, vanilla JavaScript, Web App Manifest, Service Worker, Node `assert`.

---

### Task 1: PWA Asset Contract

**Files:**
- Create: `scripts/pwa-assets.test.js`
- Modify: `index.html`
- Create: `manifest.webmanifest`
- Create: `service-worker.js`
- Create: `icons/icon.svg`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`

- [x] **Step 1: Write the failing test**

Create `scripts/pwa-assets.test.js` to verify that the HTML, manifest, icons, and service worker form a valid installable PWA contract.

- [x] **Step 2: Run test to verify it fails**

Run: `node scripts/pwa-assets.test.js`
Expected before implementation: FAIL because `manifest.webmanifest` does not exist.

- [x] **Step 3: Add PWA files and HTML hooks**

Add manifest metadata, app icons, service worker caching, and registration code in `index.html`.

- [x] **Step 4: Run tests**

Run:
`node scripts/pwa-assets.test.js`
`node scripts/app-data-safety.test.js`
`node scripts/app-render-smoke.test.js`

- [x] **Step 5: Browser verification**

Serve the folder over localhost and verify `/manifest.webmanifest` and `/service-worker.js` return HTTP 200.
