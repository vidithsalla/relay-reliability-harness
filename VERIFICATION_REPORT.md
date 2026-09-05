# VERIFICATION_REPORT

Date/time: 2026-09-05 16:54:26 EDT

Environment:

- Node: v22.19.0
- npm: 10.9.3
- PostgreSQL: 16.13 Homebrew fallback via `.relay-pgdata`
- Docker: installed, but Docker Engine socket was unavailable
- xAI live smoke: not run because `XAI_API_KEY` is not configured
- Requested structural design skills: `better-layout`, `better-typography`, `compact-landing`, `impeccable`, `better-ui`, `better-interface`, `emilkowalski/apple-design`, `emilkowalski/emil-design-eng`, and `scandinavian-design` were not available in this environment
- Design workflow used: available `design-review` and browser QA skills

## Command Results

| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 4 files / 8 tests |
| `npm run test:integration` | PASS, 2 files / 8 tests |
| `npm run eval` | PASS, 12/12 cases |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS, 15 browser tests |
| `npm run screenshots` | PASS, regenerated 11 screenshots |
| `npm run verify:db` | PASS, fresh-client persistence verification; final checked run `79179b11-72bb-488a-a42e-8041ccc7b673` completed |

## Browser Verification

Manually exercised at `http://localhost:3012`:

- homepage order: hero problem, `How Relay works` uncertainty-gap explainer, `See the proof` gateway, `Under the hood`, and `Try the failure modes`;
- hero: starts directly with “An AI agent makes a change. The API times out. What actually happened?” and keeps one primary CTA plus one quiet scenarios link;
- integrated explainer: preserves the selected execution-gap structure showing agent intent, API timeout, uncertainty, Relay's real-state check, observed reserve `$8,400`, and safe no-retry decision;
- proof gateway: **See how Relay handles failures** jumps to `#proof`; **Run a failure** submits existing `timeout-after-write`; **Inspect a trace** opens `/runs`; **View the evals** opens `/evals`;
- under the hood: four restrained engineering items cover failure injection, reconciliation + recovery, execution safety, and verification, with the planner/execution-safety boundary stated inline;
- responsive homepage smoke: laptop, large desktop, and mobile widths were checked; mobile width has no horizontal overflow and all measured interactive targets meet the touch-size baseline;
- keyboard smoke: nav, hero CTA, secondary link, and proof gateway controls are reachable by tab with visible focus outlines;
- scenario launcher: moved to `/scenarios`, shows all 9 existing scenarios, and launches the existing runtime paths without semantic changes;
- navigation: Relay logo routes to `/`; Scenarios routes to `/scenarios`; Runs, Review, Evals, and About remain unchanged;
- timeout-after-write: intended reserve write, `SET_RESERVE -> Timeout`, action-specific read-back at version 18, `CONFIRMED_APPLIED`, and no duplicate retry are visible in the first proof panel;
- timeout-before-write: first read-back shows reserve still `$5,000`, reconciliation is `CONFIRMED_NOT_APPLIED`, then only the safe action retries;
- partial completion: reserve remains completed while inspection retries selectively;
- stale version: version conflict is separated from observed source state and routes to replan;
- duplicate request: second delivery shows idempotent replay / no-op duplicate with unchanged read-back version;
- high-risk settlement approval: review queue explains approval semantics, approval revalidates state, then execution/read-back/reconciliation complete;
- reviewer rejection: human stage is `rejected`, zero adapter attempts occur, and the run fails closed;
- retry exhaustion: repeated transient failures stop at the retry limit and route to manual investigation;
- ambiguous write/read-back failure: failed authoritative read-back is visible, reconciliation is `UNKNOWN`, and Relay avoids blind retry;
- mobile-width smoke: core timeout-after-write trace collapses without obvious overlap.

Screenshots were captured under `docs/screenshots/`:

- `00-homepage.png`
- `01-scenario-launcher.png`
- `02-timeout-after-write.png`
- `03-timeout-before-write.png`
- `04-partial-completion.png`
- `05-stale-version.png`
- `06-duplicate-request.png`
- `07-retry-exhaustion.png`
- `08-ambiguous-investigation.png`
- `09-review-queue.png`
- `10-eval-results.png`

## Known Limitations

- Docker Compose path could not be used because Docker Engine was not reachable; the fallback is real local PostgreSQL, not in-memory storage.
- No live xAI/Grok API smoke was run without credentials.
- Demo auth is prototype role selection, not production identity.
- Browser verification uses local Next dev servers; production build passes but no hosted production deployment was performed.
