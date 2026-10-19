export interface Pool {
  id: string;
  title: string;
  total_amount: number;
  participants_count: number;
  share_amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  pool_id: string;
  payer_name: string;
  amount: number;
  paid_at: string;
}

export interface CreatePoolPayload {
  title: string;
  total_amount: number;
  participants_count: number;
  share_amount: number;
}

export type GoalStatus = "pending" | "approved" | "funded" | "declined";
export type ProofStatus = "pending" | "approved" | "declined";

export interface Goal {
  id: string;
  child_name: string;
  title: string;
  description: string | null;
  target_amount: number;
  parts_count: number;
  part_amount: number;
  photo_url: string | null;
  status: GoalStatus;
  parent_token: string;
  created_at: string;
  updated_at: string;
}

export interface GoalProof {
  id: string;
  goal_id: string;
  photo_url: string;
  description: string | null;
  status: ProofStatus;
  reward_amount: number;
  created_at: string;
  approved_at: string | null;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  proof_id: string | null;
  amount: number;
  contributed_at: string;
}

export interface CreateGoalPayload {
  child_name: string;
  title: string;
  description?: string;
  target_amount: number;
  parts_count: number;
  part_amount: number;
  photo_url?: string;
}

export interface Database {
  public: {
    Tables: {
      pools: {
        Row: Pool;
        Insert: CreatePoolPayload;
        Update: Partial<CreatePoolPayload>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id" | "paid_at">;
        Update: Partial<Omit<Payment, "id" | "paid_at">>;
      };
      goals: {
        Row: Goal;
        Insert: CreateGoalPayload;
        Update: Partial<CreateGoalPayload & { status?: GoalStatus; updated_at?: string }>;
      };
      goal_proofs: {
        Row: GoalProof;
        Insert: Omit<GoalProof, "id" | "created_at" | "approved_at">;
        Update: Partial<Omit<GoalProof, "id" | "created_at" | "approved_at">>;
      };
      goal_contributions: {
        Row: GoalContribution;
        Insert: Omit<GoalContribution, "id" | "contributed_at">;
        Update: Partial<Omit<GoalContribution, "id" | "contributed_at">>;
      };
    };
  };
}
