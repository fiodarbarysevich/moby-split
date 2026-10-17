-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Enable Realtime for the payments table
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- Row Level Security (RLS) policies
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write access for hackathon MVP
CREATE POLICY "Allow anonymous select on pools"
  ON pools
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert on pools"
  ON pools
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous select on payments"
  ON payments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert on payments"
  ON payments
  FOR INSERT
  TO anon
  WITH CHECK (true);
