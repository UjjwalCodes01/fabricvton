# Shopify App Distribution Setup

The app cannot be installed until a distribution method is selected in Shopify Partner Dashboard.

## Why this happens

Shopify is blocking install because the app has not been assigned a distribution type yet.

Typical error:

> This app can't be installed yet. The app developer needs to select a distribution method first.

## Fix

1. Open Shopify Partner Dashboard.
2. Go to `Apps`.
3. Open the production app for `fabricvton`.
4. Find `App distribution`.
5. Click `Choose distribution`.

## Which option to choose

### Public distribution

Choose this if you want `fabricvton` to be listed on the Shopify App Store for many merchants.

Use this when:
- you want a public Shopify app
- you plan to submit for app review later

### Custom distribution

Choose this if you want to install the app directly on a specific store or share an install link without App Store listing.

Use this when:
- you are testing on your own store
- you want to install on a client store directly
- you are not ready for public App Store review yet

## Best choice for your current setup

For local/dev testing, choose `Custom distribution`.

Then:

1. Enter the store domain:
   `fabricvton-devstore.myshopify.com`
2. Click `Generate link`
3. Copy the install link
4. Open the link in the store admin account
5. Approve install

## After install

Open the embedded app in Shopify Admin:

- Merchant dashboard: `/app/dashboard`
- Analytics: `/app/analytics`
- Products: `/app/products`
- Settings: `/app/settings`
- Billing: `/app/billing`
- Support: `/app/support`

If the logged-in Shopify account email matches `SUPER_ADMIN_EMAILS`, you also get:

- Super admin: `/app/admin`
- Logs: `/app/admin/logs`
- Model settings: `/app/admin/model`
- Tickets: `/app/admin/tickets`

## Important note

If you have separate development and production apps in Shopify, make sure you select distribution for the correct app. Shopify usually expects distribution to be configured on the production app record.
