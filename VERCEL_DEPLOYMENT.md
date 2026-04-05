# Vercel Deployment for `www.fabricvton.com`

This guide is for your chosen setup:

- Deploy the Shopify app to Vercel
- Connect `www.fabricvton.com` to that Vercel project
- Keep Shopify configured to use `https://www.fabricvton.com`

## Before you start

Keep these values as they are:

- [`shopify.app.toml`](/home/ujwal/Desktop/coding/vton/fabricvton/shopify.app.toml)
  - `application_url = "https://www.fabricvton.com"`
  - callback URL `https://www.fabricvton.com/auth/callback`
  - app proxy `https://www.fabricvton.com/proxy`
- Production env:
  - `SHOPIFY_APP_URL=https://www.fabricvton.com`

Do not change them if `www.fabricvton.com` is your final app domain.

## What was added to the repo

- [`vercel.json`](/home/ujwal/Desktop/coding/vton/fabricvton/vercel.json)
  - sets a `maxDuration` of 60 seconds for server functions
- [`app/routes/proxy.tryon.tsx`](/home/ujwal/Desktop/coding/vton/fabricvton/app/routes/proxy.tryon.tsx)
  - exports `maxDuration = 60`
- [`app/routes/health.tsx`](/home/ujwal/Desktop/coding/vton/fabricvton/app/routes/health.tsx)
  - provides `/health` for live verification

## Environment variables to add in Vercel

Use the values from [`.env.production.example`](/home/ujwal/Desktop/coding/vton/fabricvton/.env.production.example).

Add these in Vercel Project Settings -> Environment Variables:

- `NODE_ENV=production`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL=https://www.fabricvton.com`
- `DATABASE_URL`
- `DIRECT_URL`
- `GENLOOK_BASE_URL=https://api.genlook.app/tryon/v1`
- `GENLOOK_API_KEY`
- `SUPER_ADMIN_EMAILS`

Do not set `PORT` on Vercel.

## Deploy on Vercel

### Option 1: Import from Git

1. Push this repo to GitHub.
2. In Vercel, click `Add New Project`.
3. Import the repo.
4. Framework should detect as React Router / Vite automatically.
5. Set the environment variables above.
6. Deploy.

### Option 2: Vercel CLI

From the project root:

```bash
cd /home/ujwal/Desktop/coding/vton/fabricvton
vercel
```

Then set production env vars in Vercel and deploy to production:

```bash
vercel --prod
```

## Connect `www.fabricvton.com`

In Vercel:

1. Open the project
2. Go to `Settings` -> `Domains`
3. Add `www.fabricvton.com`
4. Follow the DNS instructions Vercel gives you

Usually:

- `www` uses a `CNAME` to Vercel
- apex/root domain may use an `A` record or redirect

Use exactly the DNS records Vercel shows in the dashboard for your project.

## After domain connection

Verify:

1. `https://www.fabricvton.com/health`
2. `https://www.fabricvton.com/auth/login`
3. `https://admin.shopify.com/store/fabricvton/apps/fabricvton/`

If `/health` works but the Shopify app does not, re-check:

- Shopify App URL in Partner Dashboard
- redirect URLs
- Vercel environment variables

## Final Shopify sync

After Vercel is live on `www.fabricvton.com`, run:

```bash
cd /home/ujwal/Desktop/coding/vton/fabricvton
npm run deploy
```

That syncs app config, webhooks, and extension changes with Shopify.

## Important production note

This app depends on PostgreSQL for sessions and app data.

If Vercel cannot reach your `DATABASE_URL` or `DIRECT_URL`, the app will fail at runtime or during migration-related tasks.

If the direct Supabase host is blocked, that must be fixed separately in your database/network setup.
