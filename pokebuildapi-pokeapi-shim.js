/**
 * PokeBuild API -> PokeAPI compatibility shim
 * -------------------------------------------
 * Drop this file into projects that still call:
 *   https://pokebuildapi.fr/api/v1/pokemon/:name
 *
 * Then load it BEFORE app.js in index.html.
 *
 * French name queries are resolved through a localStorage-backed
 * index built from PokeAPI species data. The index is populated on
 * first page load and refreshed every 7 days — subsequent loads are
 * instant.
 */
(function () {
  "use strict";

  const LEGACY_API_BASE = "https://pokebuildapi.fr/api/v1/pokemon/";
  const POKEAPI_POKEMON_BASE = "https://pokeapi.co/api/v2/pokemon/";
  const POKEAPI_GRAPHQL = "https://beta.pokeapi.co/graphql/v1beta";

  const TYPE_TRANSLATIONS = {
    normal: "Normal",
    fire: "Feu",
    water: "Eau",
    electric: "Électrik",
    grass: "Plante",
    ice: "Glace",
    fighting: "Combat",
    poison: "Poison",
    ground: "Sol",
    flying: "Vol",
    psychic: "Psy",
    bug: "Insecte",
    rock: "Roche",
    ghost: "Spectre",
    dragon: "Dragon",
    dark: "Ténèbres",
    steel: "Acier",
    fairy: "Fée",
    stellar: "Stellaire",
    unknown: "Inconnu",
  };

  const GENERATION_TO_NUMBER = {
    "generation-i": 1,
    "generation-ii": 2,
    "generation-iii": 3,
    "generation-iv": 4,
    "generation-v": 5,
    "generation-vi": 6,
    "generation-vii": 7,
    "generation-viii": 8,
    "generation-ix": 9,
  };

  const memoryCache = new Map();
  const originalFetch = window.fetch.bind(window);

  // ---- French name index (localStorage-backed) --------------------------------

  const FR_INDEX_KEY = "pokeshim_fr_index_v1";
  const FR_INDEX_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  let frenchIndex = {}; // normalized French name → Pokémon id
  let indexBuildPromise = null;

  function loadFrenchIndex() {
    try {
      const stored = localStorage.getItem(FR_INDEX_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.expires > Date.now() && parsed.index) {
          frenchIndex = parsed.index;
          return true;
        }
      }
    } catch (_e) {}
    return false;
  }

  function saveFrenchIndex() {
    try {
      localStorage.setItem(
        FR_INDEX_KEY,
        JSON.stringify({
          expires: Date.now() + FR_INDEX_TTL,
          index: frenchIndex,
        }),
      );
    } catch (_e) {}
  }

  function registerFrenchName(frenchName, pokemonId) {
    if (!frenchName || !pokemonId) return;
    const key = normalizeSearchValue(frenchName);
    if (key) frenchIndex[key] = pokemonId;
  }

  async function buildFrenchIndex() {
    if (indexBuildPromise) return indexBuildPromise;

    indexBuildPromise = (async function () {
      try {
        // One GraphQL request returns every French species name at once.
        const resp = await originalFetch(POKEAPI_GRAPHQL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "{ pokemon_v2_pokemonspeciesname(where: {language_id: {_eq: 5}}) { name pokemon_species_id } }",
          }),
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const rows = json.data && json.data.pokemon_v2_pokemonspeciesname;
        if (!Array.isArray(rows)) return;

        rows.forEach(function (row) {
          if (row.name && row.pokemon_species_id) {
            registerFrenchName(row.name, row.pokemon_species_id);
          }
        });

        saveFrenchIndex();
        console.info(
          "PokeAPI shim: French name index ready (" +
            Object.keys(frenchIndex).length +
            " entries)",
        );
      } catch (e) {
        // Reset so the next query can trigger a retry.
        indexBuildPromise = null;
        console.warn("PokeAPI shim: French name index build failed", e);
      }
    })();

    return indexBuildPromise;
  }

  // ---- Helpers ----------------------------------------------------------------

  function normalizeSearchValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");
  }

  function formatPokemonName(name) {
    return (
      String(name || "")
        .split("-")
        .filter(Boolean)
        .map(function (part) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join("-") || "Inconnu"
    );
  }

  function translateType(typeName) {
    return TYPE_TRANSLATIONS[typeName] || formatPokemonName(typeName);
  }

  function getFrenchName(speciesData) {
    if (!speciesData || !Array.isArray(speciesData.names)) return null;

    const fr = speciesData.names.find(function (entry) {
      return entry.language && entry.language.name === "fr";
    });

    return fr && fr.name ? fr.name : null;
  }

  function mapStats(apiStats) {
    const mapped = {};

    if (!Array.isArray(apiStats)) return mapped;

    apiStats.forEach(function (entry) {
      if (!entry || !entry.stat || entry.base_stat == null) return;

      const key = entry.stat.name;
      const value = entry.base_stat;

      if (key === "hp") mapped.HP = value;
      if (key === "attack") mapped.attack = value;
      if (key === "defense") mapped.defense = value;
      if (key === "special-attack") mapped.special_attack = value;
      if (key === "special-defense") mapped.special_defense = value;
      if (key === "speed") mapped.speed = value;
    });

    return mapped;
  }

  function toLegacyPokemon(apiPokemon, speciesData) {
    const image =
      apiPokemon &&
      apiPokemon.sprites &&
      apiPokemon.sprites.other &&
      apiPokemon.sprites.other["official-artwork"] &&
      apiPokemon.sprites.other["official-artwork"].front_default
        ? apiPokemon.sprites.other["official-artwork"].front_default
        : apiPokemon && apiPokemon.sprites
          ? apiPokemon.sprites.front_default
          : "";

    const apiTypes = Array.isArray(apiPokemon.types)
      ? apiPokemon.types
          .slice()
          .sort(function (a, b) {
            return (a.slot || 0) - (b.slot || 0);
          })
          .map(function (entry) {
            return {
              name: translateType(entry && entry.type ? entry.type.name : ""),
              image: "",
            };
          })
      : [];

    const generationName =
      speciesData && speciesData.generation ? speciesData.generation.name : "";

    return {
      id: apiPokemon.id,
      name: getFrenchName(speciesData) || formatPokemonName(apiPokemon.name),
      image: image,
      apiGeneration: GENERATION_TO_NUMBER[generationName] || null,
      apiTypes: apiTypes,
      stats: mapStats(apiPokemon.stats),
    };
  }

  async function fetchPokemonAsLegacy(name) {
    const normalized = normalizeSearchValue(name);
    if (memoryCache.has(normalized)) {
      return memoryCache.get(normalized);
    }

    // Resolve French name → id before making any request.
    let frId = frenchIndex[normalized];
    if (!frId && indexBuildPromise) {
      // Index is still being built (cold cache) — wait for it.
      await indexBuildPromise;
      frId = frenchIndex[normalized];
    }

    // French id takes priority; otherwise pass the name through as-is
    // (handles English names and numeric ids).
    const query = frId ? String(frId) : normalized;
    const pokemonResponse = await originalFetch(
      POKEAPI_POKEMON_BASE + encodeURIComponent(query),
    );

    if (pokemonResponse.status === 404) {
      return { status: 404, data: null };
    }

    if (!pokemonResponse.ok) {
      return { status: pokemonResponse.status, data: null };
    }

    const apiPokemon = await pokemonResponse.json();

    let speciesData = null;
    try {
      if (apiPokemon && apiPokemon.species && apiPokemon.species.url) {
        const speciesResponse = await originalFetch(apiPokemon.species.url);
        if (speciesResponse.ok) {
          speciesData = await speciesResponse.json();
        }
      }
    } catch (error) {
      // Non bloquant: continue with primary pokemon payload.
      console.warn("PokeAPI shim: species fetch failed", error);
    }

    const legacyPokemon = toLegacyPokemon(apiPokemon, speciesData);
    const result = { status: 200, data: legacyPokemon };
    memoryCache.set(normalized, result);
    return result;
  }

  function buildJsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function getRequestUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  window.fetch = async function patchedFetch(input, init) {
    const requestUrl = getRequestUrl(input);

    if (!requestUrl.startsWith(LEGACY_API_BASE)) {
      return originalFetch(input, init);
    }

    const rawName = decodeURIComponent(
      requestUrl.slice(LEGACY_API_BASE.length),
    ).trim();

    if (!rawName) {
      return buildJsonResponse({ message: "Not found" }, 404);
    }

    try {
      const result = await fetchPokemonAsLegacy(rawName);

      if (result.status === 404) {
        return buildJsonResponse({ message: "Not found" }, 404);
      }

      if (result.status !== 200 || !result.data) {
        return buildJsonResponse({ message: "Upstream error" }, 502);
      }

      return buildJsonResponse(result.data, 200);
    } catch (error) {
      // Keep fetch behavior close to native for network/runtime failures.
      throw new TypeError(
        error && error.message ? error.message : "Network error",
      );
    }
  };

  // ---- Initialization ---------------------------------------------------------
  // Load cached French name index. If absent or expired, rebuild in background.
  if (!loadFrenchIndex()) {
    console.info(
      "PokeAPI shim: building French name index (first run or cache expired)…",
    );
    buildFrenchIndex();
  }
})();
