# strength-tracker

**StrengthTracker (ST)** — Vue 3 + Vite SPA for logging strength-phase workouts, plus **AWS CDK (TypeScript)** for tenant-ready hosting (`tenantSlug` / `stage`). Product naming is separate from any one gym’s seeded Google Sheet.

**Repository:** [github.com/andrewscriven/strength-tracker](https://github.com/andrewscriven/strength-tracker)

## Quick start

```bash
git clone https://github.com/andrewscriven/strength-tracker.git
cd strength-tracker
npm install
cp .env.example .env.local
# Add GOOGLE_SHEETS_API_KEY for optional: npm run fetch:sheet
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build → `dist/` |
| `npm run fetch:sheet` | Refresh `public/data/latest.json` from Google Sheets (read-only API; key in `.env.local`) |
| `npm run infra:synth` | CDK synthesize (`infra/cdk`) |
| `npm run infra:deploy` | CDK deploy default stack |

## AWS (CDK)

Infrastructure lives in **`infra/cdk`**. Stack id pattern: **`ST-{stage}-{tenantSlug}-Core`**. Resources are tagged `Project=StrengthTracker`, `Tenant`, `Stage`.

Deploy another tenant/client later:

```bash
cd infra/cdk
npx cdk deploy -c tenantSlug=acme -c stage=prod -c destructiveDeletes=false
```

## Secrets

Do **not** commit `.env.local`. It is gitignored.

## License

Private / all rights reserved unless you add an explicit license.
