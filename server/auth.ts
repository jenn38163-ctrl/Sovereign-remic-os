import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthenticatedUser {
  id: string;
  individualId: string;
  tenantId: string;
  role: 'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR';
  name: string;
  scopes: string[];
  expires_at?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Registered asymmetric RSA-2048 keypair registry (rejects key substitution)
export const ACTIVE_SIGNING_KEY_ID = 'sovereign-key-2026-v1';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

export const REGISTERED_PUBLIC_KEYS: Record<string, string> = {
  [ACTIVE_SIGNING_KEY_ID]: publicKey
};

export { privateKey, publicKey };

// Registered principals with strict scopes, tenant binding, and verified individualId
const USERS: Record<string, AuthenticatedUser> = {
  'maker_token_123': {
    id: 'usr-maker-1',
    individualId: 'person-alice-001',
    tenantId: 'tenant-omega',
    role: 'MAKER',
    name: 'Alice Maker (Treasury)',
    scopes: ['debt-note:create', 'settlement:initiate', 'ledger:read', 'ppm:create', 'pool:create']
  },
  // Secondary account belonging to the SAME individual (used to enforce distinct-person maker-checker)
  'maker_alias_checker_token': {
    id: 'usr-maker-1-alt',
    individualId: 'person-alice-001',
    tenantId: 'tenant-omega',
    role: 'CHECKER',
    name: 'Alice Alt Checker (Same Individual)',
    scopes: ['debt-note:approve', 'ppm:approve', 'pool:approve']
  },
  'checker_token_456': {
    id: 'usr-checker-1',
    individualId: 'person-bob-002',
    tenantId: 'tenant-omega',
    role: 'CHECKER',
    name: 'Bob Checker (Risk Officer)',
    scopes: ['debt-note:approve', 'settlement:approve', 'ledger:read', 'audit:read', 'ppm:approve', 'pool:approve']
  },
  'admin_token_789': {
    id: 'usr-admin-1',
    individualId: 'person-carol-003',
    tenantId: 'tenant-omega',
    role: 'ADMIN',
    name: 'Carol Admin',
    scopes: ['*']
  },
  'auditor_token_321': {
    id: 'usr-auditor-1',
    individualId: 'person-david-004',
    tenantId: 'tenant-omega',
    role: 'AUDITOR',
    name: 'David Auditor (Compliance)',
    scopes: ['audit:read', 'ledger:read', 'debt-note:read']
  },
  // Separate tenant principals for cross-tenant isolation testing
  'beta_maker_token_111': {
    id: 'usr-beta-maker-1',
    individualId: 'person-eve-005',
    tenantId: 'tenant-beta',
    role: 'MAKER',
    name: 'Eve Beta Maker',
    scopes: ['debt-note:create', 'ppm:create', 'pool:create', 'ledger:read']
  },
  'beta_checker_token_222': {
    id: 'usr-beta-checker-1',
    individualId: 'person-frank-006',
    tenantId: 'tenant-beta',
    role: 'CHECKER',
    name: 'Frank Beta Checker',
    scopes: ['debt-note:approve', 'ppm:approve', 'pool:approve', 'ledger:read']
  }
};

const REVOKED_TOKENS = new Set<string>();

/**
 * Authentication Middleware: Fail-closed strict verification. Rejects missing, invalid, or expired credentials with HTTP 401.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (apiKeyHeader) {
    token = apiKeyHeader;
  } else {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication credentials or token.' });
  }

  if (REVOKED_TOKENS.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Token has been revoked.' });
  }

  const user = USERS[token];
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or unrecognized authentication token.' });
  }

  if (user.expires_at && Date.now() > user.expires_at) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token has expired.' });
  }

  req.user = user;
  next();
}

/**
 * Tenant Authorization Middleware: Fail-closed strict resource-level tenant isolation (no ADMIN cross-tenant bypass).
 */
export function authorizeTenant(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User principal not found' });
  }

  const requestedTenant = req.headers['x-tenant-id'] || req.body?.tenant_id || req.query?.tenant_id;
  if (requestedTenant && requestedTenant !== user.tenantId) {
    return res.status(403).json({ error: 'Forbidden: Cross-tenant data access violation detected and blocked.' });
  }

  req.headers['x-tenant-id'] = user.tenantId;
  next();
}

/**
 * Role-Based Access Control Middleware factory
 */
export function authorizeRole(...allowedRoles: Array<'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: `Forbidden: Role '${user.role}' is not authorized for this operation. Required roles: [${allowedRoles.join(', ')}]`
      });
    }
    next();
  };
}

/**
 * Asserts strict distinct-individual Maker-Checker separation (cannot bypass with a secondary userId).
 */
export function assertDistinctMakerChecker(
  creatorUserId: string | undefined | null,
  creatorIndividualId: string | undefined | null,
  approver: AuthenticatedUser
): void {
  if (creatorUserId && creatorUserId === approver.id) {
    throw new Error('Maker-Checker violation: Creator cannot approve their own record. Independent checker required.');
  }
  if (creatorIndividualId && creatorIndividualId === approver.individualId) {
    throw new Error(
      'Maker-Checker violation: Approver shares the same verified individual identity as the creator. A different individual is required.'
    );
  }
}

/**
 * Cryptographic Digital Signing utility using Node.js crypto RSA-SHA256
 */
export function signPayload(payload: any): string {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sign = crypto.createSign('SHA256');
  sign.update(payloadString);
  sign.end();
  return sign.sign(privateKey, 'hex');
}

/**
 * Cryptographic Signature Verification utility.
 * Verifies strictly against registered public keys and rejects key substitution.
 */
export function verifySignature(
  payload: any,
  signatureHex: string,
  keyId: string = ACTIVE_SIGNING_KEY_ID,
  suppliedPublicKeyPem?: string
): boolean {
  try {
    const registeredKey = REGISTERED_PUBLIC_KEYS[keyId];
    if (!registeredKey) {
      return false;
    }
    // Reject any attempt to substitute an unregistered public key
    if (suppliedPublicKeyPem && suppliedPublicKeyPem.trim() !== registeredKey.trim()) {
      return false;
    }
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const verify = crypto.createVerify('SHA256');
    verify.update(payloadString);
    verify.end();
    return verify.verify(registeredKey, signatureHex, 'hex');
  } catch (e) {
    return false;
  }
}
