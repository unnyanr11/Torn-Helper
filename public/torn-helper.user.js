// ==UserScript==
// @name Torn Command Center Companion
// @namespace torn-command-center
// @version 1.1.0
// @description Manual quick links to your Command Center. No Torn key storage or gameplay automation.
// @match https://www.torn.com/*
// @grant GM_setValue
// @grant GM_getValue
// @run-at document-idle
// ==/UserScript==
(function () {
  "use strict";
  GM_setValue("tcc_api_key", ""); // Remove the obsolete locally stored credential.
  const panel = document.createElement("aside");
  panel.setAttribute("aria-label", "Torn Command Center companion");
  panel.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:99999;background:#17212b;color:#fff;padding:16px;border-radius:12px;max-width:260px;font:14px sans-serif";
  let app;
  try {
    app = new URL(GM_getValue("tcc_app_url", "http://localhost:5173"));
    if (
      app.protocol !== "https:" &&
      !(app.hostname === "localhost" && app.protocol === "http:")
    )
      throw new Error();
  } catch {
    return;
  }
  const title = document.createElement("strong");
  title.textContent = "Torn Command Center";
  panel.append(title);
  function link(label, route) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = app.origin + app.pathname.replace(/\/$/, "") + "/#/" + route;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.cssText = "display:block;color:#9bdeff;margin:8px 0";
    panel.append(a);
  }
  link("Open Command Center", "Overview");
  link("Targets", "Targets");
  link("War Room", "War%20Room");
  const input = document.createElement("input");
  input.placeholder = "Player Torn ID";
  input.setAttribute("aria-label", "Player Torn ID");
  input.inputMode = "numeric";
  panel.append(input);
  const lookup = document.createElement("button");
  lookup.textContent = "View player in app";
  lookup.onclick = () => {
    if (!/^[1-9]\d*$/.test(input.value)) return;
    window.open(
      app.origin +
        app.pathname.replace(/\/$/, "") +
        "/#/Player%20Intel?player=" +
        input.value,
      "_blank",
      "noopener,noreferrer",
    );
  };
  panel.append(lookup);
  const settings = document.createElement("button");
  settings.textContent = "Set app URL";
  settings.onclick = () => {
    const value = prompt("Your Command Center HTTPS URL:", app.href);
    if (!value) return;
    try {
      const next = new URL(value);
      if (
        next.protocol !== "https:" &&
        !(next.hostname === "localhost" && next.protocol === "http:")
      )
        throw new Error();
      GM_setValue("tcc_app_url", next.origin + next.pathname);
      location.reload();
    } catch {
      alert("Enter a valid HTTPS app URL.");
    }
  };
  panel.append(settings);
  const close = document.createElement("button");
  close.textContent = "Hide panel";
  close.onclick = () => panel.remove();
  panel.append(close);
  document.body.append(panel);
})();
