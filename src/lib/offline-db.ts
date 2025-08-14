import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { MediaChunk, UploadQueueItem, VBIPSession, AuditLog } from '@/types';

interface VBIPOfflineDB extends DBSchema {
  sessions: {
    key: string;
    value: VBIPSession;
    indexes: { 'by-tenant': string; 'by-state': string };
  };
  mediaChunks: {
    key: string;
    value: MediaChunk;
    indexes: { 'session_media': [string, string]; 'by-uploaded': boolean };
  };
  uploadQueue: {
    key: string;
    value: UploadQueueItem;
    indexes: { 'by-retry-count': number; 'by-created': string };
  };
  clientAudit: {
    key: string;
    value: AuditLog;
    indexes: { 'by-tenant': string; 'by-timestamp': string };
  };
}

let dbInstance: IDBPDatabase<VBIPOfflineDB> | null = null;

export async function initOfflineDB(): Promise<IDBPDatabase<VBIPOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VBIPOfflineDB>('vbip-offline', 1, {
    upgrade(db) {
      const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionsStore.createIndex('by-tenant', 'tenant_id');
      sessionsStore.createIndex('by-state', 'state');

      const chunksStore = db.createObjectStore('mediaChunks', { keyPath: 'id' });
      chunksStore.createIndex('session_media', ['session_id', 'media_id']);
      chunksStore.createIndex('by-uploaded', 'uploaded');

      const queueStore = db.createObjectStore('uploadQueue', { keyPath: 'id' });
      queueStore.createIndex('by-retry-count', 'retry_count');
      queueStore.createIndex('by-created', 'created_at');

      const auditStore = db.createObjectStore('clientAudit', { keyPath: 'id' });
      auditStore.createIndex('by-tenant', 'tenant_id');
      auditStore.createIndex('by-timestamp', 'ts');
    },
  });

  return dbInstance;
}

export async function saveSession(session: VBIPSession): Promise<void> {
  const db = await initOfflineDB();
  await db.put('sessions', session);
}

export async function getSession(sessionId: string): Promise<VBIPSession | undefined> {
  const db = await initOfflineDB();
  return db.get('sessions', sessionId);
}

export async function saveChunkAndEnqueue(chunk: MediaChunk): Promise<void> {
  const db = await initOfflineDB();
  const tx = db.transaction(['mediaChunks', 'uploadQueue'], 'readwrite');
  
  await tx.objectStore('mediaChunks').put(chunk);
  
  if (!chunk.uploaded) {
    const queueItem: UploadQueueItem = {
      id: `upload-${chunk.id}`,
      method: 'PUT',
      url: '',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-MD5': chunk.checksum,
      },
      body_ref: chunk.id,
      checksum: chunk.checksum,
      retry_count: 0,
      created_at: new Date().toISOString(),
      idempotency_key: chunk.id,
    };
    await tx.objectStore('uploadQueue').put(queueItem);
  }
  
  await tx.done;
}

export async function getChunksBySessionMedia(sessionId: string, mediaId: string): Promise<MediaChunk[]> {
  const db = await initOfflineDB();
  return db.getAllFromIndex('mediaChunks', 'session_media', [sessionId, mediaId]);
}

export async function markChunkUploaded(chunkId: string, serverAck: { etag: string; confirmation: string }): Promise<void> {
  const db = await initOfflineDB();
  const tx = db.transaction(['mediaChunks', 'uploadQueue'], 'readwrite');
  
  const chunk = await tx.objectStore('mediaChunks').get(chunkId);
  if (chunk) {
    chunk.uploaded = true;
    chunk.server_ack = serverAck;
    await tx.objectStore('mediaChunks').put(chunk);
  }
  
  await tx.objectStore('uploadQueue').delete(`upload-${chunkId}`);
  
  await tx.done;
}

export async function getPendingUploads(): Promise<UploadQueueItem[]> {
  const db = await initOfflineDB();
  return db.getAll('uploadQueue');
}

export async function addClientAudit(auditEntry: Omit<AuditLog, 'id' | 'immutable_seq'>): Promise<void> {
  const db = await initOfflineDB();
  const entry: AuditLog = {
    ...auditEntry,
    id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    immutable_seq: Date.now(),
  };
  await db.put('clientAudit', entry);
}

export async function clearUploadedChunks(sessionId: string): Promise<void> {
  const db = await initOfflineDB();
  const tx = db.transaction('mediaChunks', 'readwrite');
  const chunks = await tx.store.index('session_media').getAll(IDBKeyRange.bound([sessionId], [sessionId, '\uffff']));
  
  for (const chunk of chunks) {
    if (chunk.uploaded) {
      await tx.store.delete(chunk.id);
    }
  }
  
  await tx.done;
}
