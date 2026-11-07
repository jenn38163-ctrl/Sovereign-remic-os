export type SettlementState = 
  | 'REQUESTED'
  | 'AUTHORIZED'
  | 'LEDGER_POSTED'
  | 'SETTLEMENT_SUBMITTED'
  | 'SETTLEMENT_CONFIRMED'
  | 'SETTLEMENT_FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'REVERTED';

export interface SettlementIntent {
  id: string;
  tenant_id: string;
  wallet_id: string;
  amount: string; // using canonical string decimal
  currency: string;
  provider: 'PAYU' | 'STARKNET' | 'GOOGLE_PAY';
  state: SettlementState;
  created_at: Date;
  updated_at: Date;
  external_reference?: string;
  reconciliation_reason?: string;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  intent_id: string;
  wallet_id: string;
  amount: string;
  type: 'CREDIT' | 'DEBIT';
  created_at: Date;
}

export interface AuditEntry {
  id: string;
  tenant_id: string;
  sequence_number: number;
  transaction_id?: string;
  action: string;
  payload: any;
  previous_hash: string;
  hash: string;
  created_at: Date;
}

export interface CARSOutboxItem {
  id: string;
  tenant_id: string;
  intent_id: string;
  state: 'PENDING' | 'CLAIMED' | 'ACKNOWLEDGED' | 'RETRY' | 'DEAD_LETTER';
  payload: any;
  retry_count: number;
  next_attempt_at: string;
  lease_expires_at?: string;
  external_reference?: string;
  last_error?: string;
  created_at: string;
  updated_at?: string;
}
