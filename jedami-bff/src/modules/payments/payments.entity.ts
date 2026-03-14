export interface Payment {
  id: number;
  order_id: number;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  amount: string | null;
  paid_at: Date | null;
  created_at: Date;
}
