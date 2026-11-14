import { Tx } from '../db/client';
import { firestoreAdmin } from '../../../src/lib/firebase-admin';
import crypto from 'crypto';

export interface AuditRecordNode {
  id: string;
  tenant_id: string;
  sequence_number: number;
  action: string;
  payload: string;
  previous_hash: string;
  hash: string;
  created_at: string;
}

export interface AuditCheckpoint {
  latest_sequence: number;
  head_hash: string;
  merkle_root: string;
  record_count: number;
  verified_at: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  tampered_sequences: number[];
  errors: string[];
  checkpoint: AuditCheckpoint;
}

export function computeAuditRecordHash(
  tenantId: string,
  sequenceNumber: number,
  previousHash: string,
  action: string,
  payloadStr: string
): string {
  const dataToHash = `${tenantId}:${sequenceNumber}:${previousHash}:${action}:${payloadStr}`;
  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

export function computeAuditCheckpoint(records: AuditRecordNode[]): AuditCheckpoint {
  const sorted = [...records].sort((a, b) => a.sequence_number - b.sequence_number);
  const latest = sorted[sorted.length - 1];
  const concatenated = sorted.map(r => r.hash).join('|');
  const merkleRoot = crypto.createHash('sha256').update(concatenated || 'empty').digest('hex');
  return {
    latest_sequence: latest ? latest.sequence_number : 0,
    head_hash: latest ? latest.hash : 'genesis_hash',
    merkle_root: merkleRoot,
    record_count: sorted.length,
    verified_at: new Date().toISOString()
  };
}

/**
 * Verifies sequence continuity, previous_hash linkage, and SHA-256 hash integrity
 * across an ordered list of audit records, detecting any post-write tampering.
 */
export function verifyAuditChain(
  records: AuditRecordNode[],
  expectedCheckpoint?: Pick<AuditCheckpoint, 'latest_sequence' | 'head_hash' | 'merkle_root'>
): AuditVerificationResult {
  const sorted = [...records].sort((a, b) => a.sequence_number - b.sequence_number);
  const tampered: number[] = [];
  const errors: string[] = [];

  let expectedPrevHash = 'genesis_hash';
  let expectedSeq = sorted.length > 0 ? sorted[0].sequence_number : 0;

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];
    if (i > 0 && rec.sequence_number !== expectedSeq) {
      tampered.push(rec.sequence_number);
      errors.push(`Sequence gap/mismatch at seq ${rec.sequence_number} (expected ${expectedSeq}).`);
    }
    if (i > 0 && rec.previous_hash !== expectedPrevHash) {
      tampered.push(rec.sequence_number);
      errors.push(`Broken hash chain at seq ${rec.sequence_number}: previous_hash mismatch.`);
    }
    const recomputed = computeAuditRecordHash(
      rec.tenant_id,
      rec.sequence_number,
      rec.previous_hash,
      rec.action,
      rec.payload
    );
    if (recomputed !== rec.hash) {
      tampered.push(rec.sequence_number);
      errors.push(`Tampered audit record detected at seq ${rec.sequence_number}: SHA-256 digest mismatch.`);
    }
    expectedPrevHash = rec.hash;
    expectedSeq = rec.sequence_number + 1;
  }

  const checkpoint = computeAuditCheckpoint(sorted);
  if (expectedCheckpoint) {
    if (
      expectedCheckpoint.latest_sequence !== checkpoint.latest_sequence ||
      expectedCheckpoint.head_hash !== checkpoint.head_hash ||
      expectedCheckpoint.merkle_root !== checkpoint.merkle_root
    ) {
      errors.push('Audit checkpoint mismatch: ledger state diverges from independently recorded checkpoint.');
    }
  }

  return {
    valid: errors.length === 0 && tampered.length === 0,
    tampered_sequences: Array.from(new Set(tampered)),
    errors,
    checkpoint
  };
}

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

  const currentSequence = previousSequence + 1;
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  const currentHash = computeAuditRecordHash(tenantId, currentSequence, previousHash, action, payloadStr);

  const auditDocId = Math.random().toString(36).substring(7);
  const auditDocRef = firestoreAdmin.collection('audit_logs').doc(auditDocId);
  const auditLogData: AuditRecordNode = {
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
