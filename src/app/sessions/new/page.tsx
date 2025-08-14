'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateSecureId } from '@/lib/crypto';
import { saveSession, addClientAudit } from '@/lib/offline-db';
import { VBIPSession } from '@/types';

export default function NewSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: 'demo-tenant',
    customer_id: '',
    agent_id: 'demo-agent',
    customer_name: '',
    customer_contact: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sessionId = generateSecureId('session-');
      const customerId = formData.customer_id || generateSecureId('customer-');

      const session: VBIPSession = {
        id: sessionId,
        tenant_id: formData.tenant_id,
        customer_id: customerId,
        agent_id: formData.agent_id,
        state: 'started',
        started_at: new Date().toISOString(),
      };

      await saveSession(session);

      await addClientAudit({
        tenant_id: formData.tenant_id,
        actor: formData.agent_id,
        action: 'session_created',
        target: sessionId,
        ts: new Date().toISOString(),
      });

      if (navigator.onLine) {
        try {
          const response = await fetch('/api/v1/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tenant_id: formData.tenant_id,
              customer_id: customerId,
              agent_id: formData.agent_id,
            }),
          });

          if (response.ok) {
            console.log('Session created on server');
          }
        } catch (error) {
          console.log('Server unavailable, session saved offline');
        }
      }

      router.push(`/sessions/${sessionId}/liveness`);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">Create New VBIP Session</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              id="customer_name"
              required
              className="input"
              value={formData.customer_name}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Enter customer full name"
            />
          </div>

          <div>
            <label htmlFor="customer_contact" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Contact *
            </label>
            <input
              type="tel"
              id="customer_contact"
              required
              className="input"
              value={formData.customer_contact}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_contact: e.target.value }))}
              placeholder="Enter mobile number"
            />
          </div>

          <div>
            <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 mb-2">
              Customer ID (Optional)
            </label>
            <input
              type="text"
              id="customer_id"
              className="input"
              value={formData.customer_id}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
              placeholder="Leave blank to auto-generate"
            />
          </div>

          <div>
            <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-700 mb-2">
              Tenant ID
            </label>
            <input
              type="text"
              id="tenant_id"
              className="input"
              value={formData.tenant_id}
              onChange={(e) => setFormData(prev => ({ ...prev, tenant_id: e.target.value }))}
              placeholder="Tenant identifier"
            />
          </div>

          <div>
            <label htmlFor="agent_id" className="block text-sm font-medium text-gray-700 mb-2">
              Agent ID
            </label>
            <input
              type="text"
              id="agent_id"
              className="input"
              value={formData.agent_id}
              onChange={(e) => setFormData(prev => ({ ...prev, agent_id: e.target.value }))}
              placeholder="Agent identifier"
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">VBIP Process Overview</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Liveness Detection &amp; Verification</li>
              <li>2. Video &amp; Audio Consent Capture</li>
              <li>3. Biometric Verification (Face &amp; Voice)</li>
              <li>4. Geolocation Validation</li>
              <li>5. Audit Trail Generation</li>
            </ol>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Start VBIP Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
