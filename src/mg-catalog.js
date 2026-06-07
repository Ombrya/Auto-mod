window.MGCatalog = (() => {
  const API_BASE = "https://mg-api.ariedam.fr/data";
  const LS_KEY = "mgAutomation.catalog.cache";
  const LS_TS = "mgAutomation.catalog.cacheTs";
  const SPRITE_PREFIX = "mgAutomation.sprite.";
  const CACHE_MS = 12 * 60 * 60 * 1000;

  const state = {
    loaded: false,
    groupedCache: null,
    plants: {},
    eggs: {},
    items: {},
    decors: {}
  };

  async function fetchJson(url) {
    if (window.MGLoaderRequest) {
      const raw = await window.MGLoaderRequest(url);
      return JSON.parse(raw);
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
  }

  async function load() {
    if (state.loaded) return state;

    const now = Date.now();
    const cached = localStorage.getItem(LS_KEY);
    const cachedTs = Number(localStorage.getItem(LS_TS) || 0);

    if (cached && now - cachedTs < CACHE_MS) {
      try {
        Object.assign(state, JSON.parse(cached), { loaded: true });
        buildGroupedCache();
        console.log("[MG Catalog] Loaded from cache");
        return state;
      } catch {}
    }

    try {
      const [plants, eggs, items, decors] = await Promise.all([
        fetchJson(`${API_BASE}/plants`),
        fetchJson(`${API_BASE}/eggs`),
        fetchJson(`${API_BASE}/items`),
        fetchJson(`${API_BASE}/decors`)
      ]);

      Object.assign(state, {
        loaded: true,
        plants: plants ?? {},
        eggs: eggs ?? {},
        items: items ?? {},
        decors: decors ?? {}
      });

      localStorage.setItem(LS_KEY, JSON.stringify({
        plants: state.plants,
        eggs: state.eggs,
        items: state.items,
        decors: state.decors
      }));
      localStorage.setItem(LS_TS, String(now));

      buildGroupedCache();

      console.log("[MG Catalog] Loaded from API");
    } catch (err) {
      console.warn("[MG Catalog] API failed", err);

      if (cached) {
        try {
          Object.assign(state, JSON.parse(cached), { loaded: true });
          buildGroupedCache();
          console.log("[MG Catalog] Fallback to old cache");
        } catch {}
      }
    }

    return state;
  }

  function buildGroupedCache() {
    const grouped = {
      Seed: [],
      Egg: [],
      Tool: [],
      Decor: []
    };

    for (const species of Object.keys(state.plants ?? {})) {
      if (state.plants[species]?.seed) {
        grouped.Seed.push({ itemType: "Seed", species, __catalog: true });
      }
    }

    for (const eggId of Object.keys(state.eggs ?? {})) {
      grouped.Egg.push({ itemType: "Egg", eggId, id: eggId, __catalog: true });
    }

    for (const toolId of Object.keys(state.items ?? {})) {
      grouped.Tool.push({ itemType: "Tool", toolId, id: toolId, __catalog: true });
    }

    for (const decorId of Object.keys(state.decors ?? {})) {
      grouped.Decor.push({ itemType: "Decor", decorId, id: decorId, __catalog: true });
    }

    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => {
        const pa = getPrice(a);
        const pb = getPrice(b);

        if (pa !== pb) return pa - pb;

        return getLabel(a).localeCompare(getLabel(b));
      });
    }

    state.groupedCache = grouped;
  }

  async function getAllItemsGrouped() {
    await load();
    if (!state.groupedCache) buildGroupedCache();
    return state.groupedCache ?? {};
  }

  function getMeta(item) {
    if (!item) return null;

    if (item.itemType === "Seed") {
      const species = item.species ?? item.name;
      return state.plants?.[species]?.seed ?? null;
    }

    if (item.itemType === "Egg") {
      const eggId = item.eggId ?? item.id;
      return state.eggs?.[eggId] ?? null;
    }

    if (item.itemType === "Tool") {
      const toolId = item.toolId ?? item.id;
      return state.items?.[toolId] ?? null;
    }

    if (item.itemType === "Decor") {
      const decorId = item.decorId ?? item.id;
      return state.decors?.[decorId] ?? null;
    }

    return null;
  }

  function getPrice(item) {
    const meta = getMeta(item);
    return Number(meta?.coinPrice ?? meta?.price ?? 0);
  }

  function getLabel(item) {
    const meta = getMeta(item);
    if (meta?.name) return meta.name;

    if (item?.itemType === "Seed") return `${item.species ?? item.name} Seed`;
    if (item?.itemType === "Egg") return item.eggId ?? item.id ?? "Egg";
    if (item?.itemType === "Tool") return item.toolId ?? item.id ?? "Tool";
    if (item?.itemType === "Decor") return item.decorId ?? item.id ?? "Decor";

    return item?.id ?? item?.name ?? "unknown";
  }

  function getRarity(item) {
    return getMeta(item)?.rarity ?? "";
  }

  function getSprite(item) {
    return getMeta(item)?.sprite ?? "";
  }

  async function getSpriteDataUrl(itemOrUrl) {
    const spriteUrl = typeof itemOrUrl === "string" ? itemOrUrl : getSprite(itemOrUrl);
    if (!spriteUrl) return "";

    const cacheKey = SPRITE_PREFIX + spriteUrl;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    if (!window.MGLoaderRequestDataUrl) return "";

    const dataUrl = await window.MGLoaderRequestDataUrl(spriteUrl);
    localStorage.setItem(cacheKey, dataUrl);

    return dataUrl;
  }

  async function warmSpritesInBackground() {
    const grouped = await getAllItemsGrouped();
    const allItems = Object.values(grouped).flat();

    let index = 0;
    const concurrency = 4;

    async function worker() {
      while (index < allItems.length) {
        const item = allItems[index++];
        try {
          await getSpriteDataUrl(item);
        } catch {}
        await new Promise(r => setTimeout(r, 30));
      }
    }

    for (let i = 0; i < concurrency; i++) {
      worker();
    }
  }

  return {
    load,
    getAllItemsGrouped,
    getMeta,
    getPrice,
    getLabel,
    getRarity,
    getSprite,
    getSpriteDataUrl,
    warmSpritesInBackground
  };
})();