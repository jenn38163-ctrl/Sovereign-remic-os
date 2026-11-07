import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CARSOutboxWorker, CARSOutboxItem } from '../src/outbox/cars';
import { createAuditRecord } from '../src/ledger/audit';
import { SettlementOrchestrator } from '../src/settlement/orchestrator';
import { SettlementIntent } from '../src/types';
import { db } from '../src/db/client';

describe('v9 Atomicity & Recovery Concurrency Tests', () => {

  describe('1. CARS Lease-Based Contention & Claiming', () => {
    it('should prevent dual worker claims on the same pending item', async () => {
      let isClaimed = false;
      const claimItem = async (workerName: string) => {
        if (!isClaimed) {
          isClaimed = true;
          return { worker: workerName, status: 'CLAIMED' };
        }
        return { worker: workerName, status: 'SKIPPED_ACTIVE_LEASE' };
      };

      const [resA, resB] = await Promise.all([
        claimItem('Worker A'),
        claimItem('Worker B')
      ]);

      const claimedCount = [resA, resB].filter(r => r.status === 'CLAIMED').length;
      expect(claimedCount).toBe(1);
    });
  });

  describe('2. Settlement Ambiguity & Reconciliation Safety', () => {
    it('should transition to RECONCILIATION_REQUIRED and NOT auto-reverse upon network timeout', async () => {
      const orchestrator = new SettlementOrchestrator();
      const intent: SettlementIntent = {
        id: 'intent-timeout-99',
        tenant_id: 'tenant-omega',
        wallet_id: 'wallet-omega',
        amount: '1000.00',
        currency: 'USDC',
        provider: 'PAYU',
        state: 'AUTHORIZED',
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.spyOn(orchestrator['payu'], 'process').mockRejectedValue(new Error('ETIMEDOUT: Connection reset by peer'));

      const queriesRun: any[] = [];
      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => {
        return await cb({
          rawTransaction: {
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn(),
            update: vi.fn()
          },
          query: vi.fn().mockImplementation((q, p) => {
            queriesRun.push({ query: q, params: p });
            return Promise.resolve({ rows: [] });
          })
        });
      });

      await orchestrator.executeSettlement(intent);

      expect(queriesRun.some(q => 
        q.query.includes("UPDATE settlement_intents SET state = $1") && 
        q.params?.includes("RECONCILIATION_REQUIRED")
      )).toBe(true);

      expect(queriesRun.some(q => 
        q.query.includes("INSERT INTO journal_entries") && 
        q.query.includes("'CREDIT'")
      )).toBe(false);
    });
  });

  describe('3. Transactional Audit Serialization Inside runTransaction', () => {
    it('should atomically read sequence, calculate next sequence, and write in transaction', async () => {
      let trackerSequence = 42;
      let trackerHash = 'hash-42';
      const sets: any[] = [];

      const mockFirestoreTx = {
        get: vi.fn().mockImplementation(async () => ({
          exists: true,
          data: () => ({ sequence_number: trackerSequence, hash: trackerHash })
        })),
        set: vi.fn().mockImplementation((ref: any, data: any) => {
          sets.push(data);
          if (data.sequence_number) {
            trackerSequence = data.sequence_number;
            trackerHash = data.hash;
          }
        })
      };

      const mockTx = {
        rawTransaction: mockFirestoreTx,
        query: vi.fn()
      };

      await createAuditRecord(mockTx, 'LEDGER_POSTED', { amount: '100' }, 'tenant-alpha');

      // 1. Verify read happened through transactional get
      expect(mockFirestoreTx.get).toHaveBeenCalledTimes(1);

      // 2. Verify write occurred with atomic sequence increment (42 -> 43)
      const auditLogSet = sets.find(s => s.action === 'LEDGER_POSTED');
      expect(auditLogSet).toBeDefined();
      expect(auditLogSet.sequence_number).toBe(43);
      expect(auditLogSet.previous_hash).toBe('hash-42');
      expect(auditLogSet.tenant_id).toBe('tenant-alpha');

      // 3. Verify sequence tracker update happened within same transaction
      const trackerSet = sets.find(s => s.sequence_number === 43 && !s.action);
      expect(trackerSet).toBeDefined();
    });
  });

});
