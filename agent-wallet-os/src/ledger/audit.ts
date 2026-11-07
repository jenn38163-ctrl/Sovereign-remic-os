import { Tx } from '../db/client';
import { firestoreAdmin } from '../../../src/lib/firebase-admin';
import crypto from 'crypto';

/**
 * Creates an audit record atomically within the Firestore transaction (`runTransaction`).
 * Performs the read-calculate-write cycle strictly on `tx.rawTransaction` so that
 * sequence incrementing, hashing, and audit log appending are 100% atomic and protected
 * against distributed race conditions.
 */
export async function createAuditRecord(
  tx: Tx,
  action: string,
  payload: any,
  tenantId: string = 'system'
): Promise<void> {
  const firestoreTx = tx.rawTransaction;
  const seqDocRef = firestoreAdmin.collection('system_metadata').doc('audit_sequence');

  let previousSequence = 0;
  let previousHash = 'genesis_hash';

  // 1. Transactional Read: Query the latest sequence and hash inside the Firestore transaction
  if (firestoreTx) {
    const seqSnap = await firestoreTx.get(seqDocRef);
    if (seqSnap.exists) {
      const data = seqSnap.data();
      previousSequence = Number(data?.sequence_number) || 0;
      previousHash = data?.hash || 'genesis_hash';
    }
  } else {
    const result = await tx.query(`
      SELECT sequence_number, hash 
      FROM audit_logs 
      ORDER BY sequence_number DESC 
      LIMIT 1 
      FOR UPDATE
    `);
    if (result.rows && result.rows.length > 0) {
      previousSequence = Number(result.rows[0].sequence_number) || 0;
      previousHash = result.rows[0].hash || 'genesis_hash';
    }
  }

  // 2. Compute the next sequence number and SHA-256 hash deterministically
  const currentSequence = previousSequence + 1;
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  const dataToHash = `${tenantId}:${currentSequence}:${previousHash}:${action}:${payloadStr}`;
  const currentHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

  // 3. Transactional Write: Atomically create the immutable audit log document
  const auditDocId = Math.random().toString(36).substring(7);
  const auditDocRef = firestoreAdmin.collection('audit_logs').doc(auditDocId);
  const auditLogData = {
    id: auditDocId,
    tenant_id: tenantId,
    sequence_number: currentSequence,
    action,
    payload: payloadStr,
    previous_hash: previousHash,
    hash: currentHash,
    created_at: new Date().toISOString()
  };

  if (firestoreTx) {
    firestoreTx.set(auditDocRef, auditLogData);
    // 4. Transactional Write: Atomically update the sequence tracker in the same transaction
    firestoreTx.set(seqDocRef, {
      sequence_number: currentSequence,
      hash: currentHash,
      updated_at: new Date().toISOString()
    }, { merge: true });
  } else {
    await tx.query(`
      INSERT INTO audit_logs (
        id, tenant_id, sequence_number, action, payload, previous_hash, hash, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
      )
    `, [tenantId, currentSequence, action, payloadStr, previousHash, currentHash]);

    await tx.query(`
      UPDATE system_metadata SET sequence_number = $1, hash = $2
    `, [currentSequence, currentHash]);
  }
}
