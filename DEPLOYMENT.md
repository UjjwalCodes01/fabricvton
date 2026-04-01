# FabricVTON Deployment

This project is configured to run the Shopify app on `https://www.fabricvton.com`.

## Goal

Replace the placeholder website currently served on `www.fabricvton.com` with this Shopify app so the installed app in Shopify Admin loads the real embedded dashboard.

## Production requirements

- A public HTTPS server for `https://www.fabricvton.com`
- Node.js 20
- A reachable PostgreSQL database
- Valid Shopify app credentials
- Valid GenLook API credentials

## Important Shopify config

These values are already set in [`shopify.app.toml`](/home/ujwal/Desktop/coding/vton/fabricvton/shopify.app.toml):

- `application_url = "https://www.fabricvton.com"`
- auth callback at `https://www.fabricvton.com/auth/callback`
- app proxy at `https://www.fabricvton.com/proxy`

After deployment, sync config with Shopify:

```bash
npm run deploy
```

## Environment variables

Use [`fabricvton/.env.production.example`](/home/ujwal/Desktop/coding/vton/fabricvton/.env.production.example) as the production template.

Required values:

- `NODE_ENV=production`
- `PORT=3000`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL=https://www.fabricvton.com`
- `DATABASE_URL`
- `DIRECT_URL`
- `GENLOOK_BASE_URL`
- `GENLOOK_API_KEY`
- `SUPER_ADMIN_EMAILS`

## Recommended deployment flow

### Option 1: Docker on a VPS or VM

Build:

```bash
docker build -t fabricvton .
```

Run:

```bash
docker run -d \
  --name fabricvton \
  -p 3000:3000 \
  --env-file .env.production \
  fabricvton
```

The container startup runs:

- `prisma generate`
- `prisma migrate deploy`
- the production server

### Option 2: Managed container host

Use any platform that supports a Dockerfile and custom domains, such as:

- GCP Cloud Run
- Railway
- Render
- Fly.io

Point the custom domain `www.fabricvton.com` at the deployed service and set the same environment variables there.

## DNS and domain cutover

1. Deploy the app to a public host.
2. Confirm `https://your-host/health` returns JSON.
3. Point `www.fabricvton.com` DNS to the new host.
4. Verify `https://www.fabricvton.com/health` works.
5. Open the installed Shopify app again from Shopify Admin.

## Expected behavior after cutover

The installed admin URL:

`https://admin.shopify.com/store/fabricvton/apps/fabricvton/`

should load this app instead of the placeholder website.

The app should redirect authenticated merchants into:

- `/app/dashboard`

Super admins listed in `SUPER_ADMIN_EMAILS` will also see:

- `/app/admin`

## Verification checklist

After deployment, verify all of these:

1. `https://www.fabricvton.com/health` returns `{ "ok": true, ... }`
2. `https://www.fabricvton.com/auth/login` opens correctly
3. App opens from Shopify Admin without showing the old site
4. Merchant dashboard loads
5. App proxy requests succeed at `/proxy`
6. Theme extension still works in the store theme
7. Webhooks are registered after `npm run deploy`

## Known blockers from current local setup

- Your local machine previously could not reach the Supabase direct host in `DIRECT_URL`
- Production will need a host/network that can reach both:
  - `DATABASE_URL`
  - `DIRECT_URL`

If direct DB access is blocked from the host, `prisma migrate deploy` will fail during startup.

## Security note

The Docker build now ignores local `.env` files so secrets are not copied into the image build context.
