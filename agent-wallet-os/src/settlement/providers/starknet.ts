import { SettlementIntent } from '../../types';

export class StarknetAdapter {
  async process(intent: SettlementIntent): Promise<boolean> {
    const supportedCurrencies = ['USDC', 'ETH', 'STRK'];
    
    if (!supportedCurrencies.includes(intent.currency)) {
      throw new Error(`Unsupported currency for Starknet: ${intent.currency}`);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const rpcUrl = process.env.STARKNET_RPC_URL;
    const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;
    const privateKey = process.env.STARKNET_PRIVATE_KEY;

    // Hard-disable and fail-closed in production unless real RPC node and account keys are configured
    if (isProduction) {
      if (!rpcUrl || !accountAddress || !privateKey) {
        throw new Error('Starknet gateway is disabled in production: Real RPC credentials (STARKNET_RPC_URL, STARKNET_ACCOUNT_ADDRESS, STARKNET_PRIVATE_KEY) are required.');
      }
      
      // In production, execute real on-chain transaction verification
      throw new Error('Starknet on-chain execution requires verified cryptographic contract invocation.');
    }

    console.log('[Dev Simulation] Starknet transaction dispatched:', {
      amount: intent.amount,
      token: intent.currency,
      reference: intent.id
    });
    return true;
  }
}
