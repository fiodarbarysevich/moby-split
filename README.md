# Moby Split

A Belarusian group expense sharing app with a Piggy Bank module for kids' financial literacy and a Safe-Call anti-fraud feature.

## Tech Stack

- Next.js 14+ App Router
- TypeScript
- Tailwind CSS
- Lucide icons
- Supabase (PostgreSQL + Realtime)
- qrcode.react
- canvas-confetti

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the schema in the Supabase SQL Editor:

```sql
-- paste contents of supabase/schema.sql
```

4. Make sure the Supabase Storage bucket `goal-photos` is public for Piggy Bank photo uploads.

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

### Group Split

- Create a pool, share the link, and track who paid.
- Payer screen at `/pay/[id]`.

### Piggy Bank (kids)

- Child creates savings goals.
- Uploads proof photos for parents to approve.
- Parent review page at `/parent/goal/[token]`.
- Spend / Save / Give wallets with allowance rules.
- Auto-split option: all incoming money (including gifts) can be split into the three wallets.

### Gift Links (parents)

- Parents generate gift links and QR codes for relatives.
- Dedicated page: `/piggy-bank/gift-links`.
- Relative sends money via `/gift/[token]` without an account.

### Safe-Call

- Bank operator portal at `/operator`.
- Global `SafeCallModal` simulates an incoming verification call.

## Project Structure

```
src/
  app/                 # Next.js App Router pages
  components/          # Shared components (SafeCallModal)
  lib/supabaseClient.ts # Supabase singleton
  types/index.ts       # TypeScript types
supabase/schema.sql    # Database schema
```

## Known Downsides / MVP Limitations

1. **No authentication** — anyone with a link/token can access parent pages.
2. **Open RLS policies** — the Supabase tables allow anonymous read/write for hackathon speed.
3. **No real payments** — money movement is simulated by updating wallet balances.
4. **No spending/withdrawal flow** — wallets only show balances.
5. **Gift links are not tied to specific relatives** — anyone with the link can send money.
6. **Parent tokens are in the URL** — can be leaked via browser history or screenshots.
7. **No child identity verification** — any user can enter any child name.
8. **Auto-split rounding** — very small amounts may leave a 0.01 BYN rounding difference.
9. **Supabase client is untyped** — the `Database` generic was removed to avoid type conflicts.
10. **No email/SMS integration** — links must be copied and shared manually.
