(() => {
  'use strict';

  // ============================================================
  // Generic spaced "retry later" deck engine
  // Cards answered wrong are re-queued to reappear after RETRY_GAP
  // other cards have been shown, growing as the user keeps missing them.
  //
  // Ordering strategy: rather than a flat shuffle of every id (which can
  // by chance clump several same-category cards together), ids are grouped
  // into buckets by category (DSA pattern / ML topic), each bucket is
  // shuffled independently, and the full-cycle order is built by drawing
  // from a randomly rotating mix of buckets while avoiding picking the
  // same category twice in a row whenever an alternative is available.
  // This guarantees every card in the set is shown exactly once per full
  // cycle (no repeats until everything has been seen), while keeping
  // consecutive cards varied in type. Each new cycle re-shuffles
  // independently, and since nothing is seeded, a fresh browser session
  // with no localStorage gets its own independent random order rather
  // than replaying the same sequence.
  // ============================================================
  const RETRY_GAP = 5;

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Builds one full pass over `ids`, interleaved by category so the same
  // category rarely repeats back-to-back. `categoryOf(id)` returns a
  // grouping key; if omitted, everything is treated as one bucket (a
  // plain shuffle). Selection is weighted by each category's remaining
  // count so a large category (e.g. many DP problems) gets spread across
  // the whole cycle rather than only showing up once smaller buckets run out.
  function buildInterleavedOrder(ids, categoryOf) {
    const buckets = new Map();
    for (const id of ids) {
      const cat = categoryOf ? categoryOf(id) : 'default';
      if (!buckets.has(cat)) buckets.set(cat, []);
      buckets.get(cat).push(id);
    }
    for (const bucket of buckets.values()) shuffleInPlace(bucket);

    const categories = [...buckets.keys()];
    const order = [];
    let lastCat = null;
    while (order.length < ids.length) {
      const available = categories.filter(c => buckets.get(c).length > 0);
      const pool = available.length > 1 ? available.filter(c => c !== lastCat) : available;
      // weighted pick proportional to remaining bucket size
      const totalWeight = pool.reduce((sum, c) => sum + buckets.get(c).length, 0);
      let roll = Math.random() * totalWeight;
      let cat = pool[pool.length - 1];
      for (const c of pool) {
        roll -= buckets.get(c).length;
        if (roll <= 0) { cat = c; break; }
      }
      order.push(buckets.get(cat).shift());
      lastCat = cat;
    }
    return order;
  }

  class Deck {
    // categoryOf: optional function(id) -> string, used to interleave categories
    constructor(storageKey, ids, categoryOf) {
      this.storageKey = storageKey;
      this.allIds = ids;
      this.categoryOf = categoryOf || null;
      const saved = this._load();
      this.order = (saved.order && saved.order.length === ids.length)
        ? saved.order
        : buildInterleavedOrder(ids, this.categoryOf);
      this.pointer = saved.pointer || 0;
      this.retryQueue = saved.retryQueue || []; // [{id, dueAt}]
      this.askCount = saved.askCount || 0;
      this.currentId = saved.currentId ?? null;
      this.stats = saved.stats || { correct: 0, incorrect: 0 };
    }

    _reshuffle() {
      this.order = buildInterleavedOrder(this.allIds, this.categoryOf);
      // avoid the new cycle's first card being identical to the card that
      // just ended the previous cycle
      if (this.order.length > 1 && this.order[0] === this.currentId) {
        const swapAt = 1 + Math.floor(Math.random() * (this.order.length - 1));
        [this.order[0], this.order[swapAt]] = [this.order[swapAt], this.order[0]];
      }
      this.pointer = 0;
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
        localStorage.setItem(this.storageKey, JSON.stringify({
          order: this.order,
          pointer: this.pointer,
          retryQueue: this.retryQueue,
          askCount: this.askCount,
          currentId: this.currentId,
          stats: this.stats
        }));
      } catch { /* storage unavailable, degrade silently */ }
    }

    current() {
      if (this.currentId == null) return this.next();
      return this.currentId;
    }

    next() {
      this.askCount++;
      const dueIdx = this.retryQueue.findIndex(r => r.dueAt <= this.askCount);
      let id;
      if (dueIdx >= 0) {
        id = this.retryQueue.splice(dueIdx, 1)[0].id;
      } else {
        if (this.pointer >= this.order.length) this._reshuffle();
        id = this.order[this.pointer++];
      }
      this.currentId = id;
      this._save();
      return id;
    }

    markRetryLater(id) {
      this.retryQueue = this.retryQueue.filter(r => r.id !== id);
      this.retryQueue.push({ id, dueAt: this.askCount + RETRY_GAP });
      this._save();
    }

    markResult(correct) {
      if (correct) this.stats.correct++; else this.stats.incorrect++;
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
    dsa: null,       // { patternPool, problems }
    sysdesign: null, // [ ... ]
    ml: null,        // [ ... ]
    lang: localStorage.getItem('drillset_lang') || 'python',
    decks: {}
  };

  // Resolve data URLs against this script's own location rather than
  // location.href/relative paths. GitHub Pages (and many static hosts) will
  // happily serve a page at ".../your-repo" with no trailing slash, and a
  // bare relative fetch("data/dsa.json") then resolves one directory too
  // high and 404s (returning an HTML error page, which breaks JSON.parse).
  // <script src="app.js"> is always resolved correctly by the browser, so
  // basing everything off that sidesteps the ambiguity entirely.
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : window.location.href;
  const BASE_URL = SCRIPT_URL.substring(0, SCRIPT_URL.lastIndexOf('/') + 1);

  async function fetchJson(path) {
    const url = BASE_URL + path;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${url} responded ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `${url} did not return JSON (content-type: ${contentType || 'unknown'}). ` +
        `This usually means the file wasn't found at that path and the host returned an HTML error page instead.`
      );
    }
  }

  async function loadData() {
    const [dsa, sysdesign, ml, cloud, leadership] = await Promise.all([
      fetchJson('data/dsa.json'),
      fetchJson('data/system_design.json'),
      fetchJson('data/ml.json'),
      fetchJson('data/cloud.json'),
      fetchJson('data/leadership.json')
    ]);
    state.dsa = dsa;
    state.sysdesign = sysdesign;
    state.ml = ml;
    state.cloud = cloud;
    state.leadership = leadership;

    const dsaPatternById = new Map(dsa.problems.map(p => [p.id, p.correctPattern]));
    const mlCategoryById = new Map(ml.map(c => [c.id, c.category]));
    const cloudCategoryById = new Map(cloud.map(c => [c.id, c.category]));
    const leadershipCategoryById = new Map(leadership.map(c => [c.id, c.category]));

    state.decks.dsa = new Deck('drillset_dsa_state', dsa.problems.map(p => p.id), id => dsaPatternById.get(id));
    // System design has no category grouping: each prompt is already a distinct
    // topic, so a plain shuffle gives plenty of variety on its own.
    state.decks.sysdesign = new Deck('drillset_sysdesign_state', sysdesign.map(q => q.id));
    state.decks.ml = new Deck('drillset_ml_state', ml.map(c => c.id), id => mlCategoryById.get(id));
    state.decks.cloud = new Deck('drillset_cloud_state', cloud.map(c => c.id), id => cloudCategoryById.get(id));
    state.decks.leadership = new Deck('drillset_leadership_state', leadership.map(c => c.id), id => leadershipCategoryById.get(id));

    renderHomeStats();
  }

  function renderHomeStats() {
    const dsaDeck = state.decks.dsa, sdDeck = state.decks.sysdesign, mlDeck = state.decks.ml,
          cloudDeck = state.decks.cloud, leadershipDeck = state.decks.leadership;
    document.getElementById('stat-dsa').textContent =
      `${state.dsa.problems.length} problems · ${dsaDeck.dueForRetryCount()} queued for retry`;
    document.getElementById('stat-sysdesign').textContent =
      `${state.sysdesign.length} prompts · ${sdDeck.dueForRetryCount()} queued for retry`;
    document.getElementById('stat-ml').textContent =
      `${state.ml.length} cards · ${mlDeck.dueForRetryCount()} queued for retry`;
    document.getElementById('stat-cloud').textContent =
      `${state.cloud.length} cards · ${cloudDeck.dueForRetryCount()} queued for retry`;
    document.getElementById('stat-leadership').textContent =
      `${state.leadership.length} cards · ${leadershipDeck.dueForRetryCount()} queued for retry`;
  }

  // ============================================================
  // View navigation
  // ============================================================
  const views = ['home', 'dsa', 'sysdesign', 'ml', 'cloud', 'leadership'];

  function showView(name) {
    views.forEach(v => {
      document.getElementById(`view-${v}`).hidden = v !== name;
    });
    if (name === 'home') renderHomeStats();
    if (name === 'dsa') renderDsaCard(state.decks.dsa.current());
    if (name === 'sysdesign') renderSdCard(state.decks.sysdesign.current());
    if (name === 'ml') mlDeckUI.render(state.decks.ml.current());
    if (name === 'cloud') cloudDeckUI.render(state.decks.cloud.current());
    if (name === 'leadership') leadershipDeckUI.render(state.decks.leadership.current());
    window.scrollTo(0, 0);
  }

  document.getElementById('homeBtn').addEventListener('click', () => showView('home'));
  document.querySelectorAll('[data-back]').forEach(btn =>
    btn.addEventListener('click', () => showView('home'))
  );
  document.querySelectorAll('.deck-card').forEach(card =>
    card.addEventListener('click', () => showView(card.dataset.target))
  );

  // ============================================================
  // DSA VIEW
  // ============================================================
  const langSelect = document.getElementById('langSelect');
  langSelect.value = state.lang;
  langSelect.addEventListener('change', () => {
    state.lang = langSelect.value;
    localStorage.setItem('drillset_lang', state.lang);
    document.getElementById('solutionLang').textContent = state.lang;
    const problem = getDsaProblem(state.decks.dsa.currentId);
    if (problem && !document.getElementById('solutionZone').hidden) {
      document.getElementById('solutionCode').textContent = problem.solutions[state.lang];
    }
  });

  function getDsaProblem(id) {
    return state.dsa.problems.find(p => p.id === id);
  }

  let dsaSolved = false;

  function renderDsaCard(id) {
    const p = getDsaProblem(id);
    dsaSolved = false;

    document.getElementById('dsaNumber').textContent = `#${p.number}`;
    document.getElementById('dsaDiff').textContent = p.difficulty;
    document.getElementById('dsaTitle').textContent = p.title;
    document.getElementById('dsaDesc').textContent = p.description;
    document.getElementById('dsaTab').textContent = p.correctPattern.split(' ')[0].toUpperCase();

    const btnWrap = document.getElementById('patternButtons');
    btnWrap.innerHTML = '';
    p.options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'pattern-btn';
      b.textContent = opt;
      b.addEventListener('click', () => handlePatternClick(b, opt, p));
      btnWrap.appendChild(b);
    });

    document.getElementById('feedbackMsg').textContent = '';
    document.getElementById('feedbackMsg').className = 'feedback-msg';
    document.getElementById('solutionZone').hidden = true;
    document.getElementById('solutionLang').textContent = state.lang;
    document.getElementById('dsaRetryBtn').hidden = true;
    document.getElementById('dsaNextBtn').hidden = true;

    const card = document.getElementById('dsaCard');
    const scroller = card.querySelector('.card-scroll');
    scroller.scrollTop = 0;
  }

  function handlePatternClick(btn, chosen, problem) {
    if (dsaSolved || btn.disabled) return;
    const feedback = document.getElementById('feedbackMsg');

    if (chosen === problem.correctPattern) {
      btn.classList.add('correct');
      document.querySelectorAll('#patternButtons .pattern-btn').forEach(b => b.disabled = true);
      feedback.textContent = 'Correct — nice pattern recognition.';
      feedback.className = 'feedback-msg correct';
      dsaSolved = true;

      const solutionZone = document.getElementById('solutionZone');
      solutionZone.hidden = false;
      document.getElementById('solutionCode').textContent = problem.solutions[state.lang];

      document.getElementById('dsaNextBtn').hidden = false;
      document.getElementById('dsaRetryBtn').hidden = false;
      state.decks.dsa.markResult(true);
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      feedback.textContent = 'Incorrect — try another pattern.';
      feedback.className = 'feedback-msg wrong';
      document.getElementById('dsaRetryBtn').hidden = false;
      state.decks.dsa.markResult(false);
    }
  }

  document.getElementById('dsaNextBtn').addEventListener('click', () => {
    renderDsaCard(state.decks.dsa.next());
  });
  document.getElementById('dsaRetryBtn').addEventListener('click', () => {
    state.decks.dsa.markRetryLater(state.decks.dsa.currentId);
    renderDsaCard(state.decks.dsa.next());
  });

  const copyCodeBtn = document.getElementById('copyCodeBtn');
  let copyResetTimer = null;

  function selectCodeTextForManualCopy() {
    const codeEl = document.getElementById('solutionCode');
    try {
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch {
      return false;
    }
  }

  copyCodeBtn.addEventListener('click', async () => {
    const code = document.getElementById('solutionCode').textContent;
    let success = false;

    // Preferred path: the async Clipboard API. This requires a secure
    // context (https, or localhost) — it's silently unavailable on plain
    // http, which is a common reason this can appear to "do nothing".
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        success = true;
      } catch (err) {
        console.warn('Clipboard API write failed, falling back:', err);
      }
    }

    // Fallback: legacy execCommand via a hidden, focused, selected textarea.
    // Its return value must be checked explicitly — it fails by returning
    // false, not by throwing, so skipping that check was the original bug
    // (the UI would claim success even when nothing was actually copied).
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length); // needed on iOS Safari
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (err) {
        console.warn('execCommand copy fallback failed:', err);
      }
    }

    if (success) {
      copyCodeBtn.textContent = 'Copied!';
      copyCodeBtn.classList.add('copied');
    } else {
      // Last resort: both programmatic methods were blocked (some browsers
      // restrict clipboard access entirely outside a very narrow set of
      // conditions). Select the code instead so a manual Ctrl/Cmd+C still works.
      selectCodeTextForManualCopy();
      copyCodeBtn.textContent = 'Selected — press ⌘/Ctrl+C';
    }

    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyCodeBtn.textContent = 'Copy';
      copyCodeBtn.classList.remove('copied');
    }, success ? 1500 : 3000);
  });

  // ============================================================
  // SYSTEM DESIGN VIEW
  // ============================================================
  let sdStageIndex = 0;
  let mermaidReady = false;

  function getSdQuestion(id) {
    return state.sysdesign.find(q => q.id === id);
  }

  function renderSdCard(id) {
    const q = getSdQuestion(id);
    sdStageIndex = 0;
    renderSdStage(q);
  }

  function renderSdStage(q) {
    const stage = q.stages[sdStageIndex];
    document.getElementById('sdTitle').textContent = q.title;
    document.getElementById('sdPrompt').textContent = stage.prompt;
    document.getElementById('sdStagePill').textContent = `Stage ${sdStageIndex + 1} / ${q.stages.length}`;

    document.getElementById('sdAnswerZone').hidden = true;
    document.getElementById('sdDiagramZone').hidden = true;
    document.getElementById('sdAnswer').textContent = stage.answer;

    document.getElementById('sdActionBar').hidden = false;
    document.getElementById('sdEndBar').hidden = true;
    document.getElementById('sdShowAnswerBtn').hidden = false;
    document.getElementById('sdFollowUpBtn').hidden = true;

    document.querySelector('#sdCard .card-scroll').scrollTop = 0;
  }

  document.getElementById('sdShowAnswerBtn').addEventListener('click', async () => {
    const q = getSdQuestion(state.decks.sysdesign.currentId);
    document.getElementById('sdAnswerZone').hidden = false;
    document.getElementById('sdShowAnswerBtn').hidden = true;

    const isLastStage = sdStageIndex === q.stages.length - 1;
    if (isLastStage) {
      document.getElementById('sdDiagramZone').hidden = false;
      await renderMermaid(q);
      document.getElementById('sdActionBar').hidden = true;
      document.getElementById('sdEndBar').hidden = false;
    } else {
      document.getElementById('sdFollowUpBtn').hidden = false;
    }
  });

  document.getElementById('sdFollowUpBtn').addEventListener('click', () => {
    const q = getSdQuestion(state.decks.sysdesign.currentId);
    sdStageIndex++;
    renderSdStage(q);
  });

  document.getElementById('sdNextBtn').addEventListener('click', () => {
    renderSdCard(state.decks.sysdesign.next());
  });
  document.getElementById('sdRetryBtn').addEventListener('click', () => {
    state.decks.sysdesign.markRetryLater(state.decks.sysdesign.currentId);
    renderSdCard(state.decks.sysdesign.next());
  });

  async function renderMermaid(q) {
    const el = document.getElementById('sdDiagram');
    el.removeAttribute('data-processed');
    el.textContent = q.diagram;
    if (!mermaidReady && window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          background: '#0B0D12',
          primaryColor: '#1E2230',
          primaryTextColor: '#EDEFF4',
          primaryBorderColor: '#2A2F3D',
          lineColor: '#4FD1C5',
          secondaryColor: '#171A21',
          tertiaryColor: '#171A21',
          fontFamily: 'JetBrains Mono, monospace'
        }
      });
      mermaidReady = true;
    }
    try {
      if (window.mermaid) {
        const { svg } = await window.mermaid.render('sdDiagramSvg-' + Date.now(), q.diagram);
        el.innerHTML = svg;
      }
    } catch (e) {
      el.textContent = 'Diagram unavailable — here is the raw structure:\n\n' + q.diagram;
    }
  }

  // ============================================================
  // SIMPLE Q&A DECKS (ML / Cloud / Leadership)
  // These three views share an identical shape: a category pill, a
  // question, a reveal-able answer, and retry-later/next controls.
  // Rather than tripling near-identical code, wire each one up from a
  // single factory keyed by its DOM id prefix.
  // ============================================================
  function initSimpleDeck(prefix, getDataArray, getDeck) {
    function getCard(id) {
      return getDataArray().find(c => c.id === id);
    }
    function render(id) {
      const c = getCard(id);
      document.getElementById(`${prefix}CategoryPill`).textContent = c.category;
      document.getElementById(`${prefix}Question`).textContent = c.question;
      document.getElementById(`${prefix}Answer`).textContent = c.answer;
      document.getElementById(`${prefix}AnswerZone`).hidden = true;
      document.getElementById(`${prefix}ShowAnswerBtn`).hidden = false;
      document.getElementById(`${prefix}RetryBtn`).hidden = true;
      document.getElementById(`${prefix}NextBtn`).hidden = true;
      document.querySelector(`#${prefix}Card .card-scroll`).scrollTop = 0;
    }

    document.getElementById(`${prefix}ShowAnswerBtn`).addEventListener('click', () => {
      document.getElementById(`${prefix}AnswerZone`).hidden = false;
      document.getElementById(`${prefix}ShowAnswerBtn`).hidden = true;
      document.getElementById(`${prefix}RetryBtn`).hidden = false;
      document.getElementById(`${prefix}NextBtn`).hidden = false;
    });
    document.getElementById(`${prefix}NextBtn`).addEventListener('click', () => {
      render(getDeck().next());
    });
    document.getElementById(`${prefix}RetryBtn`).addEventListener('click', () => {
      const deck = getDeck();
      deck.markRetryLater(deck.currentId);
      render(deck.next());
    });

    return { render };
  }

  const mlDeckUI = initSimpleDeck('ml', () => state.ml, () => state.decks.ml);
  const cloudDeckUI = initSimpleDeck('cloud', () => state.cloud, () => state.decks.cloud);
  const leadershipDeckUI = initSimpleDeck('leadership', () => state.leadership, () => state.decks.leadership);

  // ============================================================
  // Boot
  // ============================================================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  loadData().catch(err => {
    document.getElementById('view-home').innerHTML =
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
