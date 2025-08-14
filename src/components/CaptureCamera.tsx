'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CaptureConfig, MediaChunk } from '@/types';
import { generateSecureId, createChunkId, computeSHA256 } from '@/lib/crypto';
import { saveChunkAndEnqueue } from '@/lib/offline-db';
import { uploadManager } from '@/lib/upload-manager';

interface CaptureCameraProps {
  sessionId: string;
  config: CaptureConfig;
  onChunkReady?: (chunk: MediaChunk) => void;
  onRecordingComplete?: (mediaId: string, totalChunks: number) => void;
}

export default function CaptureCamera({
  sessionId,
  config,
  onChunkReady,
  onRecordingComplete,
}: CaptureCameraProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentMediaId, setCurrentMediaId] = useState<string>('');
  const [chunkCount, setChunkCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: config.video ? (config.videoConstraints || {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: config.lowBandwidth ? { ideal: 15 } : { ideal: 30 }
        }) : false,
        audio: config.audio ? (config.audioConstraints || {
          echoCancellation: true,
          noiseSuppression: true
        }) : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to start camera:', error);
      throw error;
    }
  }, [config]);

  const stopCamera = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  }, [mediaStream]);

  const startRecording = useCallback(async () => {
    if (!mediaStream) {
      await startCamera();
      return;
    }

    const mediaId = generateSecureId('media-');
    setCurrentMediaId(mediaId);
    setChunkCount(0);
    chunksRef.current = [];

    const mimeType = config.video 
      ? (config.lowBandwidth ? 'video/webm;codecs=vp8' : 'video/webm;codecs=vp9')
      : 'audio/webm;codecs=opus';

    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType,
      videoBitsPerSecond: config.lowBandwidth ? 500000 : 2000000,
      audioBitsPerSecond: 128000,
    });

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const chunkIndex = chunkCount;
        setChunkCount(prev => prev + 1);

        const checksum = await computeSHA256(event.data);
        const chunkId = createChunkId(sessionId, mediaId, chunkIndex);

        const chunk: MediaChunk = {
          id: chunkId,
          session_id: sessionId,
          media_id: mediaId,
          index: chunkIndex,
          blob: event.data,
          checksum,
          uploaded: false,
        };

        await saveChunkAndEnqueue(chunk);
        
        const uploadSuccess = await uploadManager.tryImmediateUpload(chunk);
        if (!uploadSuccess) {
          console.log(`Chunk ${chunkIndex} queued for background upload`);
        }

        onChunkReady?.(chunk);
      }
    };

    mediaRecorder.onstop = () => {
      onRecordingComplete?.(mediaId, chunkCount);
    };

    mediaRecorder.start(config.chunkMs);
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    if (config.maxDuration) {
      setTimeout(() => {
        stopRecording();
      }, config.maxDuration * 1000);
    }
  }, [mediaStream, sessionId, config, chunkCount, onChunkReady, onRecordingComplete, startCamera]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stopCamera]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative bg-black rounded-lg overflow-hidden">
        {config.video && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-auto"
          />
        )}
        
        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}

        {chunkCount > 0 && (
          <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full">
            <span className="text-sm">Chunks: {chunkCount}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-4">
        {!mediaStream && (
          <button
            onClick={startCamera}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Start Camera
          </button>
        )}

        {mediaStream && !isRecording && (
          <button
            onClick={startRecording}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Start Recording
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Stop Recording
          </button>
        )}

        {mediaStream && (
          <button
            onClick={stopCamera}
            className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
          >
            Stop Camera
          </button>
        )}
      </div>
    </div>
  );
}
