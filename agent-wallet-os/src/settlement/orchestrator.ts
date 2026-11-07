import { db } from '../db/client';
import { SettlementIntent, SettlementState } from '../types';
import { postLedgerTransaction, reverseLedgerTransaction } from '../ledger/journal';
import { createAuditRecord } from '../ledger/audit';
import { PayUAdapter } from './providers/payu';
import { StarknetAdapter } from './providers/starknet';

export class SettlementOrchestrator {
  private payu = new PayUAdapter();
  private starknet = new StarknetAdapter();

  /**
   * Complete Settlement State Machine with Reconciliation Safety:
   * 1. Authorized -> Post internal debit -> LEDGER_POSTED
   * 2. Mark SETTLEMENT_SUBMITTED (Durable in-flight state to survive crashes)
   * 3. Execute external gateway settlement
   * 4. State transition to:
   *    - SETTLEMENT_CONFIRMED (when provider explicitly returns verified success)
   *    - SETTLEMENT_FAILED (when provider explicitly rejects, triggers auto-reversal)
   *    - RECONCILIATION_REQUIRED (when timeout/network error occurs; does NOT auto-reverse until reconciled)
   */
  async executeSettlement(intent: SettlementIntent): Promise<void> {
    // 1. Post to internal ledger FIRST
    await db.transaction(async (tx) => {
      await postLedgerTransaction(tx, intent);
      
      await tx.query(
        'UPDATE settlement_intents SET state = $1 WHERE id = $2',
        ['LEDGER_POSTED', intent.id]
      );
    });

    // 2. Durable in-flight submission state
    await db.transaction(async (tx) => {
      await tx.query(
        'UPDATE settlement_intents SET state = $1 WHERE id = $2',
        ['SETTLEMENT_SUBMITTED', intent.id]
      );
      await createAuditRecord(tx, 'SETTLEMENT_SUBMITTED', { intent_id: intent.id }, intent.tenant_id);
    });

    // 3. Submit to external gateway
    let outcome: 'CONFIRMED' | 'FAILED' | 'UNKNOWN' = 'UNKNOWN';
    let errorMessage = '';

    try {
      const isConfirmed = await this.routeToProvider(intent);
      outcome = isConfirmed ? 'CONFIRMED' : 'FAILED';
    } catch (err: any) {
      errorMessage = err.message || 'Unknown provider error';
      // If error is explicit rejection vs timeout/network ambiguity
      if (errorMessage.includes('Unsupported currency') || errorMessage.includes('Invalid credentials')) {
        outcome = 'FAILED';
      } else {
        outcome = 'UNKNOWN';
      }
    }

    // 4. Handle Final State with Reconciliation Guard
    await db.transaction(async (tx) => {
      if (outcome === 'CONFIRMED') {
        await tx.query(
          'UPDATE settlement_intents SET state = $1 WHERE id = $2',
          ['SETTLEMENT_CONFIRMED', intent.id]
        );
        await createAuditRecord(tx, 'SETTLEMENT_CONFIRMED', { intent_id: intent.id }, intent.tenant_id);
      } else if (outcome === 'FAILED') {
        // Reverse the journal entry on explicit failure
        await reverseLedgerTransaction(tx, intent, errorMessage || 'External settlement explicitly failed');
        
        await tx.query(
          'UPDATE settlement_intents SET state = $1 WHERE id = $2',
          ['SETTLEMENT_FAILED', intent.id]
        );
        await createAuditRecord(tx, 'SETTLEMENT_FAILED', { intent_id: intent.id, reason: errorMessage }, intent.tenant_id);
      } else {
        // Unknown outcome (process crash / timeout): Move to RECONCILIATION_REQUIRED
        // P0 Safety: DO NOT auto-reverse when status is unknown
        await tx.query(
          'UPDATE settlement_intents SET state = $1 WHERE id = $2',
          ['RECONCILIATION_REQUIRED', intent.id]
        );
        await createAuditRecord(tx, 'RECONCILIATION_REQUIRED', { intent_id: intent.id, error: errorMessage }, intent.tenant_id);
      }
    });
  }

  /**
   * Explicit Provider Routing
   */
  private async routeToProvider(intent: SettlementIntent): Promise<boolean> {
    switch (intent.provider) {
      case 'PAYU':
        return await this.payu.process(intent);
      case 'STARKNET':
        return await this.starknet.process(intent);
      case 'GOOGLE_PAY':
        throw new Error('Google Pay not implemented: Requires ECv2 cryptographic verification');
      default:
        throw new Error(`Unknown provider routing: ${intent.provider}`);
    }
  }
}
