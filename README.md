# Moby Split

A Belarusian counterpart to Tikkie for group expense sharing. Built with Next.js 14 (App Router), Tailwind CSS, Supabase, and TypeScript.

## Features

### Group Split
- Create shared expense pools with a target amount and number of participants.
- Automatic per-person share calculation.
- Dynamic QR code and shareable payment link.
- Real-time contributor tracking via Supabase Realtime.
- Animated progress bar and confetti celebration when a pool is fully funded.
- Mobile-optimized payer screen with a simulated one-click Moby Pay flow.

### Piggy Bank / Kids Goals
- Children create savings goals (toys, gadgets, etc.) with a target amount.
- Goals are split into equal reward fractions (e.g., 10 parts).
- Parent receives a unique QR code / link to approve or decline the goal.
- Child uploads photo proof of chores or good grades.
- Parent approves each proof to release one reward fraction.
- Real-time progress bar and confetti when the goal is fully funded.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Styling:** Tailwind CSS + Lucide Icons
- **Database & Realtime:** Supabase (PostgreSQL + Realtime)
- **QR Generation:** qrcode.react
- **Effects:** canvas-confetti

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd moby-split
npm install
```

### 2. Set up Supabase

1. Create a new project on [Supabase](https://supabase.com).
2. Open the SQL Editor and run the script in `supabase/schema.sql`.
3. Create a public Storage bucket named `goal-photos` for the Piggy Bank feature:
   - Go to **Storage → New bucket**
   - Name: `goal-photos`
   - Enable **Public bucket**
   - Recommended: restrict allowed MIME types to `image/*`
4. Copy your project URL and anon key from Settings → API.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    page.tsx                       # Home / mode selection
    pool/[id]/page.tsx             # Creator tracking screen
    pay/[id]/page.tsx              # Payer screen via QR/link
    piggy-bank/page.tsx            # Kids goals dashboard
    piggy-bank/create/page.tsx     # Create a new savings goal
    piggy-bank/goal/[id]/page.tsx  # Child goal progress + proof upload
    parent/goal/[token]/page.tsx   # Parent review + approve proofs
  lib/
    supabaseClient.ts              # Singleton Supabase client
  types/
    index.ts                       # TypeScript data contracts
supabase/
  schema.sql                       # Executable SQL schema
```

## Notes

- All interactive pages are client components (`'use client'`).
- Supabase Realtime channels are unsubscribed in `useEffect` cleanup to prevent leaks.
- RLS policies in the schema allow anonymous read/write access for the hackathon MVP.
