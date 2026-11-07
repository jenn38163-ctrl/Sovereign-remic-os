import { Tx } from '../db/client';
import { createAuditRecord } from './audit';
import { SettlementIntent } from '../types';
import { validateAmount } from '../utils/amount';

export async function postLedgerTransaction(tx: Tx, intent: SettlementIntent): Promise<void> {
  // Canonical Decimal.js validation maintaining exact string representation (no parseFloat precision loss)
  const validatedAmount = validateAmount(intent.amount);

  // Record debit
  await tx.query(`
    INSERT INTO journal_entries (id, tenant_id, intent_id, wallet_id, amount, type, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'DEBIT', NOW())
  `, [intent.tenant_id, intent.id, intent.wallet_id, validatedAmount]);

  // Record audit trail atomically
  await createAuditRecord(tx, 'LEDGER_POSTED', {
    intent_id: intent.id,
    tenant_id: intent.tenant_id,
    wallet_id: intent.wallet_id,
    amount: validatedAmount
  });
}

export async function reverseLedgerTransaction(tx: Tx, intent: SettlementIntent, reason: string): Promise<void> {
  const validatedAmount = validateAmount(intent.amount);

  // Compensating transaction
  await tx.query(`
    INSERT INTO journal_entries (id, tenant_id, intent_id, wallet_id, amount, type, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'CREDIT', NOW())
  `, [intent.tenant_id, intent.id, intent.wallet_id, validatedAmount]);

  await createAuditRecord(tx, 'LEDGER_REVERSED', {
    intent_id: intent.id,
    tenant_id: intent.tenant_id,
    wallet_id: intent.wallet_id,
    amount: validatedAmount,
    reason
  });
}
