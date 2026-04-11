export interface PosDevice {
  id: number;
  mp_device_id: string;
  name: string;
  operating_mode: 'PDV' | 'STANDALONE';
  active: boolean;
  created_at: Date;
}

export type PosIntentStatus =
  | 'open'
  | 'on_terminal'
  | 'processing'
  | 'processed'
  | 'abandoned'
  | 'cancelled'
  | 'error';

export interface PosPaymentIntent {
  id: number;
  device_id: number;
  order_id: number;
  mp_intent_id: string;
  status: PosIntentStatus;
  mp_payment_id: string | null;
  created_at: Date;
  updated_at: Date;
}
