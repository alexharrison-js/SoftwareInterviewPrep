(() => {
  "use strict";

  // ============================================================
  // Generic spaced "retry later" deck engine
  // Cards answered wrong are re-queued to reappear after RETRY_GAP
  // other cards have been shown, growing as the user keeps missing them.
  // ============================================================
  const RETRY_GAP = 5;

  class Deck {
    constructor(storageKey, ids) {
      this.storageKey = storageKey;
      this.allIds = ids;
      const saved = this._load();
      this.order =
        saved.order && saved.order.length === ids.length
          ? saved.order
          : this._shuffle([...ids]);
      this.pointer = saved.pointer || 0;
      this.retryQueue = saved.retryQueue || []; // [{id, dueAt}]
      this.askCount = saved.askCount || 0;
      this.currentId = saved.currentId ?? null;
      this.stats = saved.stats || { correct: 0, incorrect: 0 };
    }

    _shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    _load() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    _save() {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({
            order: this.order,
            pointer: this.pointer,
            retryQueue: this.retryQueue,
            askCount: this.askCount,
            currentId: this.currentId,
            stats: this.stats,
          }),
        );
      } catch {
        /* storage unavailable, degrade silently */
      }
    }

    current() {
      if (this.currentId == null) return this.next();
      return this.currentId;
    }

    next() {
      this.askCount++;
      const dueIdx = this.retryQueue.findIndex((r) => r.dueAt <= this.askCount);
      let id;
      if (dueIdx >= 0) {
        id = this.retryQueue.splice(dueIdx, 1)[0].id;
      } else {
        if (this.pointer >= this.order.length) {
          this.order = this._shuffle([...this.allIds]);
          this.pointer = 0;
        }
        id = this.order[this.pointer++];
        // avoid immediate repeat when possible
        if (id === this.currentId && this.order.length > 1) {
          if (this.pointer >= this.order.length) {
            this.order = this._shuffle([...this.allIds]);
            this.pointer = 0;
          }
          id = this.order[this.pointer++];
        }
      }
      this.currentId = id;
      this._save();
      return id;
    }

    markRetryLater(id) {
      this.retryQueue = this.retryQueue.filter((r) => r.id !== id);
      this.retryQueue.push({ id, dueAt: this.askCount + RETRY_GAP });
      this._save();
    }

    markResult(correct) {
      if (correct) this.stats.correct++;
      else this.stats.incorrect++;
      this._save();
    }

    dueForRetryCount() {
      return this.retryQueue.length;
    }
  }

  // ============================================================
  // Data loading
  // ============================================================
  const state = {
    dsa: null, // { patternPool, problems }
    sysdesign: null, // [ ... ]
    ml: null, // [ ... ]
    lang: localStorage.getItem("drillset_lang") || "python",
    decks: {},
  };

  // Resolve data URLs against this script's own location rather than
  // location.href/relative paths. GitHub Pages (and many static hosts) will
  // happily serve a page at ".../your-repo" with no trailing slash, and a
  // bare relative fetch("data/dsa.json") then resolves one directory too
  // high and 404s (returning an HTML error page, which breaks JSON.parse).
  // <script src="app.js"> is always resolved correctly by the browser, so
  // basing everything off that sidesteps the ambiguity entirely.
  const SCRIPT_URL = document.currentScript
    ? document.currentScript.src
    : window.location.href;
  const BASE_URL = SCRIPT_URL.substring(0, SCRIPT_URL.lastIndexOf("/") + 1);

  async function fetchJson(path) {
    const url = BASE_URL + path;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${url} responded ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `${url} did not return JSON (content-type: ${contentType || "unknown"}). ` +
          `This usually means the file wasn't found at that path and the host returned an HTML error page instead.`,
      );
    }
  }

  async function loadData() {
    const [dsa, sysdesign, ml] = await Promise.all([
      fetchJson("data/dsa.json"),
      fetchJson("data/system_design.json"),
      fetchJson("data/ml.json"),
    ]);
    state.dsa = dsa;
    state.sysdesign = sysdesign;
    state.ml = ml;

    state.decks.dsa = new Deck(
      "drillset_dsa_state",
      dsa.problems.map((p) => p.id),
    );
    state.decks.sysdesign = new Deck(
      "drillset_sysdesign_state",
      sysdesign.map((q) => q.id),
    );
    state.decks.ml = new Deck(
      "drillset_ml_state",
      ml.map((c) => c.id),
    );

    renderHomeStats();
  }

  function renderHomeStats() {
    const dsaDeck = state.decks.dsa,
      sdDeck = state.decks.sysdesign,
      mlDeck = state.decks.ml;
    document.getElementById("stat-dsa").textContent =
      `${state.dsa.problems.length} problems · ${dsaDeck.dueForRetryCount()} queued for retry`;
    document.getElementById("stat-sysdesign").textContent =
      `${state.sysdesign.length} prompts · ${sdDeck.dueForRetryCount()} queued for retry`;
    document.getElementById("stat-ml").textContent =
      `${state.ml.length} cards · ${mlDeck.dueForRetryCount()} queued for retry`;
  }

  // ============================================================
  // View navigation
  // ============================================================
  const views = ["home", "dsa", "sysdesign", "ml"];

  function showView(name) {
    views.forEach((v) => {
      document.getElementById(`view-${v}`).hidden = v !== name;
    });
    if (name === "home") renderHomeStats();
    if (name === "dsa") renderDsaCard(state.decks.dsa.current());
    if (name === "sysdesign") renderSdCard(state.decks.sysdesign.current());
    if (name === "ml") renderMlCard(state.decks.ml.current());
    window.scrollTo(0, 0);
  }

  document
    .getElementById("homeBtn")
    .addEventListener("click", () => showView("home"));
  document
    .querySelectorAll("[data-back]")
    .forEach((btn) => btn.addEventListener("click", () => showView("home")));
  document
    .querySelectorAll(".deck-card")
    .forEach((card) =>
      card.addEventListener("click", () => showView(card.dataset.target)),
    );

  // ============================================================
  // DSA VIEW
  // ============================================================
  const langSelect = document.getElementById("langSelect");
  langSelect.value = state.lang;
  langSelect.addEventListener("change", () => {
    state.lang = langSelect.value;
    localStorage.setItem("drillset_lang", state.lang);
    document.getElementById("solutionLang").textContent = state.lang;
    const problem = getDsaProblem(state.decks.dsa.currentId);
    if (problem && !document.getElementById("solutionZone").hidden) {
      document.getElementById("solutionCode").textContent =
        problem.solutions[state.lang];
    }
  });

  function getDsaProblem(id) {
    return state.dsa.problems.find((p) => p.id === id);
  }

  let dsaSolved = false;

  function renderDsaCard(id) {
    const p = getDsaProblem(id);
    dsaSolved = false;

    document.getElementById("dsaNumber").textContent = `#${p.number}`;
    document.getElementById("dsaDiff").textContent = p.difficulty;
    document.getElementById("dsaTitle").textContent = p.title;
    document.getElementById("dsaDesc").textContent = p.description;
    document.getElementById("dsaTab").textContent = p.correctPattern
      .split(" ")[0]
      .toUpperCase();

    const btnWrap = document.getElementById("patternButtons");
    btnWrap.innerHTML = "";
    p.options.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "pattern-btn";
      b.textContent = opt;
      b.addEventListener("click", () => handlePatternClick(b, opt, p));
      btnWrap.appendChild(b);
    });

    document.getElementById("feedbackMsg").textContent = "";
    document.getElementById("feedbackMsg").className = "feedback-msg";
    document.getElementById("solutionZone").hidden = true;
    document.getElementById("solutionLang").textContent = state.lang;
    document.getElementById("dsaRetryBtn").hidden = true;
    document.getElementById("dsaNextBtn").hidden = true;

    const card = document.getElementById("dsaCard");
    const scroller = card.querySelector(".card-scroll");
    scroller.scrollTop = 0;
  }

  function handlePatternClick(btn, chosen, problem) {
    if (dsaSolved || btn.disabled) return;
    const feedback = document.getElementById("feedbackMsg");

    if (chosen === problem.correctPattern) {
      btn.classList.add("correct");
      document
        .querySelectorAll("#patternButtons .pattern-btn")
        .forEach((b) => (b.disabled = true));
      feedback.textContent = "Correct — nice pattern recognition.";
      feedback.className = "feedback-msg correct";
      dsaSolved = true;

      const solutionZone = document.getElementById("solutionZone");
      solutionZone.hidden = false;
      document.getElementById("solutionCode").textContent =
        problem.solutions[state.lang];

      document.getElementById("dsaNextBtn").hidden = false;
      document.getElementById("dsaRetryBtn").hidden = true;
      state.decks.dsa.markResult(true);
    } else {
      btn.classList.add("wrong");
      btn.disabled = true;
      feedback.textContent = "Incorrect — try another pattern.";
      feedback.className = "feedback-msg wrong";
      document.getElementById("dsaRetryBtn").hidden = false;
      state.decks.dsa.markResult(false);
    }
  }

  document.getElementById("dsaNextBtn").addEventListener("click", () => {
    renderDsaCard(state.decks.dsa.next());
  });
  document.getElementById("dsaRetryBtn").addEventListener("click", () => {
    state.decks.dsa.markRetryLater(state.decks.dsa.currentId);
    renderDsaCard(state.decks.dsa.next());
  });

  // ============================================================
  // SYSTEM DESIGN VIEW
  // ============================================================
  let sdStageIndex = 0;
  let mermaidReady = false;

  function getSdQuestion(id) {
    return state.sysdesign.find((q) => q.id === id);
  }

  function renderSdCard(id) {
    const q = getSdQuestion(id);
    sdStageIndex = 0;
    renderSdStage(q);
  }

  function renderSdStage(q) {
    const stage = q.stages[sdStageIndex];
    document.getElementById("sdTitle").textContent = q.title;
    document.getElementById("sdPrompt").textContent = stage.prompt;
    document.getElementById("sdStagePill").textContent =
      `Stage ${sdStageIndex + 1} / ${q.stages.length}`;

    document.getElementById("sdAnswerZone").hidden = true;
    document.getElementById("sdDiagramZone").hidden = true;
    document.getElementById("sdAnswer").textContent = stage.answer;

    document.getElementById("sdActionBar").hidden = false;
    document.getElementById("sdEndBar").hidden = true;
    document.getElementById("sdShowAnswerBtn").hidden = false;
    document.getElementById("sdFollowUpBtn").hidden = true;

    document.querySelector("#sdCard .card-scroll").scrollTop = 0;
  }

  document
    .getElementById("sdShowAnswerBtn")
    .addEventListener("click", async () => {
      const q = getSdQuestion(state.decks.sysdesign.currentId);
      document.getElementById("sdAnswerZone").hidden = false;
      document.getElementById("sdShowAnswerBtn").hidden = true;

      const isLastStage = sdStageIndex === q.stages.length - 1;
      if (isLastStage) {
        document.getElementById("sdDiagramZone").hidden = false;
        await renderMermaid(q);
        document.getElementById("sdActionBar").hidden = true;
        document.getElementById("sdEndBar").hidden = false;
      } else {
        document.getElementById("sdFollowUpBtn").hidden = false;
      }
    });

  document.getElementById("sdFollowUpBtn").addEventListener("click", () => {
    const q = getSdQuestion(state.decks.sysdesign.currentId);
    sdStageIndex++;
    renderSdStage(q);
  });

  document.getElementById("sdNextBtn").addEventListener("click", () => {
    renderSdCard(state.decks.sysdesign.next());
  });
  document.getElementById("sdRetryBtn").addEventListener("click", () => {
    state.decks.sysdesign.markRetryLater(state.decks.sysdesign.currentId);
    renderSdCard(state.decks.sysdesign.next());
  });

  async function renderMermaid(q) {
    const el = document.getElementById("sdDiagram");
    el.removeAttribute("data-processed");
    el.textContent = q.diagram;
    if (!mermaidReady && window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          background: "#0B0D12",
          primaryColor: "#1E2230",
          primaryTextColor: "#EDEFF4",
          primaryBorderColor: "#2A2F3D",
          lineColor: "#4FD1C5",
          secondaryColor: "#171A21",
          tertiaryColor: "#171A21",
          fontFamily: "JetBrains Mono, monospace",
        },
      });
      mermaidReady = true;
    }
    try {
      if (window.mermaid) {
        const { svg } = await window.mermaid.render(
          "sdDiagramSvg-" + Date.now(),
          q.diagram,
        );
        el.innerHTML = svg;
      }
    } catch (e) {
      el.textContent =
        "Diagram unavailable — here is the raw structure:\n\n" + q.diagram;
    }
  }

  // ============================================================
  // ML VIEW
  // ============================================================
  function getMlCard(id) {
    return state.ml.find((c) => c.id === id);
  }

  function renderMlCard(id) {
    const c = getMlCard(id);
    document.getElementById("mlCategoryPill").textContent = c.category;
    document.getElementById("mlQuestion").textContent = c.question;
    document.getElementById("mlAnswer").textContent = c.answer;
    document.getElementById("mlAnswerZone").hidden = true;
    document.getElementById("mlShowAnswerBtn").hidden = false;
    document.getElementById("mlRetryBtn").hidden = true;
    document.getElementById("mlNextBtn").hidden = true;
    document.querySelector("#mlCard .card-scroll").scrollTop = 0;
  }

  document.getElementById("mlShowAnswerBtn").addEventListener("click", () => {
    document.getElementById("mlAnswerZone").hidden = false;
    document.getElementById("mlShowAnswerBtn").hidden = true;
    document.getElementById("mlRetryBtn").hidden = false;
    document.getElementById("mlNextBtn").hidden = false;
  });

  document.getElementById("mlNextBtn").addEventListener("click", () => {
    renderMlCard(state.decks.ml.next());
  });
  document.getElementById("mlRetryBtn").addEventListener("click", () => {
    state.decks.ml.markRetryLater(state.decks.ml.currentId);
    renderMlCard(state.decks.ml.next());
  });

  // ============================================================
  // Boot
  // ============================================================
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  loadData().catch((err) => {
    document.getElementById("view-home").innerHTML =
      `<div style="padding:40px 4px;color:#F2726F;font-family:monospace;font-size:13px;line-height:1.6;">
        <p><strong>Couldn't load flashcard data.</strong></p>
        <p style="color:#8B93A7;">${escapeHtml(err.message)}</p>
        <p style="color:#8B93A7;">
          If you're running this locally by double-clicking index.html (a file:// URL), serve the
          folder over http instead, e.g. <code>python3 -m http.server</code> then open
          http://localhost:8000. If this is on GitHub Pages, confirm the data/ folder was actually
          pushed to the repo and check the exact file URL (e.g. yoursite/data/dsa.json) loads directly
          in the browser without a 404.
        </p>
      </div>`;
  });
})();
