window.MGUI = (() => {
  const LS_SETTINGS_OPEN = "mgAutomation.settingsOpen";
  const LS_COLLAPSED_TYPES = "mgAutomation.collapsedTypes";

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeSwitch(active) {
    const btn = document.createElement("button");
    btn.className = "mg-auto-switch";
    btn.dataset.active = active ? "true" : "false";
    btn.style.cssText = `
      width: 44px;
      height: 24px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.25);
      background: ${active ? "#4f6df5" : "#2d333b"};
      cursor: pointer;
      position: relative;
      flex: 0 0 auto;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
    `;

    const dot = document.createElement("span");
    dot.style.cssText = `
      position: absolute;
      top: 2px;
      left: ${active ? "22px" : "2px"};
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      transition: left .12s ease;
    `;

    btn.appendChild(dot);
    return btn;
  }

  function setSwitchState(btn, active) {
    btn.dataset.active = active ? "true" : "false";
    btn.style.background = active ? "#4f6df5" : "#2d333b";
    const dot = btn.querySelector("span");
    if (dot) dot.style.left = active ? "22px" : "2px";
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

  function createPanel() {
    if (document.getElementById("mg-auto-panel")) return;

    const panel = document.createElement("div");
    panel.id = "mg-auto-panel";

    panel.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      z-index: 999999;
      width: 240px;
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

      <button id="mg-auto-settings-open" style="width:100%;padding:6px;border-radius:8px;cursor:pointer;">
        Auto-buy settings
      </button>
    `;

    document.body.appendChild(panel);

    document.getElementById("mg-auto-toggle").onclick = async () => {
      if (window.MGCore.enabled) window.MGCore.stop();
      else await window.MGCore.start();
    };

    document.getElementById("mg-auto-settings-open").onclick = async () => {
      await openSettingsWindow();
    };

    document.getElementById("mg-auto-hide").onclick = () => {
      panel.style.display = "none";
      localStorage.setItem("mgAutomation.panelHidden", "true");
    };

    makeDraggable(panel, "mgAutomation.panelX", "mgAutomation.panelY");
    restorePosition(panel, "mgAutomation.panelX", "mgAutomation.panelY");

    if (localStorage.getItem("mgAutomation.panelHidden") === "true") {
      panel.style.display = "none";
    }

    updatePanel();

    if (localStorage.getItem(LS_SETTINGS_OPEN) === "true") {
      openSettingsWindow();
    }
  }

  async function openSettingsWindow() {
    localStorage.setItem(LS_SETTINGS_OPEN, "true");

    let win = document.getElementById("mg-auto-settings-window");

    if (!win) {
      win = document.createElement("div");
      win.id = "mg-auto-settings-window";

      win.style.cssText = `
        position: fixed;
		top: 90px;
		left: 90px;
		z-index: 999998;
		width: 620px;
		height: 78vh;
		padding: 12px;
		border-radius: 14px;
		background: rgba(17, 21, 27, 0.97);
		color: #e7eef7;
		font-family: system-ui, sans-serif;
		font-size: 12px;
		box-shadow: 0 14px 40px rgba(0,0,0,.45);
		border: 1px solid rgba(255,255,255,.13);
		user-select: none;
		display: flex;
		flex-direction: column;
      `;

      win.innerHTML = `
        <div id="mg-auto-settings-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;cursor:move;">
          <div>
            <strong style="font-size:14px;">⚙️ Auto-buy settings</strong>
            <div style="opacity:.65;font-size:11px;">Choose what should be bought automatically.</div>
          </div>
          <button id="mg-auto-settings-close" style="cursor:pointer;">×</button>
        </div>

        <div id="mg-auto-global-settings" style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:12px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.03);"></div>

        <div
			id="mg-auto-settings-content"
			style="
				flex:1;
				overflow-y:auto;
				overflow-x:hidden;
				min-height:0;
				padding-right:4px;
				scrollbar-width:thin;
			"
		></div>
      `;

      document.body.appendChild(win);

      document.getElementById("mg-auto-settings-close").onclick = () => {
        win.remove();
        localStorage.setItem(LS_SETTINGS_OPEN, "false");
      };

      makeDraggable(
        win,
        "mgAutomation.settingsX",
        "mgAutomation.settingsY",
        document.getElementById("mg-auto-settings-header")
      );

      restorePosition(win, "mgAutomation.settingsX", "mgAutomation.settingsY");
    }

    win.style.display = "block";
    await renderSettings();
  }

  async function renderSettings() {
    renderGlobalSettings();

    const content = document.getElementById("mg-auto-settings-content");
    if (!content || !window.MGCore) return;

    content.innerHTML = "Loading items...";

    const grouped = await window.MGCore.getAllShopItemsGrouped();
    const allTypes = window.MGCore.getKnownTypes(grouped);
    const collapsed = readJson(LS_COLLAPSED_TYPES, {});

    content.innerHTML = "";

    const tableHead = document.createElement("div");
    tableHead.style.cssText = `
      display:grid;
      grid-template-columns: 1fr 76px 74px 62px;
      gap:8px;
      padding:0 8px 6px 8px;
      opacity:.8;
      font-weight:700;
      border-bottom:1px solid rgba(255,255,255,.12);
    `;

    tableHead.innerHTML = `
      <div>Item</div>
      <div>Price</div>
      <div>Rarity</div>
      <div style="text-align:center;">Buy</div>
    `;

    content.appendChild(tableHead);

    for (const type of allTypes) {
      const items = grouped[type] ?? [];
      const isCollapsed = collapsed[type] === true;
      const typeEnabled = window.MGCore.isTypeEnabled(type);

      const section = document.createElement("div");
      section.style.cssText = "border-bottom:1px solid rgba(255,255,255,.1);";

      const header = document.createElement("div");
      header.style.cssText = `
        display:grid;
        grid-template-columns: 1fr auto;
        align-items:center;
        gap:8px;
        padding:8px;
        background:rgba(255,255,255,.035);
      `;

      const left = document.createElement("button");
      left.style.cssText = `
        background:transparent;
        border:0;
        color:#e7eef7;
        text-align:left;
        cursor:pointer;
        font-weight:700;
        padding:0;
      `;
      left.textContent = `${isCollapsed ? "▶" : "▼"} ${type} (${items.length})`;

      left.onclick = async () => {
        collapsed[type] = !collapsed[type];
        writeJson(LS_COLLAPSED_TYPES, collapsed);
        await renderSettings();
      };

      const typeSwitch = makeSwitch(typeEnabled);
      typeSwitch.title = typeEnabled
        ? `Disable automatic purchase for all ${type}`
        : `Enable automatic purchase for all visible ${type}`;

      typeSwitch.onclick = () => {
        window.MGCore.setTypeEnabled(type, !window.MGCore.isTypeEnabled(type), items);
      };

      header.append(left, typeSwitch);
      section.appendChild(header);

      if (!isCollapsed) {
        if (!items.length) {
          const empty = document.createElement("div");
          empty.textContent = "No visible item in current shops.";
          empty.style.cssText = "opacity:.55;padding:8px;";
          section.appendChild(empty);
        }

        for (const item of items) {
          section.appendChild(createItemRow(item, items));
        }
      }

      content.appendChild(section);
    }
  }

  function renderGlobalSettings() {
    const box = document.getElementById("mg-auto-global-settings");
    if (!box || !window.MGCore) return;

    box.innerHTML = "";

    const autoBuyLabel = document.createElement("div");
    autoBuyLabel.innerHTML = `
      <strong>Auto-buy</strong>
      <div style="opacity:.65;font-size:11px;">When enabled, buys selected items on start and after restocks.</div>
    `;

    const autoBuySwitch = makeSwitch(window.MGCore.enabled);
    autoBuySwitch.onclick = async () => {
      if (window.MGCore.enabled) window.MGCore.stop();
      else await window.MGCore.start();
      renderGlobalSettings();
    };

    const siloLabel = document.createElement("div");
    siloLabel.innerHTML = `
      <strong>Auto-silo</strong>
      <div style="opacity:.65;font-size:11px;">After buying a seed, stores it if this species already exists in your Seed Silo.</div>
    `;

    const siloSwitch = makeSwitch(window.MGCore.autoSiloEnabled);
    siloSwitch.onclick = () => {
      window.MGCore.setAutoSiloEnabled(!window.MGCore.autoSiloEnabled);
      renderGlobalSettings();
    };

    box.append(autoBuyLabel, autoBuySwitch, siloLabel, siloSwitch);
  }

  function createItemRow(item, allItemsOfType) {
    const row = document.createElement("div");

    row.style.cssText = `
      display:grid;
      grid-template-columns: 1fr 76px 74px 62px;
      align-items:center;
      gap:8px;
      padding:7px 8px;
      border-top:1px solid rgba(255,255,255,.06);
    `;

    const name = window.MGCore.getItemLabel(item);
    const sprite = window.MGCatalog?.getSprite?.(item);
    const rarity = window.MGCatalog?.getRarity?.(item);
    const price = window.MGCatalog?.getPrice?.(item);
    const enabled = window.MGCore.isItemEnabled(item);

    const itemCell = document.createElement("div");
    itemCell.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";

    const img = document.createElement("img");
    img.style.cssText = `
      width:30px;
      height:30px;
      border-radius:7px;
      object-fit:contain;
      background:rgba(255,255,255,.08);
      flex:0 0 auto;
    `;
    loadSpriteIntoImage(img, sprite);

    const nameWrap = document.createElement("div");
    nameWrap.style.cssText = "min-width:0;";

    const title = document.createElement("div");
    title.textContent = name;
    title.title = window.MGCore.getItemKey(item);
    title.style.cssText = "font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

    nameWrap.appendChild(title);
    itemCell.append(img, nameWrap);

    const priceCell = document.createElement("div");
    priceCell.textContent = price ? Number(price).toLocaleString("en-US") : "-";
    priceCell.style.cssText = "opacity:.85;";

    const rarityCell = document.createElement("div");
    rarityCell.textContent = rarity || "-";
    rarityCell.style.cssText = "opacity:.85;";

    const buyCell = document.createElement("div");
    buyCell.style.cssText = "display:flex;justify-content:center;";

    const itemSwitch = makeSwitch(enabled);
    itemSwitch.onclick = () => {
      window.MGCore.setItemEnabled(item, !window.MGCore.isItemEnabled(item), allItemsOfType);
    };

    buyCell.appendChild(itemSwitch);

    row.append(itemCell, priceCell, rarityCell, buyCell);

    return row;
  }

  function makeDraggable(panel, xKey, yKey, handle = panel) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("mousedown", (e) => {
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

      localStorage.setItem(xKey, panel.style.left);
      localStorage.setItem(yKey, panel.style.top);
    });
  }

  function restorePosition(panel, xKey, yKey) {
    const savedX = localStorage.getItem(xKey);
    const savedY = localStorage.getItem(yKey);

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

    const status = document.getElementById("mg-auto-status");
    if (status && !window.MGCore.running) {
      status.textContent = on ? "ON, waiting restock" : "OFF";
    }
  }

  return {
    createPanel,
    updatePanel,
    renderSettings,
    openSettingsWindow
  };
})();