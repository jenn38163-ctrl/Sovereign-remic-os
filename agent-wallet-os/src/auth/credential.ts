import { db } from '../db/client';

export interface Principal {
  id: string;
  tenantId: string;
  role: 'AGENT' | 'ADMIN' | 'READ_ONLY';
  scopes: string[];
}

/**
 * P1 Fix: Dynamic API Key mapping instead of static global credentials.
 * API Key -> Credential Record -> Organization/Tenant -> Principal -> Scopes
 */
export async function authenticateApiKey(apiKey: string): Promise<Principal> {
  // Hash the incoming key for lookup (keys should be stored hashed)
  const crypto = await import('crypto');
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Perform multi-tenant lookup
  const result = await db.query(
    `SELECT p.id, p.tenant_id, p.role, p.scopes 
     FROM credentials c
     JOIN principals p ON c.principal_id = p.id
     WHERE c.hashed_key = $1 AND c.status = 'ACTIVE'`,
    [hashedKey]
  );

  if (result.rows.length === 0) {
    throw new Error('Unauthorized: Invalid or revoked API key');
  }

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    scopes: row.scopes || []
  };
}
