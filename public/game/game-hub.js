/* مدير نقاط موحّد لكل مراحل الألعاب: تخزين مستقل لكل لعبة + مجموع تراكمي.
   متاح في المتصفح كـ window.GameHub، وقابل للاختبار في Node بلا واجهة. */
(function (root) {
  const STORAGE_KEY = "dgr_game_hub_data";
  const VERSION = "1.0";
  const NEXT_GAME_URL = "https://dgr-exp.netlify.app/m1/pairs.html";
  const STAGES = {
    game1: { name: "اللعبة الأولى", nameEn: "Warehouse Shift" },
    pairs: { name: "قرائن الصور", nameEn: "Picture Clues" },
  };

  function blank() {
    return { version: VERSION, activeGameId: "game1", totalScore: 0, games: {} };
  }

  function normalize(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    const games = data.games && typeof data.games === "object" ? data.games : {};
    const clean = blank();
    clean.activeGameId = typeof data.activeGameId === "string" ? data.activeGameId : "game1";
    for (const id of Object.keys(games)) {
      const g = games[id] || {};
      clean.games[id] = {
        name: typeof g.name === "string" ? g.name : (STAGES[id] || {}).name || id,
        bestScore: score(g.bestScore),
        lastScore: score(g.lastScore),
        stars: stars(g.stars),
        completed: !!g.completed,
        lastPlayedAt: typeof g.lastPlayedAt === "string" ? g.lastPlayedAt : null,
      };
    }
    clean.totalScore = sum(clean);
    return clean;
  }

  function score(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function stars(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(3, Math.round(n))) : 1;
  }

  function sum(data) {
    return Object.values(data.games).reduce((total, g) => total + score(g.bestScore), 0);
  }

  function read() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return blank();
    }
  }

  function write(data) {
    const clean = normalize(data);
    clean.totalScore = sum(clean);
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (error) {
      /* التخزين قد يكون معطلاً (وضع خاص) — تبقى اللعبة قابلة للعب */
    }
    return clean;
  }

  const GameHub = {
    STORAGE_KEY,
    NEXT_GAME_URL,
    STAGES,

    getData() {
      return read();
    },

    saveGameScore(gameId, newScore, newStars = 3) {
      const data = read();
      const previous = data.games[gameId] || { bestScore: 0, stars: 1 };
      const value = score(newScore);
      const isRecord = value > previous.bestScore;
      data.games[gameId] = {
        name: (STAGES[gameId] || {}).name || (previous.name || gameId),
        bestScore: Math.max(previous.bestScore, value),
        lastScore: value,
        stars: isRecord ? stars(newStars) : previous.stars || stars(newStars),
        completed: true,
        lastPlayedAt: new Date().toISOString(),
      };
      data.activeGameId = gameId;
      const saved = write(data);
      return {
        data: saved,
        bestScore: saved.games[gameId].bestScore,
        lastScore: saved.games[gameId].lastScore,
        totalScore: saved.totalScore,
        isRecord,
      };
    },

    getTotalScore() {
      return read().totalScore;
    },

    getStageScore(gameId) {
      const stage = read().games[gameId];
      return stage ? { ...stage } : null;
    },

    canReplayStage(gameId) {
      return typeof gameId === "string" && gameId.length > 0;
    },

    setActiveGame(gameId) {
      const data = read();
      data.activeGameId = gameId;
      return write(data);
    },

    nextUrl(fromGameId) {
      const from = fromGameId || read().activeGameId || "game1";
      return NEXT_GAME_URL + "?source=" + encodeURIComponent(from) + "&session=active";
    },
  };

  root.GameHub = GameHub;
})(globalThis);
