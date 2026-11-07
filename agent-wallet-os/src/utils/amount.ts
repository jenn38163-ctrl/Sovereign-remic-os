import Decimal from 'decimal.js';

/**
 * P1 Fix: Replace JS Number with strict decimal arithmetic.
 * Validates financial amounts and canonicalizes them to strings for the PostgreSQL ledger.
 */
export function validateAmount(amount: string | number): string {
  try {
    const dec = new Decimal(amount);
    
    // Must be a valid number
    if (dec.isNaN()) {
      throw new Error('Invalid financial amount: NaN');
    }
    
    // Must be strictly positive
    if (dec.lte(0)) {
      throw new Error('Invalid financial amount: Must be strictly positive');
    }
    
    // Ensure it doesn't exceed PostgreSQL numeric(30,6) scale
    if (dec.decimalPlaces() > 6) {
      throw new Error('Invalid financial amount: Exceeds maximum 6 decimal places');
    }
    
    // Return canonical string representation
    return dec.toFixed();
  } catch (err: any) {
    throw new Error(`Amount validation failed: ${err.message}`);
  }
}
