(() => {
  "use strict";

  if (window.__aiPanduWidgetLoaded) return;
  window.__aiPanduWidgetLoaded = true;

  const script = document.currentScript;
  const appKey = String(script?.dataset?.appKey || "").trim().toLowerCase();
  const baseUrl = new URL(script?.src || window.location.href).origin;
  if (!appKey) {
    console.error("aiPandu: data-app-key is required.");
    return;
  }

  const host = document.createElement("div");
  host.id = "aipandu-widget-host";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{all:initial}
      .launcher{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:58px;height:58px;border:0;border-radius:50%;background:linear-gradient(145deg,#0f766e,#155e75);color:#fff;box-shadow:0 14px 34px rgba(15,23,42,.28);cursor:pointer;font:800 21px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;transition:transform .18s ease,box-shadow .18s ease}
      .launcher:hover{transform:translateY(-2px);box-shadow:0 18px 38px rgba(15,23,42,.34)}
      .launcher:focus-visible{outline:3px solid #fbbf24;outline-offset:3px}
      .launcher-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.35);border-radius:50%}
      .panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:min(390px,calc(100vw - 24px));height:min(650px,calc(100vh - 112px));border:0;border-radius:22px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.34);overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
      .panel.open{opacity:1;transform:none;pointer-events:auto}
      iframe{display:block;width:100%;height:100%;border:0;background:#f8fafc}
      .status{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#475569;background:#f8fafc;font:600 14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      @media(max-width:520px){.launcher{right:14px;bottom:14px}.panel{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}}
      @media(prefers-reduced-motion:reduce){.launcher,.panel{transition:none}}
    </style>
    <section class="panel" aria-label="aiPandu help" aria-hidden="true">
      <div class="status">Open aiPandu to get help.</div>
    </section>
    <button class="launcher" type="button" aria-label="Open aiPandu help" aria-expanded="false">
      <span class="launcher-mark" aria-hidden="true">P</span>
    </button>`;

  const launcher = shadow.querySelector(".launcher");
  const panel = shadow.querySelector(".panel");
  const status = shadow.querySelector(".status");
  let frame = null;
  let token = "";
  let opening = null;

  async function createSession() {
    const response = await fetch(`${baseUrl}/api/session?appKey=${encodeURIComponent(appKey)}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || "Unable to start aiPandu.");
    token = data.token;
  }

  function ensureFrame() {
    if (frame) return;
    frame = document.createElement("iframe");
    frame.title = "aiPandu help assistant";
    frame.src = `${baseUrl}/chat.html`;
    frame.allow = "clipboard-write";
    frame.referrerPolicy = "no-referrer";
    panel.appendChild(frame);
  }

  async function open() {
    if (opening) return opening;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    launcher.setAttribute("aria-expanded", "true");
    status.textContent = "Connecting to aiPandu…";
    status.hidden = false;
    opening = (async () => {
      try {
        if (!token) await createSession();
        ensureFrame();
        frame.contentWindow?.postMessage({ type: "aipandu:init", appKey, token }, baseUrl);
      } catch (error) {
        status.textContent = error?.message || "Unable to open aiPandu.";
      } finally {
        opening = null;
      }
    })();
    return opening;
  }

  function close() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", () => panel.classList.contains("open") ? close() : open());
  window.addEventListener("message", event => {
    if (event.origin !== baseUrl || event.source !== frame?.contentWindow) return;
    if (event.data?.type === "aipandu:ready") {
      status.hidden = true;
      if (token) frame.contentWindow.postMessage({ type: "aipandu:init", appKey, token }, baseUrl);
    }
    if (event.data?.type === "aipandu:close") close();
    if (event.data?.type === "aipandu:session-expired") {
      token = "";
      createSession().then(() => {
        frame?.contentWindow?.postMessage({ type: "aipandu:init", appKey, token }, baseUrl);
      }).catch(error => {
        status.hidden = false;
        status.textContent = error?.message || "Unable to reconnect to aiPandu.";
      });
    }
  });

  window.aiPandu = {
    open,
    close,
    destroy() {
      host.remove();
      delete window.aiPandu;
      delete window.__aiPanduWidgetLoaded;
    }
  };
})();

