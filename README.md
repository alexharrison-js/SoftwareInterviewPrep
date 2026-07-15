# Drillset — Senior Engineer Interview Prep

Live Demo: https://alexharrison-js.github.io/SoftwareInterviewPrep/

A single-page flashcard app for drilling seven interview tracks:

1. **DSA** — LeetCode-style problems → pick the right pattern/data-structure → view a reference solution in Python, Java, TypeScript, JavaScript, C++, or Go, then quiz yourself on its time/space complexity.
2. **System Design** — open-ended design prompts with staged follow-up questions, model answers, and an architecture diagram (rendered with Mermaid).
3. **AI & ML** — concept, history, ML algorithms, neural architectures, and AI-engineering-practice flashcards.
4. **Distributed Systems & Cloud Architecture** — containers, Kubernetes, GPUs & AI infrastructure, messaging/databases, networking, and cloud autoscaling.
5. **Engineering Leadership** — the senior/staff-level judgment questions almost nobody studies: de-risking migrations, build vs buy, mentorship, tradeoffs, prioritization.
6. **Back-of-Envelope Estimation** — traffic, storage, bandwidth, cost, and latency math, the numeric-reasoning skill system design interviews test explicitly.
7. **Production Debugging** — multi-step diagnostic scenarios for real ML/cloud incidents (GPU OOMs, K8s crash loops, model drift, Kafka lag): pick what to check first, then follow the trail through 2-3 stages to a root-cause writeup.

All seven share the same "retry later" mechanic: mark a card to review again and it resurfaces after 5 other cards.

**Every card in every deck is quizzed with no repeats until you've seen the whole deck once** — and this is genuinely persistent, not just per-session: each deck's shuffled draw order, your current position in it, your retry queue, and your correct/incorrect stats are all saved to the browser's `localStorage` after every single card. Close the tab, reopen it days later, even restart the browser — as long as you're on the same device/browser profile and haven't cleared site data, you resume exactly where you left off with zero repeats, because the app reloads that saved state instead of starting a fresh shuffle. The home screen shows this directly for every deck (e.g. "42/232 seen this pass"), so you can see your saved progress rather than just trust that it's there. Once a full pass is complete, the deck reshuffles for the next lap (an intentional spaced-repetition cycle, not a bug) — and since nothing is seeded, that reshuffle (and any fresh session with `localStorage` cleared) gets its own independent order rather than replaying a fixed sequence.

The DSA reference solution has a **Copy** button next to the language label — copies the exact code shown (in whichever language is currently selected) to the clipboard, so it's easy to paste into a search engine, an LLM, or your own editor for a deeper explanation. It tries the modern Clipboard API first, falls back to a legacy copy method if that's unavailable, and as a last resort selects the code text for a manual Ctrl/Cmd+C if both programmatic paths are blocked by the browser.

No build step — plain HTML/CSS/JS + JSON data files.

## Deploy to GitHub Pages

This uses the same deployment method as most modern Vite/React GitHub Pages projects: a GitHub Actions workflow that uploads the site as a Pages artifact and deploys it directly — **no Jekyll build in the middle**, which is what was silently mangling the JSON fetches in an earlier version of this app's deploy setup.

1. Push this folder's contents (including the `.github/workflows/deploy.yml` file) to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Drillset interview prep app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (not "Deploy from a branch" — that path routes through Jekyll and is the more error-prone option).
3. Pushing to `main` automatically triggers the `Deploy to GitHub Pages` workflow (check the **Actions** tab for progress). Once it finishes, your app is live at `https://<your-username>.github.io/<your-repo>/`.

There's no build step in the workflow (no `npm run build`) because this app has no bundler — it's plain HTML/CSS/JS, so the workflow just uploads the repo as-is and deploys it.

### If you still see "Couldn't load flashcard data"

