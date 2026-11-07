import { SettlementIntent } from '../../types';

export class PayUAdapter {
  async process(intent: SettlementIntent): Promise<boolean> {
    const supportedCurrencies = ['PLN', 'USDC'];
    
    if (!supportedCurrencies.includes(intent.currency)) {
      throw new Error(`Unsupported currency for PayU: ${intent.currency}`);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const clientId = process.env.PAYU_CLIENT_ID;
    const clientSecret = process.env.PAYU_CLIENT_SECRET;
    const posId = process.env.PAYU_POS_ID;

    // Hard-disable and fail-closed in production unless real verified gateway endpoints and keys are configured
    if (isProduction) {
      if (!clientId || !clientSecret || !posId) {
        throw new Error('PayU gateway is disabled in production: Real OAuth credentials (PAYU_CLIENT_ID, PAYU_CLIENT_SECRET, PAYU_POS_ID) are required.');
      }
      
      // In production, execute real HTTP call to PayU REST API /openpay/2_1/orders
      // Fail closed if payment gateway does not return HTTP 200/201 SUCCESS status
      throw new Error('PayU production gateway integration requires live merchant signature verification.');
    }

    // In dev / test environment with mock simulation:
    console.log('[Dev Simulation] PayU order dispatched:', {
      amount: intent.amount,
      currency: intent.currency,
      extOrderId: intent.id
    });
    return true;
  }
}
