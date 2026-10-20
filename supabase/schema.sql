-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to safely add a table to the realtime publication (idempotent)
CREATE OR REPLACE FUNCTION add_table_to_realtime(table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
  END IF;
END;
$$;

-- Pools table: represents a group expense split
CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  participants_count INT NOT NULL CHECK (participants_count >= 2),
  share_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments table: tracks individual contributions to a pool
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster realtime filtered lookups
CREATE INDEX IF NOT EXISTS idx_payments_pool_id ON payments(pool_id);

-- Enable Realtime for the payments table (idempotent)
SELECT add_table_to_realtime('payments');

-- Row Level Security (RLS) policies
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write access for hackathon MVP
DROP POLICY IF EXISTS "Allow anonymous select on pools" ON pools;
CREATE POLICY "Allow anonymous select on pools"
  ON pools
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on pools" ON pools;
CREATE POLICY "Allow anonymous insert on pools"
  ON pools
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on payments" ON payments;
CREATE POLICY "Allow anonymous select on payments"
  ON payments
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on payments" ON payments;
CREATE POLICY "Allow anonymous insert on payments"
  ON payments
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================
-- Piggy Bank / Kids Goals feature
-- ============================================================

-- Goals / piggy bank items
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(10, 2) NOT NULL,
  parts_count INT NOT NULL CHECK (parts_count >= 1),
  part_amount NUMERIC(10, 2) NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'funded', 'declined')),
  parent_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Proofs submitted by the child
CREATE TABLE IF NOT EXISTS goal_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  reward_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
);

-- Contributions / released fractions
CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  proof_id UUID REFERENCES goal_proofs(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  contributed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_proofs_goal_id ON goal_proofs(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON goal_contributions(goal_id);

-- Enable Realtime for the new tables (idempotent)
SELECT add_table_to_realtime('goals');
SELECT add_table_to_realtime('goal_proofs');
SELECT add_table_to_realtime('goal_contributions');

-- RLS policies for anonymous MVP access
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select on goals" ON goals;
CREATE POLICY "Allow anonymous select on goals" ON goals FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on goals" ON goals;
CREATE POLICY "Allow anonymous insert on goals" ON goals FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on goals" ON goals;
CREATE POLICY "Allow anonymous update on goals" ON goals FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on goal_proofs" ON goal_proofs;
CREATE POLICY "Allow anonymous select on goal_proofs" ON goal_proofs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on goal_proofs" ON goal_proofs;
CREATE POLICY "Allow anonymous insert on goal_proofs" ON goal_proofs FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on goal_proofs" ON goal_proofs;
CREATE POLICY "Allow anonymous update on goal_proofs" ON goal_proofs FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on goal_contributions" ON goal_contributions;
CREATE POLICY "Allow anonymous select on goal_contributions" ON goal_contributions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on goal_contributions" ON goal_contributions;
CREATE POLICY "Allow anonymous insert on goal_contributions" ON goal_contributions FOR INSERT TO anon WITH CHECK (true);

-- Storage bucket for goal and proof photos
-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('goal-photos', 'goal-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anonymous read access to photos in the goal-photos bucket
DROP POLICY IF EXISTS "Allow anonymous select on goal-photos" ON storage.objects;
CREATE POLICY "Allow anonymous select on goal-photos"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'goal-photos');

-- Allow anonymous upload access to photos in the goal-photos bucket
DROP POLICY IF EXISTS "Allow anonymous insert on goal-photos" ON storage.objects;
CREATE POLICY "Allow anonymous insert on goal-photos"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'goal-photos');

-- ============================================================
-- Safe-Call Verification / Anti-Fraud feature
-- ============================================================

CREATE TABLE IF NOT EXISTS public.outgoing_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL DEFAULT '+375 (17) 229-99-99',
  verification_code VARCHAR(4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VERIFIED', 'REPORTED_FRAUD', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_starts_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 minute'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 minutes')
);

ALTER TABLE public.outgoing_calls ADD COLUMN IF NOT EXISTS call_starts_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 minute');

CREATE INDEX IF NOT EXISTS idx_outgoing_calls_status ON outgoing_calls(status);
CREATE INDEX IF NOT EXISTS idx_outgoing_calls_expires_at ON outgoing_calls(expires_at);

SELECT add_table_to_realtime('outgoing_calls');

ALTER TABLE public.outgoing_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on outgoing_calls" ON public.outgoing_calls;
CREATE POLICY "Allow public select on outgoing_calls"
  ON public.outgoing_calls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on outgoing_calls" ON public.outgoing_calls;
CREATE POLICY "Allow public insert on outgoing_calls"
  ON public.outgoing_calls FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on outgoing_calls" ON public.outgoing_calls;
CREATE POLICY "Allow public update on outgoing_calls"
  ON public.outgoing_calls FOR UPDATE USING (true);

-- ============================================================
-- Spend / Save / Give Wallets + Gift Links
-- ============================================================

-- Child wallets
CREATE TABLE IF NOT EXISTS child_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name TEXT NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('spend', 'save', 'give')),
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_name, wallet_type)
);

