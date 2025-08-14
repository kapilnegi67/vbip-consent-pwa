'use client';

import React, { useState, useEffect } from 'react';
import { UploadQueueItem, MediaChunk } from '@/types';
import { getPendingUploads, initOfflineDB } from '@/lib/offline-db';
import { uploadManager } from '@/lib/upload-manager';

export default function PendingUploadsPage() {
  const [pendingUploads, setPendingUploads] = useState<UploadQueueItem[]>([]);
  const [pendingChunks, setPendingChunks] = useState<MediaChunk[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    loadPendingData();

    const interval = setInterval(loadPendingData, 5000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  const loadPendingData = async () => {
    try {
      const uploads = await getPendingUploads();
      setPendingUploads(uploads);

      const db = await initOfflineDB();
      const chunks = await db.getAllFromIndex('mediaChunks', 'by-uploaded', false);
      setPendingChunks(chunks);
    } catch (error) {
      console.error('Failed to load pending data:', error);
    }
  };

  const handleRetryUploads = async () => {
    if (!isOnline) {
      alert('Cannot retry uploads while offline');
      return;
    }

    setProcessing(true);
    try {
      await uploadManager.processUploadQueue();
      await loadPendingData();
    } catch (error) {
      console.error('Failed to retry uploads:', error);
    } finally {
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalPendingSize = pendingChunks.reduce((total, chunk) => total + chunk.blob.size, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Pending Uploads</h1>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {isOnline && pendingUploads.length > 0 && (
              <button
                onClick={handleRetryUploads}
                disabled={processing}
                className="btn-primary"
              >
                {processing ? 'Processing...' : 'Retry All'}
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900">Pending Uploads</h3>
            <p className="text-2xl font-bold text-blue-600">{pendingUploads.length}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium text-yellow-900">Pending Chunks</h3>
            <p className="text-2xl font-bold text-yellow-600">{pendingChunks.length}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-900">Total Size</h3>
            <p className="text-2xl font-bold text-purple-600">{formatFileSize(totalPendingSize)}</p>
          </div>
        </div>

        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-medium text-yellow-800">Offline Mode</span>
            </div>
            <p className="text-yellow-700 mt-1">
              Uploads will automatically resume when you&apos;re back online.
            </p>
          </div>
        )}

        {pendingUploads.length === 0 && pendingChunks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h2>
            <p className="text-gray-600">No pending uploads at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Upload Queue</h2>
            {pendingUploads.map((upload) => (
              <div key={upload.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Upload {upload.id.slice(-8)}</p>
                    <p className="text-sm text-gray-600">
                      Method: {upload.method} | Retries: {upload.retry_count}
                    </p>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(upload.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      upload.retry_count === 0 
                        ? 'bg-blue-100 text-blue-800'
                        : upload.retry_count < 3
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {upload.retry_count === 0 ? 'Pending' : `Retry ${upload.retry_count}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {pendingChunks.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mt-6">Media Chunks</h2>
                {pendingChunks.slice(0, 10).map((chunk) => (
                  <div key={chunk.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Chunk {chunk.index}</p>
                        <p className="text-sm text-gray-600">
                          Session: {chunk.session_id.slice(-8)} | Media: {chunk.media_id.slice(-8)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Size: {formatFileSize(chunk.blob.size)} | Checksum: {chunk.checksum.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="inline-block px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          Not Uploaded
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingChunks.length > 10 && (
                  <p className="text-sm text-gray-500 text-center">
                    ... and {pendingChunks.length - 10} more chunks
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
