import { SettlementIntent } from '../../types';

export class GooglePayAdapter {
  async process(intent: SettlementIntent, tokenPayload?: any): Promise<boolean> {
    // P0 Fix: Google Pay verification is a mock.
    // The previous implementation blindly trusted the presence of a signature.
    // We explicitly throw an error preventing production use until ECv2 is implemented.
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Google Pay endpoint disabled in production: Genuine ECv2 verification/decryption ' +
        'and merchant/acquirer settlement validation are required but not yet implemented.'
      );
    }
    
    console.warn('WARN: Google Pay mock verification used in non-production environment');
    return true; 
  }
}
