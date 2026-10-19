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
