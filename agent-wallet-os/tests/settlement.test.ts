import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettlementOrchestrator } from '../src/settlement/orchestrator';
import { SettlementIntent } from '../src/types';
import { db, Tx } from '../src/db/client';

// Mock DB transactions
vi.mock('../src/db/client', () => {
  const queryMock = vi.fn().mockResolvedValue({ rows: [] });
  return {
    db: {
      query: queryMock,
      transaction: async (cb: (tx: Tx) => Promise<any>) => {
        return await cb({ query: queryMock });
      }
    }
  };
});

describe('SettlementOrchestrator', () => {
  let orchestrator: SettlementOrchestrator;
  
  beforeEach(() => {
    orchestrator = new SettlementOrchestrator();
    vi.clearAllMocks();
  });

  it('should successfully post ledger and confirm settlement for valid PayU USDC intent', async () => {
    const intent: SettlementIntent = {
      id: 'intent-123',
      tenant_id: 'tenant-abc',
      wallet_id: 'wallet-xyz',
      amount: '100.00',
      currency: 'USDC',
      provider: 'PAYU', // explicitly routed to PayU
      state: 'AUTHORIZED',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Spy on PayU adapter processing
    const payuSpy = vi.spyOn(orchestrator['payu'], 'process').mockResolvedValue(true);

    await orchestrator.executeSettlement(intent);

    // 1. Should route explicitly to PayU, not Starknet
    expect(payuSpy).toHaveBeenCalledWith(intent);
    
    // 2. Database queries should include DEBIT for ledger and SETTLEMENT_CONFIRMED
    const queriesAndParams = (db.query as any).mock.calls.map((c: any) => ({
      query: c[0] as string,
      params: c[1] as any[]
    }));
    
    expect(queriesAndParams.some(q => 
      q.query.includes("INSERT INTO journal_entries") && 
      q.query.includes("'DEBIT'")
    )).toBe(true);
    
    expect(queriesAndParams.some(q => 
      q.query.includes("UPDATE settlement_intents SET state = $1") && 
      q.params?.includes("SETTLEMENT_CONFIRMED")
    )).toBe(true);
  });

  it('should explicitly reverse ledger if settlement fails', async () => {
    const intent: SettlementIntent = {
      id: 'intent-456',
      tenant_id: 'tenant-abc',
      wallet_id: 'wallet-xyz',
      amount: '50.00',
      currency: 'PLN',
      provider: 'PAYU',
      state: 'AUTHORIZED',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Force settlement failure
    vi.spyOn(orchestrator['payu'], 'process').mockResolvedValue(false);

    await orchestrator.executeSettlement(intent);

    // Expect reversal (CREDIT) entry and FAILED state update
    const queriesAndParams = (db.query as any).mock.calls.map((c: any) => ({
      query: c[0] as string,
      params: c[1] as any[]
    }));
    
    expect(queriesAndParams.some(q => 
      q.query.includes("INSERT INTO journal_entries") && 
      q.query.includes("'CREDIT'")
    )).toBe(true);
    
    expect(queriesAndParams.some(q => 
      q.query.includes("UPDATE settlement_intents SET state = $1") && 
      q.params?.includes("SETTLEMENT_FAILED")
    )).toBe(true);
  });

  it('should enforce currency boundaries on adapters', async () => {
    const intent: SettlementIntent = {
      id: 'intent-789',
      tenant_id: 'tenant-abc',
      wallet_id: 'wallet-xyz',
      amount: '100.00',
      currency: 'BTC', // Invalid for PayU
      provider: 'PAYU',
      state: 'AUTHORIZED',
      created_at: new Date(),
      updated_at: new Date()
    };

    // The executeSettlement swallows the error to reverse the ledger
    await orchestrator.executeSettlement(intent);

    const queriesAndParams = (db.query as any).mock.calls.map((c: any) => ({
      query: c[0] as string,
      params: c[1] as any[]
    }));
    expect(queriesAndParams.some(q => 
      q.query.includes("UPDATE settlement_intents SET state = $1") && 
      q.params?.includes("SETTLEMENT_FAILED")
    )).toBe(true);
  });
});
