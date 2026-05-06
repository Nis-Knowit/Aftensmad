(() => {
  "use strict";

  // ---------- Constants ----------
  const RECIPES_KEY = "aftensmad.recipes";
  const INGREDIENTS_KEY = "aftensmad.ingredients";
  const SCHEMA_KEY = "aftensmad.schemaVersion";
  const CART_KEY = "aftensmad.cart";
  const SCHEMA_VERSION = 2;

  const KNOWN_UNITS = [
    "g", "kg", "mg",
    "ml", "cl", "dl", "l",
    "stk", "stk.",
    "spsk", "spsk.",
    "tsk", "tsk.",
    "fed", "knsp", "knsp.",
    "tern", "skiver",
    "dåse", "dåser",
    "pakke", "pakker",
    "bdt", "bundt", "bundter",
  ];
  const COMMON_UNITS = ["g", "kg", "ml", "dl", "l", "stk", "spsk", "tsk", "fed", "knsp"];

  const T = {
    appTitle: "Aftensmad",
    newRecipe: "Ny opskrift",
    search: "Søg opskrifter…",
    emptyTitle: "Ingen opskrifter endnu",
    emptyAction: "Tilføj din første opskrift",
    modeManual: "Skriv selv",
    modeLink: "Link til opskrift",
    title: "Titel",
    description: "Beskrivelse",
    ingredients: "Ingredienser",
    steps: "Fremgangsmåde",
    link: "Link",
    save: "Gem",
    cancel: "Annullér",
    edit: "Rediger",
    delete: "Slet",
    open: "Åbn opskrift",
    export: "Eksportér",
    import: "Importér",
    confirmDelete: "Er du sikker på at du vil slette denne opskrift?",
    invalidUrl: "Linket skal starte med http:// eller https://",
    titleRequired: "Titel er påkrævet",
    stepsHint: "Et trin pr. linje",
    back: "← Tilbage",
    importError: "Kunne ikke importere filen",
    importSuccess: (n) => `Importerede ${n} opskrift${n === 1 ? "" : "er"}`,
    addIngredient: "Tilføj ingrediens",
    addSection: "Tilføj sektion",
    addStep: "Tilføj trin",
    sectionTitle: "Sektion (fx 'Raita')",
    stepPlaceholder: "Beskriv trinnet…",
    amount: "Mængde",
    unit: "Enhed",
    ingredientName: "Ingrediens",
    noteOptional: "Note (valgfri)",
    remove: "Fjern",
    random: "🎲 Tilfældig",
    select: "Vælg",
    selectDone: "Færdig",
    selectedCount: (n) => `${n} valgt`,
    makeShoppingList: "Lav indkøbsliste",
    shoppingList: "Indkøbsliste",
    shoppingFromRecipes: "Fra opskrifter",
    shoppingOther: "Øvrigt",
    shoppingEmpty: "Du har ikke valgt nogen opskrifter.",
    copy: "Kopiér til udklipsholder",
    copied: "Kopieret!",
    copyFailed: "Kunne ikke kopiere",
    backToList: "Tilbage til listen",
    sync: "Synkronisering",
    syncToken: "GitHub Personal Access Token",
    syncTokenHint: "Opret en fine-grained token på github.com/settings/personal-access-tokens med 'Contents: Read and write' på dette repo. Tokenen gemmes kun i denne browser.",
    syncOpenTokenPage: "Åbn GitHub-tokens",
    syncRepo: "Repo (owner/navn)",
    syncPath: "Filsti i repoet",
    syncSave: "Gem",
    syncShow: "Vis",
    syncHide: "Skjul",
    syncAdvanced: "Avanceret",
    syncForget: "Glem token",
    syncForgetConfirm: "Er du sikker på at du vil slette tokenen fra denne browser?",
    syncRunNow: "Synkronisér nu",
    syncStatusUnconfigured: "Ikke konfigureret",
    syncStatusReady: "Synkroniseret",
    syncStatusInFlight: "Synkroniserer…",
    syncStatusError: "Fejl",
    syncStatusNever: "Aldrig synkroniseret",
    syncStatusLastAt: (s) => "Senest synkroniseret " + s,
    syncErrorAuth: "Token blev afvist (401). Tjek at den ikke er udløbet og har Contents-write til repoet.",
    syncErrorNotFound: "Repo eller fil blev ikke fundet (404). Tjek owner/repo-stien.",
    syncErrorNetwork: "Kunne ikke nå GitHub. Tjek dit internet og prøv igen.",
    syncErrorOther: (s) => "GitHub-fejl: " + s,
    syncErrorConflict: "Konflikt mod GitHub. Forsøgte at flette, men kunne ikke afgøres.",
    importFromUrl: "Hent fra link",
    importUrlPlaceholder: "https://… (indsæt opskrifts-URL)",
    fetch: "Hent",
    fetching: "Henter…",
    fetchFailed: "Kunne ikke hente opskriften fra dette link",
    fetchNoData: "Kunne ikke finde en opskrift på siden",
    fetchSuccess: "Opskriften er hentet",
    fetchFileProtocol: "Henting virker ikke når siden åbnes direkte fra disken. Kør i stedet 'python -m http.server' i mappen og åbn http://localhost:8000 — eller deploy til GitHub Pages.",
    source: "Kilde",
  };

  // ---------- Storage ----------
  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function loadRecipes() {
    const v = safeParse(localStorage.getItem(RECIPES_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  // Live recipes — what we show in the UI (excludes deleted tombstones)
  function loadActiveRecipes() {
    return loadRecipes().filter((r) => r && !r.deletedAt);
  }
  function saveRecipes(arr) {
    localStorage.setItem(RECIPES_KEY, JSON.stringify(arr));
    localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    schedulePush();
  }
  function loadIngredients() {
    const v = safeParse(localStorage.getItem(INGREDIENTS_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function saveIngredients(arr) {
    localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(arr));
    schedulePush();
  }
  function getRecipe(id) {
    return loadActiveRecipes().find((r) => r.id === id);
  }
  function upsertRecipe(recipe) {
    const all = loadRecipes();
    const idx = all.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) all[idx] = recipe;
    else all.unshift(recipe);
    saveRecipes(all);
  }
  function deleteRecipeById(id) {
    const all = loadRecipes();
    const idx = all.findIndex((r) => r && r.id === id && !r.deletedAt);
    if (idx < 0) return;
    const now = Date.now();
    // Replace with a tombstone so the deletion propagates via sync.
    all[idx] = { id, deletedAt: now, updatedAt: now };
    saveRecipes(all);
  }
  function getIngredient(id) {
    return loadIngredients().find((i) => i.id === id);
  }
  function findOrCreateIngredient(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const all = loadIngredients();
    const existing = all.find(
      (i) => i.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;
    const created = {
      id: uuid(),
      name: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    all.push(created);
    saveIngredients(all);
    return created;
  }

  // ---------- Cart (selection in sessionStorage) ----------
  function loadCart() {
    const v = safeParse(sessionStorage.getItem(CART_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function saveCart(ids) {
    sessionStorage.setItem(CART_KEY, JSON.stringify(ids));
  }
  function clearCart() {
    sessionStorage.removeItem(CART_KEY);
  }

  // ---------- Helpers ----------
  function uuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function isValidHttpUrl(s) {
    return typeof s === "string" && /^https?:\/\//i.test(s.trim());
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "style" && typeof v === "string") {
        node.setAttribute("style", v);
      } else if (k in node && typeof node[k] !== "object") {
        node[k] = v;
      } else {
        node.setAttribute(k, v);
      }
    }
    for (const child of [].concat(children)) {
      if (child == null || child === false) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function splitLines(s) {
    return (s || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function navigate(hash) {
    if (location.hash === hash) router();
    else location.hash = hash;
  }

  function parseAmount(s) {
    if (s == null) return null;
    const cleaned = String(s).trim().replace(",", ".");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function formatAmount(n) {
    if (n == null || !Number.isFinite(n)) return "";
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 100) / 100).replace(".", ",");
  }

  function formatIngredientLine(line, ingName) {
    const parts = [];
    if (line.amount != null) parts.push(formatAmount(line.amount));
    if (line.unit) parts.push(line.unit);
    if (ingName) parts.push(ingName);
    let s = parts.join(" ");
    if (line.note) s += (s ? ", " : "") + line.note;
    return s;
  }

  // ---------- Migration ----------
  function parseLegacyIngredient(rawLine) {
    const line = (rawLine || "").trim();
    if (!line) return null;

    // Match leading number (with , or . decimal), optional space, optional token, then the rest
    const m = line.match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zæøåÆØÅ.]*)\s*(.*)$/);
    let amount = null;
    let unit = "";
    let rest = line;

    if (m) {
      amount = parseAmount(m[1]);
      const maybeUnit = (m[2] || "").trim();
      const after = (m[3] || "").trim();
      if (maybeUnit && KNOWN_UNITS.includes(maybeUnit.toLowerCase())) {
        unit = maybeUnit.toLowerCase();
        rest = after;
      } else {
        // Reassemble unit-less rest
        rest = (maybeUnit + " " + after).trim();
      }
    } else {
      amount = null;
    }

    if (!rest) {
      // Number only, no name — treat the whole original as a note
      return { amount: null, unit: "", name: line, note: "" };
    }

    // Split on first comma → name, note
    const commaIdx = rest.indexOf(",");
    let name, note;
    if (commaIdx >= 0) {
      name = rest.slice(0, commaIdx).trim();
      note = rest.slice(commaIdx + 1).trim();
    } else {
      name = rest;
      note = "";
    }

    return { amount, unit, name, note };
  }

  function migrate() {
    const current = parseInt(localStorage.getItem(SCHEMA_KEY) || "1", 10);
    if (current >= SCHEMA_VERSION) return;

    const recipes = loadRecipes();
    let ingredients = loadIngredients();
    let changed = false;

    function findOrAdd(name) {
      const trimmed = (name || "").trim();
      if (!trimmed) return null;
      const existing = ingredients.find(
        (i) => i.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return existing;
      const created = {
        id: uuid(),
        name: trimmed,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      ingredients.push(created);
      changed = true;
      return created;
    }

    for (const r of recipes) {
      if (r.type === "manual" && Array.isArray(r.ingredients)) {
        const isLegacy = r.ingredients.length > 0 && typeof r.ingredients[0] === "string";
        if (isLegacy) {
          const newRows = [];
          for (const lineStr of r.ingredients) {
            const parsed = parseLegacyIngredient(lineStr);
            if (!parsed) continue;
            const ing = findOrAdd(parsed.name);
            newRows.push({
              ingredientId: ing ? ing.id : null,
              amount: parsed.amount,
              unit: parsed.unit,
              note: parsed.note,
            });
          }
          r.ingredients = newRows;
          changed = true;
        }
      }
    }

    if (changed) {
      saveIngredients(ingredients);
      saveRecipes(recipes);
    }
    localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
  }

  // ---------- Sync (GitHub Contents API) ----------
  const SYNC_KEY = "aftensmad.sync";
  const DEFAULT_SYNC_OWNER = "Nis-Knowit";
  const DEFAULT_SYNC_REPO = "Aftensmad";
  const DEFAULT_SYNC_PATH = "data/recipes.json";

  function loadSyncSettings() {
    const v = safeParse(localStorage.getItem(SYNC_KEY), {}) || {};
    return {
      token: v.token || "",
      owner: v.owner || DEFAULT_SYNC_OWNER,
      repo: v.repo || DEFAULT_SYNC_REPO,
      path: v.path || DEFAULT_SYNC_PATH,
      sha: v.sha || "",
      lastSyncAt: v.lastSyncAt || 0,
      lastError: v.lastError || "",
    };
  }
  function saveSyncSettings(partial) {
    const next = { ...loadSyncSettings(), ...partial };
    localStorage.setItem(SYNC_KEY, JSON.stringify(next));
  }
  function syncConfigured() {
    return !!loadSyncSettings().token;
  }

  // UTF-8 safe base64 helpers
  function b64encode(text) {
    const utf8 = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of utf8) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function b64decode(b64) {
    const binary = atob((b64 || "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function ghContentsUrl() {
    const s = loadSyncSettings();
    return `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${s.path
      .split("/").map(encodeURIComponent).join("/")}`;
  }

  function ghHeaders() {
    const s = loadSyncSettings();
    return {
      Authorization: "Bearer " + s.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function ghMessageFromError(res, body) {
    if (res.status === 401 || res.status === 403) return T.syncErrorAuth;
    if (res.status === 404) return T.syncErrorNotFound;
    let msg = "";
    if (body && typeof body === "object" && body.message) msg = body.message;
    return T.syncErrorOther(res.status + (msg ? " " + msg : ""));
  }

  async function pullRemote() {
    const res = await fetch(ghContentsUrl(), {
      method: "GET",
      headers: ghHeaders(),
      cache: "no-store",
    });
    if (res.status === 404) return { exists: false };
    let body;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
      const err = new Error(ghMessageFromError(res, body));
      err.status = res.status;
      throw err;
    }
    let payload = null;
    try {
      const text = b64decode(body.content || "");
      payload = JSON.parse(text);
    } catch (e) {
      throw new Error("Kunne ikke læse remote-filen — er den gyldig JSON?");
    }
    return { exists: true, sha: body.sha, payload };
  }

  async function pushRemote(payload, sha, message) {
    const body = {
      message: message || "Opdater opskrifter fra Aftensmad",
      content: b64encode(JSON.stringify(payload, null, 2)),
    };
    if (sha) body.sha = sha;
    const res = await fetch(ghContentsUrl(), {
      method: "PUT",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409 || res.status === 422) return { conflict: true };
    let resBody;
    try { resBody = await res.json(); } catch { resBody = null; }
    if (!res.ok) {
      const err = new Error(ghMessageFromError(res, resBody));
      err.status = res.status;
      throw err;
    }
    return { ok: true, sha: resBody?.content?.sha };
  }

  function mergeData(local, remote) {
    const recipesById = new Map();
    for (const r of local.recipes || []) recipesById.set(r.id, r);
    for (const r of remote.recipes || []) {
      const existing = recipesById.get(r.id);
      if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) {
        recipesById.set(r.id, r);
      }
    }
    const ingredientsById = new Map();
    for (const i of local.ingredients || []) ingredientsById.set(i.id, i);
    for (const i of remote.ingredients || []) {
      const existing = ingredientsById.get(i.id);
      if (!existing || (i.updatedAt || 0) > (existing.updatedAt || 0)) {
        ingredientsById.set(i.id, i);
      }
    }
    return {
      recipes: [...recipesById.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      ingredients: [...ingredientsById.values()],
    };
  }

  let _syncInFlight = false;
  let _syncListeners = new Set();
  function notifySyncListeners() {
    for (const fn of _syncListeners) {
      try { fn(); } catch { /* ignore */ }
    }
  }
  function onSyncChange(fn) {
    _syncListeners.add(fn);
    return () => _syncListeners.delete(fn);
  }

  async function syncOnce({ silent = false } = {}) {
    if (!syncConfigured()) return { skipped: true };
    if (_syncInFlight) return { busy: true };
    _syncInFlight = true;
    if (!silent) notifySyncListeners();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await pullRemote();
        const local = { recipes: loadRecipes(), ingredients: loadIngredients() };

        let merged;
        let baseSha = "";
        if (remote.exists) {
          baseSha = remote.sha;
          merged = mergeData(local, remote.payload || {});
        } else {
          merged = local;
        }

        const localChanged =
          JSON.stringify(local) !== JSON.stringify(merged);
        if (localChanged) {
          // Bypass save helpers' push hooks while we're already in flight.
          localStorage.setItem(RECIPES_KEY, JSON.stringify(merged.recipes));
          localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
          localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(merged.ingredients));
        }

        // Skip the push entirely if remote already matches the merged data —
        // nothing to commit, and avoids spurious commits to the repo.
        const remoteData = remote.exists ? remote.payload || {} : null;
        const sameAsRemote =
          remoteData &&
          JSON.stringify(remoteData.recipes || []) === JSON.stringify(merged.recipes) &&
          JSON.stringify(remoteData.ingredients || []) === JSON.stringify(merged.ingredients);

        if (sameAsRemote) {
          saveSyncSettings({
            sha: baseSha,
            lastSyncAt: Date.now(),
            lastError: "",
          });
          notifySyncListeners();
          if (localChanged) router();
          return { ok: true, localChanged };
        }

        const payload = {
          schemaVersion: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          recipes: merged.recipes,
          ingredients: merged.ingredients,
        };
        const result = await pushRemote(payload, baseSha);
        if (result.ok) {
          saveSyncSettings({
            sha: result.sha || "",
            lastSyncAt: Date.now(),
            lastError: "",
          });
          notifySyncListeners();
          if (localChanged) router();
          return { ok: true, localChanged };
        }
        if (result.conflict) {
          continue;
        }
      }
      throw new Error(T.syncErrorConflict);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      saveSyncSettings({ lastError: msg });
      notifySyncListeners();
      throw err;
    } finally {
      _syncInFlight = false;
      notifySyncListeners();
    }
  }

  let _pushTimer = null;
  function schedulePush(delay = 1500) {
    if (!syncConfigured()) return;
    if (_syncInFlight) return; // syncOnce will pick up current state
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => {
      syncOnce({ silent: true }).catch(() => {
        /* error already stored on settings; UI shows it via listener */
      });
    }, delay);
  }

  async function startupSync() {
    if (!syncConfigured()) return;
    try {
      await syncOnce({ silent: true });
    } catch {
      /* swallow on startup; user can retry from settings */
    }
  }

  // ---------- Sync background triggers ----------
  let _pollTimer = null;
  function startSyncPolling(intervalMs = 30000) {
    stopSyncPolling();
    _pollTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!syncConfigured()) return;
      syncOnce({ silent: true }).catch(() => {});
    }, intervalMs);
  }
  function stopSyncPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }
  function wireSyncTriggers() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (syncConfigured()) {
          syncOnce({ silent: true }).catch(() => {});
        }
        startSyncPolling();
      } else {
        // Pause polling when hidden — save battery & API calls.
        stopSyncPolling();
      }
    });
    window.addEventListener("focus", () => {
      if (document.visibilityState === "visible" && syncConfigured()) {
        syncOnce({ silent: true }).catch(() => {});
      }
    });
    if (document.visibilityState === "visible") {
      startSyncPolling();
    }
  }

  // ---------- URL import ----------
  // Tries JSON-LD Recipe first, falls back to Schema.org microdata.
  // Returns { title, description, ingredients: string[], steps: string[], image? } or null.
  function extractRecipeFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1) JSON-LD
    const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const s of ldScripts) {
      try {
        const data = JSON.parse(s.textContent);
        const recipe = findRecipeNode(data);
        if (recipe) {
          return normalizeRecipeNode(recipe);
        }
      } catch {
        /* skip malformed json-ld */
      }
    }

    // 2) Microdata
    const recipeScope = doc.querySelector(
      '[itemtype$="schema.org/Recipe"], [itemtype$="schema.org/Recipe/"]'
    );
    if (recipeScope) {
      const title =
        textOf(directItemprop(recipeScope, "name")) ||
        textOf(doc.querySelector("h1"));
      const description = textOf(directItemprop(recipeScope, "description"));
      const ingredients = extractIngredientsWithSections(recipeScope);
      const steps = extractSteps(recipeScope);
      const image = imageFrom(directItemprop(recipeScope, "image"));
      if (title && (ingredients.length > 0 || steps.length > 0)) {
        return { title, description, ingredients, steps, image };
      }
    }

    return null;
  }

  // Microdata helpers: itemprops belong to their nearest itemscope ancestor.
  // Skip props that live inside a nested itemscope.
  function isDirectChildProp(scope, node) {
    let n = node.parentElement;
    while (n && n !== scope) {
      if (n.hasAttribute("itemscope")) return false;
      n = n.parentElement;
    }
    return n === scope;
  }
  function directItemprop(scope, prop) {
    for (const node of scope.querySelectorAll(`[itemprop="${prop}"]`)) {
      if (isDirectChildProp(scope, node)) return node;
    }
    return null;
  }
  function directItemprops(scope, prop) {
    const out = [];
    for (const node of scope.querySelectorAll(`[itemprop="${prop}"]`)) {
      if (isDirectChildProp(scope, node)) out.push(node);
    }
    return out;
  }

  function findRecipeNode(node) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const r = findRecipeNode(item);
        if (r) return r;
      }
      return null;
    }
    if (typeof node !== "object") return null;
    const t = node["@type"];
    const ts = Array.isArray(t) ? t.join(" ") : t || "";
    if (typeof ts === "string" && /\bRecipe\b/i.test(ts)) return node;
    // @graph or other nested structures
    for (const v of Object.values(node)) {
      if (typeof v === "object" && v !== null) {
        const r = findRecipeNode(v);
        if (r) return r;
      }
    }
    return null;
  }

  function normalizeRecipeNode(r) {
    const title = (r.name || "").toString().trim();
    const description = (r.description || "").toString().trim();

    let rawIngs = [];
    if (Array.isArray(r.recipeIngredient)) rawIngs = r.recipeIngredient;
    else if (Array.isArray(r.ingredients)) rawIngs = r.ingredients;
    const ings = rawIngs
      .map((s) => String(s).trim())
      .filter(Boolean)
      .map((text) => ({ kind: "ingredient", text }));

    let steps = [];
    const ri = r.recipeInstructions;
    if (Array.isArray(ri)) {
      steps = ri.flatMap(stepFromNode).filter(Boolean);
    } else if (typeof ri === "string") {
      // Sometimes a single big string with line breaks
      steps = ri.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
    } else if (ri && typeof ri === "object") {
      steps = stepFromNode(ri);
    }

    let image;
    if (r.image) {
      if (typeof r.image === "string") image = r.image;
      else if (Array.isArray(r.image)) image = r.image[0];
      else if (typeof r.image === "object") image = r.image.url || r.image["@id"];
    }

    return { title, description, ingredients: ings, steps, image };
  }

  function stepFromNode(node) {
    if (!node) return [];
    if (typeof node === "string") return [node.trim()].filter(Boolean);
    if (Array.isArray(node)) return node.flatMap(stepFromNode);
    if (typeof node === "object") {
      const t = node["@type"];
      const ts = Array.isArray(t) ? t.join(" ") : t || "";
      if (/HowToSection/i.test(ts) && Array.isArray(node.itemListElement)) {
        return node.itemListElement.flatMap(stepFromNode);
      }
      if (/HowToStep/i.test(ts) || node.text || node.name) {
        const t = (node.text || node.name || "").toString().trim();
        return t ? [t] : [];
      }
    }
    return [];
  }

  function textOf(node) {
    if (!node) return "";
    if (node.hasAttribute && node.hasAttribute("content")) {
      const c = node.getAttribute("content");
      if (c) return c.trim();
    }
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractSteps(scope) {
    const instrNodes = directItemprops(scope, "recipeInstructions");
    const out = [];
    for (const n of instrNodes) {
      const ps = n.querySelectorAll("p, li");
      if (ps.length > 0) {
        for (const p of ps) extractStepFromNode(p, out);
      } else {
        const t = textOf(n);
        if (t) {
          const parts = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
          for (const part of parts.length ? parts : [t]) out.push(part);
        }
      }
    }
    return out;
  }

  // Detect "<strong>Section</strong><br>rest" pattern at the start of a step paragraph
  // and split into a section marker ("## title") plus the rest as a step.
  function extractStepFromNode(p, out) {
    const first = p.firstElementChild;
    if (
      first &&
      (first.tagName === "STRONG" || first.tagName === "B") &&
      first.nextSibling &&
      ((first.nextSibling.nodeType === 1 && first.nextSibling.tagName === "BR") ||
        (first.nextSibling.nodeType === 3 && /^\s*$/.test(first.nextSibling.textContent) &&
          first.nextSibling.nextSibling &&
          first.nextSibling.nextSibling.nodeType === 1 &&
          first.nextSibling.nextSibling.tagName === "BR"))
    ) {
      const sectionTitle = textOf(first);
      // Clone p, remove the strong + br, take the rest as the step
      const clone = p.cloneNode(true);
      clone.removeChild(clone.firstElementChild); // strong
      // Remove leading <br> and whitespace text nodes
      while (
        clone.firstChild &&
        ((clone.firstChild.nodeType === 1 && clone.firstChild.tagName === "BR") ||
          (clone.firstChild.nodeType === 3 && /^\s*$/.test(clone.firstChild.textContent)))
      ) {
        clone.removeChild(clone.firstChild);
      }
      if (sectionTitle) out.push("## " + sectionTitle);
      const rest = textOf(clone);
      if (rest) out.push(rest);
      return;
    }
    const t = textOf(p);
    if (t) out.push(t);
  }

  // Walk the recipe scope in document order and emit a mixed list of
  // { kind: "ingredient", text } and { kind: "section", title } items.
  function extractIngredientsWithSections(scope) {
    const ingredientNodes = directItemprops(scope, "recipeIngredient")
      .concat(directItemprops(scope, "ingredients"));
    if (ingredientNodes.length === 0) return [];

    const ingSet = new Set(ingredientNodes);
    const container = lowestCommonAncestor(ingredientNodes) || scope;

    const result = [];
    const walker = container.ownerDocument.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT
    );
    let node = walker.nextNode();
    while (node) {
      if (ingSet.has(node)) {
        const t = textOf(node);
        if (t) result.push({ kind: "ingredient", text: t });
        // Skip into ingredient subtree
      } else if (isSectionLike(node, ingSet, container)) {
        const t = textOf(node);
        if (t) result.push({ kind: "section", title: t });
      }
      node = walker.nextNode();
    }

    // Trim leading section that has no following ingredients
    while (result.length && result[result.length - 1].kind === "section") result.pop();
    return result;
  }

  function isSectionLike(node, ingSet, container) {
    // Skip nodes that are descendants of an ingredient
    let p = node.parentElement;
    while (p && p !== container) {
      if (ingSet.has(p)) return false;
      p = p.parentElement;
    }
    if (/^H[2-5]$/.test(node.tagName)) return true;
    if (
      node.tagName === "LI" &&
      !node.hasAttribute("itemprop") &&
      !node.querySelector("[itemprop='recipeIngredient']")
    ) {
      // Plain <li> without itemprop, in or near an ingredient list — treat as section
      // Only count it if a sibling has the recipeIngredient itemprop
      const parent = node.parentElement;
      if (parent && parent.querySelector(":scope > [itemprop='recipeIngredient']")) {
        return true;
      }
    }
    return false;
  }

  function lowestCommonAncestor(nodes) {
    if (nodes.length === 0) return null;
    if (nodes.length === 1) return nodes[0].parentElement;
    let candidate = nodes[0].parentElement;
    while (candidate) {
      if (nodes.every((n) => candidate.contains(n))) return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  }

  function imageFrom(node) {
    if (!node) return undefined;
    if (node.tagName === "IMG") return node.src || undefined;
    if (node.hasAttribute && node.hasAttribute("content")) return node.getAttribute("content");
    const inner = node.querySelector && node.querySelector("img");
    if (inner) return inner.src;
    const t = textOf(node);
    return /^https?:\/\//i.test(t) ? t : undefined;
  }

  async function fetchRecipeFromUrl(url) {
    if (!isValidHttpUrl(url)) throw new Error("invalid url");
    const proxied = "https://corsproxy.io/?url=" + encodeURIComponent(url);
    const res = await fetch(proxied, { headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const data = extractRecipeFromHtml(html);
    if (!data) throw new Error("no recipe found");
    return data;
  }

  // ---------- Datalists ----------
  function ensureDatalists() {
    let ingDl = document.getElementById("ingredients-datalist");
    if (!ingDl) {
      ingDl = el("datalist", { id: "ingredients-datalist" });
      document.body.appendChild(ingDl);
    }
    clear(ingDl);
    for (const ing of loadIngredients()) {
      ingDl.appendChild(el("option", { value: ing.name }));
    }

    let unitDl = document.getElementById("units-datalist");
    if (!unitDl) {
      unitDl = el("datalist", { id: "units-datalist" });
      document.body.appendChild(unitDl);
      for (const u of COMMON_UNITS) {
        unitDl.appendChild(el("option", { value: u }));
      }
    }
  }

  // ---------- Views ----------
  const app = document.getElementById("app");

  function renderList() {
    clear(app);
    const recipes = loadActiveRecipes();
    let selected = new Set(loadCart());

    // Filter cart to only existing recipes
    selected = new Set([...selected].filter((id) => recipes.some((r) => r.id === id)));
    saveCart([...selected]);

    const toolbar = el("div", { class: "toolbar" });
    const randomBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.random,
      disabled: recipes.length === 0,
      onclick: () => {
        if (recipes.length === 0) return;
        const r = recipes[Math.floor(Math.random() * recipes.length)];
        navigate(`#/opskrift/${r.id}`);
      },
    });
    toolbar.appendChild(randomBtn);
    app.appendChild(toolbar);

    const search = el("div", { class: "search" });
    const searchInput = el("input", {
      type: "search",
      id: "search-input",
      placeholder: T.search,
      autocomplete: "off",
    });
    search.appendChild(searchInput);
    app.appendChild(search);

    const listContainer = el("div", { id: "list-container" });
    app.appendChild(listContainer);

    const cartBar = el("div", { class: "cartbar", hidden: true });
    app.appendChild(cartBar);

    function renderCartBar() {
      clear(cartBar);
      if (selected.size === 0) {
        cartBar.hidden = true;
        return;
      }
      cartBar.hidden = false;
      cartBar.appendChild(el("span", { class: "cartbar__count", text: T.selectedCount(selected.size) }));
      cartBar.appendChild(
        el("button", {
          type: "button",
          class: "btn btn--primary",
          text: T.makeShoppingList,
          onclick: () => {
            saveCart([...selected]);
            navigate("#/indkoeb");
          },
        })
      );
    }

    function toggleSelected(id, checked) {
      if (checked) selected.add(id);
      else selected.delete(id);
      saveCart([...selected]);
      renderCartBar();
    }

    function renderItems(filter = "") {
      clear(listContainer);
      const q = filter.trim().toLowerCase();
      const filtered = q
        ? recipes.filter((r) => (r.title || "").toLowerCase().includes(q))
        : recipes;

      if (filtered.length === 0) {
        if (recipes.length === 0) {
          listContainer.appendChild(
            el("div", { class: "empty" }, [
              el("p", { text: T.emptyTitle }),
              el("a", { class: "btn btn--primary", href: "#/ny", text: T.emptyAction }),
            ])
          );
        } else {
          listContainer.appendChild(
            el("div", { class: "empty" }, [el("p", { text: "Ingen resultater" })])
          );
        }
        return;
      }

      const ul = el("ul", { class: "list" });
      for (const r of filtered) {
        const icon = r.type === "link" ? "🔗" : "📖";
        const isChecked = selected.has(r.id);
        const checkboxId = `chk-${r.id}`;

        const checkbox = el("input", {
          type: "checkbox",
          class: "card__check",
          id: checkboxId,
          checked: isChecked,
          "aria-label": "Vælg " + (r.title || ""),
          onchange: (e) => {
            toggleSelected(r.id, e.target.checked);
            cardEl.classList.toggle("card--selected", e.target.checked);
          },
        });

        const link = el("a", {
          class: "card__link",
          href: `#/opskrift/${r.id}`,
        }, [
          el("div", { class: "card__title" }, [
            el("span", { class: "card__icon", text: icon, "aria-hidden": "true" }),
            el("span", { text: r.title || "(uden titel)" }),
          ]),
          r.description ? el("p", { class: "card__desc", text: r.description }) : null,
        ]);

        const cardEl = el("li", {
          class: "card" + (isChecked ? " card--selected" : ""),
        }, [checkbox, link]);

        ul.appendChild(cardEl);
      }
      listContainer.appendChild(ul);
    }

    renderItems();
    renderCartBar();
    searchInput.addEventListener("input", (e) => renderItems(e.target.value));
  }

  // Generic pointer-based DnD reorder for direct children of `list`.
  // The user must press on an element matching `handleSelector` to start dragging.
  // Works for both mouse and touch via PointerEvent.
  function makeSortable(list, { handleSelector, onReorder } = {}) {
    let dragging = null;
    let movedSinceDown = false;
    let activePointerId = null;
    let activeHandle = null;

    function findChildOf(parent, target) {
      let n = target;
      while (n && n.parentNode !== parent) n = n.parentNode;
      return n;
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      const handle = e.target.closest(handleSelector || ".sortable-handle");
      if (!handle || !list.contains(handle)) return;
      const row = findChildOf(list, handle);
      if (!row) return;
      e.preventDefault();
      dragging = row;
      activePointerId = e.pointerId;
      activeHandle = handle;
      movedSinceDown = false;
      try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      if (!movedSinceDown) {
        movedSinceDown = true;
        dragging.classList.add("dragging");
      }
      const y = e.clientY;
      for (const sibling of list.children) {
        if (sibling === dragging) continue;
        const rect = sibling.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          const midpoint = rect.top + rect.height / 2;
          if (y < midpoint) {
            if (sibling.previousElementSibling !== dragging) {
              list.insertBefore(dragging, sibling);
            }
          } else {
            if (sibling.nextElementSibling !== dragging) {
              list.insertBefore(dragging, sibling.nextElementSibling);
            }
          }
          break;
        }
      }
    }

    function onPointerUp() {
      if (!dragging) return;
      const handle = activeHandle;
      if (handle) {
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
        handle.removeEventListener("pointercancel", onPointerUp);
        try { handle.releasePointerCapture(activePointerId); } catch { /* ignore */ }
      }
      dragging.classList.remove("dragging");
      const reordered = movedSinceDown;
      dragging = null;
      activePointerId = null;
      activeHandle = null;
      movedSinceDown = false;
      if (reordered && onReorder) onReorder();
    }

    list.addEventListener("pointerdown", onPointerDown);
  }

  function makeDragHandle() {
    return el("button", {
      type: "button",
      class: "sortable-handle row__handle",
      "aria-label": "Flyt række",
      title: "Træk for at flytte",
      tabindex: "-1",
      text: "≡",
    });
  }

  function makeSectionRow(title) {
    const handle = makeDragHandle();
    const titleInput = el("input", {
      type: "text",
      class: "ing-section__title",
      placeholder: T.sectionTitle,
      value: title || "",
      "aria-label": T.sectionTitle,
    });
    const removeBtn = el("button", {
      type: "button",
      class: "btn btn--icon ing-row__remove",
      "aria-label": T.remove,
      title: T.remove,
      text: "×",
      onclick: () => row.remove(),
    });
    const row = el("div", { class: "ing-section", "data-kind": "section" }, [
      handle,
      titleInput,
      removeBtn,
    ]);
    row._inputs = { titleInput };
    return row;
  }

  function autoResizeTextarea(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.max(ta.scrollHeight, 36) + "px";
  }

  function makeStepRow(text) {
    const handle = makeDragHandle();
    const input = el("textarea", {
      class: "step-row__text",
      rows: "1",
      placeholder: T.stepPlaceholder,
      "aria-label": T.steps,
    });
    input.value = text || "";
    input.addEventListener("input", () => autoResizeTextarea(input));
    const removeBtn = el("button", {
      type: "button",
      class: "btn btn--icon ing-row__remove",
      "aria-label": T.remove,
      title: T.remove,
      text: "×",
      onclick: () => row.remove(),
    });
    const row = el("div", { class: "step-row", "data-kind": "step" }, [
      handle,
      input,
      removeBtn,
    ]);
    row._inputs = { input };
    // Defer resize to next frame so the textarea is in the DOM and has a width
    requestAnimationFrame(() => autoResizeTextarea(input));
    return row;
  }

  function makeStepSectionRow(title) {
    const handle = makeDragHandle();
    const titleInput = el("input", {
      type: "text",
      class: "ing-section__title",
      placeholder: T.sectionTitle,
      value: title || "",
      "aria-label": T.sectionTitle,
    });
    const removeBtn = el("button", {
      type: "button",
      class: "btn btn--icon ing-row__remove",
      "aria-label": T.remove,
      title: T.remove,
      text: "×",
      onclick: () => row.remove(),
    });
    const row = el("div", { class: "step-row step-row--section", "data-kind": "section" }, [
      handle,
      titleInput,
      removeBtn,
    ]);
    row._inputs = { titleInput };
    return row;
  }

  function makeIngredientRow(line) {
    const data = line || { ingredientId: null, amount: null, unit: "", note: "" };
    const initialName =
      data._initialName ||
      (data.ingredientId ? (getIngredient(data.ingredientId)?.name || "") : "");

    const amountInput = el("input", {
      type: "text",
      inputmode: "decimal",
      class: "ing-row__amount",
      placeholder: T.amount,
      value: data.amount != null ? formatAmount(data.amount) : "",
      "aria-label": T.amount,
    });
    const unitInput = el("input", {
      type: "text",
      class: "ing-row__unit",
      list: "units-datalist",
      placeholder: T.unit,
      value: data.unit || "",
      "aria-label": T.unit,
    });
    const nameInput = el("input", {
      type: "text",
      class: "ing-row__name",
      list: "ingredients-datalist",
      placeholder: T.ingredientName,
      value: initialName,
      "aria-label": T.ingredientName,
    });
    const noteInput = el("input", {
      type: "text",
      class: "ing-row__note",
      placeholder: T.noteOptional,
      value: data.note || "",
      "aria-label": T.noteOptional,
    });
    const removeBtn = el("button", {
      type: "button",
      class: "btn btn--icon ing-row__remove",
      "aria-label": T.remove,
      title: T.remove,
      text: "×",
      onclick: () => {
        row.remove();
      },
    });
    const handle = makeDragHandle();
    const row = el("div", { class: "ing-row", "data-kind": "ingredient" }, [
      handle,
      amountInput,
      unitInput,
      nameInput,
      noteInput,
      removeBtn,
    ]);
    row._inputs = { amountInput, unitInput, nameInput, noteInput };
    return row;
  }

  function renderForm(existing) {
    clear(app);
    ensureDatalists();

    const isEdit = !!existing;
    let mode = existing ? existing.type : "manual";

    app.appendChild(el("a", { class: "back-link", href: "#/", text: T.back }));
    app.appendChild(el("h2", { text: isEdit ? T.edit : T.newRecipe }));

    const toggle = el("div", { class: "toggle", role: "tablist" }, [
      el("button", {
        type: "button",
        "aria-pressed": String(mode === "manual"),
        text: T.modeManual,
        onclick: () => setMode("manual"),
      }),
      el("button", {
        type: "button",
        "aria-pressed": String(mode === "link"),
        text: T.modeLink,
        onclick: () => setMode("link"),
      }),
    ]);
    if (!isEdit) app.appendChild(toggle);

    const form = el("form", { class: "form", novalidate: true });

    // Import-from-URL (only meaningful in Skriv selv mode)
    const importUrlInput = el("input", {
      type: "url",
      class: "import-url__input",
      placeholder: T.importUrlPlaceholder,
      value: existing && existing.sourceUrl ? existing.sourceUrl : "",
    });
    const importBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.fetch,
    });
    const importStatus = el("p", { class: "hint import-url__status" });
    const importBlock = el("div", { class: "import-url" }, [
      el("label", { class: "import-url__label", text: T.importFromUrl }),
      el("div", { class: "import-url__row" }, [importUrlInput, importBtn]),
      importStatus,
    ]);

    importBtn.addEventListener("click", async () => {
      if (location.protocol === "file:") {
        importStatus.textContent = T.fetchFileProtocol;
        importStatus.style.color = "var(--danger)";
        return;
      }
      const url = importUrlInput.value.trim();
      if (!isValidHttpUrl(url)) {
        importStatus.textContent = T.invalidUrl;
        importStatus.style.color = "var(--danger)";
        return;
      }
      importBtn.disabled = true;
      const originalText = importBtn.textContent;
      importBtn.textContent = T.fetching;
      importStatus.textContent = "";
      importStatus.style.color = "";
      try {
        const data = await fetchRecipeFromUrl(url);
        if (data.title) titleInput.value = data.title;
        if (Array.isArray(data.steps) && data.steps.length) {
          clear(stepsContainer);
          for (const item of data.steps) {
            if (typeof item !== "string") continue;
            const m = item.match(/^##\s+(.*)$/);
            if (m) stepsContainer.appendChild(makeStepSectionRow(m[1]));
            else stepsContainer.appendChild(makeStepRow(item));
          }
        }
        if (Array.isArray(data.ingredients) && data.ingredients.length) {
          // Replace existing ingredient rows with imported ones (mixed: ingredient + section)
          clear(ingContainer);
          for (const item of data.ingredients) {
            if (item && item.kind === "section") {
              ingContainer.appendChild(makeSectionRow(item.title || ""));
              continue;
            }
            const text = (item && item.text) || (typeof item === "string" ? item : "");
            const parsed = parseLegacyIngredient(text);
            if (!parsed) continue;
            ingContainer.appendChild(
              makeIngredientRow({
                ingredientId: null,
                amount: parsed.amount,
                unit: parsed.unit,
                note: parsed.note,
                _initialName: parsed.name,
              })
            );
          }
        }
        importStatus.textContent = T.fetchSuccess;
        importStatus.style.color = "var(--accent)";
      } catch (err) {
        importStatus.textContent =
          err && err.message === "no recipe found" ? T.fetchNoData : T.fetchFailed;
        importStatus.style.color = "var(--danger)";
      } finally {
        importBtn.disabled = false;
        importBtn.textContent = originalText;
      }
    });

    const titleInput = el("input", {
      type: "text",
      id: "f-title",
      required: true,
      value: existing ? existing.title || "" : "",
    });
    const descInput = el("textarea", { id: "f-desc", rows: "2" });
    descInput.value = existing ? existing.description || "" : "";

    // Ingredient editor
    const ingContainer = el("div", { class: "ing-list", id: "ing-list" });
    if (existing && Array.isArray(existing.ingredients)) {
      for (const line of existing.ingredients) {
        if (line && line.kind === "section") {
          ingContainer.appendChild(makeSectionRow(line.title || ""));
        } else {
          ingContainer.appendChild(makeIngredientRow(line));
        }
      }
    }
    if (ingContainer.children.length === 0) {
      ingContainer.appendChild(makeIngredientRow(null));
    }
    const addIngBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.addIngredient,
      onclick: () => {
        const row = makeIngredientRow(null);
        ingContainer.appendChild(row);
        row._inputs.amountInput.focus();
      },
    });
    const addSectionBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.addSection,
      onclick: () => {
        const row = makeSectionRow("");
        ingContainer.appendChild(row);
        row._inputs.titleInput.focus();
      },
    });
    const addRowActions = el("div", { class: "ing-list__actions" }, [addIngBtn, addSectionBtn]);

    // Step editor (per-row, sortable)
    const stepsContainer = el("div", { class: "step-list", id: "step-list" });
    if (existing && Array.isArray(existing.steps)) {
      for (const item of existing.steps) {
        if (typeof item !== "string") continue;
        const m = item.match(/^##\s+(.*)$/);
        if (m) stepsContainer.appendChild(makeStepSectionRow(m[1]));
        else stepsContainer.appendChild(makeStepRow(item));
      }
    }
    const addStepBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.addStep,
      onclick: () => {
        const row = makeStepRow("");
        stepsContainer.appendChild(row);
        row._inputs.input.focus();
      },
    });
    const addStepSectionBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.addSection,
      onclick: () => {
        const row = makeStepSectionRow("");
        stepsContainer.appendChild(row);
        row._inputs.titleInput.focus();
      },
    });
    const addStepActions = el("div", { class: "ing-list__actions" }, [addStepBtn, addStepSectionBtn]);

    const urlInput = el("input", {
      type: "url",
      id: "f-url",
      placeholder: "https://…",
      value: existing && existing.url ? existing.url : "",
    });

    const errorBox = el("p", { class: "hint", style: "color: var(--danger);" });

    const titleField = el("div", { class: "form__field" }, [
      el("label", { for: "f-title", text: T.title }),
      titleInput,
    ]);
    const descField = el("div", { class: "form__field" }, [
      el("label", { for: "f-desc", text: T.description }),
      descInput,
    ]);
    const ingredientsField = el("div", { class: "form__field" }, [
      el("label", { text: T.ingredients }),
      ingContainer,
      addRowActions,
    ]);
    const stepsField = el("div", { class: "form__field" }, [
      el("label", { text: T.steps }),
      stepsContainer,
      addStepActions,
    ]);
    const urlField = el("div", { class: "form__field" }, [
      el("label", { for: "f-url", text: T.link }),
      urlInput,
    ]);

    const actions = el("div", { class: "form__actions" }, [
      el("button", { type: "submit", class: "btn btn--primary", text: T.save }),
      el("a", { class: "btn", href: isEdit ? `#/opskrift/${existing.id}` : "#/", text: T.cancel }),
    ]);

    form.appendChild(importBlock);
    form.appendChild(titleField);
    form.appendChild(descField);
    form.appendChild(ingredientsField);
    form.appendChild(stepsField);
    form.appendChild(urlField);
    form.appendChild(errorBox);
    form.appendChild(actions);
    app.appendChild(form);

    function setMode(m) {
      mode = m;
      toggle.querySelectorAll("button").forEach((b, i) => {
        b.setAttribute("aria-pressed", String((i === 0 && m === "manual") || (i === 1 && m === "link")));
      });
      importBlock.style.display = m === "manual" ? "" : "none";
      ingredientsField.style.display = m === "manual" ? "" : "none";
      stepsField.style.display = m === "manual" ? "" : "none";
      urlField.style.display = m === "link" ? "" : "none";
    }
    setMode(mode);

    makeSortable(ingContainer, { handleSelector: ".sortable-handle" });
    makeSortable(stepsContainer, { handleSelector: ".sortable-handle" });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      errorBox.textContent = "";

      const title = titleInput.value.trim();
      if (!title) {
        errorBox.textContent = T.titleRequired;
        titleInput.focus();
        return;
      }

      const description = descInput.value.trim();
      const now = Date.now();
      let recipe;

      if (mode === "link") {
        const url = urlInput.value.trim();
        if (!isValidHttpUrl(url)) {
          errorBox.textContent = T.invalidUrl;
          urlInput.focus();
          return;
        }
        recipe = {
          id: existing ? existing.id : uuid(),
          type: "link",
          title,
          description,
          url,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
      } else {
        const ingRows = [];
        for (const row of ingContainer.children) {
          const kind = row.getAttribute("data-kind");
          if (kind === "section") {
            const title = row._inputs.titleInput.value.trim();
            if (!title) continue;
            ingRows.push({ kind: "section", title });
          } else {
            const inputs = row._inputs;
            const name = inputs.nameInput.value.trim();
            const amount = parseAmount(inputs.amountInput.value);
            const unit = inputs.unitInput.value.trim();
            const note = inputs.noteInput.value.trim();
            if (!name && amount == null && !unit && !note) continue;
            let ingredientId = null;
            if (name) {
              const ing = findOrCreateIngredient(name);
              ingredientId = ing ? ing.id : null;
            }
            ingRows.push({ kind: "ingredient", ingredientId, amount, unit, note });
          }
        }

        const stepRows = [];
        for (const row of stepsContainer.children) {
          const kind = row.getAttribute("data-kind");
          if (kind === "section") {
            const title = row._inputs.titleInput.value.trim();
            if (title) stepRows.push("## " + title);
          } else {
            const text = row._inputs.input.value.trim();
            if (text) stepRows.push(text);
          }
        }

        const sourceUrl = importUrlInput.value.trim();
        recipe = {
          id: existing ? existing.id : uuid(),
          type: "manual",
          title,
          description,
          ingredients: ingRows,
          steps: stepRows,
          sourceUrl: isValidHttpUrl(sourceUrl) ? sourceUrl : "",
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
      }

      upsertRecipe(recipe);
      navigate(`#/opskrift/${recipe.id}`);
    });

    titleInput.focus();
  }

  function renderDetail(id) {
    const recipe = getRecipe(id);
    clear(app);

    if (!recipe) {
      app.appendChild(el("a", { class: "back-link", href: "#/", text: T.back }));
      app.appendChild(el("p", { text: "Opskriften blev ikke fundet." }));
      return;
    }

    app.appendChild(el("a", { class: "back-link", href: "#/", text: T.back }));

    const wrap = el("div", { class: "detail" });

    const header = el("div", { class: "detail__header" }, [
      el("h2", { class: "detail__title", text: recipe.title }),
      recipe.description
        ? el("p", { class: "detail__desc", text: recipe.description })
        : null,
    ]);
    wrap.appendChild(header);

    if (recipe.type === "link") {
      const linkAttrs = isValidHttpUrl(recipe.url)
        ? { href: recipe.url, target: "_blank", rel: "noopener noreferrer" }
        : { href: "#", "aria-disabled": "true" };
      wrap.appendChild(el("a", { class: "btn btn--primary", ...linkAttrs, text: T.open }));
    } else {
      if (recipe.sourceUrl && isValidHttpUrl(recipe.sourceUrl)) {
        wrap.appendChild(
          el("p", { class: "detail__source" }, [
            document.createTextNode(T.source + ": "),
            el("a", {
              href: recipe.sourceUrl,
              target: "_blank",
              rel: "noopener noreferrer",
              text: recipe.sourceUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
            }),
          ])
        );
      }
      if (recipe.ingredients && recipe.ingredients.length) {
        const sec = el("section", { class: "detail__section" });
        sec.appendChild(el("h2", { text: T.ingredients }));
        let ul = null;
        for (const line of recipe.ingredients) {
          if (line && line.kind === "section") {
            sec.appendChild(el("h3", { class: "detail__subsection", text: line.title || "" }));
            ul = null;
            continue;
          }
          if (!ul) {
            ul = el("ul");
            sec.appendChild(ul);
          }
          const ingName = line.ingredientId ? (getIngredient(line.ingredientId)?.name || "") : "";
          const formatted = formatIngredientLine(line, ingName);
          if (formatted) ul.appendChild(el("li", { text: formatted }));
        }
        wrap.appendChild(sec);
      }
      if (recipe.steps && recipe.steps.length) {
        const sec = el("section", { class: "detail__section" });
        sec.appendChild(el("h2", { text: T.steps }));
        let ol = null;
        for (const item of recipe.steps) {
          const sectMatch = typeof item === "string" ? item.match(/^##\s+(.*)$/) : null;
          if (sectMatch) {
            sec.appendChild(el("h3", { class: "detail__subsection", text: sectMatch[1] }));
            ol = null;
            continue;
          }
          if (!ol) {
            ol = el("ol");
            sec.appendChild(ol);
          }
          ol.appendChild(el("li", { text: item }));
        }
        wrap.appendChild(sec);
      }
    }

    const actions = el("div", { class: "detail__actions" }, [
      el("a", { class: "btn", href: `#/rediger/${recipe.id}`, text: T.edit }),
      el("button", {
        type: "button",
        class: "btn btn--danger",
        text: T.delete,
        onclick: () => {
          if (confirm(T.confirmDelete)) {
            deleteRecipeById(recipe.id);
            navigate("#/");
          }
        },
      }),
    ]);
    wrap.appendChild(actions);

    app.appendChild(wrap);
  }

  function renderSync() {
    clear(app);
    app.appendChild(el("a", { class: "back-link", href: "#/", text: T.back }));
    app.appendChild(el("h2", { text: T.sync }));

    const wrap = el("div", { class: "sync" });
    const statusBox = el("div", { class: "sync__status" });
    wrap.appendChild(statusBox);

    function renderStatus() {
      clear(statusBox);
      const s = loadSyncSettings();
      let icon, text, cls;
      if (_syncInFlight) {
        icon = "🔄"; text = T.syncStatusInFlight; cls = "sync__status--busy";
      } else if (!s.token) {
        icon = "⚪"; text = T.syncStatusUnconfigured; cls = "sync__status--idle";
      } else if (s.lastError) {
        icon = "🔴"; text = T.syncStatusError + ": " + s.lastError; cls = "sync__status--error";
      } else if (s.lastSyncAt) {
        const dt = new Date(s.lastSyncAt);
        const stamp = dt.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
        icon = "🟢"; text = T.syncStatusLastAt(stamp); cls = "sync__status--ok";
      } else {
        icon = "⚪"; text = T.syncStatusNever; cls = "sync__status--idle";
      }
      statusBox.className = "sync__status " + cls;
      statusBox.appendChild(el("span", { class: "sync__status-icon", text: icon, "aria-hidden": "true" }));
      statusBox.appendChild(el("span", { class: "sync__status-text", text }));
    }
    const off = onSyncChange(renderStatus);
    // Detach listener when view replaced (next router render clears app)
    app.addEventListener("DOMNodeRemoved", off, { once: true });
    renderStatus();

    const settings = loadSyncSettings();

    // Token field with show/hide
    const tokenInput = el("input", {
      type: "password",
      class: "sync__token",
      autocomplete: "off",
      spellcheck: false,
      placeholder: "github_pat_… eller ghp_…",
      value: settings.token,
    });
    const showHideBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.syncShow,
      onclick: () => {
        const showing = tokenInput.type === "text";
        tokenInput.type = showing ? "password" : "text";
        showHideBtn.textContent = showing ? T.syncShow : T.syncHide;
      },
    });
    const tokenHelp = el("p", { class: "hint" }, [
      document.createTextNode(T.syncTokenHint + " "),
      el("a", {
        href: "https://github.com/settings/personal-access-tokens",
        target: "_blank",
        rel: "noopener noreferrer",
        text: T.syncOpenTokenPage,
      }),
    ]);
    const tokenField = el("div", { class: "form__field" }, [
      el("label", { text: T.syncToken }),
      el("div", { class: "sync__token-row" }, [tokenInput, showHideBtn]),
      tokenHelp,
    ]);

    // Advanced: repo + path
    const ownerRepoInput = el("input", {
      type: "text",
      class: "sync__advanced-input",
      value: `${settings.owner}/${settings.repo}`,
      placeholder: `${DEFAULT_SYNC_OWNER}/${DEFAULT_SYNC_REPO}`,
      autocomplete: "off",
      spellcheck: false,
    });
    const pathInput = el("input", {
      type: "text",
      class: "sync__advanced-input",
      value: settings.path,
      placeholder: DEFAULT_SYNC_PATH,
      autocomplete: "off",
      spellcheck: false,
    });
    const advancedDetails = el("details", { class: "sync__advanced" }, [
      el("summary", { text: T.syncAdvanced }),
      el("div", { class: "form__field" }, [
        el("label", { text: T.syncRepo }),
        ownerRepoInput,
      ]),
      el("div", { class: "form__field" }, [
        el("label", { text: T.syncPath }),
        pathInput,
      ]),
    ]);

    // Action buttons
    const actionRow = el("div", { class: "sync__actions" });
    const saveBtn = el("button", {
      type: "button",
      class: "btn btn--primary",
      text: T.syncSave,
      onclick: async () => {
        const token = tokenInput.value.trim();
        const repoPath = ownerRepoInput.value.trim();
        const path = pathInput.value.trim();
        let owner = DEFAULT_SYNC_OWNER, repo = DEFAULT_SYNC_REPO;
        if (repoPath.includes("/")) {
          const [o, r] = repoPath.split("/", 2);
          owner = o.trim();
          repo = r.trim();
        }
        saveSyncSettings({
          token,
          owner: owner || DEFAULT_SYNC_OWNER,
          repo: repo || DEFAULT_SYNC_REPO,
          path: path || DEFAULT_SYNC_PATH,
          sha: "", // reset, will be re-discovered on next pull
          lastError: "",
        });
        renderStatus();
        if (token) {
          try {
            await syncOnce();
          } catch {
            // error already in settings
          }
          renderStatus();
        }
      },
    });
    const runNowBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.syncRunNow,
      onclick: async () => {
        try {
          await syncOnce();
        } catch {
          // error already in settings
        }
      },
    });
    const forgetBtn = el("button", {
      type: "button",
      class: "btn btn--danger",
      text: T.syncForget,
      onclick: () => {
        if (!confirm(T.syncForgetConfirm)) return;
        saveSyncSettings({ token: "", sha: "", lastSyncAt: 0, lastError: "" });
        tokenInput.value = "";
        renderStatus();
      },
    });
    actionRow.appendChild(saveBtn);
    actionRow.appendChild(runNowBtn);
    if (settings.token) actionRow.appendChild(forgetBtn);

    wrap.appendChild(tokenField);
    wrap.appendChild(advancedDetails);
    wrap.appendChild(actionRow);
    app.appendChild(wrap);
  }

  function renderShopping() {
    clear(app);
    app.appendChild(el("a", { class: "back-link", href: "#/", text: T.backToList }));

    const ids = loadCart();
    const recipes = ids
      .map((id) => getRecipe(id))
      .filter((r) => r && r.type === "manual" && Array.isArray(r.ingredients));

    const wrap = el("div", { class: "shopping" });
    wrap.appendChild(el("h2", { text: T.shoppingList }));

    if (recipes.length === 0) {
      wrap.appendChild(el("p", { text: T.shoppingEmpty }));
      app.appendChild(wrap);
      return;
    }

    // Used in
    const usedIn = el("p", { class: "shopping__source" }, [
      el("strong", { text: T.shoppingFromRecipes + ": " }),
      document.createTextNode(recipes.map((r) => r.title).join(", ")),
    ]);
    wrap.appendChild(usedIn);

    // Aggregate
    // Key: ingredientId + "|" + unitLower; sum amount; collect missing-amount notes
    const aggregated = new Map();
    const freeForm = [];

    for (const r of recipes) {
      for (const line of r.ingredients) {
        // Sections are display-only — never appear in the shopping list
        if (line && line.kind === "section") continue;
        if (!line.ingredientId) {
          const text = (line.note || "").trim();
          if (text) freeForm.push({ recipe: r.title, text });
          continue;
        }
        const unit = (line.unit || "").trim().toLowerCase();
        const key = line.ingredientId + "|" + unit;
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            ingredientId: line.ingredientId,
            unit: line.unit || "",
            totalAmount: 0,
            anyAmount: false,
            notes: [],
            recipes: new Set(),
          });
        }
        const entry = aggregated.get(key);
        if (line.amount != null) {
          entry.totalAmount += line.amount;
          entry.anyAmount = true;
        }
        if (line.note) entry.notes.push(line.note);
        entry.recipes.add(r.title);
      }
    }

    // Render aggregated
    const sortedEntries = [...aggregated.values()].sort((a, b) => {
      const an = (getIngredient(a.ingredientId)?.name || "").toLowerCase();
      const bn = (getIngredient(b.ingredientId)?.name || "").toLowerCase();
      return an.localeCompare(bn, "da");
    });

    if (sortedEntries.length > 0) {
      const ul = el("ul", { class: "shopping__list" });
      for (const entry of sortedEntries) {
        const name = getIngredient(entry.ingredientId)?.name || "(ukendt)";
        const parts = [];
        if (entry.anyAmount) parts.push(formatAmount(entry.totalAmount));
        if (entry.unit) parts.push(entry.unit);
        parts.push(name);
        const main = parts.join(" ");
        const recs = [...entry.recipes].join(", ");
        const li = el("li", { class: "shopping__item" }, [
          el("label", {}, [
            el("input", { type: "checkbox", class: "shopping__check" }),
            el("span", { class: "shopping__main", text: main }),
            recs ? el("span", { class: "shopping__src", text: " — " + recs }) : null,
          ]),
        ]);
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
    }

    // Render freeform
    if (freeForm.length > 0) {
      wrap.appendChild(el("h3", { text: T.shoppingOther }));
      const ul = el("ul", { class: "shopping__list" });
      for (const ff of freeForm) {
        const li = el("li", { class: "shopping__item" }, [
          el("label", {}, [
            el("input", { type: "checkbox", class: "shopping__check" }),
            el("span", { class: "shopping__main", text: ff.text }),
            el("span", { class: "shopping__src", text: " — " + ff.recipe }),
          ]),
        ]);
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
    }

    // Build plain-text version for clipboard
    function buildPlainText() {
      const lines = [];
      lines.push(T.shoppingList);
      lines.push(T.shoppingFromRecipes + ": " + recipes.map((r) => r.title).join(", "));
      lines.push("");
      for (const entry of sortedEntries) {
        const name = getIngredient(entry.ingredientId)?.name || "(ukendt)";
        const parts = [];
        if (entry.anyAmount) parts.push(formatAmount(entry.totalAmount));
        if (entry.unit) parts.push(entry.unit);
        parts.push(name);
        lines.push("- " + parts.join(" "));
      }
      if (freeForm.length > 0) {
        lines.push("");
        lines.push(T.shoppingOther + ":");
        for (const ff of freeForm) lines.push("- " + ff.text);
      }
      return lines.join("\n");
    }

    const copyBtn = el("button", {
      type: "button",
      class: "btn",
      text: T.copy,
      onclick: async () => {
        const text = buildPlainText();
        let ok = false;
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          // Fallback: use a hidden textarea + execCommand
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try {
            ok = document.execCommand("copy");
          } catch {
            ok = false;
          }
          document.body.removeChild(ta);
        }
        const original = copyBtn.textContent;
        copyBtn.textContent = ok ? T.copied : T.copyFailed;
        copyBtn.classList.toggle("btn--primary", ok);
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.classList.remove("btn--primary");
        }, 1500);
      },
    });

    wrap.appendChild(el("div", { class: "shopping__actions" }, [copyBtn]));

    app.appendChild(wrap);
  }

  // ---------- Export / Import ----------
  function exportToFile() {
    const data = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      recipes: loadRecipes(),
      ingredients: loadIngredients(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = el("a", { href: url, download: `aftensmad-${stamp}.json` });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incomingRecipes = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.recipes)
          ? parsed.recipes
          : null;
        if (!incomingRecipes) throw new Error("invalid shape");

        const incomingIngredients = Array.isArray(parsed.ingredients)
          ? parsed.ingredients
          : [];

        // Validate ingredients
        const validIngredients = incomingIngredients.filter(
          (i) => i && typeof i.id === "string" && typeof i.name === "string"
        );

        // Validate recipes
        const validRecipes = incomingRecipes.filter(
          (r) =>
            r &&
            typeof r.id === "string" &&
            typeof r.title === "string" &&
            (r.type === "manual" || r.type === "link")
        );

        // Merge ingredients (skip duplicates by id)
        const existingIngredients = loadIngredients();
        const ingIds = new Set(existingIngredients.map((i) => i.id));
        const ingByName = new Map(
          existingIngredients.map((i) => [i.name.toLowerCase(), i.id])
        );
        const idRemap = {};
        for (const i of validIngredients) {
          if (ingIds.has(i.id)) continue;
          const existingByName = ingByName.get(i.name.toLowerCase());
          if (existingByName) {
            idRemap[i.id] = existingByName;
          } else {
            existingIngredients.push(i);
            ingIds.add(i.id);
            ingByName.set(i.name.toLowerCase(), i.id);
          }
        }
        saveIngredients(existingIngredients);

        // Migrate any legacy string-form recipe ingredients in the import
        for (const r of validRecipes) {
          if (
            r.type === "manual" &&
            Array.isArray(r.ingredients) &&
            r.ingredients.length > 0 &&
            typeof r.ingredients[0] === "string"
          ) {
            const newRows = [];
            for (const lineStr of r.ingredients) {
              const parsedLine = parseLegacyIngredient(lineStr);
              if (!parsedLine) continue;
              const ing = findOrCreateIngredient(parsedLine.name);
              newRows.push({
                ingredientId: ing ? ing.id : null,
                amount: parsedLine.amount,
                unit: parsedLine.unit,
                note: parsedLine.note,
              });
            }
            r.ingredients = newRows;
          } else if (r.type === "manual" && Array.isArray(r.ingredients)) {
            // remap ingredient ids if needed
            r.ingredients = r.ingredients.map((line) => ({
              ingredientId: line.ingredientId
                ? idRemap[line.ingredientId] || line.ingredientId
                : null,
              amount: typeof line.amount === "number" ? line.amount : null,
              unit: typeof line.unit === "string" ? line.unit : "",
              note: typeof line.note === "string" ? line.note : "",
            }));
          }
        }

        // Merge recipes (skip duplicates by id)
        const existing = loadRecipes();
        const existingIds = new Set(existing.map((r) => r.id));
        const merged = existing.concat(validRecipes.filter((r) => !existingIds.has(r.id)));
        saveRecipes(merged);

        alert(T.importSuccess(validRecipes.length));
        router();
      } catch {
        alert(T.importError);
      }
    };
    reader.onerror = () => alert(T.importError);
    reader.readAsText(file);
  }

  // ---------- Menu wiring ----------
  function wireMenu() {
    const btn = document.getElementById("menu-btn");
    const list = document.getElementById("menu-list");
    const syncNowBtn = document.getElementById("sync-now-btn");
    const syncBtn = document.getElementById("sync-btn");
    const exportBtn = document.getElementById("export-btn");
    const importBtn = document.getElementById("import-btn");
    const importFile = document.getElementById("import-file");

    function close() {
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    function toggleMenu() {
      const open = list.hidden;
      list.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });
    document.addEventListener("click", (e) => {
      if (!list.hidden && !list.contains(e.target) && e.target !== btn) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    syncNowBtn.addEventListener("click", async () => {
      close();
      if (!syncConfigured()) {
        navigate("#/sync");
        return;
      }
      const original = syncNowBtn.textContent;
      syncNowBtn.textContent = T.syncStatusInFlight;
      syncNowBtn.disabled = true;
      try {
        await syncOnce();
      } catch {
        /* error stored in settings, surfaces on /sync page */
      }
      syncNowBtn.textContent = original;
      syncNowBtn.disabled = false;
    });
    syncBtn.addEventListener("click", () => {
      close();
      navigate("#/sync");
    });
    exportBtn.addEventListener("click", () => {
      close();
      exportToFile();
    });
    importBtn.addEventListener("click", () => {
      close();
      importFile.click();
    });
    importFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importFromFile(file);
      e.target.value = "";
    });
  }

  // ---------- Router ----------
  function router() {
    ensureDatalists();
    const hash = location.hash || "#/";
    const editMatch = hash.match(/^#\/rediger\/(.+)$/);
    const detailMatch = hash.match(/^#\/opskrift\/(.+)$/);

    if (hash === "#/" || hash === "" || hash === "#") {
      renderList();
    } else if (hash === "#/ny") {
      renderForm(null);
    } else if (hash === "#/indkoeb") {
      renderShopping();
    } else if (hash === "#/sync") {
      renderSync();
    } else if (editMatch) {
      const r = getRecipe(decodeURIComponent(editMatch[1]));
      if (r) renderForm(r);
      else navigate("#/");
    } else if (detailMatch) {
      renderDetail(decodeURIComponent(detailMatch[1]));
    } else {
      navigate("#/");
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", router);
  document.addEventListener("DOMContentLoaded", () => {
    migrate();
    wireMenu();
    router();
    startupSync();
    wireSyncTriggers();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  });
})();
