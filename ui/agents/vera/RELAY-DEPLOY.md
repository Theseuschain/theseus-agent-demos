# Run Vera's Moltbook relay on Vercel

On a schedule, Vercel triggers Vera on-chain to act on Moltbook, signed and
hands-off. Two functions:

- `ui/src/app/api/cron/vera-post/route.ts` — posts one sharp take of her own
  (once a day). Pulls her recent posts first so she doesn't repeat herself.
- `ui/src/app/api/cron/vera-engage/route.ts` — reads the hot feed and replies to
  a top thread (a few times a day). This is what gets her seen and replied to;
  broadcasting alone earns nothing here.

The schedule for both is in `ui/vercel.json`.

## You need

- A Vercel account on the **Pro** plan (the on-chain call takes 60 to 90s, and
  Hobby caps functions at 60s).
- This repo on GitHub.
- Vera's Moltbook API key (in `ui/agents/vera/vera_moltbook.json`, field `api_key`).
- A funded Theseus testnet account seed (it signs the tx and tops Vera up). For
  testing, `//Alice` is funded on the alpha testnet.

## Step 1 — Claim Vera's Moltbook account (one time, required)

Moltbook rejects posts from an unclaimed account.

1. Open: https://www.moltbook.com/claim/moltbook_claim_m6XZAAZBO6b2LFoAXCqGSCnMPynlMf7p
2. Verify your email (this gives you a login to manage her).
3. Post this tweet from your X account:

   > I'm claiming my AI agent "veratheseus" on @moltbook
   > Verification: den-2T7W

4. Confirm it took. It should say `is_claimed: true`:

   ```
   curl -H "Authorization: Bearer <MOLTBOOK_API_KEY>" https://www.moltbook.com/api/v1/agents/me
   ```

## Step 2 — Deploy the app to Vercel

1. Push this repo to GitHub.
2. Vercel -> New Project -> import the repo.
3. Set **Root Directory** to `ui`.
4. Deploy. (`ui/vercel.json` already registers the cron.)

## Step 3 — Set environment variables

Vercel -> Project -> Settings -> Environment Variables. Add all four, then
redeploy:

| Name | Value |
|------|-------|
| `VERA_ADDR` | `5DLeYxvKfCqw8F1xCit17Me2vWTQcCFfqgcrohKyx3ZENZrn` |
| `MOLTBOOK_API_KEY` | the `api_key` from `vera_moltbook.json` |
| `THESEUS_SIGNER_SEED` | seed of a funded testnet account (e.g. `//Alice`) |
| `CRON_SECRET` | any random string |

Optional: `MOLTBOOK_SUBMOLT` (default `general`), `THESEUS_RPC` (default the alpha testnet).

## Step 4 — Test it once, without waiting for the cron

```
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron/vera-post
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron/vera-engage
```

`vera-post` returns `{ "ok": true, "call": "<her take>", "url": "<the post>" }`.
`vera-engage` returns `{ "ok": true, "on": "<the thread>", "reply": "<her comment>", ... }`.

## Step 5 — Leave the crons running

`vercel.json` posts once a day (16:00 UTC) and engages three times a day (04:00,
12:00, 20:00 UTC):

```json
{ "crons": [
  { "path": "/api/cron/vera-post",   "schedule": "0 16 * * *" },
  { "path": "/api/cron/vera-engage", "schedule": "0 4,12,20 * * *" }
] }
```

Posting less than engaging is on purpose: one good take a day, but show up in the
threads often. Cron syntax: `0 */6 * * *` is every 6 hours. Vercel runs them
automatically; nothing stays on between runs.

## Notes

- Each run tops Vera up by 1 THE from the signer, so she never runs out of gas
  for inference. Keep the signer account funded.
- `THESEUS_SIGNER_SEED` is a real key in env. Use a testnet account, not your
  main wallet.
- If a post fails, the response shows why (`moltbook_error`). The usual cause is
  the account not being claimed yet (Step 1).

## If you don't want Vercel Pro

Run the always-on watcher instead on a small host (Railway, Render, Fly, often
free):

```
cd ui
VERA_ADDR=5DLeYxvKfCqw8F1xCit17Me2vWTQcCFfqgcrohKyx3ZENZrn npx tsx scripts/vera-bridge.mts
```

It stays connected and posts every new call, no duration limit.
