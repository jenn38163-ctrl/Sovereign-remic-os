import { firestoreAdmin } from '../../../src/lib/firebase-admin';

export interface Tx {
  query: (text: string, params?: any[]) => Promise<any>;
  rawTransaction: any;
}

export interface DbClient {
  query: (text: string, params?: any[]) => Promise<any>;
  transaction: <T>(callback: (tx: Tx) => Promise<T>) => Promise<T>;
}

export const db: DbClient = {
  query: async (text: string, params?: any[]) => {
    return await executeQueryWithTx(null, text, params);
  },

  /**
   * Real authoritative atomic database transaction using Firestore runTransaction.
   */
  transaction: async <T>(callback: (tx: Tx) => Promise<T>): Promise<T> => {
    return await firestoreAdmin.runTransaction(async (firestoreTx) => {
      const tx: Tx = {
        rawTransaction: firestoreTx,
        query: async (text: string, params?: any[]) => {
          return await executeQueryWithTx(firestoreTx, text, params);
        }
      };
      return await callback(tx);
    });
  }
};

async function executeQueryWithTx(firestoreTx: any, text: string, params?: any[]) {
  // 1. Journal Entry Insertion (Balanced Double Entry)
  if (text.includes('INSERT INTO journal_entries')) {
    const entry = {
      id: Math.random().toString(36).substring(7),
      tenant_id: params?.[0],
      intent_id: params?.[1],
      wallet_id: params?.[2],
      amount: String(params?.[3]),
      type: params?.[4],
      created_at: new Date().toISOString()
    };

    const docRef = firestoreAdmin.collection('journal_entries').doc(entry.id);
    if (firestoreTx) {
      firestoreTx.set(docRef, entry);
    } else {
      await docRef.set(entry);
    }
    return { rows: [entry] };
  }

  // 2. Audit Log Insertion
  if (text.includes('INSERT INTO audit_logs')) {
    const log = {
      id: Math.random().toString(36).substring(7),
      tenant_id: params?.[0] || 'system',
      sequence_number: Number(params?.[1]),
      action: params?.[2],
      payload: typeof params?.[3] === 'object' ? JSON.stringify(params?.[3]) : String(params?.[3]),
      previous_hash: params?.[4],
      hash: params?.[5],
      created_at: new Date().toISOString()
    };

    const docRef = firestoreAdmin.collection('audit_logs').doc(log.id);
    if (firestoreTx) {
      firestoreTx.set(docRef, log);
    } else {
      await docRef.set(log);
    }
    return { rows: [log] };
  }

  // 3. Query Audit Sequence
  if (text.includes('SELECT sequence_number, hash FROM audit_logs')) {
    const seqDocRef = firestoreAdmin.collection('system_metadata').doc('audit_sequence');
    const snap = firestoreTx ? await firestoreTx.get(seqDocRef) : await seqDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      return { rows: [{ sequence_number: data.sequence_number, hash: data.hash }] };
    }
    return { rows: [] };
  }

  // 4. Update Audit Sequence Tracker
  if (text.includes('UPDATE system_metadata SET sequence_number')) {
    const seq = params?.[0];
    const hash = params?.[1];
    const seqDocRef = firestoreAdmin.collection('system_metadata').doc('audit_sequence');
    const updateData = { sequence_number: seq, hash, updated_at: new Date().toISOString() };
    
    if (firestoreTx) {
      firestoreTx.set(seqDocRef, updateData, { merge: true });
    } else {
      await seqDocRef.set(updateData, { merge: true });
    }
    return { rows: [] };
  }

  // 5. Update Settlement Intent State
  if (text.includes('UPDATE settlement_intents SET state')) {
    const state = params?.[0];
    const id = params?.[1];

    if (id) {
      const docRef = firestoreAdmin.collection('settlement_intents').doc(id);
      const updateData = { state, updated_at: new Date().toISOString() };
      if (firestoreTx) {
        firestoreTx.set(docRef, updateData, { merge: true });
      } else {
        await docRef.set(updateData, { merge: true });
      }
    }
    return { rows: [] };
  }

  // 6. Idempotency Keys Lookup & Insertion
  if (text.includes('SELECT * FROM idempotency_keys')) {
    const key = params?.[0];
    const docRef = firestoreAdmin.collection('idempotency_keys').doc(key);
    const snap = firestoreTx ? await firestoreTx.get(docRef) : await docRef.get();
    if (snap.exists) {
      return { rows: [snap.data()] };
    }
    return { rows: [] };
  }

  if (text.includes('INSERT INTO idempotency_keys')) {
    const key = params?.[0];
    const fingerprint = params?.[1];
    const record = { key, fingerprint, state: 'PROCESSING', created_at: new Date().toISOString() };
    const docRef = firestoreAdmin.collection('idempotency_keys').doc(key);
    if (firestoreTx) {
      firestoreTx.set(docRef, record);
    } else {
      await docRef.set(record);
    }
    return { rows: [record] };
  }

  // 7. CARS Outbox Insert
  if (text.includes('INSERT INTO cars_outbox')) {
    const outboxRecord = {
      id: Math.random().toString(36).substring(7),
      tenant_id: params?.[0],
      intent_id: params?.[1],
      state: 'PENDING',
      payload: typeof params?.[2] === 'object' ? JSON.stringify(params?.[2]) : String(params?.[2]),
      retry_count: 0,
      next_attempt_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const docRef = firestoreAdmin.collection('cars_outbox').doc(outboxRecord.id);
    if (firestoreTx) {
      firestoreTx.set(docRef, outboxRecord);
    } else {
      await docRef.set(outboxRecord);
    }
    return { rows: [outboxRecord] };
  }

  return { rows: [] };
}
