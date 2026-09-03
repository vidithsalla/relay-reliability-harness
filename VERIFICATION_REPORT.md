# VERIFICATION_REPORT

Date/time: 2026-09-03 19:33:49 EDT

Environment:

- Node: v22.19.0
- npm: 10.9.3
- PostgreSQL: 16.13 Homebrew fallback via `.relay-pgdata`
- Docker: installed, but Docker Engine socket was unavailable
- Git SHA: unavailable; this directory is not a Git repository
- xAI live smoke: not run because `XAI_API_KEY` is not configured

## Command Results

| Command | Result |
| --- | --- |
| `npm install` | PASS, 387 packages installed |
| `npm run db:up` | PASS via local PostgreSQL fallback; Docker path failed because daemon socket was unavailable |
| `npm run db:migrate` | PASS, applied `0000_initial.sql` |
| `npm run db:seed` | PASS, seeded synthetic claims and fault profiles |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 4 files / 8 tests |
| `npm run test:integration` | PASS, 2 files / 8 tests |
| `npm run eval` | PASS, 12/12 cases |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS, 5 browser tests |
| `npm run verify:db` | PASS, fresh-client persistence verification; final checked run `7f9f3ecf-4ed5-42c5-9039-65ca9fbc661a` completed |

## Browser Verification

Verified through Playwright:

- scenario launcher renders;
- timeout-after-write displays timeout transport with confirmed business application and no retry;
- partial completion displays one reserve attempt and two inspection attempts;
- stale-version scenario displays replan blocker;
- high-risk settlement approval revalidates and persists settlement;
- evals page reflects persisted 12/12 result;
- run detail survives refresh.

Screenshots were captured under `docs/screenshots/`.

## Known Limitations

- Docker Compose path could not be used because Docker Engine was not reachable; the fallback is real local PostgreSQL, not in-memory storage.
- No live xAI/Grok API smoke was run without credentials.
- Demo auth is prototype role selection, not production identity.
