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
      width: 280px;
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

      <button id="mg-auto-run" style="width:100%;margin-bottom:6px;padding:6px;border-radius:8px;cursor:pointer;">
        Run once now
      </button>

      <button id="mg-auto-settings-toggle" style="width:100%;padding:6px;border-radius:8px;cursor:pointer;">
        Settings
      </button>

      <div id="mg-auto-settings" style="display:none;margin-top:10px;max-height:420px;overflow:auto;border-top:1px solid rgba(255,255,255,.15);padding-top:8px;"></div>
    `;

    document.body.appendChild(panel);

    document.getElementById("mg-auto-toggle").onclick = async () => {
      if (window.MGCore.enabled) window.MGCore.stop();
      else await window.MGCore.start();
    };

    document.getElementById("mg-auto-run").onclick = async () => {
      await window.MGCore.buyAllAvailable(true);
    };

    document.getElementById("mg-auto-settings-toggle").onclick = async () => {
      const box = document.getElementById("mg-auto-settings");
      box.style.display = box.style.display === "none" ? "block" : "none";
      if (box.style.display === "block") await renderSettings();
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

  function makeButton(text, active) {
    const btn = document.createElement("button");

    btn.textContent = text;
    btn.style.cssText = `
      padding: 3px 7px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.15);
      cursor: pointer;
      color: white;
      background: ${active ? "#1f8f4d" : "#6b2f2f"};
      font-size: 11px;
      min-width: 42px;
    `;

    return btn;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadSpriteIntoImage(img, spriteUrl) {
    if (!img || !spriteUrl || !window.MGLoaderRequestDataUrl) {
      if (img) img.style.display = "none";
      return;
    }

    const cacheKey = `mgAutomation.sprite.${spriteUrl}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      img.src = cached;
      return;
    }

    try {
      const dataUrl = await window.MGLoaderRequestDataUrl(spriteUrl);
      localStorage.setItem(cacheKey, dataUrl);
      img.src = dataUrl;
    } catch {
      img.style.display = "none";
    }
  }

  async function renderSettings() {
    const box = document.getElementById("mg-auto-settings");
    if (!box || !window.MGCore) return;

    box.innerHTML = "Loading settings...";

    const grouped = await window.MGCore.getAllShopItemsGrouped();

    const knownTypes = ["Seed", "Egg", "Tool", "Decor"];
    const allTypes = Array.from(new Set([...knownTypes, ...Object.keys(grouped)]));

    box.innerHTML = "";

    const help = document.createElement("div");
    help.textContent = "Type ON = buy all items of this type. If type OFF, only enabled items are bought.";
    help.style.cssText = "opacity:.75;margin-bottom:8px;font-size:11px;line-height:1.25;";
    box.appendChild(help);

    for (const type of allTypes) {
      const typeWrap = document.createElement("div");
      typeWrap.style.cssText = "margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.1);";

      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;";

      const title = document.createElement("strong");
      title.textContent = type;

      const typeOn = window.MGCore.isTypeEnabled(type);
      const typeBtn = makeButton(typeOn ? "ON" : "OFF", typeOn);

      typeBtn.onclick = () => {
        window.MGCore.setTypeEnabled(type, !window.MGCore.isTypeEnabled(type));
      };

      header.append(title, typeBtn);
      typeWrap.appendChild(header);

      const items = grouped[type] ?? [];

      if (!items.length) {
        const empty = document.createElement("div");
        empty.textContent = "No visible item in current shops.";
        empty.style.cssText = "opacity:.55;font-size:11px;";
        typeWrap.appendChild(empty);
      }

      for (const item of items) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0;";

        const label = document.createElement("div");
        label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;";
        label.title = window.MGCore.getItemKey(item);

        const sprite = window.MGCatalog?.getSprite?.(item);
        const rarity = window.MGCatalog?.getRarity?.(item);
        const price = window.MGCatalog?.getPrice?.(item);
        const name = window.MGCore.getItemLabel(item);

        label.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;min-width:0;">
            <img
              data-mg-sprite="${escapeHtml(sprite || "")}"
              style="width:24px;height:24px;border-radius:5px;object-fit:contain;background:rgba(255,255,255,.08);flex:0 0 auto;"
            >
            <div style="min-width:0;">
              <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHtml(name)}
              </div>
              <div style="opacity:.65;font-size:10px;">
                ${price ? `${Number(price).toLocaleString("en-US")} coins` : ""}
                ${rarity ? ` · ${escapeHtml(rarity)}` : ""}
              </div>
            </div>
          </div>
        `;

        const img = label.querySelector("img[data-mg-sprite]");
        loadSpriteIntoImage(img, sprite);

        const itemKey = window.MGCore.getItemKey(item);
        const forcedOn = window.MGCore.itemEnabled[itemKey] === true;
        const typeEnabled = window.MGCore.isTypeEnabled(type);

        const itemBtn = makeButton(forcedOn ? "ON" : "OFF", forcedOn || typeEnabled);

        itemBtn.textContent = typeEnabled ? "AUTO" : (forcedOn ? "ON" : "OFF");
        itemBtn.title = typeEnabled
          ? "Type is ON, this item will be bought automatically."
          : "Toggle this individual item.";

        itemBtn.onclick = () => {
          if (window.MGCore.isTypeEnabled(type)) return;
          window.MGCore.setItemEnabled(item, !window.MGCore.itemEnabled[itemKey]);
        };

        if (typeEnabled) {
          itemBtn.style.opacity = ".75";
          itemBtn.style.cursor = "not-allowed";
        }

        row.append(label, itemBtn);
        typeWrap.appendChild(row);
      }

      box.appendChild(typeWrap);
    }
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

  return { createPanel, updatePanel, renderSettings };
})();