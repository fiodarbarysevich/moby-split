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
    };
  };
}
