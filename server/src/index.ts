import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

interface Session {
  id: string;
  tenant_id: string;
  customer_id: string;
  agent_id: string;
  state: string;
  started_at: string;
  ended_at?: string;
}

interface MediaChunk {
  session_id: string;
  media_id: string;
  index: number;
  checksum: string;
  etag: string;
  uploaded_at: string;
}

interface AuditEntry {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  target: string;
  ts: string;
  immutable_seq: number;
}

const sessions = new Map<string, Session>();
const mediaChunks = new Map<string, MediaChunk[]>();
const auditLog: AuditEntry[] = [];
let auditSequence = 1;

function addAuditEntry(tenant_id: string, actor: string, action: string, target: string) {
  const entry: AuditEntry = {
    id: uuidv4(),
    tenant_id,
    actor,
    action,
    target,
    ts: new Date().toISOString(),
    immutable_seq: auditSequence++,
  };
  auditLog.push(entry);
  return entry;
}

app.post('/api/v1/sessions', (req, res) => {
  try {
    const { tenant_id, customer_id, agent_id } = req.body;
    
    if (!tenant_id || !customer_id || !agent_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const sessionId = uuidv4();
    const session: Session = {
      id: sessionId,
      tenant_id,
      customer_id,
      agent_id,
      state: 'started',
      started_at: new Date().toISOString(),
    };

    sessions.set(sessionId, session);
    addAuditEntry(tenant_id, agent_id, 'session_created', sessionId);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.post('/api/v1/sessions/:id/liveness', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { challenge_type, media_id, total_chunks } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    session.state = 'liveness_completed';
    sessions.set(sessionId, session);

    addAuditEntry(
      session.tenant_id,
      session.agent_id,
      'liveness_completed',
      `${sessionId}:${challenge_type}`
    );

    res.json({
      success: true,
      message: 'Liveness challenge completed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.post('/api/v1/media/signed-url', (req, res) => {
  try {
    const { session_id, media_id, chunk_index, checksum } = req.body;

    const signedUrl = `https://storage.example.com/upload/${session_id}/${media_id}/${chunk_index}?signature=${crypto.randomBytes(16).toString('hex')}`;

    res.json({
      success: true,
      signed_url: signedUrl,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.get('/api/v1/sessions/:id/media/:mediaId/chunks', (req, res) => {
  try {
    const { id: sessionId, mediaId } = req.params;
    const key = `${sessionId}:${mediaId}`;
    const chunks = mediaChunks.get(key) || [];

    res.json({
      success: true,
      data: chunks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.post('/api/v1/sessions/:id/consent', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { script_version, terms_hash, acceptance_video_ref, acceptance_audio_ref, location } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    session.state = 'consent_captured';
    sessions.set(sessionId, session);

    addAuditEntry(
      session.tenant_id,
      session.agent_id,
      'consent_captured',
      `${sessionId}:${terms_hash}`
    );

    if (location) {
      addAuditEntry(
        session.tenant_id,
        session.agent_id,
        'geolocation_captured',
        `${sessionId}:${location.lat},${location.lon}`
      );
    }

    res.json({
      success: true,
      message: 'Consent captured successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.get('/api/v1/sessions/:id/audit', (req, res) => {
  try {
    const sessionId = req.params.id;
    const sessionAudit = auditLog.filter(entry => entry.target.includes(sessionId));

    res.json({
      success: true,
      data: sessionAudit,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.get('/api/v1/reports/irdai', (req, res) => {
  try {
    const { tenant_id, start_date, end_date } = req.query;

    let filteredSessions = Array.from(sessions.values());
    let filteredAudit = [...auditLog];

    if (tenant_id && tenant_id !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.tenant_id === tenant_id);
      filteredAudit = filteredAudit.filter(a => a.tenant_id === tenant_id);
    }

    if (start_date && end_date) {
      const start = new Date(start_date as string);
      const end = new Date(end_date as string);
      
      filteredSessions = filteredSessions.filter(s => {
        const sessionDate = new Date(s.started_at);
        return sessionDate >= start && sessionDate <= end;
      });

      filteredAudit = filteredAudit.filter(a => {
        const auditDate = new Date(a.ts);
        return auditDate >= start && auditDate <= end;
      });
    }

    const report = {
      generated_at: new Date().toISOString(),
      tenant_id: tenant_id || 'all',
      date_range: { start_date, end_date },
      sessions: filteredSessions,
      audit_trail: filteredAudit,
      compliance_summary: {
        total_sessions: filteredSessions.length,
        completed_sessions: filteredSessions.filter(s => s.state === 'completed').length,
        failed_sessions: filteredSessions.filter(s => s.state === 'failed').length,
        audit_entries: filteredAudit.length,
      },
    };

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.post('/api/v1/push/subscribe', (req, res) => {
  try {
    const subscription = req.body;
    console.log('Push subscription received:', subscription);

    res.json({
      success: true,
      message: 'Push subscription saved',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.post('/api/v1/push/unsubscribe', (req, res) => {
  try {
    const subscription = req.body;
    console.log('Push unsubscription received:', subscription);

    res.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.get('/api/v1/config/pwa', (req, res) => {
  res.json({
    success: true,
    data: {
      features: {
        offlineMode: true,
        backgroundSync: true,
        pushNotifications: true,
        biometricCapture: true,
      },
      capture: {
        defaultChunkMs: 3000,
        maxFileSize: 100 * 1024 * 1024,
        supportedFormats: ['video/webm', 'audio/webm'],
      },
      upload: {
        maxRetries: 5,
        retryDelayMs: 1000,
        chunkSize: 1024 * 1024,
      },
    },
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.listen(PORT, () => {
  console.log(`VBIP Consent Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
