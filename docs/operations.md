# Operations Guide

## Local run

Backend:

```bash
cd packages/backend
npm install
npm run start
```

Frontend:

```bash
cd packages/frontend
npm install
npm run dev
```

## Quality checks
Frontend quality gate:

```bash
cd packages/frontend
npm run lint && npm run test && npm run build
```

Backend type check:

```bash
cd packages/backend
npm install
npm run typecheck
```

## Common troubleshooting
- Empty match list: source websites may have changed HTML patterns; fallback data may be returned.
- Forebet detail 404: ensure `matchKey` matches current combined row key.
- CI fails at build: run local build command and compare logs.
