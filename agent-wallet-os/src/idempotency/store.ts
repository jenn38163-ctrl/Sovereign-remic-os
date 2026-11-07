import crypto from 'crypto';
import { Tx } from '../db/client';

export type IdempotencyState = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  fingerprint: string;
  state: IdempotencyState;
  response_status?: number;
  response_body?: any;
}

/**
 * P1 Fix: Idempotency Handling is Not Safe Enough
 * Binds the idempotency key to the request payload fingerprint.
 */
export async function enforceIdempotency(
  tx: Tx,
  idempotencyKey: string,
  payload: any
): Promise<{ status: 'NEW' | 'REPLAY' | 'CONFLICT' | 'PROCESSING', record?: IdempotencyRecord }> {
  // 1. Fingerprint the request payload
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  // 2. Try to lock the idempotency record
  const result = await tx.query(
    `SELECT * FROM idempotency_keys WHERE key = $1 FOR UPDATE`,
    [idempotencyKey]
  );

  if (result.rows.length === 0) {
    // Brand new request. Insert as PROCESSING.
    await tx.query(
      `INSERT INTO idempotency_keys (key, fingerprint, state, created_at)
       VALUES ($1, $2, 'PROCESSING', NOW())`,
      [idempotencyKey, fingerprint]
    );
    return { status: 'NEW' };
  }

  const record = result.rows[0] as IdempotencyRecord;

  // 3. Verify fingerprint matches (prevent payload swapping)
  if (record.fingerprint !== fingerprint) {
    return { status: 'CONFLICT' }; // Conflict! Reuse of key with different payload.
  }

  // 4. Safely handle concurrent processing
  if (record.state === 'PROCESSING') {
    return { status: 'PROCESSING', record }; // Caller should retry/wait, not just throw 409
  }

  // 5. Replay completed result
  return { status: 'REPLAY', record };
}
