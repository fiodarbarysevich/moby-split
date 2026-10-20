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

export type OutgoingCallStatus = "ACTIVE" | "VERIFIED" | "REPORTED_FRAUD" | "EXPIRED";

export interface OutgoingCall {
  id: string;
  phone_number: string;
  verification_code: string;
  status: OutgoingCallStatus;
  created_at: string;
  call_starts_at: string;
  expires_at: string;
}

export type WalletType = "spend" | "save" | "give";

export interface ChildWallet {
  id: string;
  child_name: string;
  wallet_type: WalletType;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface AllowanceRule {
  id: string;
  child_name: string;
  amount: number;
  frequency: "weekly";
  spend_percent: number;
  save_percent: number;
  give_percent: number;
  auto_split_all: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllowanceTransaction {
  id: string;
  child_name: string;
  amount: number;
  spend_amount: number;
  save_amount: number;
  give_amount: number;
  created_at: string;
}

export interface GiftLink {
  id: string;
  child_name: string;
  goal_id: string | null;
  token: string;
  created_at: string;
}

export interface Gift {
  id: string;
  gift_link_id: string;
  child_name: string;
  goal_id: string | null;
  sender_name: string;
  amount: number;
  message: string | null;
  created_at: string;
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
      outgoing_calls: {
        Row: OutgoingCall;
        Insert: Omit<OutgoingCall, "id" | "created_at">;
        Update: Partial<Omit<OutgoingCall, "id" | "created_at">>;
      };
      child_wallets: {
        Row: ChildWallet;
        Insert: Omit<ChildWallet, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ChildWallet, "id" | "created_at" | "updated_at">>;
      };
      allowance_rules: {
        Row: AllowanceRule;
        Insert: Omit<AllowanceRule, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AllowanceRule, "id" | "created_at" | "updated_at">>;
      };
      allowance_transactions: {
        Row: AllowanceTransaction;
        Insert: Omit<AllowanceTransaction, "id" | "created_at">;
        Update: Partial<Omit<AllowanceTransaction, "id" | "created_at">>;
      };
      gift_links: {
        Row: GiftLink;
        Insert: Omit<GiftLink, "id" | "created_at" | "token">;
        Update: Partial<Omit<GiftLink, "id" | "created_at" | "token">>;
      };
      gifts: {
        Row: Gift;
        Insert: Omit<Gift, "id" | "created_at">;
        Update: Partial<Omit<Gift, "id" | "created_at">>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
