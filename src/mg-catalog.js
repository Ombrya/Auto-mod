window.MGCatalog = (() => {
  const API_BASE = "https://mg-api.ariedam.fr";
  const DATA_URL = `${API_BASE}/data`;
  const ENUMS_URL = `${API_BASE}/data/enums`;

  const LS_DATA = "mgAutomation.catalog.data";
  const LS_ENUMS = "mgAutomation.catalog.enums";
  const LS_TS = "mgAutomation.catalog.cacheTs";
  const SPRITE_PREFIX = "mgAutomation.sprite.";
  const CACHE_MS = 12 * 60 * 60 * 1000;

  const state = {
    loaded: false,
    raw: {},
    enums: {},
    entries: [],
    grouped: {}
  };

  const COLLECTIONS = {
    plants: {
      type: "Seed",
      idField: "species",
      getItems(data) {
        return Object.entries(data ?? {})
          .filter(([, value]) => value?.seed)
          .map(([id, value]) => ({
            id,
            meta: value.seed
          }));
      }
    },

    eggs: {
      type: "Egg",
      idField: "eggId"
    },

    items: {
      type: "Tool",
      idField: "toolId"
    },

    decor: {
      type: "Decor",
      idField: "decorId",
      aliases: ["decors"]
    },

    pets: {
      type: "Pet",
      idField: "petId"
    }
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
    const cachedData = localStorage.getItem(LS_DATA);
    const cachedEnums = localStorage.getItem(LS_ENUMS);
    const cachedTs = Number(localStorage.getItem(LS_TS) || 0);

    if (!force && cachedData && now - cachedTs < CACHE_MS) {
      try {
        applyData(JSON.parse(cachedData), cachedEnums ? JSON.parse(cachedEnums) : {});
        return state;
      } catch {}
    }

    try {
      const [data, enums] = await Promise.all([
        fetchJson(DATA_URL),
        fetchJson(ENUMS_URL).catch(() => ({}))
      ]);

      localStorage.setItem(LS_DATA, JSON.stringify(data));
      localStorage.setItem(LS_ENUMS, JSON.stringify(enums));
      localStorage.setItem(LS_TS, String(now));

      applyData(data, enums);
    } catch (err) {
      if (cachedData) {
        try {
          applyData(JSON.parse(cachedData), cachedEnums ? JSON.parse(cachedEnums) : {});
          console.warn("[MG Catalog] API failed, using cached data", err);
          return state;
        } catch {}
      }

      console.error("[MG Catalog] Failed to load catalog", err);
      throw err;
    }

    return state;
  }

  function applyData(data, enums) {
    state.raw = data ?? {};
    state.enums = enums ?? state.raw.enums ?? {};
    state.entries = buildEntries();
    state.grouped = groupEntries(state.entries);
    state.loaded = true;
  }

  function getRawCollection(name, config = {}) {
    const direct = state.raw?.[name];
    if (direct) return direct;

    for (const alias of config.aliases ?? []) {
      if (state.raw?.[alias]) return state.raw[alias];
    }

    return {};
  }

  function buildEntries() {
    const entries = [];

    for (const [collectionName, config] of Object.entries(COLLECTIONS)) {
      const data = getRawCollection(collectionName, config);
      const items = config.getItems
        ? config.getItems(data)
        : Object.entries(data ?? {}).map(([id, meta]) => ({ id, meta }));

      for (const item of items) {
        const type = inferType(collectionName, item.meta, config.type);
        entries.push(makeEntry(type, item.id, item.meta, {
          source: collectionName,
          idField: config.idField
        }));
      }
    }

    return dedupeEntries(entries)
      .filter(isUsefulEntry);
  }

  function inferType(collectionName, meta, fallbackType) {
    const apiTypes = state.enums?.itemType ?? [];

    if (meta?.itemType && (!apiTypes.length || apiTypes.includes(meta.itemType))) {
      return meta.itemType;
    }

    if (meta?.type && (!apiTypes.length || apiTypes.includes(meta.type))) {
      return meta.type;
    }

    return fallbackType || collectionName;
  }

  function makeEntry(type, id, meta, options = {}) {
    const entry = {
      itemType: type,
      id,
      __catalog: true,
      __source: options.source ?? null,
      __meta: meta ?? {}
    };

    const idField = options.idField || getIdFieldForType(type);
    if (idField) entry[idField] = id;

    return entry;
  }

  function getIdFieldForType(type) {
    const map = {
      Seed: "species",
      Egg: "eggId",
      Tool: "toolId",
      Decor: "decorId",
      Pet: "petId"
    };

    return map[type] ?? "id";
  }

  function dedupeEntries(entries) {
    const byKey = new Map();

    for (const entry of entries) {
      const key = getItemKey(entry);

      if (!byKey.has(key)) {
        byKey.set(key, entry);
        continue;
      }

      const existing = byKey.get(key);
      byKey.set(key, {
        ...existing,
        __meta: {
          ...entry.__meta,
          ...existing.__meta
        }
      });
    }

    return Array.from(byKey.values());
  }

  function isUsefulEntry(entry) {
    if (!entry?.itemType) return false;
    if (!getEntryId(entry)) return false;

    const meta = getMeta(entry);
    if (meta?.purchasable === false) return false;

    return true;
  }

  function groupEntries(entries) {
    const grouped = {};

    for (const entry of entries) {
      const type = entry.itemType || "Unknown";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(entry);
    }

    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => {
        const pa = getPrice(a);
        const pb = getPrice(b);

        if (pa !== pb) return pa - pb;

        return getLabel(a).localeCompare(getLabel(b));
      });
    }

    return grouped;
  }

  async function getAllItemsGrouped() {
    await load();
    return state.grouped;
  }

  function getAllEntries() {
    return state.entries;
  }

  function getRaw() {
    return state.raw;
  }

  function getEnums() {
    return state.enums;
  }

  function getCollection(name) {
    return getRawCollection(name, COLLECTIONS[name] ?? {});
  }

  function getMeta(item) {
    if (!item) return null;
    if (item.__meta) return item.__meta;

    const type = item.itemType;
    const id = getEntryId(item);

    const collectionName = getCollectionNameForType(type);
    if (!collectionName) return null;

    if (type === "Seed") {
      return getCollection("plants")?.[id]?.seed ?? null;
    }

    return getCollection(collectionName)?.[id] ?? null;
  }

  function getCollectionNameForType(type) {
    const map = {
      Seed: "plants",
      Egg: "eggs",
      Tool: "items",
      Decor: "decor",
      Pet: "pets"
    };

    return map[type] ?? null;
  }

  function getEntryId(item) {
    if (!item) return "";

    return (
      item.species ??
      item.eggId ??
      item.toolId ??
      item.decorId ??
      item.petId ??
      item.id ??
      item.name ??
      ""
    );
  }

  function getItemKey(item) {
    return `${item?.itemType ?? "Unknown"}:${getEntryId(item)}`;
  }

  function getPrice(item) {
    const meta = getMeta(item);

    return Number(
      meta?.coinPrice ??
      meta?.price ??
      meta?.cost ??
      0
    );
  }

  function getLabel(item) {
    const meta = getMeta(item);
    if (meta?.name) return meta.name;

    const id = getEntryId(item);

    if (item?.itemType === "Seed") return `${id} Seed`;
    if (item?.itemType === "Egg") return `${id} Egg`;

    return id || "unknown";
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

    const cacheKey = SPRITE_PREFIX + spriteUrl;
    const cached = localStorage.getItem(cacheKey);

    if (cached) return cached;

    const dataUrl = await window.MGLoaderRequestDataUrl(spriteUrl);
    localStorage.setItem(cacheKey, dataUrl);

    return dataUrl;
  }

  function findCatalogEntryForLiveItem(liveItem) {
    const key = getItemKey(liveItem);
    return state.entries.find(entry => getItemKey(entry) === key) ?? null;
  }

  function clearCache() {
    localStorage.removeItem(LS_DATA);
    localStorage.removeItem(LS_ENUMS);
    localStorage.removeItem(LS_TS);

    state.loaded = false;
    state.raw = {};
    state.enums = {};
    state.entries = [];
    state.grouped = {};
  }

  return {
    load,
    clearCache,

    getRaw,
    getEnums,
    getCollection,
    getAllEntries,
    getAllItemsGrouped,

    getMeta,
    getPrice,
    getLabel,
    getRarity,
    getSprite,
    getSpriteDataUrl,

    getEntryId,
    getItemKey,
    findCatalogEntryForLiveItem,

    get raw() { return state.raw; },
    get enums() { return state.enums; },
    get entries() { return state.entries; },
    get grouped() { return state.grouped; }
  };
})();