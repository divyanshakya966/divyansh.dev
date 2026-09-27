# Media uploads (R2, optional)

Project screenshots and article images can live in Cloudflare R2 instead of
the repo. Everything degrades gracefully: without a bucket, uploads return
`501` with this doc's pointer and the site keeps serving existing URLs.

## 1. Create the bucket

```bash
npx wrangler r2 bucket create divyansh-media
```

## 2. Bind it

Add to `wrangler.jsonc` (top-level, next to `d1_databases`):

```jsonc
"r2_buckets": [
  {
    "binding": "R2_BUCKET",
    "bucket_name": "divyansh-media",
  },
],
```

`server.ts` reads `env.R2_BUCKET` — the binding name must stay `R2_BUCKET`.
No public bucket access needed: the worker serves files itself.

## 3. Deploy

```bash
npm run build
npx wrangler deploy
```

## 4. Use it

1. Open `/admin` → any item → **Upload image (≤2 MB)** under the Image URL field.
2. PNG, JPEG, WebP, GIF or AVIF. Files land at `/media/uploads/<user>/<ts>-<rand>.<ext>`.
3. Save the item — the URL is already filled in.

Uploads require a signed-in session **and** a verified step-up grant, same as
saves. Served responses carry `cache-control: public, max-age=31536000,
immutable` (keys are unique per upload, so caching is safe).
