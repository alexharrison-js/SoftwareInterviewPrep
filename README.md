# Drillset — Senior Engineer Interview Prep

A single-page flashcard app for drilling three interview tracks:

1. **DSA** — LeetCode-style problems → pick the right pattern/data-structure → view a reference solution in Python, Java, TypeScript, JavaScript, C++, or Go.
2. **System Design** — open-ended design prompts with staged follow-up questions, model answers, and an architecture diagram (rendered with Mermaid).
3. **AI & ML** — concept, history, and applied-AI-engineering flashcards.

All three share the same "retry later" mechanic: mark a card to review again and it resurfaces after 5 other cards, persisted in the browser's `localStorage` (so it survives reloads on the same device).

No build step — plain HTML/CSS/JS + JSON data files.

## Deploy to GitHub Pages

1. Create a new GitHub repo (or use an existing one) and push this folder's contents to it:
   ```bash
   git init
   git add .
   git commit -m "Drillset interview prep app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. Your app will be live at `https://<your-username>.github.io/<your-repo>/` within a minute or two.

That's it — everything (including the JSON data) is static and same-origin, so it works as-is on GitHub Pages. No server, database, or API keys needed.

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
  "solutions": { "python": "...", "java": "...", "typescript": "...", "javascript": "...", "cpp": "...", "go": "..." }
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
