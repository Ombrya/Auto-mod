window.MGCore = (() => {
  const LS_ENABLED = "mgAutomation.enabled";
  const LS_AUTO_SILO = "mgAutomation.autoSiloEnabled";
  const LS_TYPE_ENABLED = "mgAutomation.typeEnabled";
  const LS_ITEM_ENABLED = "mgAutomation.itemEnabled";

  const KNOWN_TYPES = ["Seed", "Egg", "Tool", "Decor"];

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

  const core = {
    enabled: localStorage.getItem(LS_ENABLED) === "true",
    autoSiloEnabled: localStorage.getItem(LS_AUTO_SILO) !== "false",

    running: false,
    listening: false,
    prev: null,

    delayMs: 300,
    siloDelayMs: 1500,
    restockDelayMinMs: 10000,
    restockDelayMaxMs: 15000,

    // Type ON = default ON for this type.
    // Individual items can still override this.
    typeEnabled: {
      Seed: true,
      Egg: true,
      Tool: false,
      Decor: false,
      ...readJson(LS_TYPE_ENABLED, {})
    },

    // Item-specific rules.
    // Example: "Seed:Carrot": true / false
    itemEnabled: readJson(LS_ITEM_ENABLED, {}),

    setStatus(text) {
      const el = document.getElementById("mg-auto-status");
      if (el) el.textContent = text;
      console.log("[MG Automation]", text);
    },

    saveEnabled() {
      localStorage.setItem(LS_ENABLED, this.enabled ? "true" : "false");
    },

    saveAutoSilo() {
      localStorage.setItem(LS_AUTO_SILO, this.autoSiloEnabled ? "true" : "false");
    },

    saveSettings() {
      writeJson(LS_TYPE_ENABLED, this.typeEnabled);
      writeJson(LS_ITEM_ENABLED, this.itemEnabled);
    },

    setAutoSiloEnabled(enabled) {
      this.autoSiloEnabled = !!enabled;
      this.saveAutoSilo();
      window.MGUI?.updatePanel?.();
      window.MGUI?.renderSettings?.();
    },

    getItemType(item) {
      return String(item?.itemType ?? "Unknown");
    },

    getItemId(item) {
      if (item?.itemType === "Seed") return item.species ?? item.name ?? "";
      if (item?.itemType === "Egg") return item.eggId ?? item.id ?? "";
      if (item?.itemType === "Tool") return item.toolId ?? item.id ?? "";
      if (item?.itemType === "Decor") return item.decorId ?? item.id ?? "";
      return item?.id ?? item?.species ?? item?.name ?? "";
    },

    getItemKey(item) {
      return `${this.getItemType(item)}:${this.getItemId(item)}`;
    },

    getItemLabel(item) {
      return window.MGCatalog?.getLabel?.(item) ?? this.getItemId(item) ?? "unknown";
    },

    getKnownTypes(extraGrouped = {}) {
      return Array.from(new Set([...KNOWN_TYPES, ...Object.keys(extraGrouped)]));
    },

    isTypeEnabled(type) {
      return this.typeEnabled[type] === true;
    },

    isItemExplicitlyEnabled(item) {
      const key = this.getItemKey(item);
      return this.itemEnabled[key] === true;
    },

    isItemExplicitlyDisabled(item) {
      const key = this.getItemKey(item);
      return this.itemEnabled[key] === false;
    },

    isItemEnabled(item) {
      const type = this.getItemType(item);
      const key = this.getItemKey(item);

      if (Object.prototype.hasOwnProperty.call(this.itemEnabled, key)) {
        return this.itemEnabled[key] === true;
      }

      return this.isTypeEnabled(type);
    },

    setTypeEnabled(type, enabled, items = []) {
      const next = !!enabled;

      this.typeEnabled[type] = next;

      for (const item of items) {
        if (this.getItemType(item) !== type) continue;
        const key = this.getItemKey(item);
        this.itemEnabled[key] = next;
      }

      this.saveSettings();
      window.MGUI?.renderSettings?.();
    },

    setItemEnabled(item, enabled, allItemsOfType = []) {
      const type = this.getItemType(item);
      const key = this.getItemKey(item);

      this.itemEnabled[key] = !!enabled;

      // If one item is turned OFF, the category is no longer globally ON.
      if (!enabled) {
        this.typeEnabled[type] = false;
      } else if (allItemsOfType.length) {
        // If all currently visible items of this type are ON, promote category to ON.
        const allOn = allItemsOfType.every(x => {
          const itemKey = this.getItemKey(x);

          if (Object.prototype.hasOwnProperty.call(this.itemEnabled, itemKey)) {
            return this.itemEnabled[itemKey] === true;
          }

          return this.typeEnabled[type] === true;
        });

        if (allOn) this.typeEnabled[type] = true;
      }

      this.saveSettings();
      window.MGUI?.renderSettings?.();
    },

    randomRestockDelay() {
      return this.restockDelayMinMs + Math.floor(
        Math.random() * (this.restockDelayMaxMs - this.restockDelayMinMs + 1)
      );
    },

    buy(shop, item) {
      return MGUtils.send({
        type: "PurchaseShopItem",
        shop,
        item
      });
    },

    storeSeedInSilo(species) {
      return MGUtils.send({
        type: "PutItemInStorage",
        itemId: species,
        storageId: "SeedSilo"
      });
    },

    getStock(item) {
      return Number(
        item.stock ??
        item.quantity ??
        item.amount ??
        item.count ??
        item.available ??
        item.initialStock ??
        0
      );
    },

    itemPayload(item) {
      if (item?.itemType === "Seed" && item?.species) {
        return {
          itemType: "Seed",
          species: item.species
        };
      }

      if (item?.itemType === "Egg") {
        const eggId = item.eggId ?? item.id;
        if (eggId) {
          return {
            itemType: "Egg",
            eggId
          };
        }
      }

      if (item?.itemType === "Tool") {
        const toolId = item.toolId ?? item.id;
        if (toolId) {
          return {
            itemType: "Tool",
            toolId
          };
        }
      }

      if (item?.itemType === "Decor") {
        const decorId = item.decorId ?? item.id;
        if (decorId) {
          return {
            itemType: "Decor",
            decorId
          };
        }
      }

      return null;
    },

	async getAllShopItemsGrouped() {
		return await window.MGCatalog.getAllItemsGrouped();
	},

  if (window.MGCatalog?.getAllItemsGrouped) {
    return await window.MGCatalog.getAllItemsGrouped();
  }

  const shops = await QWS_Atoms.shop.shops.get();

  const grouped = {};
  const seen = new Set();

  for (const [shopKey, shop] of Object.entries(shops ?? {})) {
    for (const item of shop?.inventory ?? []) {
      const type = this.getItemType(item);
      const id = this.getItemId(item);

      if (!type || !id) continue;

      const key = `${type}:${id}`;

      if (seen.has(key)) continue;
      seen.add(key);

      if (!grouped[type]) grouped[type] = [];

      grouped[type].push({
        ...item,
        __shopKey: shopKey
      });
    }
  }

  for (const type of Object.keys(grouped)) {
    grouped[type].sort((a, b) => {
      const pa = window.MGCatalog?.getPrice?.(a) ?? 0;
      const pb = window.MGCatalog?.getPrice?.(b) ?? 0;

      if (pa !== pb) return pa - pb;

      return this.getItemLabel(a).localeCompare(this.getItemLabel(b));
    });
  }

  return grouped;
},
      const shops = await QWS_Atoms.shop.shops.get();

      const grouped = {};
      const seen = new Set();

      for (const [shopKey, shop] of Object.entries(shops ?? {})) {
        for (const item of shop?.inventory ?? []) {
          const type = this.getItemType(item);
          const id = this.getItemId(item);

          if (!type || !id) continue;

          const key = `${type}:${id}`;

          if (seen.has(key)) continue;
          seen.add(key);

          if (!grouped[type]) grouped[type] = [];

          grouped[type].push({
            ...item,
            __shopKey: shopKey
          });
        }
      }

      for (const type of Object.keys(grouped)) {
        grouped[type].sort((a, b) => {
          const pa = window.MGCatalog?.getPrice?.(a) ?? 0;
          const pb = window.MGCatalog?.getPrice?.(b) ?? 0;

          if (pa !== pb) return pa - pb;

          return this.getItemLabel(a).localeCompare(this.getItemLabel(b));
        });
      }

      return grouped;
    },

    async autoStoreOneSeedIfPossible(species) {
      if (!this.autoSiloEnabled) return;
      if (!species) return;

      const siloItems = await QWS_Atoms.inventory.mySeedSiloItems.get();

      const siloSpecies = new Set(
        (siloItems ?? [])
          .map(x => x?.species)
          .filter(Boolean)
      );

      if (!siloSpecies.has(species)) {
        this.setStatus(`Skip silo: ${species}`);
        return;
      }

      this.setStatus(`Silo: ${species}`);

      this.storeSeedInSilo(species);

      await MGUtils.sleep(this.delayMs);
    },

    async buyShopInventory(shopKey, label) {
      const fresh = await QWS_Atoms.shop.shops.get();
      const items = fresh?.[shopKey]?.inventory ?? [];

      for (const item of items) {
        if (!this.enabled && label !== "manual") break;

        if (!this.isItemEnabled(item)) {
          continue;
        }

        const stock = this.getStock(item);
        if (stock <= 0) continue;

        const payload = this.itemPayload(item);
        if (!payload) continue;

        const itemLabel = this.getItemLabel(item);

        this.setStatus(`Buying ${stock}x ${label}: ${itemLabel}`);

        for (let i = 0; i < stock; i++) {
          if (!this.enabled && label !== "manual") break;

          const ok = this.buy(shopKey, payload);
          if (!ok) break;

          await MGUtils.sleep(this.delayMs);
        }

        if (payload.itemType === "Seed" && payload.species) {
          await MGUtils.sleep(this.siloDelayMs);
          await this.autoStoreOneSeedIfPossible(payload.species);
        }
      }
    },

    async buyAllAvailable(manual = false) {
      if (this.running) return;

      this.running = true;

      try {
        this.setStatus(manual ? "Manual run..." : "Buying stock...");

        const shops = await QWS_Atoms.shop.shops.get();
        const shopKeys = Object.keys(shops ?? {});

        for (const shopKey of shopKeys) {
          await this.buyShopInventory(shopKey, manual ? "manual" : shopKey);
        }

        this.setStatus(this.enabled ? "ON, waiting restock" : "OFF");
      } finally {
        this.running = false;
      }
    },

    async handleShopUpdate(shops) {
      if (!this.enabled) return;

      const prev = this.prev;

      const seedRestocked =
        prev &&
        (prev.seed?.secondsUntilRestock ?? 0) <
        (shops.seed?.secondsUntilRestock ?? 0);

      this.prev = shops;

      if (!seedRestocked) return;

      const delay = this.randomRestockDelay();

      this.setStatus(`Restock detected, waiting ${Math.round(delay / 1000)}s`);

      await MGUtils.sleep(delay);

      await this.buyAllAvailable(false);
    },

    async start() {
      if (this.listening) return;

      this.prev = await QWS_Atoms.shop.shops.get();

      this.unsub = await QWS_Atoms.shop.shops.onChange((shops) => {
        this.handleShopUpdate(shops);
      });

      this.listening = true;
      this.enabled = true;

      this.saveEnabled();

      window.MGUI?.updatePanel?.();

      this.setStatus("ON, buying current stock");

      // New behavior: starting a session immediately buys currently available ON items.
      await this.buyAllAvailable(false);

      this.setStatus("ON, waiting restock");
    },

    stop() {
      this.enabled = false;

      this.saveEnabled();

      try {
        this.unsub?.();
      } catch {}

      this.unsub = null;
      this.listening = false;

      window.MGUI?.updatePanel?.();

      this.setStatus("OFF");
    }
  };

  window.MG_AUTO_BUY = core;

  return core;
})();