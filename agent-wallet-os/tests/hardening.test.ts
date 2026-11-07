import { describe, it, expect, vi } from 'vitest';
import { validateAmount } from '../src/utils/amount';
import { enforceIdempotency } from '../src/idempotency/store';
import { processFacilityDraw } from '../src/facility/facility';
import { GooglePayAdapter } from '../src/settlement/providers/googlepay';

describe('Harden Kernel Fixes', () => {

  describe('1. Amount Validation (Decimal.js)', () => {
    it('should correctly format valid amounts', () => {
      expect(validateAmount('100')).toBe('100');
      expect(validateAmount('100.50')).toBe('100.5');
    });

    it('should reject invalid, NaN, or non-positive amounts', () => {
      expect(() => validateAmount('abc')).toThrow(/Invalid argument/);
      expect(() => validateAmount('-50')).toThrow(/strictly positive/);
      expect(() => validateAmount('0')).toThrow(/strictly positive/);
      expect(() => validateAmount('1.1234567')).toThrow(/maximum 6 decimal places/);
    });
  });

  describe('2. Idempotency Fingerprinting', () => {
    it('should reject idempotency key reuse with different payload (CONFLICT)', async () => {
      const mockTx: any = {
        query: vi.fn().mockResolvedValue({
          rows: [{
            key: 'idem-123',
            fingerprint: 'some-old-hash',
            state: 'COMPLETED'
          }]
        })
      };

      const result = await enforceIdempotency(mockTx, 'idem-123', { amount: 9000 });
      expect(result.status).toBe('CONFLICT');
    });
  });

  describe('3. Multi-Tenant Facility Binding', () => {
    it('should enforce tenant_id check when processing a draw', async () => {
      const mockTx: any = { query: vi.fn() };
      
      // Setup: facility lookup fails (meaning no facility found for this tenant)
      mockTx.query.mockResolvedValueOnce({ rows: [] }); 

      await expect(
        processFacilityDraw(mockTx, 'tenant-A', 'fac-1', 'wallet-1', '100')
      ).rejects.toThrow(/Unauthorized or missing Facility/);

      // Verify tenant_id was passed to the query
      expect(mockTx.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['fac-1', 'tenant-A']
      );
    });
  });

  describe('4. Google Pay Disabled', () => {
    it('should throw Error when running in production', async () => {
      const adapter = new GooglePayAdapter();
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      await expect(
        adapter.process({} as any, {})
      ).rejects.toThrow(/disabled in production/);
      
      process.env.NODE_ENV = origEnv;
    });
  });

});
