import { Tx } from '../db/client';
import { createAuditRecord } from './audit';
import { SettlementIntent } from '../types';
import { validateAmount } from '../utils/amount';

/**
 * Enforces balanced double-entry accounting: Every transaction atomically posts
 * equal DEBIT and CREDIT entries.
 */
export async function postLedgerTransaction(tx: Tx, intent: SettlementIntent): Promise<void> {
  const validatedAmount = validateAmount(intent.amount);

  // 1. Record DEBIT (e.g., Asset/Cash / Wallet)
  await tx.query(`
    INSERT INTO journal_entries (id, tenant_id, intent_id, wallet_id, amount, type, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'DEBIT', NOW())
  `, [intent.tenant_id, intent.id, intent.wallet_id, validatedAmount]);

  // 2. Record offsetting CREDIT (e.g., Liability/Provider Clearing) to satisfy double-entry accounting invariant
  await tx.query(`
    INSERT INTO journal_entries (id, tenant_id, intent_id, wallet_id, amount, type, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'CREDIT', NOW())
  `, [intent.tenant_id, intent.id, `clearing-${intent.wallet_id}`, validatedAmount]);

  // 3. Record audit trail atomically
  await createAuditRecord(tx, 'LEDGER_POSTED_BALANCED', {
    intent_id: intent.id,
    tenant_id: intent.tenant_id,
    wallet_id: intent.wallet_id,
    amount: validatedAmount,
    double_entry: 'BALANCED'
  }, intent.tenant_id);
}

export async function reverseLedgerTransaction(tx: Tx, intent: SettlementIntent, reason: string): Promise<void> {
  const validatedAmount = validateAmount(intent.amount);

  // Compensating balanced reversal entries
  await tx.query(`
    INSERT INTO journal_entries (id, tenant_id, intent_id, wallet_id, amount, type, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'CREDIT', NOW())
  `, [intent.tenant_id, intent.id, intent.wallet_id, validatedAmount]);

  await tx.query(`
    INSERT INTO journal_entries (id, tenant_id, intent_id, wallet_id, amount, type, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 'DEBIT', NOW())
  `, [intent.tenant_id, intent.id, `clearing-${intent.wallet_id}`, validatedAmount]);

  await createAuditRecord(tx, 'LEDGER_REVERSED_BALANCED', {
    intent_id: intent.id,
    tenant_id: intent.tenant_id,
    wallet_id: intent.wallet_id,
    amount: validatedAmount,
    reason,
    double_entry: 'BALANCED'
  }, intent.tenant_id);
}
