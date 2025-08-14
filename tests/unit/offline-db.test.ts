import { initOfflineDB, saveSession, getSession, saveChunkAndEnqueue } from '@/lib/offline-db';
import { VBIPSession, MediaChunk } from '@/types';

describe('Offline Database', () => {
  beforeEach(async () => {
    const db = await initOfflineDB();
    await db.clear('sessions');
    await db.clear('mediaChunks');
    await db.clear('uploadQueue');
    await db.clear('clientAudit');
  });

  test('saves and retrieves session', async () => {
    const session: VBIPSession = {
      id: 'test-session',
      tenant_id: 'test-tenant',
      customer_id: 'test-customer',
      agent_id: 'test-agent',
      state: 'started',
      started_at: new Date().toISOString(),
    };

    await saveSession(session);
    const retrieved = await getSession('test-session');
    
    expect(retrieved).toEqual(session);
  });

  test('saves chunk and creates upload queue item', async () => {
    const chunk: MediaChunk = {
      id: 'test-chunk',
      session_id: 'test-session',
      media_id: 'test-media',
      index: 0,
      blob: new Blob(['test'], { type: 'text/plain' }),
      checksum: 'test-checksum',
      uploaded: false,
    };

    await saveChunkAndEnqueue(chunk);
    
    const db = await initOfflineDB();
    const savedChunk = await db.get('mediaChunks', 'test-chunk');
    const queueItem = await db.get('uploadQueue', 'upload-test-chunk');
    
    expect(savedChunk).toBeTruthy();
    expect(queueItem).toBeTruthy();
    expect(queueItem?.body_ref).toBe('test-chunk');
  });
});
