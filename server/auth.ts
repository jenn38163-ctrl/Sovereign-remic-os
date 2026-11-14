import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthenticatedUser {
  id: string;
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

// In-memory keypair for cryptographic signing and verification of settlements and debt notes
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

export { privateKey, publicKey };

// Registered principals with strict scopes and tenant binding
const USERS: Record<string, AuthenticatedUser> = {
  'maker_token_123': {
    id: 'usr-maker-1',
    tenantId: 'tenant-omega',
    role: 'MAKER',
    name: 'Alice Maker (Treasury)',
    scopes: ['debt-note:create', 'settlement:initiate', 'ledger:read']
  },
  'checker_token_456': {
    id: 'usr-checker-1',
    tenantId: 'tenant-omega',
    role: 'CHECKER',
    name: 'Bob Checker (Risk Officer)',
    scopes: ['debt-note:approve', 'settlement:approve', 'ledger:read', 'audit:read']
  },
  'admin_token_789': {
    id: 'usr-admin-1',
    tenantId: 'tenant-omega',
    role: 'ADMIN',
    name: 'Carol Admin',
    scopes: ['*']
  },
  'auditor_token_321': {
    id: 'usr-auditor-1',
    tenantId: 'tenant-omega',
    role: 'AUDITOR',
    name: 'David Auditor (Compliance)',
    scopes: ['audit:read', 'ledger:read', 'debt-note:read']
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
    // CRITICAL FIX: No fallback allowed. Fail closed.
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
 * Tenant Authorization Middleware: Enforces strict resource-level tenant isolation.
 */
export function authorizeTenant(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User principal not found' });
  }

  const requestedTenant = req.headers['x-tenant-id'] || req.body.tenant_id || req.query.tenant_id;
  if (requestedTenant && requestedTenant !== user.tenantId && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Cross-tenant data access violation detected and blocked.' });
  }

  // Bind tenant ID explicitly to request
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
 * Cryptographic Signature Verification utility
 */
export function verifySignature(payload: any, signatureHex: string): boolean {
  try {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const verify = crypto.createVerify('SHA256');
    verify.update(payloadString);
    verify.end();
    return verify.verify(publicKey, signatureHex, 'hex');
  } catch (e) {
    return false;
  }
}