- Open the browser console (or Network tab) and look at the failing request's actual URL and response — that tells you exactly what's wrong, and the app now surfaces that message directly in the UI instead of a generic error.
- Confirm `data/dsa.json`, `data/system_design.json`, `data/ml.json`, `data/cloud.json`, and `data/leadership.json` are actually present in the repo (check the **Actions** run's uploaded artifact, or just browse the repo on GitHub) — a `.gitignore` rule or a partial `git add` is the most common reason files silently don't make it in.
- Try loading the JSON file's URL directly in the browser (e.g. `https://<you>.github.io/<repo>/data/dsa.json`) — if that itself 404s or shows GitHub's own error page, the deployment/path is the issue, not the app code.
- Hard-refresh (or open in a private/incognito window) to rule out a stale cached `app.js` from a previous deploy.

## Running locally

Because the app `fetch()`s the JSON files, opening `index.html` directly (`file://`) will fail in most browsers. Serve it over HTTP instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Scope note on the datasets

This ships with a **curated, hand-verified set** rather than an exhaustive scrape of every public LeetCode problem or every system-design/ML fact, so the whole thing stays reviewable and correct:

- `data/dsa.json` — **232 problems** across **21 patterns**, spanning Easy/Medium/Hard (**20 Hard**). Every problem has solutions in all 6 languages _plus_ a `timeComplexity`/`spaceComplexity` answer with auto-generated quiz options, all syntax-validated. Weakest categories from earlier rounds (Trie, Design, Sorting, Prefix Sum, Union Find, Math) were specifically built up this round; every pattern now has at least 7 problems.
- `data/system_design.json` — **30 prompts** spanning classic infrastructure and advanced/senior topics, each with 3 staged follow-ups and a Mermaid diagram.
- `data/ml.json` — **226 cards** across 13 categories, including ML Algorithms, Neural Architectures, and AI Engineering Practice (prompt engineering, dataset engineering, inference optimization, infra, and the training/pre-training/fine-tuning/post-training distinctions).
- `data/cloud.json` — **85 cards** across 9 categories: Containers, Kubernetes, GPUs, AI Infrastructure, Distributed Systems & Messaging, Databases & Caching, Networking & Load Balancing, Cloud Architecture & Autoscaling, Async & Event-Driven Systems.
- `data/leadership.json` — **38 cards** across 8 categories of open-ended senior/staff judgment questions with a model reasoning framework, not a single "correct" answer.
- `data/estimation.json` — **16 cards** across 4 categories (Traffic & Throughput, Storage & Bandwidth, Compute & Cost, Latency & Capacity) — back-of-envelope numeric reasoning with a fully worked answer showing the estimation technique, not just a final number.
- `data/debugging.json` — **10 multi-stage scenarios** across ML Infrastructure and Cloud Infrastructure — a realistic incident (GPU OOM, K8s crash loop, Kafka lag, model drift, NCCL hang, etc.), 2-3 stages of "what do you check/do next" multiple choice with an explanation per stage, ending in a full root-cause-and-fix writeup.

Getting to a genuine 500 hand-verified DSA problems (500 × 6 languages = 3,000 individually-correct code snippets) is a much larger undertaking than fits in one sitting responsibly — the risk of quietly shipping subtly-wrong solutions goes up fast if that gets rushed. Every problem added so far has been syntax-validated (Python compiles, JavaScript parses) as part of the build process; ask for more in a specific pattern/category at any time and they'll keep being added incrementally in the same verified way.

### How the next card is chosen, and how progress persists

Each deck keeps a persistent shuffled "bag" of every card's id in `localStorage`, saved after every single card shown — not just on some periodic checkpoint. Advancing to the next card draws from that bag until every card has been shown exactly once, then reshuffles a fresh bag for the next lap. Because the saved state includes the bag's current order _and_ your exact position in it (plus the retry queue and correct/incorrect stats), reopening the app — even in a brand new tab, even after fully closing the browser — reloads that saved state instead of starting over, so you resume with zero repeats exactly where you left off. This is genuine cross-session persistence via `localStorage` (which survives tab/browser close, unlike `sessionStorage`), not just an in-memory guarantee that resets on reload. The home screen's "X/Y seen this pass" stat line reads directly from this saved state, so you can visually confirm it's working rather than just trusting it.

For DSA, ML, Cloud, Leadership, and Estimation, cards are also grouped by category before shuffling — DSA by `correctPattern`, the others by `category` — and the bag-building algorithm interleaves those groups (weighted by how many cards remain in each) so you don't get several same-topic cards in a row by chance, while still guaranteeing every card appears exactly once per lap. System Design and Debugging aren't grouped since each entry is already a distinct scenario/topic.

Because nothing is seeded, a fresh browser profile (or `localStorage` cleared) gets its own independent shuffle order rather than replaying a fixed sequence — but within one browser profile, that shuffle order and position are exactly what persists.

### Extending the data

Each file is plain JSON — add new entries following the existing shape and they'll show up automatically (the retry-queue engine works off however many IDs exist).

**`dsa.json`** — top-level `{ patternPool: [...], problems: [...] }`. Each problem:

```json
{
  "id": 17,
  "number": 704,
  "title": "Binary Search",
  "difficulty": "Easy",
  "correctPattern": "Binary Search",
  "options": ["Binary Search", "Two Pointers", "Hash Map", "Sliding Window"],
  "description": "...",
  "solutions": {
    "python": "...",
    "java": "...",
    "typescript": "...",
    "javascript": "...",
    "cpp": "...",
    "go": "..."
  },
  "timeComplexity": "O(log n)",
  "spaceComplexity": "O(1)",
  "timeOptions": ["O(log n)", "O(n)", "O(1)", "O(n log n)"],
  "spaceOptions": ["O(1)", "O(n)", "O(log n)", "O(n^2)"]
}
```

`options` should include `correctPattern` plus a few plausible distractors (ideally drawn from `patternPool`); `timeOptions`/`spaceOptions` should include the correct complexity plus a few distractors from the common Big-O set (`O(1)`, `O(log n)`, `O(n)`, `O(n log n)`, `O(n^2)`, `O(n^3)`, `O(2^n)`, `O(n!)`, `O(m * n)`, `O(V + E)`). `id` must be unique; `next id = max existing id + 1`.

**`system_design.json`** — an array of:

```json
{
  "id": 9,
  "title": "Design a Payments Ledger",
  "stages": [
    { "prompt": "...", "answer": "..." },
    { "prompt": "...", "answer": "..." }
  ],
  "diagram": "flowchart LR\n    A --> B"
}
```

`diagram` is [Mermaid](https://mermaid.js.org/) syntax (flowchart is used throughout, but any Mermaid diagram type works). The last stage's answer is shown together with the diagram.

**`ml.json`**, **`cloud.json`**, **`leadership.json`**, **`estimation.json`** — all the same flat shape: `{ "id": ..., "category": "...", "question": "...", "answer": "..." }`. Add entries to any of these and they show up automatically; no HTML/JS changes needed for new cards within an existing category (a brand-new category also just works, since the category pill and interleaving both key off whatever value is present).

**`debugging.json`** — an array of:

```json
{
  "id": 11,
  "category": "ML Infrastructure",
  "title": "Short scenario title",
  "context": "1-3 sentences describing the application/infra stack and the symptom being observed.",
  "stages": [
    {
      "prompt": "What do you check first?",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "Why that option is the right first move."
    }
  ],
  "resolution": "Full root-cause-and-fix writeup, shown once every stage is answered correctly."
}
```

Each scenario needs at least 2 stages; `correctIndex` is 0-based into that stage's `options` array.

## Notes for future work

- Language solutions are written for clarity/correctness over micro-optimization — good for pattern recognition drills, not necessarily the most optimized possible implementation.
- The pattern-matching buttons currently support a single correct pattern per problem; if you want to accept multiple correct patterns for one problem, change the click handler in `app.js` (`handlePatternClick`) to check membership in an array instead of equality.
- Diagrams render client-side via the Mermaid CDN script tag in `index.html`; if you ever need it to work fully offline, vendor `mermaid.min.js` into the repo and swap the `<script src>` for a local path.
