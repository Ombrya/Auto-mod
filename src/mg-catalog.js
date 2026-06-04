window.MGCatalog = (() => {
  const API_BASE = "https://mg-api.ariedam.fr/data";
  const LS_KEY = "mgAutomation.catalog.cache";
  const LS_TS = "mgAutomation.catalog.cacheTs";
  const CACHE_MS = 12 * 60 * 60 * 1000;

  const state = {
    loaded: false,
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

      console.log("[MG Catalog] Loaded from API");
    } catch (err) {
      console.warn("[MG Catalog] API failed", err);

      if (cached) {
        try {
          Object.assign(state, JSON.parse(cached), { loaded: true });
          console.log("[MG Catalog] Fallback to old cache");
        } catch {}
      }
    }

    return state;
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

  return {
    load,
    getMeta,
    getPrice,
    getLabel,
    getRarity,
    getSprite
  };
})();