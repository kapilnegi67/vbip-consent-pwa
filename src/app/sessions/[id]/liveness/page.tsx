'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import CaptureCamera from '@/components/CaptureCamera';
import { CaptureConfig } from '@/types';
import { getSession, addClientAudit } from '@/lib/offline-db';

const LIVENESS_CHALLENGES = [
  { type: 'blink', instruction: 'Please blink your eyes naturally' },
  { type: 'smile', instruction: 'Please smile for the camera' },
  { type: 'turn_head', instruction: 'Please turn your head left, then right' },
];

export default function LivenessPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [challengeCompleted, setChallengeCompleted] = useState<boolean[]>([false, false, false]);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionData, setSessionData] = useState(null);

  const captureConfig: CaptureConfig = {
    chunkMs: 3000,
    lowBandwidth: false,
    video: true,
    audio: false,
    maxDuration: 10,
    videoConstraints: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  };

  useEffect(() => {
    loadSession();
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

  const handleChallengeComplete = async () => {
    const newCompleted = [...challengeCompleted];
    newCompleted[currentChallenge] = true;
    setChallengeCompleted(newCompleted);

    await addClientAudit({
      tenant_id: sessionData?.tenant_id || 'unknown',
      actor: sessionData?.agent_id || 'unknown',
      action: 'liveness_challenge_completed',
      target: `${sessionId}:${LIVENESS_CHALLENGES[currentChallenge].type}`,
      ts: new Date().toISOString(),
    });

    if (currentChallenge < LIVENESS_CHALLENGES.length - 1) {
      setCurrentChallenge(prev => prev + 1);
    } else {
      setTimeout(() => {
        router.push(`/sessions/${sessionId}/consent`);
      }, 2000);
    }
  };

  const handleRecordingComplete = async (mediaId: string, totalChunks: number) => {
    setIsRecording(false);
    
    if (navigator.onLine) {
      try {
        await fetch(`/api/v1/sessions/${sessionId}/liveness`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challenge_type: LIVENESS_CHALLENGES[currentChallenge].type,
            media_id: mediaId,
            total_chunks: totalChunks,
          }),
        });
      } catch (error) {
        console.log('Server unavailable, liveness data saved offline');
      }
    }

    handleChallengeComplete();
  };

  const allChallengesCompleted = challengeCompleted.every(Boolean);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">Liveness Detection</h1>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            {LIVENESS_CHALLENGES.map((challenge, index) => (
              <div
                key={index}
                className={`flex items-center ${
                  index < LIVENESS_CHALLENGES.length - 1 ? 'flex-1' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    challengeCompleted[index]
                      ? 'bg-green-500 text-white'
                      : index === currentChallenge
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {challengeCompleted[index] ? '✓' : index + 1}
                </div>
                {index < LIVENESS_CHALLENGES.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      challengeCompleted[index] ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {!allChallengesCompleted && (
          <div className="mb-6">
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-medium text-blue-900 mb-2">
                Challenge {currentChallenge + 1}: {LIVENESS_CHALLENGES[currentChallenge].type}
              </h3>
              <p className="text-blue-800">
                {LIVENESS_CHALLENGES[currentChallenge].instruction}
              </p>
            </div>

            <CaptureCamera
              sessionId={sessionId}
              config={captureConfig}
              onRecordingComplete={handleRecordingComplete}
            />

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Complete the liveness challenge by following the instruction above.
                Recording will automatically stop after 10 seconds.
              </p>
            </div>
          </div>
        )}

        {allChallengesCompleted && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-900 mb-2">
              Liveness Detection Complete
            </h2>
            <p className="text-green-700 mb-4">
              All liveness challenges have been successfully completed.
            </p>
            <p className="text-sm text-gray-600">
              Proceeding to consent capture...
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.push('/')}
            className="btn-secondary"
          >
            Cancel Session
          </button>
          {allChallengesCompleted && (
            <button
              onClick={() => router.push(`/sessions/${sessionId}/consent`)}
              className="btn-primary"
            >
              Continue to Consent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
