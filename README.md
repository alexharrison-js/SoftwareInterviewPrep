# Drillset — Senior Engineer Interview Prep

Live Demo: https://alexharrison-js.github.io/SoftwareInterviewPrep/
A single-page flashcard app for drilling three interview tracks:

1. **DSA** — LeetCode-style problems → pick the right pattern/data-structure → view a reference solution in Python, Java, TypeScript, JavaScript, C++, or Go.
2. **System Design** — open-ended design prompts with staged follow-up questions, model answers, and an architecture diagram (rendered with Mermaid).
3. **AI & ML** — concept, history, and applied-AI-engineering flashcards.

All three share the same "retry later" mechanic: mark a card to review again and it resurfaces after 5 other cards, persisted in the browser's `localStorage` (so it survives reloads on the same device).

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
- Confirm `data/dsa.json`, `data/system_design.json`, and `data/ml.json` are actually present in the repo (check the **Actions** run's uploaded artifact, or just browse the repo on GitHub) — a `.gitignore` rule or a partial `git add` is the most common reason files silently don't make it in.
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

- `data/dsa.json` — 16 problems, one to two per major interview pattern (hash map, two pointers, sliding window, stack, binary search, linked list, tree BFS/DFS, heap, backtracking, graph BFS/DFS, dynamic programming, greedy/intervals, trie, bit manipulation), each with solutions in all 6 languages.
- `data/system_design.json` — 8 classic prompts (URL shortener, image storage, rate limiter, chat system, news feed, distributed cache, web crawler, ride-sharing dispatch), each with 3 staged follow-ups and a Mermaid diagram.
- `data/ml.json` — 58 cards across History, Core ML, LLMs, and Applied AI.

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

## Notes for future work

- Language solutions are written for clarity/correctness over micro-optimization — good for pattern recognition drills, not necessarily the most optimized possible implementation.
- The pattern-matching buttons currently support a single correct pattern per problem; if you want to accept multiple correct patterns for one problem, change the click handler in `app.js` (`handlePatternClick`) to check membership in an array instead of equality.
- Diagrams render client-side via the Mermaid CDN script tag in `index.html`; if you ever need it to work fully offline, vendor `mermaid.min.js` into the repo and swap the `<script src>` for a local path.
