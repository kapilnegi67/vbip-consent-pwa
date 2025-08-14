'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSession, addClientAudit } from '@/lib/offline-db';
import { VBIPSession } from '@/types';

export default function SessionCompletePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<VBIPSession | null>(null);
  const [loading, setLoading] = useState(true);

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
      
      session.state = 'completed';
      session.ended_at = new Date().toISOString();
      
      await addClientAudit({
        tenant_id: session.tenant_id,
        actor: session.agent_id,
        action: 'session_completed',
        target: sessionId,
        ts: new Date().toISOString(),
      });

      setSessionData(session);
    } catch (error) {
      console.error('Failed to load session:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Processing session completion...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <h1 className="text-xl font-semibold text-red-600 mb-4">Session Not Found</h1>
          <Link href="/" className="btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-green-900 mb-4">
          VBIP Session Complete
        </h1>

        <p className="text-lg text-gray-700 mb-6">
          Your Video-Based Identity Proofing session has been successfully completed and recorded.
        </p>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Session Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Session ID:</span>
              <span className="font-mono">{sessionData.id.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Customer ID:</span>
              <span className="font-mono">{sessionData.customer_id.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Started:</span>
              <span>{new Date(sessionData.started_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed:</span>
              <span>{sessionData.ended_at ? new Date(sessionData.ended_at).toLocaleString() : 'Just now'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                {sessionData.state}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium text-blue-900 mb-2">What Happens Next?</h3>
          <ul className="text-sm text-blue-800 space-y-1 text-left">
            <li>• Your consent recording will be processed for biometric verification</li>
            <li>• Face and voice matching will be performed against official records</li>
            <li>• Location validation will confirm India presence during consent</li>
            <li>• All data will be encrypted and stored securely for audit purposes</li>
            <li>• You will be notified once verification is complete</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
          <h3 className="font-medium text-yellow-900 mb-2">Important Notes</h3>
          <ul className="text-sm text-yellow-800 space-y-1 text-left">
            <li>• This session is now immutable and cannot be modified</li>
            <li>• All actions have been logged for regulatory compliance</li>
            <li>• Your data is protected according to privacy regulations</li>
            <li>• Contact support if you have any questions about this session</li>
          </ul>
        </div>

        <div className="flex gap-4">
          <Link href="/" className="btn-primary flex-1">
            Return to Dashboard
          </Link>
          <Link href={`/sessions/${sessionId}/audit`} className="btn-secondary flex-1">
            View Audit Trail
          </Link>
        </div>
      </div>
    </div>
  );
}
