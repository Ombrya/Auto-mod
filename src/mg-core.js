window.MGCore = (() => {
  const LS_ENABLED = "mgAutomation.enabled";

  const core = {
    enabled: localStorage.getItem(LS_ENABLED) === "true",
    running: false,
    listening: false,
    prev: null,

    delayMs: 300,
    siloDelayMs: 1500,
    restockDelayMinMs: 10000,
    restockDelayMaxMs: 15000,

    setStatus(text) {
      const el = document.getElementById("mg-auto-status");
      if (el) el.textContent = text;
      console.log("[MG Automation]", text);
    },

    saveEnabled() {
      localStorage.setItem(LS_ENABLED, this.enabled ? "true" : "false");
    },

    randomRestockDelay() {
      return this.restockDelayMinMs + Math.floor(
        Math.random() * (this.restockDelayMaxMs - this.restockDelayMinMs + 1)
      );
    },

    buy(shop, item) {
      return MGUtils.send({ type: "PurchaseShopItem", shop, item });
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
        return { itemType: "Seed", species: item.species };
      }

      if (item?.itemType === "Egg") {
        const eggId = item.eggId ?? item.id;
        if (eggId) return { itemType: "Egg", eggId };
      }

      return null;
    },

    async autoStoreOneSeedIfPossible(species) {
      if (!species) return;

      const siloItems = await QWS_Atoms.inventory.mySeedSiloItems.get();
      const siloSpecies = new Set((siloItems ?? []).map(x => x?.species).filter(Boolean));

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

        const stock = this.getStock(item);
        if (stock <= 0) continue;

        const payload = this.itemPayload(item);
        if (!payload) continue;

        const itemLabel = payload.species ?? payload.eggId ?? "unknown";
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

        await this.buyShopInventory("seed", manual ? "manual" : "seed");
        await this.buyShopInventory("egg", manual ? "manual" : "egg");
        await this.buyShopInventory("dawn", manual ? "manual" : "dawn");

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
      this.setStatus("ON, waiting restock");
    },

    stop() {
      this.enabled = false;
      this.saveEnabled();

      try { this.unsub?.(); } catch {}
      this.unsub = null;
      this.listening = false;

      window.MGUI?.updatePanel?.();
      this.setStatus("OFF");
    }
  };

  window.MG_AUTO_BUY = core;
  return core;
})();