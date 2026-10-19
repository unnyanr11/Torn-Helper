// ==UserScript==
// @name         Torn Command Center Companion
// @namespace    torn-command-center
// @version      1.0.0
// @description  Floating quick-links panel and target lookup for Torn City, companion to Torn Command Center.
// @author       Torn Command Center
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const APP_URL = GM_getValue('tcc_app_url', 'http://localhost:5173');
  const API_KEY = GM_getValue('tcc_api_key', '');

  const panel = document.createElement('div');
  panel.id = 'tcc-companion';
  panel.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:#1a1a2e;color:#eee;border:1px solid #444;border-radius:12px;padding:12px;font-family:sans-serif;font-size:13px;max-width:260px;box-shadow:0 4px 16px rgba(0,0,0,.5);';
  panel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px;">Torn Command Center</div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <a href="${APP_URL}/" target="_blank" style="color:#7dd3fc;">Open Command Center</a>
      <a href="${APP_URL}/#/Targets" target="_blank" style="color:#7dd3fc;">Targets</a>
      <a href="${APP_URL}/#/War%20Room" target="_blank" style="color:#7dd3fc;">War Room</a>
      <a href="${APP_URL}/#/Dibs" target="_blank" style="color:#7dd3fc;">Dibs</a>
    </div>
    <div style="margin-top:10px;">
      <input id="tcc-target-id" placeholder="Target ID" style="width:100%;padding:4px;border-radius:6px;border:1px solid #555;background:#222;color:#eee;" />
      <button id="tcc-lookup" style="margin-top:4px;width:100%;padding:4px;border-radius:6px;border:none;background:#3b82f6;color:#fff;cursor:pointer;">Look up</button>
      <div id="tcc-result" style="margin-top:6px;font-size:12px;"></div>
    </div>
    <div style="margin-top:8px;font-size:11px;color:#888;">
      <a href="#" id="tcc-settings" style="color:#888;">Settings</a>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('tcc-lookup').addEventListener('click', async () => {
    const id = document.getElementById('tcc-target-id').value.trim();
    const result = document.getElementById('tcc-result');
    if (!id || !API_KEY) { result.textContent = API_KEY ? 'Enter a target ID' : 'Set your API key in Settings'; return; }
    result.textContent = 'Loading…';
    try {
      const res = await fetch(`https://api.torn.com/v2/user/${id}?selections=basic,profile&key=${API_KEY}`);
      const data = await res.json();
      if (data.error) { result.textContent = `Error: ${data.error.error}`; return; }
      const u = data;
      result.innerHTML = `<b>${u.name}</b> [${u.player_id}]<br>Level ${u.level} • ${u.status.state}<br><a href="${APP_URL}/#/Compare%20Players" target="_blank" style="color:#7dd3fc;">Compare in app</a>`;
    } catch (e) {
      result.textContent = 'Lookup failed';
    }
  });

  document.getElementById('tcc-settings').addEventListener('click', (e) => {
    e.preventDefault();
    const url = prompt('Command Center URL:', APP_URL);
    if (url) { GM_setValue('tcc_app_url', url); location.reload(); }
    const key = prompt('Torn API key (stored locally in your browser):', API_KEY);
    if (key !== null) { GM_setValue('tcc_api_key', key); location.reload(); }
  });
})();
