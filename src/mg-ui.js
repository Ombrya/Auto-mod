window.MGUI = (() => {
  function createPanel() {
    if (document.getElementById("mg-auto-panel")) return;

    const panel = document.createElement("div");
    panel.id = "mg-auto-panel";

    panel.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      z-index: 999999;
      width: 220px;
      padding: 10px;
      border-radius: 12px;
      background: rgba(22, 27, 34, 0.94);
      color: #e7eef7;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.12);
      cursor: move;
      user-select: none;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong>🤖 MG Automation</strong>
        <button id="mg-auto-hide" style="cursor:pointer;">×</button>
      </div>

      <div style="margin-bottom:8px;">
        Status: <span id="mg-auto-status">Loading...</span>
      </div>

      <button id="mg-auto-toggle" style="width:100%;margin-bottom:6px;padding:6px;border-radius:8px;cursor:pointer;">
        Toggle
      </button>

      <button id="mg-auto-run" style="width:100%;padding:6px;border-radius:8px;cursor:pointer;">
        Run once now
      </button>
    `;

    document.body.appendChild(panel);

    document.getElementById("mg-auto-toggle").onclick = async () => {
      if (window.MGCore.enabled) window.MGCore.stop();
      else await window.MGCore.start();
    };

    document.getElementById("mg-auto-run").onclick = async () => {
      await window.MGCore.buyAllAvailable(true);
    };

    document.getElementById("mg-auto-hide").onclick = () => {
      panel.style.display = "none";
      localStorage.setItem("mgAutomation.panelHidden", "true");
    };

    makeDraggable(panel);
    restorePanel(panel);

    if (localStorage.getItem("mgAutomation.panelHidden") === "true") {
      panel.style.display = "none";
    }

    updatePanel();
  }

  function makeDraggable(panel) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    panel.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;

      dragging = true;
      const rect = panel.getBoundingClientRect();

      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;

      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top = `${e.clientY - offsetY}px`;
      panel.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;

      localStorage.setItem("mgAutomation.panelX", panel.style.left);
      localStorage.setItem("mgAutomation.panelY", panel.style.top);
    });
  }

  function restorePanel(panel) {
    const savedX = localStorage.getItem("mgAutomation.panelX");
    const savedY = localStorage.getItem("mgAutomation.panelY");

    if (savedX) {
      panel.style.left = savedX;
      panel.style.right = "auto";
    }

    if (savedY) panel.style.top = savedY;
  }

  function updatePanel() {
    const btn = document.getElementById("mg-auto-toggle");
    if (!btn || !window.MGCore) return;

    const on = window.MGCore.enabled;

    btn.textContent = on ? "Disable automation" : "Enable automation";
    btn.style.background = on ? "#1f8f4d" : "#6b2f2f";
    btn.style.color = "white";
  }

  return { createPanel, updatePanel };
})();