'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { VBIPSession } from '@/types';
import { initOfflineDB } from '@/lib/offline-db';

export default function HomePage() {
  const [recentSessions, setRecentSessions] = useState<VBIPSession[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    updateOnlineStatus();

    loadRecentSessions();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const loadRecentSessions = async () => {
    try {
      const db = await initOfflineDB();
      const sessions = await db.getAll('sessions');
      const sorted = sessions
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 5);
      setRecentSessions(sorted);
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {!isOnline && (
        <div className="offline-indicator show">
          <span>You are offline. Some features may be limited.</span>
        </div>
      )}

      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          VBIP Consent PWA
        </h1>
        <p className="text-lg text-gray-600">
          Video-Based Identity Proofing consent capture and verification
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link href="/sessions/new" className="card hover:shadow-lg transition-shadow">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">New VBIP Session</h3>
            <p className="text-gray-600">Start a new consent capture session</p>
          </div>
        </Link>

        <Link href="/offline/pending" className="card hover:shadow-lg transition-shadow">
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Pending Uploads</h3>
            <p className="text-gray-600">View and manage offline uploads</p>
          </div>
        </Link>

        <Link href="/reports" className="card hover:shadow-lg transition-shadow">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Reports &amp; Audit</h3>
            <p className="text-gray-600">View compliance reports and audit trails</p>
          </div>
        </Link>
      </div>

      {recentSessions.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Session {session.id.slice(-8)}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(session.started_at).toLocaleDateString()} - {session.state}
                  </p>
                </div>
                <Link 
                  href={`/sessions/${session.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>IRDAI VBIP Compliant • Offline Ready • Secure</p>
      </div>
    </div>
  );
}
