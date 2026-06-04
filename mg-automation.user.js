// ==UserScript==
// @name         MG Automation Loader
// @namespace    Quinoa
// @version      1.0
// @description  Smart loader for MG Automation modules
// @match        https://1227719606223765687.discordsays.com/*
// @match        https://magiccircle.gg/r/*
// @match        https://magicgarden.gg/r/*
// @match        https://starweaver.org/r/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  'use strict';

  const REPO = "Ombrya/Auto-mod";
  const BRANCH = "main";
  const BASE_RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/src/`;

  const FILES = [
    "mg-utils.js",
    "mg-core.js",
    "mg-ui.js",
    "mg-bootstrap.js"
  ];

  const LS_SHA = "mgAutomation.loader.sha";
  const LS_PREFIX = "mgAutomation.loader.file.";

  function request(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: {
          "Accept": "application/vnd.github+json"
        },
        onload: (res) => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`HTTP ${res.status}: ${url}`));
            return;
          }
          resolve(res.responseText);
        },
        onerror: reject
      });
    });
  }

  async function getLatestSha() {
    const url = `https://api.github.com/repos/${REPO}/commits/${BRANCH}`;
    const raw = await request(url);
    return JSON.parse(raw).sha;
  }

  async function downloadFile(file) {
    return request(BASE_RAW + file);
  }

  function inject(code, file) {
    const script = document.createElement("script");
    script.textContent = `${code}\n//# sourceURL=mg-automation/${file}`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  function getCachedFile(file) {
    return localStorage.getItem(LS_PREFIX + file);
  }

  function setCachedFile(file, code) {
    localStorage.setItem(LS_PREFIX + file, code);
  }

  async function refreshCache(sha) {
    console.log("[MG Loader] Updating modules from GitHub:", sha);

    for (const file of FILES) {
      const code = await downloadFile(file);
      setCachedFile(file, code);
      console.log("[MG Loader] Cached", file);
    }

    localStorage.setItem(LS_SHA, sha);
  }

  async function loadFromCache() {
    for (const file of FILES) {
      const code = getCachedFile(file);
      if (!code) throw new Error(`Missing cached file: ${file}`);
      inject(code, file);
      console.log("[MG Loader] Loaded", file);
    }
  }

  async function main() {
    console.log("[MG Loader] Starting");

    try {
      const latestSha = await getLatestSha();
      const cachedSha = localStorage.getItem(LS_SHA);

      if (latestSha !== cachedSha) {
        await refreshCache(latestSha);
      } else {
        console.log("[MG Loader] Cache up to date:", cachedSha);
      }

      await loadFromCache();

      console.log("[MG Loader] Ready");
    } catch (err) {
      console.error("[MG Loader] Failed, trying cached modules", err);

      try {
        await loadFromCache();
        console.log("[MG Loader] Ready from cache");
      } catch (cacheErr) {
        console.error("[MG Loader] No usable cache", cacheErr);
      }
    }
  }

  main();
})();