-- Allowance rules
CREATE TABLE IF NOT EXISTS allowance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name TEXT NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly')),
  spend_percent INT NOT NULL CHECK (spend_percent >= 0 AND spend_percent <= 100),
  save_percent INT NOT NULL CHECK (save_percent >= 0 AND save_percent <= 100),
  give_percent INT NOT NULL CHECK (give_percent >= 0 AND give_percent <= 100),
  auto_split_all BOOLEAN NOT NULL DEFAULT false,
  CHECK (spend_percent + save_percent + give_percent = 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE allowance_rules ADD COLUMN IF NOT EXISTS auto_split_all BOOLEAN NOT NULL DEFAULT false;

-- Allowance transactions history
CREATE TABLE IF NOT EXISTS allowance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  spend_amount NUMERIC(10, 2) NOT NULL,
  save_amount NUMERIC(10, 2) NOT NULL,
  give_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gift links
CREATE TABLE IF NOT EXISTS gift_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name TEXT NOT NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gifts from relatives
CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_link_id UUID NOT NULL REFERENCES gift_links(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT add_table_to_realtime('child_wallets');
SELECT add_table_to_realtime('allowance_rules');
SELECT add_table_to_realtime('allowance_transactions');
SELECT add_table_to_realtime('gift_links');
SELECT add_table_to_realtime('gifts');

ALTER TABLE child_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select on child_wallets" ON child_wallets;
CREATE POLICY "Allow anonymous select on child_wallets" ON child_wallets FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on child_wallets" ON child_wallets;
CREATE POLICY "Allow anonymous insert on child_wallets" ON child_wallets FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on child_wallets" ON child_wallets;
CREATE POLICY "Allow anonymous update on child_wallets" ON child_wallets FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on allowance_rules" ON allowance_rules;
CREATE POLICY "Allow anonymous select on allowance_rules" ON allowance_rules FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on allowance_rules" ON allowance_rules;
CREATE POLICY "Allow anonymous insert on allowance_rules" ON allowance_rules FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on allowance_rules" ON allowance_rules;
CREATE POLICY "Allow anonymous update on allowance_rules" ON allowance_rules FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on allowance_transactions" ON allowance_transactions;
CREATE POLICY "Allow anonymous select on allowance_transactions" ON allowance_transactions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on allowance_transactions" ON allowance_transactions;
CREATE POLICY "Allow anonymous insert on allowance_transactions" ON allowance_transactions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on gift_links" ON gift_links;
CREATE POLICY "Allow anonymous select on gift_links" ON gift_links FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on gift_links" ON gift_links;
CREATE POLICY "Allow anonymous insert on gift_links" ON gift_links FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on gifts" ON gifts;
CREATE POLICY "Allow anonymous select on gifts" ON gifts FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on gifts" ON gifts;
CREATE POLICY "Allow anonymous insert on gifts" ON gifts FOR INSERT TO anon WITH CHECK (true);
