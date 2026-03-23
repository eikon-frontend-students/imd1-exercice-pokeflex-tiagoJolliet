/**
 * PokéCSS - Application JavaScript
 * ================================
 * NE MODIFIE PAS CE FICHIER !
 * Ton travail = éditer uniquement style.css
 *
 * Ce fichier gère :
 * - La recherche de Pokémon via l'API
 * - L'affichage des cartes Pokémon
 * - Les messages d'erreur
 */

(function () {
  "use strict";

  // =====================================================
  // CONFIGURATION
  // =====================================================
  // Pokémon affiché par défaut au chargement de la page.
  // Change ce nom si tu veux un autre Pokémon de départ.
  // Mets null ou '' pour ne pas charger de Pokémon par défaut.
  const DEFAULT_POKEMON = "arceus";
  // =====================================================

  // URL de base de l'API Pokémon
  const API_BASE_URL = "https://pokebuildapi.fr/api/v1/pokemon/";

  // Clé de préfixe pour le cache localStorage
  const CACHE_PREFIX = "pokeflex_";

  // Éléments du DOM (récupérés au chargement)
  let searchForm;
  let pokemonInput;
  let errorMessage;
  let cardsContainer;
  let cardTemplate;

  /**
   * Initialisation au chargement du DOM
   */
  document.addEventListener("DOMContentLoaded", function () {
    // Récupération des éléments du DOM
    searchForm = document.getElementById("search-form");
    pokemonInput = document.getElementById("pokemon-input");
    errorMessage = document.getElementById("error-message");
    cardsContainer = document.getElementById("cards-container");
    cardTemplate = document.getElementById("pokemon-card-template");

    // Vérification que tous les éléments existent
    if (
      !searchForm ||
      !pokemonInput ||
      !errorMessage ||
      !cardsContainer ||
      !cardTemplate
    ) {
      console.error(
        "PokéCSS: Éléments HTML manquants. Vérifie que tu n'as pas modifié les IDs.",
      );
      return;
    }

    // Écoute de la soumission du formulaire
    searchForm.addEventListener("submit", handleSearch);

    // Charge le Pokémon par défaut si configuré
    if (DEFAULT_POKEMON && DEFAULT_POKEMON.trim()) {
      loadDefaultPokemon(DEFAULT_POKEMON.trim());
    }
  });

  /**
   * Charge le Pokémon par défaut au démarrage
   * @param {string} name - Le nom du Pokémon à charger
   */
  async function loadDefaultPokemon(name) {
    try {
      const pokemon = await fetchPokemon(name);
      createPokemonCard(pokemon);
    } catch (error) {
      // En cas d'erreur au chargement initial, on affiche l'erreur
      // mais ça ne bloque pas l'utilisation de l'app
      console.warn(
        "PokéCSS: Impossible de charger le Pokémon par défaut:",
        error.message,
      );
    }
  }

  /**
   * Gère la soumission du formulaire de recherche
   * @param {Event} event - L'événement submit
   */
  async function handleSearch(event) {
    // Empêche le rechargement de la page
    event.preventDefault();

    // Récupère et nettoie la valeur de l'input
    const searchValue = pokemonInput.value.trim();

    // Si le champ est vide, on ne fait rien
    if (!searchValue) {
      return;
    }

    // Cache le message d'erreur précédent
    hideError();

    try {
      // Recherche le Pokémon via l'API
      const pokemon = await fetchPokemon(searchValue);

      // Crée et affiche la carte
      createPokemonCard(pokemon);

      // Vide le champ de recherche
      pokemonInput.value = "";
    } catch (error) {
      // Affiche le message d'erreur
      showError(error.message);
    }
  }

  /**
   * Génère la clé de cache pour un nom de Pokémon
   * @param {string} name - Le nom du Pokémon
   * @returns {string} La clé de cache
   */
  function getCacheKey(name) {
    // Normalise le nom en minuscules pour éviter les doublons
    return CACHE_PREFIX + name.toLowerCase();
  }

  /**
   * Récupère un Pokémon depuis le cache localStorage
   * @param {string} name - Le nom du Pokémon
   * @returns {Object|null} Les données du Pokémon ou null si non trouvé
   */
  function getFromCache(name) {
    try {
      const key = getCacheKey(name);
      const cached = localStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // En cas d'erreur (localStorage indisponible, JSON invalide, etc.)
      console.warn("PokéCSS: Erreur lecture cache:", error.message);
    }
    return null;
  }

  /**
   * Sauvegarde un Pokémon dans le cache localStorage
   * @param {string} name - Le nom du Pokémon
   * @param {Object} data - Les données du Pokémon
   */
  function saveToCache(name, data) {
    try {
      const key = getCacheKey(name);
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      // En cas d'erreur (localStorage plein, indisponible, etc.)
      console.warn("PokéCSS: Erreur écriture cache:", error.message);
    }
  }

  /**
   * Récupère les données d'un Pokémon (depuis le cache ou l'API)
   * @param {string} name - Le nom du Pokémon à rechercher
   * @returns {Promise<Object>} Les données du Pokémon
   */
  async function fetchPokemon(name) {
    // Vérifie d'abord le cache localStorage
    const cached = getFromCache(name);
    if (cached) {
      return cached;
    }

    // Sinon, récupère depuis l'API
    // Encode le nom pour l'URL (gère les accents, espaces, etc.)
    const encodedName = encodeURIComponent(name);
    const url = API_BASE_URL + encodedName;

    try {
      const response = await fetch(url);

      // Si le Pokémon n'est pas trouvé (404)
      if (response.status === 404) {
        throw new Error("Pokémon introuvable. Vérifie l'orthographe.");
      }

      // Si autre erreur HTTP
      if (!response.ok) {
        throw new Error(
          "OH écris mieux comment tu veux que je te trouve le Pokémon ? ps: jtm quand même <3",
        );
      }

      // Parse la réponse JSON
      const data = await response.json();

      // Sauvegarde dans le cache pour les prochaines recherches
      saveToCache(name, data);

      return data;
    } catch (error) {
      // Si c'est une erreur réseau (pas de connexion, etc.)
      if (error.name === "TypeError") {
        throw new Error("Erreur de connexion. Vérifie ta connexion internet.");
      }
      // Sinon, on propage l'erreur
      throw error;
    }
  }

  /**
   * Crée une carte Pokémon et l'ajoute au conteneur
   * @param {Object} pokemon - Les données du Pokémon
   */
  function createPokemonCard(pokemon) {
    // Clone le template
    const cardClone = cardTemplate.content.cloneNode(true);
    const card = cardClone.querySelector(".card");

    // === Remplissage des données ===

    // Image
    const imageEl = card.querySelector('[data-field="image"]');
    if (imageEl) {
      const imageUrl = pokemon.image || "";
      const pokemonName = pokemon.name || "Pokémon";
      imageEl.src = imageUrl;
      imageEl.alt = "Image de " + pokemonName;
    }

    // Nom
    const nameEl = card.querySelector('[data-field="name"]');
    if (nameEl) {
      nameEl.textContent = pokemon.name || "Inconnu";
    }

    // ID
    const idEl = card.querySelector('[data-field="id"]');
    if (idEl) {
      idEl.textContent = pokemon.id != null ? pokemon.id : "—";
    }

    // Génération (peut être apiGeneration ou generation selon l'API)
    const generationEl = card.querySelector('[data-field="generation"]');
    if (generationEl) {
      let gen = pokemon.apiGeneration || pokemon.generation || "—";
      // Si c'est un nombre, on l'affiche directement
      if (typeof gen === "number") {
        generationEl.textContent = gen;
      } else if (typeof gen === "string") {
        // Parfois l'API retourne "1ère génération" etc.
        generationEl.textContent = gen;
      } else {
        generationEl.textContent = "—";
      }
    }

    // Types
    const typesContainer = card.querySelector('[data-field="types-container"]');
    if (typesContainer) {
      // Récupère les types depuis apiTypes ou types
      const types = extractTypes(pokemon);

      // Vide le conteneur des types (enlève les exemples du template)
      typesContainer.innerHTML = "";

      // Crée un badge pour chaque type
      types.forEach(function (typeName) {
        const badge = document.createElement("span");
        badge.className = "type-badge";
        badge.textContent = typeName;
        typesContainer.appendChild(badge);
      });
    }

    // Statistiques
    const stats = extractStats(pokemon);

    const hpEl = card.querySelector('[data-stat="hp"]');
    if (hpEl) hpEl.textContent = stats.hp;

    const attackEl = card.querySelector('[data-stat="attack"]');
    if (attackEl) attackEl.textContent = stats.attack;

    const defenseEl = card.querySelector('[data-stat="defense"]');
    if (defenseEl) defenseEl.textContent = stats.defense;

    const spAttackEl = card.querySelector('[data-stat="special-attack"]');
    if (spAttackEl) spAttackEl.textContent = stats.specialAttack;

    const spDefenseEl = card.querySelector('[data-stat="special-defense"]');
    if (spDefenseEl) spDefenseEl.textContent = stats.specialDefense;

    const speedEl = card.querySelector('[data-stat="speed"]');
    if (speedEl) speedEl.textContent = stats.speed;

    // Ajoute la carte au conteneur
    cardsContainer.appendChild(card);
  }

  /**
   * Extrait les noms des types depuis les données du Pokémon
   * @param {Object} pokemon - Les données du Pokémon
   * @returns {string[]} Un tableau des noms de types
   */
  function extractTypes(pokemon) {
    // Essaie apiTypes d'abord (structure: [{name: "Feu", image: "..."}])
    if (pokemon.apiTypes && Array.isArray(pokemon.apiTypes)) {
      return pokemon.apiTypes.map(function (t) {
        return t.name || "Type";
      });
    }

    // Sinon essaie types
    if (pokemon.types && Array.isArray(pokemon.types)) {
      return pokemon.types.map(function (t) {
        // Si c'est un objet avec name
        if (typeof t === "object" && t.name) {
          return t.name;
        }
        // Si c'est directement une string
        if (typeof t === "string") {
          return t;
        }
        return "Type";
      });
    }

    // Aucun type trouvé
    return ["—"];
  }

  /**
   * Extrait les statistiques depuis les données du Pokémon
   * @param {Object} pokemon - Les données du Pokémon
   * @returns {Object} Les statistiques formatées
   */
  function extractStats(pokemon) {
    const defaultStats = {
      hp: "—",
      attack: "—",
      defense: "—",
      specialAttack: "—",
      specialDefense: "—",
      speed: "—",
    };

    // Si pas de stats, retourne les valeurs par défaut
    if (!pokemon.stats) {
      return defaultStats;
    }

    const s = pokemon.stats;

    // Mapping des différentes structures possibles de l'API
    return {
      hp: s.HP != null ? s.HP : s.hp != null ? s.hp : "—",
      attack: s.attack != null ? s.attack : s.Attack != null ? s.Attack : "—",
      defense:
        s.defense != null ? s.defense : s.Defense != null ? s.Defense : "—",
      specialAttack:
        s.special_attack != null
          ? s.special_attack
          : s.specialAttack != null
            ? s.specialAttack
            : s["special-attack"] != null
              ? s["special-attack"]
              : "—",
      specialDefense:
        s.special_defense != null
          ? s.special_defense
          : s.specialDefense != null
            ? s.specialDefense
            : s["special-defense"] != null
              ? s["special-defense"]
              : "—",
      speed: s.speed != null ? s.speed : s.Speed != null ? s.Speed : "—",
    };
  }

  /**
   * Affiche un message d'erreur
   * @param {string} message - Le message à afficher
   */
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.removeAttribute("hidden");
  }

  /**
   * Cache le message d'erreur
   */
  function hideError() {
    errorMessage.textContent = "";
    errorMessage.setAttribute("hidden", "");
  }
})();
