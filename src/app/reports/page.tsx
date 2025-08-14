'use client';

import React, { useState, useEffect } from 'react';
import { AuditLog, VBIPSession } from '@/types';
import { initOfflineDB } from '@/lib/offline-db';

export default function ReportsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<VBIPSession[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [selectedTenant, dateRange]);

  const loadData = async () => {
    try {
      const db = await initOfflineDB();
      
      let logs = await db.getAll('clientAudit');
      let sessionData = await db.getAll('sessions');

      if (selectedTenant !== 'all') {
        logs = logs.filter(log => log.tenant_id === selectedTenant);
        sessionData = sessionData.filter(session => session.tenant_id === selectedTenant);
      }

      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      logs = logs.filter(log => {
        const logDate = new Date(log.ts);
        return logDate >= startDate && logDate <= endDate;
      });

      sessionData = sessionData.filter(session => {
        const sessionDate = new Date(session.started_at);
        return sessionDate >= startDate && sessionDate <= endDate;
      });

      logs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      sessionData.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      setAuditLogs(logs);
      setSessions(sessionData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const generateIRDAIReport = async () => {
    try {
      const reportData = {
        generated_at: new Date().toISOString(),
        tenant_id: selectedTenant,
        date_range: dateRange,
        sessions: sessions.map(session => ({
          id: session.id,
          state: session.state,
          started_at: session.started_at,
          ended_at: session.ended_at,
          customer_id: session.customer_id,
        })),
        audit_trail: auditLogs.map(log => ({
          action: log.action,
          actor: log.actor,
          target: log.target,
          timestamp: log.ts,
          sequence: log.immutable_seq,
        })),
        compliance_summary: {
          total_sessions: sessions.length,
          completed_sessions: sessions.filter(s => s.state === 'completed').length,
          failed_sessions: sessions.filter(s => s.state === 'failed').length,
          audit_entries: auditLogs.length,
        }
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `irdai-vbip-report-${dateRange.start}-to-${dateRange.end}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const tenants = Array.from(new Set(sessions.map(s => s.tenant_id)));

  const sessionStats = {
    total: sessions.length,
    completed: sessions.filter(s => s.state === 'completed').length,
    pending: sessions.filter(s => ['started', 'liveness_pending', 'consent_pending', 'verification_pending'].includes(s.state)).length,
    failed: sessions.filter(s => s.state === 'failed').length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Reports &amp; Audit Trail</h1>
          <button
            onClick={generateIRDAIReport}
            className="btn-primary"
          >
            Generate IRDAI Report
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900">Total Sessions</h3>
            <p className="text-2xl font-bold text-blue-600">{sessionStats.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900">Completed</h3>
            <p className="text-2xl font-bold text-green-600">{sessionStats.completed}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium text-yellow-900">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600">{sessionStats.pending}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-medium text-red-900">Failed</h3>
            <p className="text-2xl font-bold text-red-600">{sessionStats.failed}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="input w-48"
            >
              <option value="all">All Tenants</option>
              {tenants.map(tenant => (
                <option key={tenant} value={tenant}>{tenant}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="input"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sessions.slice(0, 20).map((session) => (
                <div key={session.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Session {session.id.slice(-8)}</p>
                      <p className="text-sm text-gray-600">
                        Customer: {session.customer_id.slice(-8)} | Agent: {session.agent_id.slice(-8)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.started_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        session.state === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : session.state === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {session.state}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.slice(0, 50).map((log) => (
                <div key={log.id} className="border border-gray-200 rounded p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-gray-500">#{log.immutable_seq}</span>
                  </div>
                  <p className="text-gray-600">
                    Actor: {log.actor} | Target: {log.target.slice(0, 20)}...
                  </p>
                  <p className="text-gray-500">
                    {new Date(log.ts).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">IRDAI Compliance Notes</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• All audit entries are immutable and sequentially numbered</li>
            <li>• Video and audio consent recordings are integrity-protected with checksums</li>
            <li>• Geolocation validation ensures India presence during consent capture</li>
            <li>• Biometric verification includes liveness detection and face/voice matching</li>
            <li>• All PII data is masked and encrypted in compliance with privacy regulations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
