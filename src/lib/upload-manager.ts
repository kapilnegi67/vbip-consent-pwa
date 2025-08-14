import { MediaChunk, UploadQueueItem } from '@/types';
import { getPendingUploads, markChunkUploaded, initOfflineDB } from './offline-db';
import { computeMD5 } from './crypto';

export class UploadManager {
  private isOnline = navigator.onLine;
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processUploadQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'BACKGROUND_SYNC') {
          this.processUploadQueue();
        }
      });
    }
  }

  async tryImmediateUpload(chunk: MediaChunk): Promise<boolean> {
    if (!this.isOnline) return false;

    try {
      const signedUrl = await this.getSignedUploadUrl(chunk);
      const success = await this.uploadChunk(chunk, signedUrl);
      
      if (success) {
        await markChunkUploaded(chunk.id, {
          etag: await computeMD5(chunk.blob),
          confirmation: `uploaded-${Date.now()}`
        });
        return true;
      }
    } catch (error) {
      console.error('Immediate upload failed:', error);
    }

    return false;
  }

  async processUploadQueue(): Promise<void> {
    if (!this.isOnline) return;

    const pendingUploads = await getPendingUploads();
    
    for (const upload of pendingUploads) {
      if (upload.retry_count >= 5) {
        continue;
      }

      try {
        await this.retryUpload(upload);
      } catch (error) {
        console.error(`Upload retry failed for ${upload.id}:`, error);
        await this.scheduleRetry(upload);
      }
    }
  }

  private async retryUpload(upload: UploadQueueItem): Promise<void> {
    const db = await initOfflineDB();
    const chunk = await db.get('mediaChunks', upload.body_ref || '');
    
    if (!chunk || chunk.uploaded) return;

    const signedUrl = await this.getSignedUploadUrl(chunk);
    const success = await this.uploadChunk(chunk, signedUrl);

    if (success) {
      await markChunkUploaded(chunk.id, {
        etag: await computeMD5(chunk.blob),
        confirmation: `uploaded-${Date.now()}`
      });
    } else {
      throw new Error('Upload failed');
    }
  }

  private async scheduleRetry(upload: UploadQueueItem): Promise<void> {
    const db = await initOfflineDB();
    const delay = Math.min(1000 * Math.pow(2, upload.retry_count), 30000);
    
    upload.retry_count++;
    await db.put('uploadQueue', upload);

    const timeoutId = setTimeout(() => {
      this.retryUpload(upload).catch(console.error);
      this.retryTimeouts.delete(upload.id);
    }, delay);

    this.retryTimeouts.set(upload.id, timeoutId);
  }

  private async getSignedUploadUrl(chunk: MediaChunk): Promise<string> {
    const response = await fetch('/api/v1/media/signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: chunk.session_id,
        media_id: chunk.media_id,
        chunk_index: chunk.index,
        checksum: chunk.checksum,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get signed URL');
    }

    const data = await response.json();
    return data.signed_url;
  }

  private async uploadChunk(chunk: MediaChunk, signedUrl: string): Promise<boolean> {
    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-MD5': await computeMD5(chunk.blob),
        },
        body: chunk.blob,
      });

      return response.ok;
    } catch (error) {
      console.error('Chunk upload failed:', error);
      return false;
    }
  }

  async reconcileAndResumeUploads(sessionId: string, mediaId: string): Promise<void> {
    try {
      const response = await fetch(`/api/v1/sessions/${sessionId}/media/${mediaId}/chunks`);
      if (!response.ok) return;

      const serverChunks = await response.json();
      const localChunks = await this.getLocalChunks(sessionId, mediaId);

      for (const localChunk of localChunks) {
        const serverChunk = serverChunks.find((sc: any) => sc.index === localChunk.index);
        
        if (serverChunk && serverChunk.checksum === localChunk.checksum) {
          await markChunkUploaded(localChunk.id, {
            etag: serverChunk.etag,
            confirmation: serverChunk.confirmation
          });
        }
      }
    } catch (error) {
      console.error('Reconciliation failed:', error);
    }
  }

  private async getLocalChunks(sessionId: string, mediaId: string): Promise<MediaChunk[]> {
    const db = await initOfflineDB();
    return db.getAllFromIndex('mediaChunks', 'session_media', [sessionId, mediaId]);
  }
}

export const uploadManager = new UploadManager();
