"use strict";

var CACHE_NAME = "caiji-pwa-v22";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css",
  "./styles/base.css",
  "./styles/components.css",
  "./styles/modals.css",
  "./styles/dashboard.css",
  "./styles/pages.css",
  "./styles/subpages.css",
  "./styles/responsive.css",
  "./styles/dashboard/layout.css",
  "./styles/dashboard/layout-topbar.css",
  "./styles/dashboard/layout-shell.css",
  "./styles/dashboard/layout-main-center-right.css",
  "./styles/dashboard/layout-bottom-strip.css",
  "./styles/dashboard/layout-bottom-nav.css",
  "./styles/dashboard/responsive.css",
  "./scripts/app-state.js",
  "./scripts/app-validators.js",
  "./scripts/app-migrations.js",
  "./scripts/app-storage.js",
  "./scripts/app-backend-config.js",
  "./scripts/app-calculations.js",
  "./scripts/app-render-core.js",
  "./scripts/dashboard/dashboard-formatters.js",
  "./scripts/dashboard/render-bottom-strip.js",
  "./scripts/app-render-dashboard.js",
  "./scripts/app-render-assets.js",
  "./scripts/app-render-records.js",
  "./scripts/app-render-investments.js",
  "./scripts/app-render-monthly.js",
  "./scripts/app-render-flow.js",
  "./scripts/app-actions-data.js",
  "./scripts/app-actions-crud.js",
  "./scripts/app-actions-quick-entry.js",
  "./scripts/app-actions-modals.js",
  "./scripts/app-auth.js",
  "./scripts/app-sync.js",
  "./scripts/app-actions-navigation.js",
  "./scripts/app-actions.js",
  "./scripts/app-pwa.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

var APP_SHELL_URLS = APP_SHELL.map(function (path) {
  return new URL(path, self.registration.scope).href;
});

function isAppShellRequest(requestUrl) {
  return APP_SHELL_URLS.indexOf(requestUrl.href) !== -1;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(cacheNames.map(function (cacheName) {
        if (cacheName !== CACHE_NAME) {
          return caches.delete(cacheName);
        }
        return undefined;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("./index.html");
      })
    );
    return;
  }

  if (!isAppShellRequest(requestUrl) && !APP_SHELL_URLS.some(function (url) { return requestUrl.href.split("?")[0] === url; })) {
    return;
  }

  event.respondWith(
    fetch(request).then(function (networkResponse) {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        var responseCopy = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(requestUrl.href, responseCopy);
        });
        return networkResponse;
      }).catch(function () {
        return caches.match(requestUrl.href).then(function (cachedResponse) {
          return cachedResponse || caches.match(requestUrl.href.split("?")[0]);
        });
      })
  );
});
