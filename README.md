# Drillset — Senior Engineer Interview Prep

Live Demo: https://alexharrison-js.github.io/SoftwareInterviewPrep/

A single-page flashcard app for drilling five interview tracks:

1. **DSA** — LeetCode-style problems → pick the right pattern/data-structure → view a reference solution in Python, Java, TypeScript, JavaScript, C++, or Go.
2. **System Design** — open-ended design prompts with staged follow-up questions, model answers, and an architecture diagram (rendered with Mermaid).
3. **AI & ML** — concept, history, and applied-AI-engineering flashcards.
4. **Distributed Systems & Cloud Architecture** — containers, Kubernetes, GPUs & AI infrastructure, messaging/databases, networking, and cloud autoscaling.
5. **Engineering Leadership** — the senior/staff-level judgment questions almost nobody studies: de-risking migrations, build vs buy, mentorship, tradeoffs, prioritization.

All five share the same "retry later" mechanic: mark a card to review again and it resurfaces after 5 other cards, persisted in the browser's `localStorage` (so it survives reloads on the same device).

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

- `data/dsa.json` — **214 problems** across **21 patterns** — the original 19 (hash map, two pointers, sliding window, stack, binary search, linked list, tree BFS/DFS, heap, backtracking, graph BFS/DFS, dynamic programming, greedy/intervals, trie, bit manipulation, union find, prefix sum, matrix/grid, math, string manipulation) plus two added in this round: **Sorting** (merge sort, quickselect-style problems, in-place merge) and **Design** (Twitter-style feeds, hit counters, circular queues, time-based key-value stores — the "build a small system" interview category). Every pattern now has double-digit representation except Trie, Design, and Sorting (5, 5, 4 respectively — still solid coverage for less-frequently-asked categories). Spans Easy/Medium/Hard (**20 Hard problems**), each with solutions in all 6 languages, all syntax-validated.
- `data/system_design.json` — **30 prompts** spanning classic infrastructure (URL shortener, image storage, rate limiter, chat, news feed, distributed cache, web crawler, ride-sharing, CDN, distributed locks) and more advanced/senior topics (distributed ID generation, config management, multiplayer game backends, recommendation systems, ad billing & fraud, service discovery, cache invalidation at fleet scale, 2FA, job deduplication), each with 3 staged follow-ups and a Mermaid diagram.
- `data/ml.json` — **186 cards** across 10 categories: History, Core ML, LLMs, NLP, Computer Vision, MLOps, Statistics & Math, Applied AI, AI Safety & Ethics, and Reinforcement Learning.
- `data/cloud.json` — **85 cards** across 9 categories: Containers, Kubernetes, GPUs, AI Infrastructure (vLLM, Triton, Ray, NCCL, quantization, KV cache, speculative decoding), Distributed Systems & Messaging (Kafka, RabbitMQ, SQS, CQRS, event sourcing), Databases & Caching (Redis, Cassandra, DynamoDB, replication), Networking & Load Balancing, Cloud Architecture & Autoscaling (ECS vs EKS, spot instances, multi-region), and Async & Event-Driven Systems (sagas, idempotency, circuit breakers, outbox pattern).
- `data/leadership.json` — **38 cards** across 8 categories: Risk & Migration, Build vs Buy, Consistency & Tradeoffs, Architecture & Design, Team & Mentorship, Technical Debt, Operations & Debugging, and Prioritization & Metrics. These are open-ended judgment questions with a model answer laying out a reasoning framework, not a single "correct" answer — the point is practicing how to structure a thoughtful response, not memorizing one.

Getting to a genuine 500 hand-verified DSA problems (500 × 6 languages = 3,000 individually-correct code snippets) is a much larger undertaking than fits in one sitting responsibly — the risk of quietly shipping subtly-wrong solutions goes up fast if that gets rushed. Every problem added so far has been syntax-validated (Python compiles, JavaScript parses) as part of the build process; ask for more in a specific pattern/category at any time and they'll keep being added incrementally in the same verified way.

### How the next card is chosen

Each deck (DSA / System Design / ML / Cloud / Leadership) keeps a persistent shuffled "bag" of every card's id in `localStorage`. Advancing to the next card draws from that bag until every card has been shown exactly once, then reshuffles a fresh bag for the next lap — so within a browser session you're guaranteed full coverage with no repeats until you've genuinely seen everything (aside from anything you've marked "retry later", which is injected back in after 5 other cards per the retry-queue logic).

For DSA, ML, Cloud, and Leadership, cards are also grouped by category before shuffling — DSA by `correctPattern`, the other three by `category` — and the bag-building algorithm interleaves those groups (weighted by how many cards remain in each) so you don't get several same-topic cards in a row by chance, while still guaranteeing every card appears exactly once per lap. System design isn't grouped since each of its 30 prompts is already a distinct topic.

Because nothing is seeded, a fresh browser session with `localStorage` cleared gets its own independent shuffle order rather than replaying the same sequence as a previous session.

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
  }
}
```

`options` should include `correctPattern` plus a few plausible distractors (ideally drawn from `patternPool`). `id` must be unique; `next id = max existing id + 1`.

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

**`ml.json`** — a flat array of `{ "id": 59, "category": "LLMs", "question": "...", "answer": "..." }`.

**`cloud.json`** and **`leadership.json`** — same flat shape as `ml.json`: `{ "id": ..., "category": "...", "question": "...", "answer": "..." }`. Add entries to either file and they show up automatically; no HTML/JS changes needed for new cards within an existing category (a brand-new category also just works, since the category pill and interleaving both key off whatever value is present).

## Notes for future work

- Language solutions are written for clarity/correctness over micro-optimization — good for pattern recognition drills, not necessarily the most optimized possible implementation.
- The pattern-matching buttons currently support a single correct pattern per problem; if you want to accept multiple correct patterns for one problem, change the click handler in `app.js` (`handlePatternClick`) to check membership in an array instead of equality.
- Diagrams render client-side via the Mermaid CDN script tag in `index.html`; if you ever need it to work fully offline, vendor `mermaid.min.js` into the repo and swap the `<script src>` for a local path.
