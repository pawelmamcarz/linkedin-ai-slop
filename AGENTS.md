# Repository Guidelines

## Project Structure & Module Organization

- `extension/`: shared browser-extension JavaScript, HTML, CSS, manifest, and icons. `ext-api.js` handles browser API differences.
- `server/src/`: TypeScript proxy for Jev, caching, rate limits, Pro tokens, and Stripe billing.
- `jev/`: shared model questions and verdict thresholds; update classification rules here.
- `server/test/`: automated tests and `fixtures/`; `server/demo/feed.html` provides a local feed preview.
- `docs/`: website and legal pages; English versions live in `docs/en/`.
- `scripts/`: packaging, Safari builds, and screenshots. `store/`: listings, assets, and release checklists. `safari/`: Xcode wrapper.

## Build, Test, and Development Commands

Use Node.js 20+; run commands from the repository root:

- `npm --prefix server ci`: install locked server dependencies.
- `cp server/.env.example server/.env`: configure `TYPESAFE_API_KEY` locally.
- `npm start`: run the proxy, normally at `http://127.0.0.1:8787`.
- `npm --prefix server run dev`: run the proxy with file watching.
- `npm test`: run the complete automated suite.
- `npm run typecheck`: check TypeScript without emitting files.
- `npm run pack:chrome`, `npm run pack:extension`, `npm run pack:firefox`: produce Chrome Store ZIP, Chromium ZIP, and Firefox XPI.
- `npm run safari:build`: build the Safari wrapper on macOS with Xcode.

Load `extension/` unpacked through `chrome://extensions`; use `/demo` on the local proxy to preview feed behavior.

## Coding Style & Naming Conventions

Use two-space indentation, double-quoted JavaScript/TypeScript strings, and semicolons. Use `camelCase` for functions and variables, `PascalCase` for types, and `UPPER_SNAKE_CASE` for constants. Name modules in kebab-case, e.g. `verdict-cache.ts`. TypeScript uses strict checking and explicit `.ts` imports. No ESLint or Prettier configuration exists.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict` through `tsx`; DOM tests use jsdom. Name tests `server/test/<feature>.test.ts`. Add regression coverage for changed behavior, using fixtures for selector changes and mocked external API calls. Tests require no live TypeSafe key. No numeric coverage target is configured. Before submitting, run tests and typecheck; verify UI changes in-browser.

## Commit & Pull Request Guidelines

History favors imperative subjects, such as “Remove redundant localhost optional host permissions”, often followed by PR numbers. PRs should describe behavior changes, link relevant issues, report validation, and include screenshots for visual changes. Keep manifest versions and Safari version metadata aligned for releases.

## Security & Configuration Tips

Keep TypeSafe and Stripe secrets server-side; never commit credentials or Pro tokens. Preserve logging without post text or secrets. Railway must deploy from repository root because `server/` imports `jev/`. Review `store/CHECKLIST.md` before packaging a release.
