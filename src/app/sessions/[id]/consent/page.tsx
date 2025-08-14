'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import CaptureCamera from '@/components/CaptureCamera';
import { CaptureConfig, VBIPSession } from '@/types';
import { getSession, addClientAudit } from '@/lib/offline-db';
import { computeSHA256 } from '@/lib/crypto';

const CONSENT_SCRIPT = `
I, [Customer Name], hereby provide my explicit consent for the Video-Based Identity Proofing (VBIP) process 
as per IRDAI guidelines. I understand that:

1. My video and audio will be recorded for identity verification purposes
2. Biometric data including face and voice patterns will be captured and analyzed
3. My location will be verified to ensure I am within India
4. This consent is being provided voluntarily and I can withdraw it at any time
5. The recorded data will be used solely for insurance verification purposes
6. All data will be handled in compliance with applicable privacy laws

I confirm that I am the person whose identity is being verified and that all information provided is accurate.
`;

export default function ConsentPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<VBIPSession | null>(null);
  const [consentRead, setConsentRead] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [consentMediaId, setConsentMediaId] = useState('');
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);

  const captureConfig: CaptureConfig = {
    chunkMs: 3000,
    lowBandwidth: false,
    video: true,
    audio: true,
    maxDuration: 120,
    videoConstraints: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    },
    audioConstraints: {
      echoCancellation: true,
      noiseSuppression: true
    }
  };

  useEffect(() => {
    loadSession();
    getCurrentLocation();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const session = await getSession(sessionId);
      if (!session) {
        router.push('/');
        return;
      }
      setSessionData(session);
    } catch (error) {
      console.error('Failed to load session:', error);
      router.push('/');
    }
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    }
  };

  const handleRecordingComplete = async (mediaId: string, totalChunks: number) => {
    setIsRecording(false);
    setRecordingComplete(true);
    setConsentMediaId(mediaId);

    const termsHash = await computeSHA256(new Blob([CONSENT_SCRIPT], { type: 'text/plain' }));

    await addClientAudit({
      tenant_id: sessionData?.tenant_id || 'unknown',
      actor: sessionData?.agent_id || 'unknown',
      action: 'consent_recorded',
      target: `${sessionId}:${mediaId}`,
      ts: new Date().toISOString(),
    });

    if (location) {
      await addClientAudit({
        tenant_id: sessionData?.tenant_id || 'unknown',
        actor: sessionData?.agent_id || 'unknown',
        action: 'geolocation_captured',
        target: `${sessionId}:${location.lat},${location.lon}`,
        ts: new Date().toISOString(),
      });
    }

    if (navigator.onLine) {
      try {
        await fetch(`/api/v1/sessions/${sessionId}/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            script_version: '1.0',
            terms_hash: termsHash,
            acceptance_video_ref: mediaId,
            acceptance_audio_ref: mediaId,
            location: location,
          }),
        });
      } catch (error) {
        console.log('Server unavailable, consent data saved offline');
      }
    }
  };

  const handleCompleteSession = async () => {
    await addClientAudit({
      tenant_id: sessionData?.tenant_id || 'unknown',
      actor: sessionData?.agent_id || 'unknown',
      action: 'session_completed',
      target: sessionId,
      ts: new Date().toISOString(),
    });

    router.push(`/sessions/${sessionId}/complete`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">Consent Capture</h1>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">VBIP Consent Declaration</h2>
          <div className="bg-gray-50 p-4 rounded-lg mb-4 max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-800">
              {CONSENT_SCRIPT}
            </pre>
          </div>
          
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={consentRead}
              onChange={(e) => setConsentRead(e.target.checked)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">
              I have read and understood the consent declaration above
            </span>
          </label>
        </div>

        {location && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">Location Verified</h3>
            <p className="text-sm text-green-800">
              Location captured: {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
            </p>
          </div>
        )}

        {!recordingComplete && consentRead && (
          <div className="mb-6">
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-medium text-blue-900 mb-2">Record Your Consent</h3>
              <p className="text-blue-800">
                Please read the consent declaration aloud while looking at the camera.
                This will create an audio-visual record of your consent.
              </p>
            </div>

            <CaptureCamera
              sessionId={sessionId}
              config={captureConfig}
              onRecordingComplete={handleRecordingComplete}
            />

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Recording will automatically stop after 2 minutes or you can stop it manually.
              </p>
            </div>
          </div>
        )}

        {recordingComplete && (
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-900 mb-2">
              Consent Successfully Recorded
            </h2>
            <p className="text-green-700 mb-4">
              Your video and audio consent has been captured and will be processed for verification.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/')}
            className="btn-secondary"
          >
            Cancel Session
          </button>
          {recordingComplete && (
            <button
              onClick={handleCompleteSession}
              className="btn-primary"
            >
              Complete Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
