window.MGCatalog = (() => {
  const API_BASE = "https://mg-api.ariedam.fr/data";
  const LS_KEY = "mgAutomation.catalog.cache";
  const LS_TS = "mgAutomation.catalog.cacheTs";
  const CACHE_MS = 12 * 60 * 60 * 1000;

  const state = {
    loaded: false,
    grouped: null,
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

  async function load(force = false) {
    if (state.loaded && !force) return state;

    const now = Date.now();
    const cached = localStorage.getItem(LS_KEY);
    const cachedTs = Number(localStorage.getItem(LS_TS) || 0);

    if (!force && cached && now - cachedTs < CACHE_MS) {
      try {
        const parsed = JSON.parse(cached);
        Object.assign(state, parsed, { loaded: true });
        buildGrouped();
        console.log("[MG Catalog] Loaded from cache");
        return state;
      } catch {}
    }

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

    buildGrouped();

    console.log("[MG Catalog] Loaded from API");
    return state;
  }

  function makeItem(type, id, meta) {
    const item = {
      itemType: type,
      id,
      __catalog: true,
      __meta: meta ?? {}
    };

    if (type === "Seed") item.species = id;
    if (type === "Egg") item.eggId = id;
    if (type === "Tool") item.toolId = id;
    if (type === "Decor") item.decorId = id;

    return item;
  }

  function buildGrouped() {
    const grouped = {
      Seed: [],
      Egg: [],
      Tool: [],
      Decor: []
    };

    for (const [species, data] of Object.entries(state.plants ?? {})) {
      if (!data?.seed) continue;
      grouped.Seed.push(makeItem("Seed", species, data.seed));
    }

    for (const [eggId, meta] of Object.entries(state.eggs ?? {})) {
      grouped.Egg.push(makeItem("Egg", eggId, meta));
    }

    for (const [toolId, meta] of Object.entries(state.items ?? {})) {
      grouped.Tool.push(makeItem("Tool", toolId, meta));
    }

    for (const [decorId, meta] of Object.entries(state.decors ?? {})) {
      grouped.Decor.push(makeItem("Decor", decorId, meta));
    }

    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => {
        const pa = getPrice(a);
        const pb = getPrice(b);

        if (pa !== pb) return pa - pb;

        return getLabel(a).localeCompare(getLabel(b));
      });
    }

    state.grouped = grouped;
  }

  async function getAllItemsGrouped() {
    await load();
    if (!state.grouped) buildGrouped();
    return state.grouped;
  }

  function getMeta(item) {
    if (!item) return null;

    if (item.__meta) return item.__meta;

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

    if (item?.itemType === "Seed") return `${item.species ?? item.id} Seed`;
    if (item?.itemType === "Egg") return item.eggId ?? item.id ?? "Egg";
    if (item?.itemType === "Tool") return item.toolId ?? item.id ?? "Tool";
    if (item?.itemType === "Decor") return item.decorId ?? item.id ?? "Decor";

    return item?.id ?? "unknown";
  }

  function getRarity(item) {
    return getMeta(item)?.rarity ?? "";
  }

  function getSprite(item) {
    return getMeta(item)?.sprite ?? "";
  }

  async function getSpriteDataUrl(itemOrUrl) {
    const spriteUrl =
      typeof itemOrUrl === "string"
        ? itemOrUrl
        : getSprite(itemOrUrl);

    if (!spriteUrl || !window.MGLoaderRequestDataUrl) return "";

    const cacheKey = `mgAutomation.sprite.${spriteUrl}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) return cached;

    const dataUrl = await window.MGLoaderRequestDataUrl(spriteUrl);
    localStorage.setItem(cacheKey, dataUrl);

    return dataUrl;
  }

  return {
    load,
    getAllItemsGrouped,
    getMeta,
    getPrice,
    getLabel,
    getRarity,
    getSprite,
    getSpriteDataUrl
  };
})();