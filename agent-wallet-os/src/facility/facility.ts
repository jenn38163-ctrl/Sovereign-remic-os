import { Tx } from '../db/client';
import { validateAmount } from '../utils/amount';

/**
 * P0 Fix: Facility Tenant Binding
 * Ensures facilities and wallets are checked against the authenticated tenant.
 */
export async function processFacilityDraw(
  tx: Tx,
  tenantId: string, // Injected from authenticated principal
  facilityId: string,
  walletId: string,
  rawAmount: string
): Promise<void> {
  // P1 Fix: Proper decimal amount validation
  const amount = validateAmount(rawAmount);

  // 1. Authorize Facility (Tenant Bound)
  const facilityResult = await tx.query(
    `SELECT id, commitment, drawn FROM facilities 
     WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
    [facilityId, tenantId] // tenant_id binding prevents cross-tenant access
  );

  if (facilityResult.rows.length === 0) {
    throw new Error('Unauthorized or missing Facility');
  }

  // 2. Authorize Wallet (Tenant Bound)
  const walletResult = await tx.query(
    `SELECT id FROM wallets WHERE id = $1 AND tenant_id = $2`,
    [walletId, tenantId]
  );

  if (walletResult.rows.length === 0) {
    throw new Error('Unauthorized or missing Wallet');
  }

  // (Simulated logic for checking limits and updating drawn amount...)
  // await tx.query(...)
}
